use serde::Deserialize;
use std::collections::HashMap;

/// Runtime configuration for the hub: where each governance service lives.
#[derive(Debug, Clone, Deserialize, Default)]
pub struct Config {
    #[serde(default)]
    pub services: HashMap<String, ServiceConfig>,
    #[serde(default = "default_listen")]
    pub listen: String,
    /// Shared secret required on every `/api/svc/*` proxy call.
    /// Falls back to `HUB_ADMIN_TOKEN` env when absent. Proxying is refused
    /// (503) entirely when unset — never ship an open proxy.
    #[serde(default)]
    pub admin_token: Option<String>,
    /// Argus IdP issuer (e.g. https://id.rajeev.me). Login is enabled when set.
    #[serde(default)]
    pub oidc_issuer: Option<String>,
    /// This hub's OIDC client credentials (from Argus `svc_…` registration).
    #[serde(default)]
    pub oidc_client_id: Option<String>,
    #[serde(default)]
    pub oidc_client_secret: Option<String>,
}

fn default_listen() -> String {
    "127.0.0.1:8600".to_string()
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServiceConfig {
    /// Public base URL used by the browser (defaults to `url`).
    #[serde(default)]
    pub public_url: Option<String>,
    /// Base URL the hub server calls server-side.
    pub url: String,
    /// Optional bearer token for server-side calls.
    #[serde(default)]
    pub token: Option<String>,
    /// Bearer token the hub injects when proxying API calls to this service
    /// (server-side only — never exposed to browsers).
    #[serde(default)]
    pub api_token: Option<String>,
    /// Health path probed for status cards.
    #[serde(default = "default_health")]
    pub health_path: String,
    /// Human label.
    pub label: String,
    /// One-line description shown in the UI.
    pub description: String,
    /// Accent color for the service card.
    #[serde(default = "default_color")]
    pub color: String,
    /// Link to the service's own dashboard/UI.
    #[serde(default)]
    pub ui_path: String,
}

fn default_health() -> String {
    "/health".to_string()
}

fn default_color() -> String {
    "#6366f1".to_string()
}

impl Config {
    pub fn load(path: &str) -> anyhow::Result<Self> {
        let raw = std::fs::read_to_string(path)?;
        let mut cfg: Config = toml::from_str(&raw)?;
        // Secrets may live in the environment (env-file) rather than toml.
        if let Ok(v) = std::env::var("HUB_OIDC_ISSUER") {
            if !v.is_empty() {
                cfg.oidc_issuer = Some(v);
            }
        }
        if let Ok(v) = std::env::var("HUB_OIDC_CLIENT_ID") {
            if !v.is_empty() {
                cfg.oidc_client_id = Some(v);
            }
        }
        if let Ok(v) = std::env::var("HUB_OIDC_CLIENT_SECRET") {
            if !v.is_empty() {
                cfg.oidc_client_secret = Some(v);
            }
        }
        Ok(cfg)
    }
}
