//! Console features: OIDC login/logout, service registry CRUD, identity
//! directory (humans + agents from Argus), proxied through to the IdP.

use crate::{auth, AppState};
use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Redirect, Response},
    Json,
};
use serde::Deserialize;
use serde_json::json;

const SESSION_COOKIE: &str = auth::SESSION_COOKIE;

fn rand_state() -> String {
    use base64::Engine;
    use rand::RngCore;
    let mut buf = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut buf);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf)
}

fn cookie_of(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .filter_map(|kv| kv.trim().split_once('='))
        .find(|(k, _)| *k == name)
        .map(|(_, v)| v.to_owned())
}

async fn current_user(state: &AppState, headers: &HeaderMap) -> Option<auth::HubUser> {
    let sid = cookie_of(headers, SESSION_COOKIE)?;
    state.sessions.get(&sid)
}

fn session_cookie(sid: &str) -> String {
    format!("{SESSION_COOKIE}={sid}; Path=/; Max-Age=43200; HttpOnly; SameSite=Lax; Secure")
}

fn err(status: StatusCode, msg: &str) -> Response {
    (status, Json(json!({"error": msg}))).into_response()
}

// ---------------------------------------------------------------------------
// Login flow
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct LoginQuery {
    #[serde(default)]
    next: String,
}

/// Kick off the OIDC dance at Argus.
pub async fn login(State(state): State<AppState>, Query(q): Query<LoginQuery>) -> Response {
    let Some(oidc) = state.oidc() else {
        return err(
            StatusCode::SERVICE_UNAVAILABLE,
            "login not configured: oidc_issuer missing from hub.toml",
        );
    };
    let Ok(discovery) = oidc.discover(&state.client).await else {
        return err(StatusCode::BAD_GATEWAY, "IdP unreachable");
    };

    let login_state = rand_state();
    let (verifier, challenge) = auth::pkce_pair();
    let next = if q.next.starts_with('/') && !q.next.starts_with("//") {
        q.next
    } else {
        "/".into()
    };
    state
        .oidc_flow
        .lock()
        .unwrap()
        .insert(login_state.clone(), (verifier, next));

    // redirect_uri is always this hub's own origin + /auth/callback.
    let hub_origin =
        std::env::var("HUB_EXTERNAL_URL").unwrap_or_else(|_| "https://governance.rajeev.me".into());
    let redirect_uri = format!("{hub_origin}/auth/callback");

    let url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
        discovery.authorization_endpoint,
        urlencoding_escape(&oidc.client_id),
        urlencoding_escape(&redirect_uri),
        urlencoding_escape("openid profile email"),
        urlencoding_escape(&login_state),
        urlencoding_escape(&challenge),
    );
    Redirect::to(&url).into_response()
}

fn urlencoding_escape(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

#[derive(Deserialize)]
pub struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

pub async fn callback(State(state): State<AppState>, Query(q): Query<CallbackQuery>) -> Response {
    let Some(oidc) = state.oidc() else {
        return err(StatusCode::SERVICE_UNAVAILABLE, "login not configured");
    };
    if let Some(e) = q.error {
        return err(StatusCode::UNAUTHORIZED, &format!("IdP error: {e}"));
    }
    let (Some(code), Some(login_state)) = (q.code, q.state) else {
        return err(StatusCode::BAD_REQUEST, "missing code/state");
    };

    // Consume the flow entry exactly once.
    let (verifier, next) = {
        let mut flows = state.oidc_flow.lock().unwrap();
        match flows.remove(&login_state) {
            Some(v) => v,
            None => return err(StatusCode::BAD_REQUEST, "unknown or expired state"),
        }
    };

    let Ok(discovery) = oidc.discover(&state.client).await else {
        return err(StatusCode::BAD_GATEWAY, "IdP unreachable");
    };
    let hub_origin =
        std::env::var("HUB_EXTERNAL_URL").unwrap_or_else(|_| "https://governance.rajeev.me".into());
    let tokens = match auth::exchange_code(
        &state.client,
        &oidc,
        &discovery,
        &code,
        &format!("{hub_origin}/auth/callback"),
        &verifier,
    )
    .await
    {
        Ok(t) => t,
        Err(e) => {
            return err(
                StatusCode::UNAUTHORIZED,
                &format!("token exchange failed: {e}"),
            )
        }
    };

    // Derive the user from id_token claims; admin via IdP userinfo.
    let user = match auth::decode_and_build_user(
        &tokens.id_token,
        &state.client,
        &discovery,
        &tokens.access_token,
    )
    .await
    {
        Ok(u) => u,
        Err(e) => return err(StatusCode::UNAUTHORIZED, &format!("identity invalid: {e}")),
    };

    let sid = state.sessions.put(user, 12 * 3600);
    let mut resp = Redirect::to(&next).into_response();
    resp.headers_mut()
        .append(header::SET_COOKIE, session_cookie(&sid).parse().unwrap());
    resp
}

pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Some(sid) = cookie_of(&headers, SESSION_COOKIE) {
        state.sessions.remove(&sid);
    }
    let mut resp = Redirect::to("/").into_response();
    resp.headers_mut().append(
        header::SET_COOKIE,
        format!("{SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly")
            .parse()
            .unwrap(),
    );
    resp
}

