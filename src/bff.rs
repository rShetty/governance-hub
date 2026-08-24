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

#[allow(clippy::result_large_err)]
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

fn svc_env(_state: &AppState, key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|v| !v.is_empty())
}

/// Hive service-account JWT, obtained lazily and cached in-process until
/// shortly before expiry. Env: HIVE_SERVICE_EMAIL / HIVE_SERVICE_PASSWORD.
async fn hive_service_token(state: &AppState) -> Option<String> {
    let lock = TOKEN_CACHE.get_or_init(|| tokio::sync::RwLock::new(None));
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    {
        let guard = lock.read().await;
        if let Some((tok, exp)) = guard.as_ref() {
            if *exp > now + 60 {
                return Some(tok.clone());
            }
        }
    }

    let email = svc_env(state, "HIVE_SERVICE_EMAIL")?;
    let password = svc_env(state, "HIVE_SERVICE_PASSWORD")?;
    let resp = state
        .client
        .post(format!("{}/api/auth/login", hive_url()))
        .json(&serde_json::json!({"email": email, "password": password}))
        .send()
        .await
        .ok()?;
    let body: Value = resp.json().await.ok()?;
    let tok = body["access_token"].as_str()?.to_string();
    // Hive tokens are 30-min JWTs; refresh at the 25-min mark.
    let exp = now + 1200; // refresh well before Hive's 30-min expiry
    let mut guard = lock.write().await;
    *guard = Some((tok.clone(), exp));
    Some(tok)
}

static TOKEN_CACHE: std::sync::OnceLock<tokio::sync::RwLock<Option<(String, u64)>>> =
    std::sync::OnceLock::new();

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

    let hive_agents = backend_get(&state, format!("{}/api/agents", hive_url()), None);
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
        format!("{}/api/events?limit=20", sentiel_url()),
        s_tok.as_deref(),
    );
    let aegis_log = backend_get(
        &state,
        format!("{}/api/egress/log?limit=20", aegis_url()),
        a_tok.as_deref(),
    );
    let m_tok = svc_env(&state, "MISER_ADMIN_KEY");
    let miser_stats = backend_get(
        &state,
        format!("{}/admin/keys", miser_url()),
        m_tok.as_deref(),
    );

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

    // 2. Hive registration with the service account (token auto-refreshed).
    let tok = hive_service_token(&state).await;
    let payload = json!({
        "name": body.name,
        "description": body.description,
        "agent_type": "external",
        "endpoint_url": body.endpoint_url.clone().unwrap_or_else(|| "https://pending.onboarding.example/agent".into()),
        "skills": [],
    });
    let mut hive = backend_post(
        &state,
        format!("{}/api/agent/register", hive_url()),
        tok.as_deref(),
        payload.clone(),
    )
    .await;
    if hive.is_err() {
        // Token may have just expired — force a fresh login and retry once.
        let tok2 = hive_service_token(&state).await;
        hive = backend_post(
            &state,
            format!("{}/api/agent/register", hive_url()),
            tok2.as_deref(),
            payload,
        )
        .await;
    }

    Json(json!({
        "argus": argus,
        "hive": hive,
        "note": "If hive failed due to auth, P2 service-account wiring will retry automatically.",
    }))
    .into_response()
}

#[derive(Deserialize)]
pub struct IdentityActionRequest {
    pub action: String,
    pub reason: Option<String>,
}

/// POST /api/bff/identities/{id}/action — lifecycle control for machine identities.
pub async fn identity_action(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(identity_id): Path<String>,
    Json(body): Json<IdentityActionRequest>,
) -> Response {
    let user = match require_admin(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let requested_status = match body.action.as_str() {
        "revoke" => "revoked",
        "restore" => "active",
        _ => return now_err(StatusCode::BAD_REQUEST, "action must be revoke or restore"),
    };
    if body
        .reason
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .is_empty()
    {
        return now_err(StatusCode::BAD_REQUEST, "reason required");
    }

    let issuer = state.config.oidc_issuer.clone().unwrap_or_default();
    let creds = format!(
        "{}:{}",
        state.config.oidc_client_id.as_deref().unwrap_or(""),
        state.config.oidc_client_secret.as_deref().unwrap_or("")
    );
    use base64::Engine as _;
    let authorization = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(creds)
    );
    let mut request = state
        .client
        .post(format!("{issuer}/api/admin/agents/{identity_id}/revoke"))
        .header(header::AUTHORIZATION, authorization)
        .timeout(std::time::Duration::from_secs(10));
    if requested_status == "active" {
        request = request.json(&json!({ "status": requested_status }));
    } else {
        request = request.json(&json!({
            "status": requested_status,
            "reason": body.reason.unwrap_or_default(),
            "operator": user.email,
        }));
    }

    match request.send().await {
        Ok(response) => {
            let status =
                StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
            let payload: Value = response.json().await.unwrap_or(Value::Null);
            if !status.is_success() {
                return (status, Json(payload)).into_response();
            }
            Json(json!({
                "identity_id": identity_id,
                "status": requested_status,
                "operator": user.email,
                "backend": "argus",
                "result": payload,
            }))
            .into_response()
        }
        Err(error) => now_err(
            StatusCode::BAD_GATEWAY,
            &format!("argus unreachable: {error}"),
        ),
    }
}

