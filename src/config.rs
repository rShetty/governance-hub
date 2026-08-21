use serde::Deserialize;
use std::collections::HashMap;

/// Runtime configuration for the hub: where each governance service lives.
#[derive(Debug, Clone, Deserialize, Default)]
pub struct Config {
    #[serde(default)]
    pub services: HashMap<String, ServiceConfig>,
    #[serde(default = "default_listen")]
    pub listen: String,
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
        Ok(toml::from_str(&raw)?)
    }
}
