//! Authenticated GET/POST proxy into governed services.
//!
//! The hub injects the per-service bearer token server-side, so browser
//! clients never hold service credentials. Path traversal is rejected.

use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;

use crate::AppState;

/// Phase-0 hard gate on the service proxy: every `/api/svc/*` call must
/// present `Authorization: Bearer <admin_token>` (config `admin_token`,
/// falling back to env `HUB_ADMIN_TOKEN`). When no token is configured the
/// proxy is disabled entirely — it must never be silently open.
pub async fn require_admin_token(
    State(state): State<AppState>,
    request: axum::extract::Request,
    next: Next,
) -> Result<Response, (StatusCode, axum::Json<serde_json::Value>)> {
    let configured = state
        .config
        .admin_token
        .clone()
        .or_else(|| std::env::var("HUB_ADMIN_TOKEN").ok());

    let Some(expected) = configured.filter(|t| !t.is_empty()) else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            axum::Json(json!({"error": "proxy disabled: HUB_ADMIN_TOKEN not configured"})),
        ));
    };

    let presented = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));

    match presented {
        Some(presented) if constant_time_eq(presented.as_bytes(), expected.as_bytes()) => {
            Ok(next.run(request).await)
        }
        _ => Err((
            StatusCode::UNAUTHORIZED,
            axum::Json(json!({"error": "admin token required"})),
        )),
    }
}
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter()
        .zip(b.iter())
        .fold(0u8, |acc, (x, y)| acc | (x ^ y))
        == 0
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