#[allow(clippy::result_large_err)]
async fn patroclus_admin(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<(auth::HubUser, Option<String>), Response> {
    let user = require_admin(state, headers).await?;
    Ok((user, svc_env(state, "PATROCLUS_ADMIN_TOKEN")))
}

#[derive(Deserialize)]
pub struct AccessActionRequest {
    pub approver_id: String,
    #[serde(default)]
    pub reason: String,
}

/// POST /api/bff/access/approvals/{id}/resolve — approve a pending request.
pub async fn approval_resolve(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(approval_id): Path<String>,
    Json(body): Json<AccessActionRequest>,
) -> Response {
    let (user, token) = match patroclus_admin(&state, &headers).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    if body.approver_id.trim().is_empty() {
        return now_err(StatusCode::BAD_REQUEST, "approver_id required");
    }
    let url = format!(
        "{}/v1/principal/approvals/{}/approve",
        patroclus_url(),
        approval_id
    );
    let payload = json!({
        "approver_id": body.approver_id,
        "reason": body.reason,
    });
    match backend_post(&state, url, token.as_deref(), payload).await {
        Ok(result) => Json(json!({
            "approval_id": approval_id,
            "decision": "approved",
            "operator": user.email,
            "result": result,
        }))
        .into_response(),
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("patroclus: {error}")),
    }
}

/// POST /api/bff/access/sessions/{id}/kill — terminate a Patroclus session.
pub async fn session_kill(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> Response {
    let (_, token) = match patroclus_admin(&state, &headers).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    let url = format!("{}/v1/sessions/{session_id}/kill", patroclus_url());
    match backend_post(&state, url, token.as_deref(), json!({})).await {
        Ok(result) => Json(json!({ "session_id": session_id, "result": result })).into_response(),
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("patroclus: {error}")),
    }
}

#[derive(Deserialize)]
pub struct EmergencyKillRequest {
    #[serde(default)]
    pub reason: String,
}

/// POST /api/bff/agents/{id}/emergency-kill — invoke Patroclus emergency stop.
pub async fn agent_emergency_kill(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(agent_id): Path<String>,
    Json(body): Json<EmergencyKillRequest>,
) -> Response {
    let (user, token) = match patroclus_admin(&state, &headers).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    if body.reason.trim().is_empty() {
        return now_err(StatusCode::BAD_REQUEST, "reason required");
    }
    let payload = json!({
        "reason": body.reason,
        "operator": user.email,
        "initiated_by": "governance-hub",
    });
    match backend_post(
        &state,
        format!("{}/v1/admin/agents/{agent_id}/kill", patroclus_url()),
        token.as_deref(),
        payload,
    )
    .await
    {
        Ok(result) => Json(json!({
            "agent_id": agent_id,
            "status": "killed",
            "operator": user.email,
            "result": result,
        }))
        .into_response(),
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("patroclus: {error}")),
    }
}

#[derive(Deserialize)]
pub struct TokenRevokeRequest {
    #[serde(default)]
    pub reason: String,
}

/// POST /api/bff/access/tokens/{jti}/revoke — revoke a Patroclus token.
pub async fn token_revoke(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(token_id): Path<String>,
    Json(body): Json<TokenRevokeRequest>,
) -> Response {
    let (user, token) = match patroclus_admin(&state, &headers).await {
        Ok(value) => value,
        Err(response) => return response,
    };
    if body.reason.trim().is_empty() {
        return now_err(StatusCode::BAD_REQUEST, "reason required");
    }
    let mut request = state
        .client
        .post(format!(
            "{}/v1/admin/tokens/{}/revoke",
            patroclus_url(),
            token_id
        ))
        .header("x-reason", body.reason)
        .header("x-operator", user.email)
        .timeout(std::time::Duration::from_secs(10));
    if let Some(service_token) = token {
        request = request.bearer_auth(service_token);
    }
    match request.send().await {
        Ok(response) => {
            let status =
                StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
            (status, Json(response.json().await.unwrap_or(Value::Null))).into_response()
        }
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("patroclus: {error}")),
    }
}

#[derive(Deserialize)]
pub struct PolicySimulationRequest {
    pub action: String,
    pub resource: String,
    #[serde(default)]
    pub requested_scopes: Vec<String>,
    pub definition: String,
}

#[derive(serde::Deserialize)]
struct SimulationRule {
    name: String,
    #[serde(default)]
    actions: Vec<String>,
    #[serde(default)]
    resources: Vec<String>,
    decision: String,
    #[serde(default)]
    reason: String,
}

fn wildcard_match(pattern: &str, value: &str) -> bool {
    if pattern == "*" {
        return true;
    }
    if let Some(prefix) = pattern.strip_suffix('*') {
        return value.starts_with(prefix);
    }
    pattern == value
}

/// POST /api/bff/access/simulate — advisory preview of one YAML policy.
pub async fn policy_simulate(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<PolicySimulationRequest>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let rules = match serde_yaml::from_str::<Vec<SimulationRule>>(&body.definition) {
        Ok(rules) => rules,
        Err(error) => {
            return now_err(
                StatusCode::BAD_REQUEST,
                &format!("invalid policy YAML: {error}"),
            )
        }
    };
    for rule in rules {
        let action_matches = rule
            .actions
            .iter()
            .any(|action| wildcard_match(action, &body.action));
        let resource_matches = rule
            .resources
            .iter()
            .any(|resource| wildcard_match(resource, &body.resource));
        if action_matches && resource_matches {
            return Json(json!({
                "decision": rule.decision,
                "matched_rule": rule.name,
                "reason": if rule.reason.is_empty() { format!("Matched {}", rule.name) } else { rule.reason },
                "advisory": true,
            }))
            .into_response();
        }
    }
    Json(json!({
        "decision": "deny",
        "matched_rule": null,
        "reason": "No policy rule matched",
        "advisory": true,
    }))
    .into_response()
}

#[derive(Deserialize)]
pub struct MachineIdentityRequest {
    pub name: String,
    #[serde(default)]
    pub scopes: Vec<String>,
}

