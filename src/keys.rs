//! JWKS fetching/caching for validating Argus tokens at the hub.

use anyhow::Context;

#[derive(Debug, Clone)]
pub struct IdpKey {
    pub kid: String,
    pub jwk: serde_json::Value,
}

/// Fetch the first RSA/RS256 signing key from the IdP's JWKS.
pub async fn fetch_current_key(http: &reqwest::Client, jwks_uri: &str) -> anyhow::Result<IdpKey> {
    let doc: serde_json::Value = http
        .get(jwks_uri)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let keys = doc["keys"].as_array().context("jwks has no keys")?;
    let k = keys
        .iter()
        .find(|k| k["alg"] == "RS256" && k["kty"] == "RSA")
        .context("no RS256 key in jwks")?;
    Ok(IdpKey {
        kid: k["kid"].as_str().unwrap_or_default().to_string(),
        jwk: k.clone(),
    })
}
