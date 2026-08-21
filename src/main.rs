use governance_hub::{router, AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "governance_hub=info".into()),
        )
        .init();

    let path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "/etc/governance-hub/hub.toml".to_string());
    let cfg = governance_hub::Config::load(&path)?;
    let listen = cfg.listen.clone();
    let app = router(AppState::new(cfg));

    tracing::info!("governance-hub listening on {listen}");
    let listener = tokio::net::TcpListener::bind(&listen).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
