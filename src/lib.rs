pub mod assets;
pub mod auth;
pub mod config;
pub mod console;
pub mod keys;
pub mod proxy;
pub mod status;

use axum::{
    http::header,
    response::{Html, Response},
    routing::{get, post},
    Json, Router,
};
pub use config::Config;
use std::collections::HashMap;

#[derive(Clone)]
pub struct AppState {
    pub config: std::sync::Arc<Config>,
    pub client: reqwest::Client,
    pub sessions: auth::SessionStore,
    /// In-flight PKCE verifiers + next URLs keyed by the state param.
    pub oidc_flow: std::sync::Arc<std::sync::Mutex<HashMap<String, (String, String)>>>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            config: std::sync::Arc::new(config),
            client: reqwest::Client::new(),
            sessions: auth::SessionStore::new(),
            oidc_flow: std::sync::Arc::new(std::sync::Mutex::new(HashMap::new())),
        }
    }

    pub fn oidc(&self) -> Option<auth::OidcConfig> {
        Some(auth::OidcConfig {
            issuer: self.config.oidc_issuer.clone()?,
            client_id: self.config.oidc_client_id.clone()?,
            client_secret: self.config.oidc_client_secret.clone()?,
        })
    }
}

pub fn router(state: AppState) -> Router {
    // Public surface: dashboard, static assets, status API, health probe.
    let public = Router::new()
        .route("/", get(dashboard))
        .route("/assets/{*path}", get(assets::asset))
        .route("/api/services", get(services_status))
        .route("/health", get(health));

    // Privileged surface: the service proxy. Gated behind the admin token —
    // route_layer here scopes the middleware to these routes only.
    let protected = Router::new()
        .route(
            "/api/svc/{service}/{*path}",
            get(proxy::proxy_get).post(proxy::proxy_post),
        )
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            proxy::require_admin_token,
        ));

    // Console surface: OIDC login + admin management.
    let console = Router::new()
        .route("/login", get(console::login))
        .route("/auth/callback", get(console::callback))
        .route("/logout", post(console::logout))
        .route("/api/me", get(console::me))
        .route("/api/console/identities", get(console::identities))
        .route("/api/console/services", get(console::services_list))
        .route(
            "/api/console/services",
            post(console::service_upsert).delete(console::service_delete),
        );

    public
        .merge(protected)
        .merge(console)
        .layer(axum::middleware::map_response(
            |mut res: Response| async move {
                let h = res.headers_mut();
                h.insert(header::X_FRAME_OPTIONS, "DENY".parse().unwrap());
                h.insert(header::X_CONTENT_TYPE_OPTIONS, "nosniff".parse().unwrap());
                h.insert(header::REFERRER_POLICY, "no-referrer".parse().unwrap());
                res
            },
        ))
        .fallback(dashboard)
        .with_state(state)
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({"status": "ok", "service": "governance-hub"}))
}

/// Live status of every configured governance service (probed concurrently).
async fn services_status(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Json<serde_json::Value> {
    let mut entries: Vec<_> = state.config.services.iter().collect();
    entries.sort_by(|a, b| a.0.cmp(b.0));

    let mut handles = Vec::new();
    for (id, cfg) in &entries {
        let client = state.client.clone();
        let id = (*id).clone();
        let cfg = (*cfg).clone();
        handles.push(tokio::spawn(async move {
            let (_, service_status) = status::probe(&client, &id, &cfg).await;
            service_status
        }));
    }

    let mut services = Vec::new();
    for h in handles {
        if let Ok(s) = h.await {
            services.push(s);
        }
    }
    Json(serde_json::json!({
        "services": services,
        "healthy_count": services.iter().filter(|s| s.healthy).count(),
    }))
}

async fn dashboard() -> Html<&'static str> {
    Html(include_str!("../frontend/dist/index.html"))
}