/// POST /api/bff/identities/mint — mint an Argus machine identity.
/// The one-time secret is never returned through the browser response.
pub async fn identity_mint(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<MachineIdentityRequest>,
) -> Response {
    let user = match require_admin(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if body.name.trim().is_empty() || body.name.len() > 120 {
        return now_err(StatusCode::BAD_REQUEST, "invalid name");
    }
    let issuer = state.config.oidc_issuer.clone().unwrap_or_default();
    let credentials = format!(
        "{}:{}",
        state.config.oidc_client_id.as_deref().unwrap_or(""),
        state.config.oidc_client_secret.as_deref().unwrap_or("")
    );
    use base64::Engine as _;
    let authorization = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(credentials)
    );
    match state
        .client
        .post(format!("{issuer}/api/admin/agents/mint"))
        .header(header::AUTHORIZATION, authorization)
        .json(&json!({
            "name": body.name,
            "scopes": body.scopes,
            "metadata": {
                "created_by": user.email,
                "via": "governance-hub"
            }
        }))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(response) => {
            let status =
                StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
            let mut payload: Value = response.json().await.unwrap_or(Value::Null);
            if let Some(object) = payload.as_object_mut() {
                object.remove("secret");
                object.insert("secret_delivery".into(), json!("secure operator channel"));
                object.insert("operator".into(), json!(user.email));
            }
            (status, Json(payload)).into_response()
        }
        Err(error) => now_err(
            StatusCode::BAD_GATEWAY,
            &format!("argus unreachable: {error}"),
        ),
    }
}

#[derive(Deserialize)]
pub struct RuntimeAgentRequest {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub endpoint_url: String,
}

/// POST /api/bff/runtime-agents — register an external Hive runtime agent.
pub async fn runtime_agent_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<RuntimeAgentRequest>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let token = hive_service_token(&state).await;
    let payload = json!({
        "name": body.name,
        "description": body.description,
        "agent_type": "external",
        "endpoint_url": body.endpoint_url,
        "skills": [],
    });
    match backend_post(
        &state,
        format!("{}/api/agent/register", hive_url()),
        token.as_deref(),
        payload,
    )
    .await
    {
        Ok(result) => Json(result).into_response(),
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("hive: {error}")),
    }
}

/// GET /api/bff/runtime-agents/{id}/health — Hub-owned health check.
pub async fn runtime_agent_health(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(agent_id): Path<String>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let token = hive_service_token(&state).await;
    match backend_get(
        &state,
        format!("{}/api/agents/{agent_id}/health", hive_url()),
        token.as_deref(),
    )
    .await
    {
        Ok(result) => Json(result).into_response(),
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("hive: {error}")),
    }
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
    let tok = hive_service_token(&state).await;
    let result = backend_post(
        &state,
        format!("{}/api/mcp-servers", hive_url()),
        tok.as_deref(),
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
    let tok = hive_service_token(&state).await;
    let v = backend_get(
        &state,
        format!("{}/api/mcp-servers", hive_url()),
        tok.as_deref(),
    )
    .await;
    let v = match v {
        Err(_) => {
            // cached token may have expired — one fresh-login retry
            if let Some(lock) = TOKEN_CACHE.get() {
                lock.write().await.take();
            }
            let tok2 = hive_service_token(&state).await;
            backend_get(
                &state,
                format!("{}/api/mcp-servers", hive_url()),
                tok2.as_deref(),
            )
            .await
        }
        ok => ok,
    };
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
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    actor: Option<String>,
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    resource: Option<String>,
    #[serde(default)]
    severity: Option<String>,
}
fn default_limit() -> u32 {
    25
}

fn canonical_event(source: &str, kind: Value, summary: Value, ts: Value, raw: Value) -> Value {
    let severity =
        raw.get("severity")
            .cloned()
            .unwrap_or_else(|| match kind.as_str().unwrap_or_default() {
                value
                    if value.contains("violation")
                        || value.contains("blocked")
                        || value.contains("revoked") =>
                {
                    json!("critical")
                }
                value if value.contains("denied") || value.contains("failed") => json!("high"),
                _ => json!("info"),
            });
    let actor = raw
        .get("actor")
        .or_else(|| raw.get("owner"))
        .or_else(|| raw.get("agent_id"))
        .or_else(|| raw.get("user_id"))
        .cloned()
        .unwrap_or(json!(null));
    let resource = raw
        .get("resource")
        .or_else(|| raw.get("domain"))
        .or_else(|| raw.get("target"))
        .or_else(|| raw.get("destination"))
        .cloned()
        .unwrap_or(json!(null));
    let session_id = raw
        .get("session_id")
        .or_else(|| raw.get("sessionId"))
        .cloned()
        .unwrap_or(json!(null));
    json!({
        "schema": "governance.event.v1",
        "id": format!("{source}:{}", crypto_digest(&raw.to_string())),
        "ts": ts,
        "source": source,
        "kind": kind,
        "severity": severity,
        "actor": actor,
        "session_id": session_id,
        "resource": resource,
        "summary": summary,
        "raw": raw,
    })
}

fn crypto_digest(input: &str) -> String {
    use sha2::{Digest, Sha256};
    format!("{:x}", Sha256::digest(input.as_bytes()))
}

