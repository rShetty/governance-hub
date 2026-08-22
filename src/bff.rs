//! Backend-for-frontend: unified read/write surface over every governed
//! backend. The console UI talks only to these endpoints; each call fans
//! out server-side using per-service admin credentials from the hub env.
//!
//! Auth model: console session (Argus SSO) + admin role for mutations.

use crate::{auth, AppState};
use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

fn now_err(status: StatusCode, msg: &str) -> Response {
    (status, Json(json!({ "error": msg }))).into_response()
}

async fn require_admin(state: &AppState, headers: &HeaderMap) -> Result<auth::HubUser, Response> {
    let sid = crate::console::cookie_value_pub(headers, auth::SESSION_COOKIE).unwrap_or_default();
    let user = state
        .sessions
        .get(&sid)
        .ok_or_else(|| now_err(StatusCode::UNAUTHORIZED, "login required"))?;
    if !user.is_admin {
        return Err(now_err(StatusCode::FORBIDDEN, "admin required"));
    }
    Ok(user)
}

/// Server-side GET against a backend with optional bearer token.
async fn backend_get(state: &AppState, url: String, token: Option<&str>) -> Result<Value, String> {
    let mut req = state
        .client
        .get(&url)
        .timeout(std::time::Duration::from_secs(8));
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    let resp = req.send().await.map_err(|e| format!("unreachable: {e}"))?;
    let status = resp.status();
    let body: Value = resp.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(format!("status {}", status.as_u16()));
    }
    Ok(body)
}

async fn backend_post(
    state: &AppState,
    url: String,
    token: Option<&str>,
    body: Value,
) -> Result<Value, String> {
    let mut req = state
        .client
        .post(&url)
        .timeout(std::time::Duration::from_secs(10))
        .json(&body);
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    let resp = req.send().await.map_err(|e| format!("unreachable: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!(
            "status {}: {}",
            status.as_u16(),
            text.chars().take(180).collect::<String>()
        ));
    }
    Ok(serde_json::from_str(&text).unwrap_or(Value::Null))
}

// env helpers ---------------------------------------------------------------

fn svc_env(state: &AppState, key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|v| !v.is_empty())
}

fn hive_url() -> String {
    std::env::var("HIVE_INTERNAL_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".into())
}
fn relay_url() -> String {
    std::env::var("RELAY_INTERNAL_URL").unwrap_or_else(|_| "http://127.0.0.1:8001".into())
}
fn patroclus_url() -> String {
    std::env::var("PATROCLUS_INTERNAL_URL").unwrap_or_else(|_| "http://127.0.0.1:8484".into())
}
fn miser_url() -> String {
    std::env::var("MISER_INTERNAL_URL").unwrap_or_else(|_| "http://127.0.0.1:8787".into())
}
fn sentiel_url() -> String {
    std::env::var("SENTIEL_INTERNAL_URL").unwrap_or_else(|_| "http://127.0.0.1:8585".into())
}
fn aegis_url() -> String {
    std::env::var("AEGIS_INTERNAL_URL").unwrap_or_else(|_| "http://127.0.0.1:8686".into())
}

// ── Unified fleet overview ───────────────────────────────────────────────────

