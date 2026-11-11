use panpops_server::{AppState, Config, app};
use std::{io, sync::Arc};
use tower::ServiceBuilder;
use vercel_runtime::{Error, axum::VercelLayer};

#[tokio::main]
async fn main() -> Result<(), Error> {
    let config = Config::from_env().map_err(|error| io::Error::other(error.to_string()))?;
    let state =
        Arc::new(AppState::new(config).map_err(|error| io::Error::other(error.to_string()))?);
    let service = ServiceBuilder::new()
        .layer(VercelLayer::new())
        .service(app(state));
    vercel_runtime::run(service).await
}