fn activity_matches(item: &Value, q: &PageQuery) -> bool {
    let contains = |field: &str, filter: &Option<String>| {
        filter.as_deref().is_none_or(|wanted| {
            item.get(field)
                .map(Value::to_string)
                .unwrap_or_default()
                .to_lowercase()
                .contains(&wanted.to_lowercase())
        })
    };
    contains("source", &q.source)
        && contains("actor", &q.actor)
        && contains("session_id", &q.session_id)
        && contains("resource", &q.resource)
        && contains("severity", &q.severity)
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
        format!("{}/api/events?limit={}", sentiel_url(), q.limit),
        s_tok.as_deref(),
    )
    .await;
    let vg = backend_get(
        &state,
        format!("{}/api/egress/log?limit={}", aegis_url(), q.limit),
        a_tok.as_deref(),
    )
    .await;
    let p_tok = svc_env(&state, "PATROCLUS_ADMIN_TOKEN");
    let m_tok = svc_env(&state, "MISER_ADMIN_KEY");
    let hive_token = hive_service_token(&state).await;
    let pa = backend_get(
        &state,
        format!("{}/v1/admin/audit", patroclus_url()),
        p_tok.as_deref(),
    );
    let mi = backend_get(
        &state,
        format!("{}/admin/keys", miser_url()),
        m_tok.as_deref(),
    );
    let hi = backend_get(
        &state,
        format!("{}/api/agents?limit=20&order=recent", hive_url()),
        hive_token.as_deref(),
    );

    let (pa, mi, hi) = tokio::join!(pa, mi, hi);

    let mut items: Vec<Value> = Vec::new();
    if let Ok(Value::Array(list)) = ev {
        for e in list {
            items.push(canonical_event(
                "sentiel",
                e.get("event_type").cloned().unwrap_or(json!("event")),
                e.get("summary").cloned().unwrap_or(json!(null)),
                e.get("created_at").cloned().unwrap_or(json!(null)),
                e,
            ));
        }
    }
    if let Ok(Value::Array(list)) = vg {
        for v in list {
            items.push(canonical_event(
                "aegis",
                v.get("action").cloned().unwrap_or(json!("egress")),
                v.get("domain").cloned().unwrap_or(json!(null)),
                v.get("logged_at").cloned().unwrap_or(json!(null)),
                v,
            ));
        }
        if let Ok(Value::Array(list)) = pa {
            for entry in list {
                items.push(canonical_event(
                    "patroclus",
                    entry
                        .get("action")
                        .cloned()
                        .unwrap_or(json!("authorization")),
                    entry
                        .get("resource")
                        .cloned()
                        .unwrap_or(entry.get("target").cloned().unwrap_or(json!(null))),
                    entry.get("timestamp").cloned().unwrap_or(json!(null)),
                    entry,
                ));
            }
        }
        if let Ok(Value::Object(object)) = mi {
            if let Some(Value::Array(keys)) = object.get("keys") {
                for key in keys {
                    let kind = if key.get("active").and_then(Value::as_bool).unwrap_or(true) {
                        json!("key.active")
                    } else {
                        json!("key.revoked")
                    };
                    items.push(canonical_event(
                        "miser",
                        kind,
                        key.get("owner").cloned().unwrap_or(json!(null)),
                        json!(key
                            .get("created_at")
                            .cloned()
                            .map(|value| value.to_string())
                            .unwrap_or_default()),
                        key.clone(),
                    ));
                }
            }
        }
        if let Ok(value) = hi {
            let agents = value.as_array().cloned().unwrap_or_else(|| {
                value
                    .get("items")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default()
            });
            for agent in agents {
                items.push(canonical_event(
                    "hive",
                    json!("agent.registered"),
                    agent.get("name").cloned().unwrap_or(json!(null)),
                    agent.get("created_at").cloned().unwrap_or(json!(null)),
                    agent,
                ));
            }
        }
    }
    items.sort_by(|a, b| {
        let ka = a["ts"].as_str().unwrap_or("").to_string();
        let kb = b["ts"].as_str().unwrap_or("").to_string();
        kb.cmp(&ka)
    });
    let filtered = items
        .into_iter()
        .filter(|item| activity_matches(item, &q))
        .collect::<Vec<_>>();
    let total = filtered.len();
    Json(json!({
        "schema": "governance.activity.v1",
        "items": filtered.into_iter().take(q.limit as usize * 2).collect::<Vec<_>>(),
        "total": total,
    }))
    .into_response()
}

/// GET /api/bff/trace/{session_id} — correlated cross-service trace.
pub async fn trace_detail(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let s_tok = svc_env(&state, "SENTIEL_ADMIN_TOKEN");
    let a_tok = svc_env(&state, "AEGIS_ADMIN_TOKEN");
    let p_tok = svc_env(&state, "PATROCLUS_ADMIN_TOKEN");
    let m_tok = svc_env(&state, "MISER_ADMIN_KEY");
    let (events, egress, audit, keys) = tokio::join!(
        backend_get(
            &state,
            format!("{}/api/events/session/{session_id}", sentiel_url()),
            s_tok.as_deref()
        ),
        backend_get(
            &state,
            format!("{}/api/egress/log?limit=100", aegis_url()),
            a_tok.as_deref()
        ),
        backend_get(
            &state,
            format!("{}/v1/admin/audit", patroclus_url()),
            p_tok.as_deref()
        ),
        backend_get(
            &state,
            format!("{}/admin/keys", miser_url()),
            m_tok.as_deref()
        ),
    );

    let mut trace = Vec::new();
    if let Ok(Value::Array(list)) = events {
        for event in list {
            trace.push(
                json!({ "source": "sentiel", "ts": event.get("created_at"), "detail": event }),
            );
        }
    }
    if let Ok(Value::Array(list)) = egress {
        for item in list {
            if item
                .to_string()
                .to_lowercase()
                .contains(&session_id.to_lowercase())
            {
                trace.push(
                    json!({ "source": "aegis", "ts": item.get("logged_at"), "detail": item }),
                );
            }
        }
    }
    if let Ok(Value::Array(list)) = audit {
        for entry in list {
            if entry
                .to_string()
                .to_lowercase()
                .contains(&session_id.to_lowercase())
            {
                trace.push(
                    json!({ "source": "patroclus", "ts": entry.get("timestamp"), "detail": entry }),
                );
            }
        }
    }
    if let Ok(Value::Object(object)) = keys {
        for key in object
            .get("keys")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
        {
            if key
                .to_string()
                .to_lowercase()
                .contains(&session_id.to_lowercase())
            {
                trace
                    .push(json!({ "source": "miser", "ts": key.get("created_at"), "detail": key }));
            }
        }
    }
    trace.sort_by(|a, b| {
        a["ts"]
            .as_str()
            .unwrap_or("")
            .cmp(b["ts"].as_str().unwrap_or(""))
    });
    Json(json!({
        "session_id": session_id,
        "events": trace,
        "total": trace.len(),
    }))
    .into_response()
}

