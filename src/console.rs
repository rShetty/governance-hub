//! Console features: OIDC login/logout, service registry CRUD, identity
//! directory (humans + agents from Argus), proxied through to the IdP.

use crate::{auth, AppState};
use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Redirect, Response},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

const SESSION_COOKIE: &str = auth::SESSION_COOKIE;

fn rand_state() -> String {
    use base64::Engine;
    use rand::RngCore;
    let mut buf = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut buf);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf)
}

/// Public wrapper for other modules (bff) to read session cookies.
pub fn cookie_value_pub(headers: &HeaderMap, name: &str) -> Option<String> {
    cookie_of(headers, name)
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

pub async fn callback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<CallbackQuery>,
) -> Response {
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

    // Capture the IdP session id for server-side admin API calls, then
    // derive the user from id_token claims; admin via IdP userinfo.
    let argus_sid = cookie_of(&headers, auth::ARGUS_SESSION_COOKIE).unwrap_or_default();
    let user = match auth::decode_and_build_user(
        &tokens.id_token,
        &state.client,
        &discovery,
        &tokens.access_token,
        argus_sid,
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
    let hub_origin =
        std::env::var("HUB_EXTERNAL_URL").unwrap_or_else(|_| "https://governance.rajeev.me".into());
    let idp_logout_url = format!(
        "{}/logout?post_logout_redirect_uri={}",
        state
            .config
            .oidc_issuer
            .as_deref()
            .unwrap_or("https://id.rajeev.me"),
        urlencoding_escape(&format!("{hub_origin}/login")),
    );
    let mut resp = Redirect::to(&idp_logout_url).into_response();
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
pub(crate) async fn argus_get(
    state: &AppState,
    path: &str,
    _user_session: Option<&str>,
) -> Result<serde_json::Value, Response> {
    let issuer = state
        .config
        .oidc_issuer
        .clone()
        .ok_or_else(|| err(StatusCode::SERVICE_UNAVAILABLE, "IdP not configured"))?;
    // Server-to-server: the hub authenticates as a registered confidential
    // client (Basic) — Argus trusts it for directory reads.
    use base64::Engine as _;
    let creds = format!(
        "{}:{}",
        state.config.oidc_client_id.as_deref().unwrap_or(""),
        state.config.oidc_client_secret.as_deref().unwrap_or("")
    );
    let basic = base64::engine::general_purpose::STANDARD.encode(creds);
    let resp = state
        .client
        .get(format!("{issuer}{path}"))
        .header(header::AUTHORIZATION, format!("Basic {basic}"))
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
    let argus_sid = user.argus_sid.clone();
    let (users, agents) = tokio::join!(
        argus_get(&state, "/api/admin/users", Some(&argus_sid)),
        argus_get(&state, "/api/admin/agents", Some(&argus_sid))
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

/// Argus machine-identity directory fetched server-to-server as the hub's
/// registered confidential client. Returns an empty list when the IdP is
/// unreachable so unified-actor correlation degrades gracefully.
pub(crate) async fn argus_agents_list(state: &AppState) -> Vec<Value> {
    match argus_get(state, "/api/admin/agents", None).await {
        Ok(body) => body
            .get("agents")
            .cloned()
            .unwrap_or(json!([]))
            .as_array()
            .cloned()
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

/// Argus audit events (identity/consent lifecycle) fetched server-to-server.
/// Returns an empty list when the IdP is unreachable so the activity feed
/// degrades gracefully.
pub(crate) async fn argus_audit_list(state: &AppState) -> Vec<Value> {
    match argus_get(state, "/api/admin/audit", None).await {
        Ok(body) => body
            .get("events")
            .or_else(|| body.get("items"))
            .cloned()
            .unwrap_or(json!([]))
            .as_array()
            .cloned()
            .unwrap_or_default(),
        Err(_) => Vec::new(),
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

/// GET /logout — the UI's sign-out link.
pub async fn logout_get(state: State<AppState>, headers: HeaderMap) -> Response {
    logout(state, headers).await
}