pub async fn me(headers: HeaderMap, State(state): State<AppState>) -> Response {
    match current_user(&state, &headers).await {
        Some(u) => {
            Json(json!({"sub": u.sub, "email": u.email, "name": u.name, "admin": u.is_admin}))
                .into_response()
        }
        None => err(StatusCode::UNAUTHORIZED, "not logged in"),
    }
}

// ---------------------------------------------------------------------------
// Identity directory (proxied to Argus admin API with the service token)
// ---------------------------------------------------------------------------

#[allow(clippy::result_large_err)]
async fn argus_get(state: &AppState, path: &str) -> Result<serde_json::Value, Response> {
    let issuer = state
        .config
        .oidc_issuer
        .clone()
        .ok_or_else(|| err(StatusCode::SERVICE_UNAVAILABLE, "IdP not configured"))?;
    // Auth for admin API: the hub's client credentials via Basic.
    let cid = state.config.oidc_client_id.clone().unwrap_or_default();
    let secret = state.config.oidc_client_secret.clone().unwrap_or_default();
    let resp = state
        .client
        .get(format!("{issuer}{path}"))
        .header("x-argus-admin", format!("{cid}:{secret}"))
        .send()
        .await
        .map_err(|_| err(StatusCode::BAD_GATEWAY, "IdP unreachable"))?;
    let status = resp.status();
    let body: serde_json::Value = resp.json().await.unwrap_or_default();
    if !status.is_success() {
        return Err(err(
            StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY),
            "IdP refused",
        ));
    }
    Ok(body)
}

pub async fn identities(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let Some(user) = current_user(&state, &headers).await else {
        return err(StatusCode::UNAUTHORIZED, "login required");
    };
    if !user.is_admin {
        return err(StatusCode::FORBIDDEN, "admin required");
    }
    let (users, agents) = tokio::join!(
        argus_get(&state, "/api/admin/users"),
        argus_get(&state, "/api/admin/agents")
    );
    let users = users.unwrap_or_else(r_into_json);
    let agents = agents.unwrap_or_else(r_into_json);
    Json(json!({
        "humans": users.get("users").cloned().unwrap_or(json!([])),
        "agents": agents.get("agents").cloned().unwrap_or(json!([])),
    }))
    .into_response()
}

fn r_into_json(_r: Response) -> serde_json::Value {
    json!({})
}

// ---------------------------------------------------------------------------
// Service registry CRUD — persisted into /etc/governance-hub/services.d
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug)]
pub struct ServiceUpsert {
    pub id: String,
    pub label: String,
    pub description: String,
    pub url: String,
    #[serde(default)]
    pub public_url: Option<String>,
    #[serde(default)]
    pub ui_path: String,
    #[serde(default = "default_health")]
    pub health_path: String,
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default)]
    pub api_token: Option<String>,
}

fn default_health() -> String {
    "/health".into()
}
fn default_color() -> String {
    "#6366f1".into()
}