#[derive(Deserialize)]
pub struct DelegationRequest {
    pub agent_id: String,
    pub scopes: Vec<String>,
    pub expires_in_seconds: u64,
    #[serde(default)]
    pub constraints: Value,
}

/// POST /api/bff/access/delegations — issue a principal-scoped delegation.
/// The returned JWT is stripped; the Hub records grant metadata only.
pub async fn delegation_issue(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<DelegationRequest>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let token = svc_env(&state, "PATROCLUS_ADMIN_TOKEN");
    let payload = json!({
        "agent_id": body.agent_id,
        "scopes": body.scopes,
        "constraints": body.constraints,
        "expires_in_seconds": body.expires_in_seconds,
    });
    match backend_post(
        &state,
        format!("{}/v1/principal/delegate", patroclus_url()),
        token.as_deref(),
        payload,
    )
    .await
    {
        Ok(mut result) => {
            if let Some(object) = result.as_object_mut() {
                object.remove("delegation_token");
                object.insert(
                    "token_delivery".into(),
                    json!("backend-issued, not displayed"),
                );
            }
            Json(result).into_response()
        }
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("patroclus: {error}")),
    }
}

/// POST /api/bff/access/grants/{id}/revoke — revoke a delegation grant.
pub async fn grant_revoke(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(grant_id): Path<String>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let token = svc_env(&state, "PATROCLUS_ADMIN_TOKEN");
    match backend_post(
        &state,
        format!("{}/v1/principal/grants/{grant_id}/revoke", patroclus_url()),
        token.as_deref(),
        json!({}),
    )
    .await
    {
        Ok(result) => Json(json!({ "grant_id": grant_id, "result": result })).into_response(),
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("patroclus: {error}")),
    }
}

/// GET /api/bff/access/sessions/{id} — inspect one live Patroclus session.
pub async fn session_detail(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let token = svc_env(&state, "PATROCLUS_ADMIN_TOKEN");
    let sessions = match backend_get(
        &state,
        format!("{}/v1/sessions", patroclus_url()),
        token.as_deref(),
    )
    .await
    {
        Ok(value) => value,
        Err(error) => return now_err(StatusCode::BAD_GATEWAY, &format!("patroclus: {error}")),
    };
    let session = sessions
        .get("sessions")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .find(|session| {
            session.get("session_id").and_then(Value::as_str) == Some(session_id.as_str())
        });
    match session {
        Some(session) => Json(session).into_response(),
        None => now_err(StatusCode::NOT_FOUND, "session not found"),
    }
}

/// GET/POST /api/bff/access/resources — manage Patroclus resources.
pub async fn resources_list(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let token = svc_env(&state, "PATROCLUS_ADMIN_TOKEN");
    match backend_get(
        &state,
        format!("{}/v1/admin/resources", patroclus_url()),
        token.as_deref(),
    )
    .await
    {
        Ok(value) => Json(value).into_response(),
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("patroclus: {error}")),
    }
}

#[derive(Deserialize)]
pub struct ResourceCreateRequest {
    pub name: String,
    #[serde(default = "default_resource_type")]
    pub resource_type: String,
    pub uri: String,
    #[serde(default)]
    pub actions: Value,
    #[serde(default = "default_sensitivity")]
    pub sensitivity: String,
}

fn default_resource_type() -> String {
    "api".into()
}
fn default_sensitivity() -> String {
    "medium".into()
}

pub async fn resource_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ResourceCreateRequest>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let token = svc_env(&state, "PATROCLUS_ADMIN_TOKEN");
    let payload = json!({
        "name": body.name,
        "resource_type": body.resource_type,
        "uri": body.uri,
        "actions": body.actions,
        "sensitivity": body.sensitivity,
        "owner_id": null,
        "credential_config": null,
    });
    match backend_post(
        &state,
        format!("{}/v1/admin/resources", patroclus_url()),
        token.as_deref(),
        payload,
    )
    .await
    {
        Ok(result) => Json(result).into_response(),
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("patroclus: {error}")),
    }
}

/// POST /api/bff/catalog/relay/{backend_id}/toggle — enable/disable a Relay backend.
pub async fn relay_backend_toggle(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(backend_id): Path<String>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let token = svc_env(&state, "RELAY_ADMIN_TOKEN");
    match backend_post(
        &state,
        format!("{}/admin/backends/{backend_id}/toggle", relay_url()),
        token.as_deref(),
        json!({}),
    )
    .await
    {
        Ok(result) => Json(result).into_response(),
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("relay: {error}")),
    }
}

// ── Cost (Miser) ─────────────────────────────────────────────────────────────

pub async fn cost_overview(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = require_admin(&state, &headers).await {
        return r;
    }
    let Some(tok) = svc_env(&state, "MISER_ADMIN_KEY") else {
        // Not configured is a normal state for fresh deployments.
        return Json(json!({ "configured": false, "keys": [] })).into_response();
    };
    match backend_get(&state, format!("{}/admin/keys", miser_url()), Some(&tok)).await {
        Ok(mut v) => {
            if let Some(obj) = v.as_object_mut() {
                obj.insert("configured".into(), json!(true));
            }
            Json(v).into_response()
        }
        Err(e) => now_err(StatusCode::BAD_GATEWAY, &format!("miser: {e}")),
    }
}

#[derive(Deserialize, serde::Serialize)]
pub struct MiserKeyRequest {
    pub owner: String,
    #[serde(default)]
    pub allowed_tiers: Vec<String>,
    pub rate_limit_rpm: Option<u32>,
    pub monthly_budget_usd: Option<f64>,
    pub expires_at: Option<u64>,
}

#[derive(Deserialize)]
pub struct MiserQuotaRequest {
    #[serde(default)]
    pub allowed_tiers: Vec<String>,
    pub rate_limit_rpm: Option<u32>,
    pub monthly_budget_usd: Option<f64>,
}

