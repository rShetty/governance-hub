pub mod assets;
pub mod auth;
pub mod bff;
pub mod config;
pub mod console;
pub mod keys;
pub mod proxy;
pub mod status;

use axum::{
    http::header,
    response::{Html, Response},
    routing::{get, patch, post},
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
    // Public surface (no login): health probe + the OIDC dance itself.
    let public = Router::new()
        .route("/health", get(health))
        .route("/login", get(console::login))
        .route("/auth/callback", get(console::callback));

    // Authenticated surface — everything else. A middleware redirects
    // unauthenticated browsers to Argus; API clients get a JSON 401.
    let app_routes = Router::new()
        .route("/", get(dashboard))
        .route("/assets/{*path}", get(assets::asset))
        .route("/api/services", get(services_status))
        .route("/logout", post(console::logout).get(console::logout_get))
        .route("/api/me", get(console::me))
        .route("/api/console/identities", get(console::identities))
        .route("/api/console/services", get(console::services_list))
        .route(
            "/api/console/services",
            post(console::service_upsert).delete(console::service_delete),
        )
        .route(
            "/api/svc/{service}/{*path}",
            get(proxy::proxy_get)
                .post(proxy::proxy_method)
                .put(proxy::proxy_method)
                .patch(proxy::proxy_method)
                .delete(proxy::proxy_method),
        )
        .route("/api/bff/fleet", get(bff::fleet_overview))
        .route("/api/bff/agents", post(bff::agents_create))
        .route(
            "/api/bff/identities/{identity_id}/action",
            post(bff::identity_action),
        )
        .route(
            "/api/bff/access/approvals/{approval_id}/resolve",
            post(bff::approval_resolve),
        )
        .route(
            "/api/bff/access/sessions/{session_id}/kill",
            post(bff::session_kill),
        )
        .route(
            "/api/bff/agents/{agent_id}/emergency-kill",
            post(bff::agent_emergency_kill),
        )
        .route(
            "/api/bff/access/tokens/{token_id}/revoke",
            post(bff::token_revoke),
        )
        .route("/api/bff/access/simulate", post(bff::policy_simulate))
        .route("/api/bff/identities/mint", post(bff::identity_mint))
        .route("/api/bff/runtime-agents", post(bff::runtime_agent_create))
        .route(
            "/api/bff/runtime-agents/{agent_id}/health",
            get(bff::runtime_agent_health),
        )
        .route("/api/bff/mcp", get(bff::mcp_list).post(bff::mcp_create))
        .route("/api/bff/mcp/{server_id}/grant", post(bff::mcp_grant))
        .route("/api/bff/mcp/{server_id}/revoke", post(bff::mcp_revoke))
        .route("/api/bff/mcp/{server_id}/access", get(bff::mcp_access))
        .route("/api/bff/mcp/{server_id}/connect", post(bff::mcp_connect))
        .route(
            "/api/bff/policies",
            get(bff::policy_list).post(bff::policy_create),
        )
        .route("/api/bff/activity", get(bff::activity_feed))
        .route("/api/bff/trace/{session_id}", get(bff::trace_detail))
        .route("/api/bff/cost", get(bff::cost_overview))
        .route("/api/bff/cost/keys", post(bff::miser_key_create))
        .route(
            "/api/bff/cost/keys/{key_id}",
            patch(bff::miser_key_update).post(bff::miser_key_revoke),
        )
        .route("/api/bff/tools", get(bff::tools_overview))
        .route("/api/bff/catalog", get(bff::unified_catalog))
        .route(
            "/api/bff/catalog/{source}/{item_id}/health",
            post(bff::catalog_item_health),
        )
        .route("/api/bff/proxy/{backend}/{*rest}", get(bff::passthrough))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            console::require_session,
        ));

    public
        .merge(app_routes)
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
