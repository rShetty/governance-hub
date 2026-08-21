use axum::http::StatusCode;

/// Aggregated status of one governance service.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ServiceStatus {
    pub id: String,
    pub label: String,
    pub description: String,
    pub color: String,
    pub url: String,
    pub ui_url: String,
    pub healthy: bool,
    pub latency_ms: Option<u128>,
    pub detail: String,
}

pub async fn probe(
    client: &reqwest::Client,
    id: &str,
    cfg: &crate::config::ServiceConfig,
) -> (StatusCode, ServiceStatus) {
    let url = format!("{}{}", cfg.url.trim_end_matches('/'), cfg.health_path);
    let start = std::time::Instant::now();
    let mut req = client.get(&url);
    if let Some(token) = &cfg.token {
        req = req.bearer_auth(token);
    }
    let (healthy, latency_ms, detail) =
        match req.timeout(std::time::Duration::from_secs(4)).send().await {
            Ok(resp) => {
                let ms = start.elapsed().as_millis();
                let code = resp.status().as_u16().to_string();
                (resp.status().is_success(), Some(ms), format!("HTTP {code}"))
            }
            Err(e) => (false, None, format!("unreachable: {e}")),
        };
    let status = ServiceStatus {
        id: id.to_string(),
        label: cfg.label.clone(),
        description: cfg.description.clone(),
        color: cfg.color.clone(),
        url: cfg.public_url.clone().unwrap_or_else(|| cfg.url.clone()),
        ui_url: cfg.ui_path.clone(),
        healthy,
        latency_ms,
        detail,
    };
    // Degraded services still report HTTP 200 — the board renders the state.
    (StatusCode::OK, status)
}