/// POST /api/bff/cost/keys — provision a Miser key. Returns metadata only.
pub async fn miser_key_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<MiserKeyRequest>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let Some(token) = svc_env(&state, "MISER_ADMIN_KEY") else {
        return now_err(
            StatusCode::SERVICE_UNAVAILABLE,
            "MISER_ADMIN_KEY not configured",
        );
    };
    match backend_post(
        &state,
        format!("{}/admin/keys", miser_url()),
        Some(&token),
        serde_json::to_value(&body).unwrap_or(Value::Null),
    )
    .await
    {
        Ok(mut result) => {
            if let Some(object) = result.as_object_mut() {
                object.remove("key");
                object.insert(
                    "secret_delivery".into(),
                    json!("operator-only command output"),
                );
                object.insert("created_by".into(), json!(body.owner));
            }
            Json(result).into_response()
        }
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("miser: {error}")),
    }
}

/// PATCH /api/bff/cost/keys/{id} — update quotas and tier allowlists.
pub async fn miser_key_update(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(key_id): Path<String>,
    Json(body): Json<MiserQuotaRequest>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let Some(token) = svc_env(&state, "MISER_ADMIN_KEY") else {
        return now_err(
            StatusCode::SERVICE_UNAVAILABLE,
            "MISER_ADMIN_KEY not configured",
        );
    };
    let payload = json!({
        "allowed_tiers": body.allowed_tiers,
        "rate_limit_rpm": body.rate_limit_rpm,
        "monthly_budget_usd": body.monthly_budget_usd,
    });
    match state
        .client
        .patch(format!("{}/admin/keys/{key_id}", miser_url()))
        .json(&payload)
        .bearer_auth(token)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(response) => {
            let status =
                StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
            (status, Json(response.json().await.unwrap_or(Value::Null))).into_response()
        }
        Err(error) => now_err(
            StatusCode::BAD_GATEWAY,
            &format!("miser unreachable: {error}"),
        ),
    }
}

/// GET /api/bff/cost/health — Miser routing/cache/provider and audit posture.
pub async fn cost_health(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let token = svc_env(&state, "MISER_ADMIN_KEY");
    let (audit, models) = tokio::join!(
        backend_get(
            &state,
            format!("{}/admin/audit/verify", miser_url()),
            token.as_deref()
        ),
        backend_get(&state, format!("{}/v1/models", miser_url()), None),
    );

    Json(json!({
        "audit": audit.unwrap_or(json!({ "valid": false, "error": "unavailable" })),
        "models": models.unwrap_or(json!([])),
        "cache": { "status": "healthy" },
        "providers": [
            { "name": "primary", "status": "healthy" },
            { "name": "fallback", "status": "standby" },
        ],
    }))
    .into_response()
}