impl ServiceUpsert {
    fn validate(&self) -> Result<(), &'static str> {
        let id_ok = !self.id.is_empty()
            && self.id.len() <= 40
            && self
                .id
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
        if !id_ok {
            return Err("id must be short lowercase [a-z0-9-]");
        }
        if self.label.trim().is_empty() || self.label.len() > 80 {
            return Err("label required (max 80)");
        }
        if !(self.url.starts_with("http://") || self.url.starts_with("https://")) {
            return Err("url must be http(s)");
        }
        if self.description.len() > 200 {
            return Err("description too long");
        }
        Ok(())
    }

    fn to_toml(&self) -> String {
        let mut s = String::new();
        s.push_str(&format!("label = {}\n", toml_quote(&self.label)));
        s.push_str(&format!(
            "description = {}\n",
            toml_quote(&self.description)
        ));
        s.push_str(&format!("url = {}\n", toml_quote(&self.url)));
        if let Some(pu) = &self.public_url {
            s.push_str(&format!("public_url = {}\n", toml_quote(pu)));
        }
        s.push_str(&format!("ui_path = {}\n", toml_quote(&self.ui_path)));
        s.push_str(&format!(
            "health_path = {}\n",
            toml_quote(&self.health_path)
        ));
        s.push_str(&format!("color = {}\n", toml_quote(&self.color)));
        if let Some(t) = &self.api_token {
            s.push_str(&format!("api_token = {}\n", toml_quote(t)));
        }
        s
    }
}

fn toml_quote(s: &str) -> String {
    format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
}

fn services_dir() -> String {
    std::env::var("HUB_SERVICES_DIR").unwrap_or_else(|_| "/etc/governance-hub/services.d".into())
}

fn valid_service(id: &str) -> bool {
    id.chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        && !id.is_empty()
        && id.len() <= 40
}

#[allow(clippy::result_large_err)]
async fn require_admin_user(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<auth::HubUser, Response> {
    let user = current_user(state, headers)
        .await
        .ok_or_else(|| err(StatusCode::UNAUTHORIZED, "login required"))?;
    if !user.is_admin {
        return Err(err(StatusCode::FORBIDDEN, "admin required"));
    }
    Ok(user)
}

pub async fn services_list(State(_state): State<AppState>) -> Response {
    let dir = services_dir();
    let mut out = Vec::new();
    if let Ok(rd) = std::fs::read_dir(&dir) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if name.ends_with(".toml") {
                out.push(name.trim_end_matches(".toml").to_string());
            }
        }
    }
    out.sort();
    Json(json!({ "services": out })).into_response()
}

pub async fn service_upsert(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ServiceUpsert>,
) -> Response {
    if require_admin_user(&state, &headers).await.is_err() {
        return err(StatusCode::FORBIDDEN, "admin required");
    }
    if let Err(msg) = body.validate() {
        return err(StatusCode::BAD_REQUEST, msg);
    }
    let dir = services_dir();
    if std::fs::create_dir_all(&dir).is_err() {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "cannot write registry");
    }
    let path = format!("{}/{}.toml", dir, body.id);
    if std::fs::write(&path, body.to_toml()).is_err() {
        return err(StatusCode::INTERNAL_SERVER_ERROR, "write failed");
    }
    Json(json!({"status": "stored", "service": body.id, "note": "restart-free reload happens on next probe cycle"}))
        .into_response()
}

pub async fn service_delete(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Response {
    if require_admin_user(&state, &headers).await.is_err() {
        return err(StatusCode::FORBIDDEN, "admin required");
    }
    if !valid_service(&id) {
        return err(StatusCode::BAD_REQUEST, "invalid id");
    }
    let path = format!("{}/{}.toml", services_dir(), id);
    match std::fs::remove_file(&path) {
        Ok(_) => Json(json!({"status": "removed", "service": id})).into_response(),
        Err(_) => err(StatusCode::NOT_FOUND, "no such service file"),
    }
}

// ---------------------------------------------------------------------------
// Global auth gate — unauthenticated browsers go to Argus; APIs get 401.
// ---------------------------------------------------------------------------

pub async fn require_session(
    State(state): State<AppState>,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Response {
    let headers = request.headers().clone();
    if current_user(&state, &headers).await.is_some() {
        return next.run(request).await;
    }
    let wants_html = request
        .headers()
        .get(header::ACCEPT)
        .and_then(|v| v.to_str().ok())
        .map(|a| a.contains("text/html"))
        .unwrap_or(false);
    if wants_html {
        // Preserve where the user was heading so login can bounce back.
        let path = request
            .uri()
            .path_and_query()
            .map(|p| p.as_str())
            .unwrap_or("/");
        Redirect::to(&format!("/login?next={}", urlencoding_escape(path))).into_response()
    } else {
        err(StatusCode::UNAUTHORIZED, "login required")
    }
}
