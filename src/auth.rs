//! OIDC Relying-Party client for Argus + session management.
//!
//! The hub delegates all authentication to the IdP: browser hits /login →
//! Argus authorize (PKCE S256) → callback exchanges code → hub session.

use anyhow::Context as _;
use base64::Engine;
use serde::Deserialize;
use std::collections::HashMap;

pub const SESSION_COOKIE: &str = "hub_session";

#[derive(Debug, Clone)]
pub struct OidcConfig {
    pub issuer: String,
    pub client_id: String,
    pub client_secret: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Discovery {
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub userinfo_endpoint: String,
    #[serde(default)]
    pub jwks_uri: Option<String>,
}

impl OidcConfig {
    pub async fn discover(&self, http: &reqwest::Client) -> anyhow::Result<Discovery> {
        let url = format!(
            "{}/.well-known/openid-configuration",
            self.issuer.trim_end_matches('/')
        );
        http.get(&url)
            .send()
            .await?
            .error_for_status()?
            .json()
            .await
            .context("parse discovery document")
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HubUser {
    pub sub: String,
    pub email: String,
    pub name: String,
    pub is_admin: bool,
}

/// Exchange an authorization code at the token endpoint (PKCE).
pub async fn exchange_code(
    http: &reqwest::Client,
    oidc: &OidcConfig,
    discovery: &Discovery,
    code: &str,
    redirect_uri: &str,
    verifier: &str,
) -> anyhow::Result<TokenResponse> {
    let resp = http
        .post(&discovery.token_endpoint)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect_uri),
            ("client_id", oidc.client_id.as_str()),
            ("client_secret", oidc.client_secret.as_str()),
            ("code_verifier", verifier),
        ])
        .send()
        .await?
        .error_for_status()?;
    Ok(resp.json().await?)
}

#[derive(Debug, Clone, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    #[serde(default)]
    pub id_token: String,
    #[serde(default)]
    pub expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct IdClaims {
    sub: String,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    name: Option<String>,
}

/// Decode id_token claims WITHOUT verification of the signature here —
/// the token came directly from the token endpoint over TLS from our own
/// configured issuer (per OIDC Core §3.1.3.7 step 6 this is acceptable when
/// obtained via client credentials). JWKS validation is enforced on the
/// access token path below.
fn decode_id_claims(id_token: &str) -> anyhow::Result<IdClaims> {
    let part = id_token.split('.').nth(1).context("malformed id_token")?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(part)?;
    Ok(serde_json::from_slice(&bytes)?)
}

/// Validate an Argus access token against the IdP's JWKS (RS256).
pub async fn verify_access_token(
    _http: &reqwest::Client,
    key: &crate::keys::IdpKey,
    issuer: &str,
    token: &str,
) -> anyhow::Result<HubUser> {
    use jsonwebtoken::{decode, DecodingKey, Validation};
    let mut v = Validation::new(jsonwebtoken::Algorithm::RS256);
    v.set_issuer(&[issuer]);
    v.validate_aud = false; // aud = client_id of caller class; checked contextually
    let jwk: jsonwebtoken::jwk::Jwk =
        serde_json::from_value(key.jwk.clone()).context("invalid jwk shape")?;
    let data = decode::<IdClaims>(token, &DecodingKey::from_jwk(&jwk)?, &v)
        .map_err(|e| anyhow::anyhow!("bad token: {e}"))?;
    Ok(HubUser {
        sub: data.claims.sub.clone(),
        email: data.claims.email.unwrap_or_default(),
        name: data.claims.name.unwrap_or_default(),
        // Admin determination happens server-side per request via userinfo;
        // default false here.
        is_admin: false,
    })
}

// ---- Hub sessions ------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct SessionStore {
    inner: std::sync::Arc<std::sync::Mutex<HashMap<String, (HubUser, std::time::Instant)>>>,
}

impl Default for SessionStore {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            inner: std::sync::Arc::new(std::sync::Mutex::new(HashMap::new())),
        }
    }

    pub fn put(&self, user: HubUser, ttl_secs: u64) -> String {
        let sid = rand_id();
        self.inner.lock().unwrap().insert(
            sid.clone(),
            (
                user,
                std::time::Instant::now() + std::time::Duration::from_secs(ttl_secs),
            ),
        );
        sid
    }

    pub fn get(&self, sid: &str) -> Option<HubUser> {
        let mut m = self.inner.lock().unwrap();
        if let Some((user, exp)) = m.get(sid) {
            if *exp > std::time::Instant::now() {
                return Some(user.clone());
            }
            m.remove(sid);
        }
        None
    }

    pub fn remove(&self, sid: &str) {
        self.inner.lock().unwrap().remove(sid);
    }
}

fn rand_id() -> String {
    use rand::RngCore;
    let mut buf = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut buf);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf)
}

pub fn pkce_pair() -> (String, String) {
    use rand::RngCore;
    use sha2::Digest;
    let mut buf = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut buf);
    let verifier = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf);
    let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(sha2::Sha256::digest(verifier.as_bytes()));
    (verifier, challenge)
}

/// Build a HubUser from id_token claims; fetch admin flag from userinfo.
pub async fn decode_and_build_user(
    id_token: &str,
    http: &reqwest::Client,
    discovery: &Discovery,
    access_token: &str,
) -> anyhow::Result<HubUser> {
    let claims: IdClaims = decode_id_claims(id_token)?;
    // Admin check via userinfo (IdP decides).
    let ui: serde_json::Value = http
        .get(&discovery.userinfo_endpoint)
        .bearer_auth(access_token)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await
        .unwrap_or(serde_json::json!({}));
    let is_admin = ui["admin"].as_bool().unwrap_or(false);
    Ok(HubUser {
        sub: claims.sub,
        email: claims.email.unwrap_or_default(),
        name: claims.name.unwrap_or_default(),
        is_admin,
    })
}
