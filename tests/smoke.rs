//! E2E smoke tests for the governance hub HTTP surface (governance-hub#2).

use axum::body::Body;
use governance_hub::{router, AppState, Config};
use http_body_util::BodyExt;
use std::collections::HashMap;
use tower::ServiceExt;

fn test_state() -> AppState {
    let mut services = HashMap::new();
    services.insert(
        "healthy".to_string(),
        governance_hub::config::ServiceConfig {
            public_url: None,
            url: "http://127.0.0.1:9".into(), // unreachable port
            token: None,
            api_token: None,
            health_path: "/health".into(),
            label: "Unreachable Service".into(),
            description: "simulated outage".into(),
            color: "#ef4444".into(),
            ui_path: String::new(),
        },
    );
    Config {
        services,
        listen: "127.0.0.1:0".into(),
    }
    .into_app_state()
}

trait IntoAppState {
    fn into_app_state(self) -> AppState;
}
impl IntoAppState for Config {
    fn into_app_state(self) -> AppState {
        AppState::new(self)
    }
}

async fn get(app: axum::Router, uri: &str) -> (axum::http::StatusCode, String) {
    let req = axum::http::Request::builder()
        .uri(uri)
        .body(Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    let status = resp.status();
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    (status, String::from_utf8_lossy(&bytes).to_string())
}

#[tokio::test]
async fn health_is_public_and_json() {
    let (status, body) = get(router(test_state()), "/health").await;
    assert_eq!(status, axum::http::StatusCode::OK);
    assert!(body.contains("governance-hub"));
}

#[tokio::test]
async fn dashboard_renders_with_security_headers() {
    let app = router(test_state());
    let req = axum::http::Request::builder()
        .uri("/")
        .body(Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), axum::http::StatusCode::OK);
    assert_eq!(
        resp.headers().get("x-frame-options").unwrap(),
        "DENY",
        "clickjacking protection required"
    );
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let html = String::from_utf8_lossy(&body);
    assert!(html.contains("AI Governance Console"));
}

#[tokio::test]
async fn services_status_reports_unreachable_as_degraded_not_error() {
    let (status, body) = get(router(test_state()), "/api/services").await;
    assert_eq!(status, axum::http::StatusCode::OK);
    assert!(body.contains("\"healthy\":false"), "{body}");
    assert!(body.contains("Unreachable Service"), "{body}");
}

#[tokio::test]
async fn unknown_routes_serve_spa_fallback() {
    let (status, body) = get(router(test_state()), "/some/client/route").await;
    assert_eq!(status, axum::http::StatusCode::OK);
    assert!(body.contains("<html"), "SPA fallback expected");
}