pub async fn fleet_overview(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = require_admin(&state, &headers).await {
        return r;
    }
    let p_tok = svc_env(&state, "PATROCLUS_ADMIN_TOKEN");
    let s_tok = svc_env(&state, "SENTIEL_ADMIN_TOKEN");
    let a_tok = svc_env(&state, "AEGIS_ADMIN_TOKEN");

    let hive_agents = backend_get(&state, format!("{}/api/agent/list", hive_url()), None);
    let patroclus = backend_get(
        &state,
        format!("{}/v1/admin/agents", patroclus_url()),
        p_tok.as_deref(),
    );
    let policies = backend_get(
        &state,
        format!("{}/v1/admin/policies", patroclus_url()),
        p_tok.as_deref(),
    );
    let sentiel_events = backend_get(
        &state,
        format!("{}/events?limit=20", sentiel_url()),
        s_tok.as_deref(),
    );
    let aegis_log = backend_get(
        &state,
        format!("{}/egress_log?limit=20", aegis_url()),
        a_tok.as_deref(),
    );
    let miser_stats = backend_get(&state, format!("{}/admin/stats", miser_url()), None);

    let (ha, pa, po, se, ae, mi) = tokio::join!(
        hive_agents,
        patroclus,
        policies,
        sentiel_events,
        aegis_log,
        miser_stats
    );
    let ha_v = ha.as_ref().ok().cloned().unwrap_or(Value::Null);
    let pa_v = pa.as_ref().ok().cloned().unwrap_or(Value::Null);
    let po_v = po.as_ref().ok().cloned().unwrap_or(Value::Null);
    let se_v = se.as_ref().ok().cloned().unwrap_or(Value::Null);
    let ae_v = ae.as_ref().ok().cloned().unwrap_or(Value::Null);
    let mi_v = mi.as_ref().ok().cloned().unwrap_or(Value::Null);

    Json(json!({
        "hive":      { "agents": ha_v },
        "patroclus": { "agents": pa_v, "policies": po_v },
        "sentiel":   { "events": se_v },
        "aegis":     { "verdicts": ae_v },
        "miser":     { "stats": mi_v },
        "_errors": {
            "hive": ha.is_err(),
            "patroclus": pa.is_err(),
            "policies": po.is_err(),
            "sentiel": se.is_err(),
            "aegis": ae.is_err(),
            "miser": mi.is_err(),
        }
    }))
    .into_response()
}

// ── Agents: create (Hive) + identity (Argus) bridge ─────────────────────────

#[derive(Deserialize)]
pub struct AgentCreateRequest {
    pub name: String,
    #[serde(default)]
    pub description: String,
    /// ecosystem scopes for the Argus identity, e.g. ["hive:delegate"]
    #[serde(default)]
    pub scopes: Vec<String>,
    #[serde(default)]
    pub endpoint_url: Option<String>,
}

/// Create a Hive agent AND an Argus machine identity; link them by name tag.
pub async fn agents_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<AgentCreateRequest>,
) -> Response {
    let user = match require_admin(&state, &headers).await {
        Ok(u) => u,
        Err(r) => return r,
    };
    if body.name.trim().is_empty() || body.name.len() > 120 {
        return now_err(StatusCode::BAD_REQUEST, "invalid agent name");
    }

    // 1. Argus identity (owner = the console admin creating it).
    let argus = argus::create_agent_via_api(&state, &user.email, &body.name, &body.scopes).await;

    // 2. Hive registration — requires a Hive user context; use the service
    //    account created at bootstrap (or report partial success).
    let hive = backend_post(
        &state,
        format!("{}/api/agent/register", hive_url()),
        Some(&svc_env(&state, "HIVE_SERVICE_TOKEN").unwrap_or_default()),
        json!({
            "name": body.name,
            "description": body.description,
            "agent_type": "external",
            "endpoint_url": body.endpoint_url.clone().unwrap_or_else(|| "http://127.0.0.1:9/pending".into()),
            "skills": [],
        }),
    )
    .await;

    Json(json!({
        "argus": argus,
        "hive": hive,
        "note": "If hive failed due to auth, P2 service-account wiring will retry automatically.",
    }))
    .into_response()
}

mod argus {
    use super::*;

