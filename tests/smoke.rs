//! E2E smoke tests for the governance hub HTTP surface (governance-hub#2).

use axum::body::Body;
use governance_hub::{auth, router, AppState, Config};
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
        admin_token: Some("test-admin-token".into()),
        oidc_issuer: None,
        oidc_client_id: None,
        oidc_client_secret: None,
    }
    .into_app_state()
}

fn session_cookie_for(state: &AppState, admin: bool) -> String {
    let user = auth::HubUser {
        sub: "usr_test".into(),
        email: "test@test.dev".into(),
        name: "Test".into(),
        is_admin: admin,
        argus_sid: String::new(),
    };
    format!("hub_session={}", state.sessions.put(user, 3600))
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
async fn proxy_forwards_methods_and_bodies_for_admins_only() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();

    let backend = axum::Router::new().route(
        "/echo",
        axum::routing::any(
            |method: axum::http::Method, body: axum::body::Bytes| async move {
                format!("{}:{}", method, String::from_utf8_lossy(&body))
            },
        ),
    );
    let server = tokio::spawn(async move {
        axum::serve(listener, backend).await.unwrap();
    });

    let mut services = HashMap::new();
    services.insert(
        "forge".to_string(),
        governance_hub::config::ServiceConfig {
            public_url: None,
            url: format!("http://{address}"),
            token: None,
            api_token: None,
            health_path: "/health".into(),
            label: "Forge".into(),
            description: "test backend".into(),
            color: "#fff".into(),
            ui_path: String::new(),
        },
    );
    let state = Config {
        services,
        listen: "127.0.0.1:0".into(),
        admin_token: Some("test-admin-token".into()),
        oidc_issuer: None,
        oidc_client_id: None,
        oidc_client_secret: None,
    }
    .into_app_state();

    let admin_cookie = session_cookie_for(&state, true);
    let app = router(state.clone());
    let req = axum::http::Request::builder()
        .method(axum::http::Method::DELETE)
        .uri("/api/svc/forge/echo")
        .header("cookie", &admin_cookie)
        .body(Body::from("release-package"))
        .unwrap();
    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), axum::http::StatusCode::OK);
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(bytes.as_ref(), b"DELETE:release-package");

    let member_cookie = session_cookie_for(&state, false);
    let app = router(state);
    let req = axum::http::Request::builder()
        .method(axum::http::Method::DELETE)
        .uri("/api/svc/forge/echo")
        .header("cookie", &member_cookie)
        .body(Body::empty())
        .unwrap();
    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), axum::http::StatusCode::FORBIDDEN);

    server.abort();
}

#[tokio::test]
async fn health_is_public_and_json() {
    let (status, body) = get(router(test_state()), "/health").await;
    assert_eq!(status, axum::http::StatusCode::OK);
    assert!(body.contains("governance-hub"));
}

#[tokio::test]
async fn dashboard_renders_with_security_headers() {
    let state = test_state();
    let cookie = session_cookie_for(&state, true);
    let app = router(state);
    let req = axum::http::Request::builder()
        .uri("/")
        .header("cookie", &cookie)
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
    let state = test_state();
    let cookie = session_cookie_for(&state, true);
    let app = router(state);
    let req = axum::http::Request::builder()
        .uri("/api/services")
        .header("cookie", &cookie)
        .body(Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    let status = resp.status();
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(status, axum::http::StatusCode::OK);
    let body = String::from_utf8_lossy(&bytes).to_string();
    assert!(body.contains("\"healthy\":false"), "{body}");
    assert!(body.contains("Unreachable Service"), "{body}");
}

#[tokio::test]
async fn unauthenticated_browser_is_redirected_to_login() {
    let req = axum::http::Request::builder()
        .uri("/")
        .header("accept", "text/html")
        .body(Body::empty())
        .unwrap();
    let resp = router(test_state()).oneshot(req).await.unwrap();
    assert_eq!(resp.status(), axum::http::StatusCode::SEE_OTHER);
    let loc = resp.headers().get("location").unwrap().to_str().unwrap();
    assert!(loc.starts_with("/login?next="), "{loc}");
}

#[tokio::test]
async fn health_stays_public() {
    let (status, _) = get(router(test_state()), "/health").await;
    assert_eq!(status, axum::http::StatusCode::OK);
}

#[tokio::test]
async fn unknown_routes_serve_spa_fallback() {
    let (status, body) = get(router(test_state()), "/some/client/route").await;
    assert_eq!(status, axum::http::StatusCode::OK);
    assert!(body.contains("<html"), "SPA fallback expected");
}

#[tokio::test]
async fn hashed_ui_assets_are_served_with_real_mime_types() {
    let state = test_state();
    let cookie = session_cookie_for(&state, true);
    let app = router(state);
    // Discover the embedded JS bundle path from the built UI shell.
    let html = {
        let req = axum::http::Request::builder()
            .uri("/")
            .header("cookie", &cookie)
            .body(Body::empty())
            .unwrap();
        let resp = app.clone().oneshot(req).await.unwrap();
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        String::from_utf8_lossy(&bytes).to_string()
    };
    let src = html
        .split("src=\"")
        .nth(1)
        .and_then(|s| s.split('"').next())
        .expect("index.html must reference a module script");
    assert!(src.starts_with("/assets/"), "unexpected script src: {src}");

    let req = axum::http::Request::builder()
        .uri(src)
        .header("cookie", &cookie)
        .body(Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), axum::http::StatusCode::OK, "{src}");
    let ct = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    assert_eq!(
        ct, "text/javascript",
        "module script must be JavaScript, not HTML (governance.rajeev.me MIME bug)"
    );
}

