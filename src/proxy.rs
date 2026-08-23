//! Authenticated GET/POST proxy into governed services.
//!
//! The hub injects the per-service bearer token server-side, so browser
//! clients never hold service credentials. Path traversal is rejected.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde_json::json;

use crate::{auth, AppState};

async fn require_admin(
    state: &AppState,
    headers: &axum::http::HeaderMap,
) -> Result<auth::HubUser, (StatusCode, axum::Json<serde_json::Value>)> {
    let sid = crate::console::cookie_value_pub(headers, auth::SESSION_COOKIE).unwrap_or_default();
    let user = state.sessions.get(&sid).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            axum::Json(json!({"error": "login required"})),
        )
    })?;
    if !user.is_admin {
        return Err((
            StatusCode::FORBIDDEN,
            axum::Json(json!({"error": "admin required"})),
        ));
    }
    Ok(user)
}

pub fn validate(
    service: &str,
    path: &str,
) -> Result<(), (StatusCode, axum::Json<serde_json::Value>)> {
    if !state_has_service(service) {
        return Err((
            StatusCode::NOT_FOUND,
            axum::Json(json!({"error": format!("unknown service '{service}'")})),
        ));
    }
    if path.split('/').any(|seg| seg == ".." || seg.contains('\\')) {
        return Err((
            StatusCode::BAD_REQUEST,
            axum::Json(json!({"error": "invalid path"})),
        ));
    }
    Ok(())
}

fn state_has_service(service: &str) -> bool {
    // Cheap compile-time-known registry; config presence checked at proxy time.
    matches!(
        service,
        "hive" | "patroclus" | "relay" | "miser" | "sentiel" | "aegis" | "forge"
    )
}

async fn forward(
    State(state): State<AppState>,
    Path((service, rest)): Path<(String, String)>,
    method: axum::http::Method,
    body: Option<axum::body::Bytes>,
    caller_auth: Option<String>,
    query: Option<String>,
) -> Result<axum::response::Response, (StatusCode, axum::Json<serde_json::Value>)> {
    validate(&service, &rest)?;

    let Some(cfg) = state.config.services.get(&service).cloned() else {
        return Err((
            StatusCode::NOT_FOUND,
            axum::Json(json!({"error": format!("unknown service '{service}'")})),
        ));
    };

    let mut url = format!(
        "{}/{}",
        cfg.url.trim_end_matches('/'),
        rest.trim_start_matches('/')
    );
    if let Some(q) = query {
        url.push('?');
        url.push_str(&q);
    }

    let mut req = match method {
        axum::http::Method::POST => state.client.post(&url),
        axum::http::Method::PUT => state.client.put(&url),
        axum::http::Method::PATCH => state.client.patch(&url),
        axum::http::Method::DELETE => state.client.delete(&url),
        _ => state.client.get(&url),
    };
    // Prefer the configured service token; otherwise pass through the
    // caller's own Authorization (e.g. a Hive JWT arriving via the console).
    match &cfg.api_token {
        Some(token) => {
            req = req.bearer_auth(token);
        }
        None => {
            if let Some(auth) = caller_auth {
                req = req.header("authorization", auth);
            }
        }
    }
    if let Some(bytes) = body {
        req = req.header("content-type", "application/json").body(bytes);
    }

    let started = std::time::Instant::now();
    let resp = req.send().await.map_err(|e| {
        (
            StatusCode::BAD_GATEWAY,
            axum::Json(json!({"error": format!("{service} unreachable: {e}")})),
        )
    })?;

    let status =
        StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    let headers = resp.headers().clone();
    let bytes = resp.bytes().await.map_err(|_| {
        (
            StatusCode::BAD_GATEWAY,
            axum::Json(json!({"error": "upstream read failed"})),
        )
    })?;
    tracing::debug!(service = %service, path = %rest, ms = started.elapsed().as_millis() as u64, "proxied");

    let mut out = (status, bytes).into_response();
    if let Some(ct) = headers.get("content-type") {
        if let Ok(v) = ct.to_str() {
            out.headers_mut().insert("content-type", v.parse().unwrap());
        }
    }
    Ok(out)
}

pub async fn proxy_get(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    path: Path<(String, String)>,
    Query(query): Query<Vec<(String, String)>>,
) -> impl IntoResponse {
    if let Err(error) = require_admin(&state, &headers).await {
        return error.into_response();
    }
    let caller_auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .map(String::from);
    let qs = query
        .iter()
        .map(|(k, v)| format!("{k}={}", urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&");
    let qs = (!qs.is_empty()).then_some(qs);
    forward(
        State(state),
        path,
        axum::http::Method::GET,
        None,
        caller_auth,
        qs,
    )
    .await
    .into_response()
}

#[axum::debug_handler]
pub async fn proxy_method(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    method: axum::http::Method,
    path: Path<(String, String)>,
    Query(query): Query<Vec<(String, String)>>,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    if let Err(error) = require_admin(&state, &headers).await {
        return error.into_response();
    }
    let body = if body.is_empty() { None } else { Some(body) };
    let caller_auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .map(String::from);
    let qs = query
        .iter()
        .map(|(k, v)| format!("{k}={}", urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&");
    let qs = (!qs.is_empty()).then_some(qs);
    match forward(State(state), path, method, body, caller_auth, qs).await {
        Ok(response) => response,
        Err(error) => error.into_response(),
    }
}
