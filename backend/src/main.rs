use panpops_server::{AppState, Config, app};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;
    let listener = tokio::net::TcpListener::bind(&config.bind).await?;
    println!("PanPops server listening on {}", listener.local_addr()?);
    let state = Arc::new(AppState::new(config)?);
    axum::serve(listener, app(state))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