#[tokio::test]
async fn proxy_requires_admin_session() {
    let app = router(test_state());
    // No session → 401
    let req = axum::http::Request::builder()
        .uri("/api/svc/miser/health/ready")
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), axum::http::StatusCode::UNAUTHORIZED);
    // Member session → 403
    let state = test_state();
    let cookie = session_cookie_for(&state, false);
    let req = axum::http::Request::builder()
        .uri("/api/svc/miser/health/ready")
        .header("cookie", &cookie)
        .body(Body::empty())
        .unwrap();
    let resp = router(state).oneshot(req).await.unwrap();
    assert_eq!(resp.status(), axum::http::StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn proxy_reports_unreachable_backend_after_authorization() {
    let mut services = std::collections::HashMap::new();
    services.insert(
        "miser".to_string(),
        governance_hub::config::ServiceConfig {
            public_url: None,
            url: "http://127.0.0.1:9".into(),
            token: None,
            api_token: None,
            health_path: "/health".into(),
            label: "Miser".into(),
            description: "test".into(),
            color: "#000".into(),
            ui_path: String::new(),
        },
    );
    let state = Config {
        services,
        listen: "127.0.0.1:0".into(),
        admin_token: None,
        oidc_issuer: None,
        oidc_client_id: None,
        oidc_client_secret: None,
    }
    .into_app_state();
    let cookie = session_cookie_for(&state, true);
    let req = axum::http::Request::builder()
        .uri("/api/svc/miser/health/ready")
        .header("cookie", &cookie)
        .body(Body::empty())
        .unwrap();
    let resp = router(state).oneshot(req).await.unwrap();
    // Authorization passed; the unreachable backend is reported as degraded.
    assert_eq!(resp.status(), axum::http::StatusCode::BAD_GATEWAY);
}

#[tokio::test]
async fn console_endpoints_require_auth() {
    let app = router(test_state());
    // /api/me without session → 401
    let req = axum::http::Request::builder()
        .uri("/api/me")
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), axum::http::StatusCode::UNAUTHORIZED);
    // identities without login → 401
    let req = axum::http::Request::builder()
        .uri("/api/console/identities")
        .body(Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn login_redirects_to_idp_when_configured() {
    // Config with an issuer pointing at a non-existent IdP: /login should
    // attempt discovery and fail with BAD_GATEWAY (proves wiring).
    let mut services = std::collections::HashMap::new();
    services.insert(
        "miser".to_string(),
        governance_hub::config::ServiceConfig {
            public_url: None,
            url: "http://127.0.0.1:9".into(),
            token: None,
            api_token: None,
            health_path: "/health".into(),
            label: "M".into(),
            description: "d".into(),
            color: "#fff".into(),
            ui_path: String::new(),
        },
    );
    let state = Config {
        services,
        listen: "127.0.0.1:0".into(),
        admin_token: Some("t".into()),
        oidc_issuer: Some("http://127.0.0.1:1".into()),
        oidc_client_id: Some("svc_x".into()),
        oidc_client_secret: Some("s".into()),
    }
    .into_app_state();
    let req = axum::http::Request::builder()
        .uri("/login")
        .body(Body::empty())
        .unwrap();
    let resp = router(state).oneshot(req).await.unwrap();
    assert_eq!(resp.status(), axum::http::StatusCode::BAD_GATEWAY);
}