    pub async fn create_agent_via_api(
        state: &AppState,
        owner_email: &str,
        name: &str,
        scopes: &[String],
    ) -> Value {
        let issuer = match state.config.oidc_issuer.clone() {
            Some(i) => i.trim_end_matches('/').to_string(),
            None => return json!({"skipped": "IdP not configured"}),
        };
        // Admin session of the hub's own OIDC client cannot mint agents;
        // use the Argus client-registration flow via the hub's Basic creds.
        let creds = format!(
            "{}:{}",
            state.config.oidc_client_id.as_deref().unwrap_or(""),
            state.config.oidc_client_secret.as_deref().unwrap_or("")
        );
        use base64::Engine as _;
        let basic = base64::engine::general_purpose::STANDARD.encode(creds);
        let resp = state
            .client
            .post(format!("{issuer}/api/admin/agents/mint"))
            .header(header::AUTHORIZATION, format!("Basic {basic}"))
            .json(&json!({
                "name": format!("{name} ({owner_email})"),
                "scopes": scopes,
                "metadata": {"created_by": owner_email, "via": "governance-console"},
            }))
            .send()
            .await;
        match resp {
            Ok(r) if r.status().is_success() => r.json().await.unwrap_or(Value::Null),
            Ok(r) => json!({"error": format!("argus {}", r.status())}),
            Err(e) => json!({"error": e.to_string()}),
        }
    }
}

// ── MCP servers via Relay/Hive ───────────────────────────────────────────────

#[derive(Deserialize, serde::Serialize)]
pub struct McpServerCreateRequest {
    pub name: String,
    pub url: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_transport")]
    pub transport: String,
}
fn default_transport() -> String {
    "sse".into()
}

pub async fn mcp_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<McpServerCreateRequest>,
) -> Response {
    if let Err(r) = require_admin(&state, &headers).await {
        return r;
    }
    let result = backend_post(
        &state,
        format!("{}/api/mcp-servers", hive_url()),
        Some(&svc_env(&state, "HIVE_SERVICE_TOKEN").unwrap_or_default()),
        serde_json::to_value(&body).unwrap_or(Value::Null),
    )
    .await;
    match result {
        Ok(v) => Json(v).into_response(),
        Err(e) => now_err(StatusCode::BAD_GATEWAY, &format!("hive: {e}")),
    }
}

pub async fn mcp_list(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = require_admin(&state, &headers).await {
        return r;
    }
    let v = backend_get(&state, format!("{}/api/mcp-servers", hive_url()), None).await;
    match v {
        Ok(x) => Json(x).into_response(),
        Err(e) => now_err(StatusCode::BAD_GATEWAY, &format!("hive: {e}")),
    }
}

// ── Policies (Patroclus) ─────────────────────────────────────────────────────

#[derive(Deserialize, serde::Serialize)]
pub struct PolicyCreateRequest {
    pub name: String,
    #[serde(default = "default_engine")]
    pub engine: String,
    pub definition: String,
}
fn default_engine() -> String {
    "yaml".into()
}

pub async fn policy_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<PolicyCreateRequest>,
) -> Response {
    if let Err(r) = require_admin(&state, &headers).await {
        return r;
    }
    let tok = svc_env(&state, "PATROCLUS_ADMIN_TOKEN");
    match backend_post(
        &state,
        format!("{}/v1/admin/policies", patroclus_url()),
        tok.as_deref(),
        serde_json::to_value(&body).unwrap_or(Value::Null),
    )
    .await
    {
        Ok(v) => Json(v).into_response(),
        Err(e) => now_err(StatusCode::BAD_GATEWAY, &format!("patroclus: {e}")),
    }
}

pub async fn policy_list(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = require_admin(&state, &headers).await {
        return r;
    }
    let tok = svc_env(&state, "PATROCLUS_ADMIN_TOKEN");
    match backend_get(
        &state,
        format!("{}/v1/admin/policies", patroclus_url()),
        tok.as_deref(),
    )
    .await
    {
        Ok(v) => Json(v).into_response(),
        Err(e) => now_err(StatusCode::BAD_GATEWAY, &format!("patroclus: {e}")),
    }
}

// ── Activity (Sentiel + Aegis merged) ────────────────────────────────────────

#[derive(Deserialize)]
pub struct PageQuery {
    #[serde(default = "default_limit")]
    limit: u32,
}
fn default_limit() -> u32 {
    25
}

