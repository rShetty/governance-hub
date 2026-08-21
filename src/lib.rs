pub mod config;
pub mod status;

use axum::{
    http::header,
    response::{Html, Response},
    routing::get,
    Json, Router,
};
pub use config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: std::sync::Arc<Config>,
    pub client: reqwest::Client,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            config: std::sync::Arc::new(config),
            client: reqwest::Client::new(),
        }
    }
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(dashboard))
        .route("/api/services", get(services_status))
        .route("/health", get(health))
        .with_state(state)
        .layer(axum::middleware::map_response(
            |mut res: Response| async move {
                res.headers_mut()
                    .insert(header::X_CONTENT_TYPE_OPTIONS, "nosniff".parse().unwrap());
                res.headers_mut()
                    .insert(header::X_FRAME_OPTIONS, "DENY".parse().unwrap());
                res
            },
        ))
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
    Html(include_str!("../static/index.html"))
}