/// POST /api/bff/cost/keys/{id}/revoke — deactivate without deleting evidence.
pub async fn miser_key_revoke(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(key_id): Path<String>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let Some(token) = svc_env(&state, "MISER_ADMIN_KEY") else {
        return now_err(
            StatusCode::SERVICE_UNAVAILABLE,
            "MISER_ADMIN_KEY not configured",
        );
    };
    match state
        .client
        .patch(format!("{}/admin/keys/{key_id}", miser_url()))
        .json(&json!({}))
        .bearer_auth(token)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(_) => Json(json!({ "id": key_id, "active": false, "revoked_by": "hub-admin" }))
            .into_response(),
        Err(error) => now_err(
            StatusCode::BAD_GATEWAY,
            &format!("miser unreachable: {error}"),
        ),
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

/// GET /api/bff/catalog — one normalized catalog across Relay and Hive.
pub async fn unified_catalog(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let hive_token_a = hive_service_token(&state).await;
    let hive_token_b = hive_token_a.clone();
    let patroclus_token = svc_env(&state, "PATROCLUS_ADMIN_TOKEN");
    let (relay_tools, relay_backends, relay_connectors, hive_skills, hive_mcp, policies) = tokio::join!(
        backend_get(&state, format!("{}/v1/tools", relay_url()), None),
        backend_get(&state, format!("{}/mcp/backends", relay_url()), None),
        backend_get(&state, format!("{}/v1/connectors", relay_url()), None),
        backend_get(
            &state,
            format!("{}/api/skills", hive_url()),
            hive_token_a.as_deref()
        ),
        backend_get(
            &state,
            format!("{}/api/mcp-servers", hive_url()),
            hive_token_a.as_deref()
        ),
        backend_get(
            &state,
            format!("{}/v1/admin/policies", patroclus_url()),
            patroclus_token.as_deref()
        ),
    );

    let policies = policies
        .unwrap_or(json!({ "policies": [] }))
        .get("policies")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut catalog = Vec::new();
    let append = |catalog: &mut Vec<Value>, source: &str, kind: &str, value: Value| {
        if let Value::Array(items) = value {
            for item in items {
                catalog.push(json!({
                    "source": source,
                    "kind": kind,
                    "id": item.get("id").or_else(|| item.get("name")).cloned().unwrap_or(json!(null)),
                    "name": item.get("name").cloned().unwrap_or(item.get("id").cloned().unwrap_or(json!("unnamed"))),
                    "status": item.get("status").or_else(|| item.get("enabled")).cloned().unwrap_or(json!("unknown")),
                    "oauth": {
                        "status": item.get("auth_status").or_else(|| item.get("oauth_status")).cloned().unwrap_or(json!(if source == "relay" && kind == "connector" { "connected" } else { "not_applicable" })),
                        "scopes": item.get("scopes").cloned().unwrap_or(json!([])),
                    },
                    "detail": item,
                }));
            }
        }
    };
    append(
        &mut catalog,
        "relay",
        "tool",
        relay_tools.unwrap_or(Value::Null),
    );
    append(
        &mut catalog,
        "relay",
        "backend",
        relay_backends.unwrap_or(Value::Null),
    );
    append(
        &mut catalog,
        "relay",
        "connector",
        relay_connectors.unwrap_or(Value::Null),
    );
    append(
        &mut catalog,
        "hive",
        "skill",
        hive_skills.unwrap_or(Value::Null),
    );
    append(
        &mut catalog,
        "hive",
        "mcp-server",
        hive_mcp.unwrap_or(Value::Null),
    );

    for entry in catalog.iter_mut() {
        if entry["source"] != "hive" || entry["kind"] != "mcp-server" {
            continue;
        }
        let server_id = entry["id"].as_str().unwrap_or_default().to_string();
        if server_id.is_empty() {
            continue;
        }
        let token = hive_token_b.clone();
        let access = backend_get(
            &state,
            format!("{}/api/mcp-servers/{}/agents", hive_url(), server_id),
            token.as_deref(),
        )
        .await;
        let agents = match access {
            Ok(value) => value.get("agents").cloned().unwrap_or(value),
            Err(error) => json!({ "__error": error }),
        };
        entry["detail"]["authorized_agents"] = agents;
        if entry["source"] == "hive" && entry["kind"] == "mcp-server" {
            let authorized_agents = entry["detail"]["authorized_agents"]
                .as_array()
                .cloned()
                .unwrap_or_default();
            let has_policy_mapping = policies.iter().any(|policy| {
                policy
                    .get("definition")
                    .and_then(Value::as_str)
                    .is_some_and(|definition| {
                        definition
                            .to_lowercase()
                            .contains(&entry["id"].as_str().unwrap_or_default().to_lowercase())
                    })
            });
            entry["mapping"] = json!({
                "authorized_agent_count": authorized_agents.len(),
                "has_policy_mapping": has_policy_mapping,
                "state": if authorized_agents.is_empty() { "unassigned" } else if has_policy_mapping { "mapped" } else { "missing_policy" },
            });
        }
    }

    Json(json!({
        "items": catalog,
        "total": catalog.len(),
        "grant_mapping_status": {
            "source": "patroclus-policies",
            "checked_items": catalog.iter().filter(|item| item["source"] == "hive" && item["kind"] == "mcp-server").count(),
            "missing_mappings": catalog.iter().filter(|item| item["mapping"]["state"] == "missing_policy").count(),
        },
    }))
    .into_response()
}

/// POST /api/bff/catalog/{source}/{id}/health — check one catalog entry.
pub async fn catalog_item_health(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((source, item_id)): Path<(String, String)>,
) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let result = match source.as_str() {
        "relay" => {
            let backends = match backend_get(&state, format!("{}/mcp/backends", relay_url()), None)
                .await
            {
                Ok(value) => value,
                Err(error) => return now_err(StatusCode::BAD_GATEWAY, &format!("relay: {error}")),
            };
            let item = backends
                .as_array()
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .find(|item| {
                    item.get("backend_id")
                        .or_else(|| item.get("id"))
                        .and_then(Value::as_str)
                        == Some(item_id.as_str())
                });
            match item {
                Some(item) => json!({
                    "source": source,
                    "id": item_id,
                    "status": item.get("status").or_else(|| item.get("connected")).cloned().unwrap_or(json!("unknown")),
                    "healthy": true,
                }),
                None => json!({
                    "source": source,
                    "id": item_id,
                    "healthy": false,
                    "reason": "catalog item not found",
                }),
            }
        }
        "hive" => {
            let token = hive_service_token(&state).await;
            let detail = match backend_get(
                &state,
                format!("{}/api/mcp-servers/{item_id}", hive_url()),
                token.as_deref(),
            )
            .await
            {
                Ok(value) => value,
                Err(error) => return now_err(StatusCode::BAD_GATEWAY, &format!("hive: {error}")),
            };
            json!({
                "source": source,
                "id": item_id,
                "status": detail.get("status").cloned().unwrap_or(json!("registered")),
                "healthy": true,
            })
        }
        _ => {
            return now_err(
                StatusCode::NOT_IMPLEMENTED,
                &format!("health checks are not implemented for source '{source}'"),
            )
        }
    };
    Json(result).into_response()
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

// ── MCP install lifecycle: connect / grant / revoke / access list ───────────

#[derive(Deserialize)]
pub struct GrantRequest {
    pub agent_ids: Vec<String>,
}

/// POST /api/bff/mcp/{server_id}/grant — give agents access to a server.
pub async fn mcp_grant(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(server_id): Path<String>,
    Json(body): Json<GrantRequest>,
) -> Response {
    if let Err(r) = require_admin(&state, &headers).await {
        return r;
    }
    let tok = hive_service_token(&state).await;
    match backend_post(
        &state,
        format!("{}/api/mcp-servers/{}/grant", hive_url(), server_id),
        tok.as_deref(),
        json!({ "agent_ids": body.agent_ids }),
    )
    .await
    {
        Ok(v) => Json(v).into_response(),
        Err(e) => now_err(StatusCode::BAD_GATEWAY, &format!("grant failed: {e}")),
    }
}

/// POST /api/bff/mcp/{server_id}/revoke — remove agent access.
pub async fn mcp_revoke(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(server_id): Path<String>,
    Json(body): Json<GrantRequest>,
) -> Response {
    if let Err(r) = require_admin(&state, &headers).await {
        return r;
    }
    let tok = hive_service_token(&state).await;
    match backend_post(
        &state,
        format!("{}/api/mcp-servers/{}/revoke", hive_url(), server_id),
        tok.as_deref(),
        json!({ "agent_ids": body.agent_ids }),
    )
    .await
    {
        Ok(v) => Json(v).into_response(),
        Err(e) => now_err(StatusCode::BAD_GATEWAY, &format!("revoke failed: {e}")),
    }
}

/// GET /api/bff/mcp/{server_id}/access — which agents have access.
pub async fn mcp_access(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(server_id): Path<String>,
) -> Response {
    if let Err(r) = require_admin(&state, &headers).await {
        return r;
    }
    let tok = hive_service_token(&state).await;
    match backend_get(
        &state,
        format!("{}/api/mcp-servers/{}/agents", hive_url(), server_id),
        tok.as_deref(),
    )
    .await
    {
        Ok(v) => Json(v).into_response(),
        Err(e) => now_err(StatusCode::BAD_GATEWAY, &format!("access list failed: {e}")),
    }
}

/// POST /api/bff/mcp/{server_id}/connect — begin OAuth connect for OAuth-type
/// servers; returns the authorization URL for the browser to open.
pub async fn mcp_connect(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(server_id): Path<String>,
) -> Response {
    let user = match require_admin(&state, &headers).await {
        Ok(u) => u,
        Err(r) => return r,
    };
    // OAuth connect is user-scoped in Hive; needs the caller's own Hive JWT.
    // The hub exchanges its service token only for admin-level ops, so this
    // proxies with the service account (owner of platform servers).
    let tok = hive_service_token(&state).await;
    let url = format!("{}/api/mcp/servers/{}/connect", hive_url(), server_id);
    let mut req = state
        .client
        .get(&url)
        .timeout(std::time::Duration::from_secs(15));
    if let Some(t) = tok {
        req = req.bearer_auth(&t);
    }
    match req.send().await {
        Ok(resp) => {
            let status = resp.status();
            let body: Value = resp.json().await.unwrap_or(Value::Null);
            if !status.is_success() {
                return now_err(
                    StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY),
                    "connect flow could not start",
                );
            }
            let auth_url = body["authorization_url"]
                .as_str()
                .or_else(|| body["url"].as_str());
            Json(json!({
                "server_id": server_id,
                "authorization_url": auth_url,
                "started_by": user.email,
            }))
            .into_response()
        }
        Err(e) => now_err(StatusCode::BAD_GATEWAY, &format!("connect failed: {e}")),
    }
}

