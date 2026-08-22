//! Authenticated GET/POST proxy into governed services.
//!
//! The hub injects the per-service bearer token server-side, so browser
//! clients never hold service credentials. Path traversal is rejected.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde_json::json;

use crate::AppState;

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
        "hive" | "patroclus" | "relay" | "miser" | "sentiel" | "aegis"
    )
}

async fn forward(
    State(state): State<AppState>,
    Path((service, rest)): Path<(String, String)>,
    method: axum::http::Method,
    body: Option<axum::body::Bytes>,
) -> Result<axum::response::Response, (StatusCode, axum::Json<serde_json::Value>)> {
    validate(&service, &rest)?;

    let Some(cfg) = state.config.services.get(&service).cloned() else {
        return Err((
            StatusCode::NOT_FOUND,
            axum::Json(json!({"error": format!("unknown service '{service}'")})),
        ));
    };

    let url = format!(
        "{}/{}",
        cfg.url.trim_end_matches('/'),
        rest.trim_start_matches('/')
    );

    let mut req = match method {
        axum::http::Method::POST => state.client.post(&url),
        _ => state.client.get(&url),
    };
    if let Some(token) = &cfg.api_token {
        req = req.bearer_auth(token);
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

pub async fn proxy_get(state: State<AppState>, path: Path<(String, String)>) -> impl IntoResponse {
    forward(state, path, axum::http::Method::GET, None).await
}

#[axum::debug_handler]
pub async fn proxy_post(
    state: State<AppState>,
    path: Path<(String, String)>,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    let body = if body.is_empty() { None } else { Some(body) };
    forward(state, path, axum::http::Method::POST, body).await
}