pub async fn activity_feed(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<PageQuery>,
) -> Response {
    if let Err(r) = require_admin(&state, &headers).await {
        return r;
    }
    let s_tok = svc_env(&state, "SENTIEL_ADMIN_TOKEN");
    let a_tok = svc_env(&state, "AEGIS_ADMIN_TOKEN");
    let ev = backend_get(
        &state,
        format!("{}/events?limit={}", sentiel_url(), q.limit),
        s_tok.as_deref(),
    )
    .await;
    let vg = backend_get(
        &state,
        format!("{}/egress_log?limit={}", aegis_url(), q.limit),
        a_tok.as_deref(),
    )
    .await;

    // Normalize into one timeline shape: {ts, source, kind, summary}
    let mut items: Vec<Value> = Vec::new();
    if let Ok(Value::Array(list)) = ev {
        for e in list {
            items.push(json!({
                "source": "sentiel",
                "kind": e.get("event_type").cloned().unwrap_or(json!("event")),
                "summary": e.get("summary").cloned().unwrap_or(json!(null)),
                "ts": e.get("created_at").cloned().unwrap_or(json!(null)),
                "raw": e,
            }));
        }
    }
    if let Ok(Value::Array(list)) = vg {
        for v in list {
            items.push(json!({
                "source": "aegis",
                "kind": v.get("action").cloned().unwrap_or(json!("egress")),
                "summary": v.get("domain").cloned().unwrap_or(json!(null)),
                "ts": v.get("logged_at").cloned().unwrap_or(json!(null)),
                "raw": v,
            }));
        }
    }
    items.sort_by(|a, b| {
        let ka = a["ts"].as_str().unwrap_or("").to_string();
        let kb = b["ts"].as_str().unwrap_or("").to_string();
        kb.cmp(&ka)
    });
    Json(json!({ "items": items.into_iter().take(q.limit as usize * 2).collect::<Vec<_>>() }))
        .into_response()
}

// ── Cost (Miser) ─────────────────────────────────────────────────────────────

pub async fn cost_overview(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = require_admin(&state, &headers).await {
        return r;
    }
    match backend_get(&state, format!("{}/admin/stats", miser_url()), None).await {
        Ok(v) => Json(v).into_response(),
        Err(e) => now_err(StatusCode::BAD_GATEWAY, &format!("miser: {e}")),
    }
}

// ── Tools / connectors (Relay) ───────────────────────────────────────────────

pub async fn tools_overview(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = require_admin(&state, &headers).await {
        return r;
    }
    let tools = backend_get(&state, format!("{}/v1/tools", relay_url()), None).await;
    let connectors = backend_get(&state, format!("{}/v1/connectors", relay_url()), None).await;
    Json(json!({
        "tools": tools.unwrap_or(json!([])),
        "connectors": connectors.unwrap_or(json!([])),
    }))
    .into_response()
}

// ── Path-based proxy passthrough for deep product pages ─────────────────────

#[derive(Deserialize)]
pub struct ProxyPath {
    pub backend: String,
    pub rest: String,
}

pub async fn passthrough(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((backend, rest)): Path<(String, String)>,
) -> Response {
    if let Err(r) = require_admin(&state, &headers).await {
        return r;
    }
    let (base, token) = match backend.as_str() {
        "hive" => (hive_url(), svc_env(&state, "HIVE_SERVICE_TOKEN")),
        "relay" => (relay_url(), None),
        "patroclus" => (patroclus_url(), svc_env(&state, "PATROCLUS_ADMIN_TOKEN")),
        "miser" => (miser_url(), None),
        "sentiel" => (sentiel_url(), svc_env(&state, "SENTIEL_ADMIN_TOKEN")),
        "aegis" => (aegis_url(), svc_env(&state, "AEGIS_ADMIN_TOKEN")),
        _ => return now_err(StatusCode::NOT_FOUND, "unknown backend"),
    };
    match backend_get(&state, format!("{base}/{rest}"), token.as_deref()).await {
        Ok(v) => Json(v).into_response(),
        Err(e) => now_err(StatusCode::BAD_GATEWAY, &format!("{backend}: {e}")),
    }
}