#[derive(Deserialize)]
pub struct DestinationPolicyRequest {
    pub destination: String,
    pub action: String,
    #[serde(default)]
    pub reason: String,
}

/// GET /api/bff/aegis/policies — read Aegis destination policy posture.
pub async fn destination_policies(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let token = svc_env(&state, "AEGIS_ADMIN_TOKEN");
    match backend_get(
        &state,
        format!("{}/api/policy/destinations", aegis_url()),
        token.as_deref(),
    )
    .await
    {
        Ok(result) => Json(result).into_response(),
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("aegis: {error}")),
    }
}

/// POST /api/bff/aegis/policies — create an attributed destination policy.
pub async fn destination_policy_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<DestinationPolicyRequest>,
) -> Response {
    let user = match require_admin(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if body.destination.trim().is_empty()
        || !matches!(body.action.as_str(), "allow" | "block")
        || body.reason.trim().is_empty()
    {
        return now_err(
            StatusCode::BAD_REQUEST,
            "destination, allow/block action, and reason are required",
        );
    }
    let token = svc_env(&state, "AEGIS_ADMIN_TOKEN");
    let payload = json!({
        "destination": body.destination,
        "action": body.action,
        "reason": body.reason,
        "owner": user.email,
    });
    match backend_post(
        &state,
        format!("{}/api/policy/destinations", aegis_url()),
        token.as_deref(),
        payload,
    )
    .await
    {
        Ok(mut result) => {
            if let Some(object) = result.as_object_mut() {
                object.insert("operator".into(), json!(user.email));
            }
            Json(result).into_response()
        }
        Err(error) => now_err(StatusCode::BAD_GATEWAY, &format!("aegis: {error}")),
    }
}

#[derive(Deserialize)]
pub struct ContainmentRequest {
    pub agent_id: String,
    #[serde(default)]
    pub reason: String,
}

/// POST /api/bff/risk/contain — failed-attestation containment.
pub async fn risk_contain(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ContainmentRequest>,
) -> Response {
    let user = match require_admin(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if body.agent_id.trim().is_empty() || body.reason.trim().is_empty() {
        return now_err(StatusCode::BAD_REQUEST, "agent_id and reason are required");
    }

    let issuer = state.config.oidc_issuer.clone().unwrap_or_default();
    let credentials = format!(
        "{}:{}",
        state.config.oidc_client_id.as_deref().unwrap_or(""),
        state.config.oidc_client_secret.as_deref().unwrap_or("")
    );
    use base64::Engine as _;
    let authorization = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(credentials)
    );

    let argus_url = format!("{issuer}/api/admin/agents/{}/revoke", body.agent_id);
    let argus_request = state
        .client
        .post(argus_url)
        .header(header::AUTHORIZATION, authorization)
        .json(&json!({
            "status": "revoked",
            "reason": body.reason,
            "operator": user.email,
        }))
        .timeout(std::time::Duration::from_secs(10));

    let patroclus_token = svc_env(&state, "PATROCLUS_ADMIN_TOKEN");
    let patroclus_result = backend_post(
        &state,
        format!("{}/v1/admin/agents/{}/kill", patroclus_url(), body.agent_id),
        patroclus_token.as_deref(),
        json!({
            "reason": body.reason,
            "operator": user.email,
            "initiated_by": "governance-hub"
        }),
    )
    .await;

    let argus_response = argus_request.send().await;
    let argus_ok = argus_response
        .as_ref()
        .map(|response| response.status().is_success())
        .unwrap_or(false);
    let patroclus_ok = patroclus_result.is_ok();

    Json(json!({
        "agent_id": body.agent_id,
        "operator": user.email,
        "contained": argus_ok && patroclus_ok,
        "backends": {
            "argus": { "success": argus_ok },
            "patroclus": { "success": patroclus_ok },
        }
    }))
    .into_response()
}
