pub mod accounts;
pub mod fulfilment;
pub mod payments;
pub mod store;

use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Path, State},
    http::{HeaderMap, HeaderValue, Method, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post, put},
};
use rusqlite::{Connection, TransactionBehavior, params};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    env,
    path::PathBuf,
    sync::{Arc, Mutex, MutexGuard},
    time::Duration,
};
use subtle::ConstantTimeEq;
use tower_http::{cors::CorsLayer, services::ServeDir};
use uuid::Uuid;

pub type ApiResult<T> = Result<T, AppError>;

#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub message: String,
}

impl AppError {
    pub fn bad(message: &str) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }
    pub fn unavailable(message: &str) -> Self {
        Self {
            status: StatusCode::SERVICE_UNAVAILABLE,
            message: message.into(),
        }
    }
    fn conflict(message: &str) -> Self {
        Self {
            status: StatusCode::CONFLICT,
            message: message.into(),
        }
    }
    fn unauthorized() -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            message: "Authorization is required.".into(),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        eprintln!("Database operation failed: {error}");
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: "Could not save or read the order. Please try again.".into(),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}

#[derive(Clone)]
pub struct Config {
    pub bind: String,
    pub database: String,
    pub frontend_dir: String,
    pub frontend_origin: Option<String>,
    pub admin_token: String,
    pub razorpay_key: String,
    pub razorpay_secret: String,
    pub webhook_secret: String,
    pub razorpay_base: String,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        let admin_token = env::var("ADMIN_TOKEN").unwrap_or_default();
        if admin_token.len() < 32 {
            return Err("Set ADMIN_TOKEN to a random value of at least 32 characters.".into());
        }
        let key = env::var("RAZORPAY_KEY_ID").unwrap_or_default();
        let secret = env::var("RAZORPAY_KEY_SECRET").unwrap_or_default();
        if key.is_empty() != secret.is_empty() {
            return Err("Set both Razorpay key ID and key secret, or leave both empty.".into());
        }
        Ok(Self {
            bind: env::var("BIND").unwrap_or_else(|_| "127.0.0.1:3001".into()),
            database: env::var("DATABASE_PATH").unwrap_or_else(|_| "data/panpops.sqlite3".into()),
            frontend_dir: env::var("FRONTEND_DIR").unwrap_or_else(|_| "../dist".into()),
            frontend_origin: env::var("FRONTEND_ORIGIN")
                .ok()
                .filter(|value| !value.is_empty()),
            admin_token,
            razorpay_key: key,
            razorpay_secret: secret,
            webhook_secret: env::var("RAZORPAY_WEBHOOK_SECRET").unwrap_or_default(),
            razorpay_base: "https://api.razorpay.com/v1".into(),
        })
    }

    fn payments_ready(&self) -> bool {
        !self.razorpay_key.is_empty() && !self.razorpay_secret.is_empty()
    }
}

pub struct AppState {
    pub config: Config,
    db: Mutex<Connection>,
    pub client: reqwest::Client,
}

impl AppState {
    pub fn new(config: Config) -> Result<Self, Box<dyn std::error::Error>> {
        if config.database != ":memory:" {
            let path = PathBuf::from(&config.database);
            if let Some(parent) = path.parent().filter(|path| !path.as_os_str().is_empty()) {
                std::fs::create_dir_all(parent)?;
            }
        }
        let db = Connection::open(&config.database)?;
        #[cfg(unix)]
        if config.database != ":memory:" {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&config.database, std::fs::Permissions::from_mode(0o600))?;
        }
        store::initialize(&db)?;
        accounts::initialize(&db)?;
        #[cfg(unix)]
        if config.database != ":memory:" {
            use std::os::unix::fs::PermissionsExt;
            for suffix in ["-wal", "-shm"] {
                let path = format!("{}{suffix}", config.database);
                if std::path::Path::new(&path).exists() {
                    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))?;
                }
            }
        }
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()?;
        Ok(Self {
            config,
            db: Mutex::new(db),
            client,
        })
    }

    fn connection(&self) -> ApiResult<MutexGuard<'_, Connection>> {
        self.db
            .lock()
            .map_err(|_| AppError::unavailable("The database is unavailable."))
    }
}

pub fn app(state: Arc<AppState>) -> Router {
    let mut router = Router::new()
        .route("/api/health", get(|| async { Json(json!({"ok":true})) }))
        .route("/api/config", get(config))
        .route("/api/account/register", post(accounts::register))
        .route("/api/account/login", post(accounts::login))
        .route("/api/account/logout", post(accounts::logout))
        .route("/api/account/me", get(accounts::me))
        .route("/api/account/orders", get(accounts::orders))
        .route("/api/products", get(catalogue))
        .route("/api/quote", post(quote))
        .route("/api/orders", post(create_order))
        .route("/api/orders/{id}", get(order_status))
        .route("/api/payments/verify", post(verify_payment))
        .route("/api/webhooks/razorpay", post(webhook))
        .route("/api/admin/products", get(admin_catalogue))
        .route("/api/admin/products/{id}", put(update_product))
        .route(
            "/api/admin/settings",
            get(admin_settings).put(update_settings),
        )
        .route("/api/admin/orders", get(admin_orders))
        .route("/api/admin/orders/{id}", put(fulfilment::update))
        .fallback_service(
            ServeDir::new(&state.config.frontend_dir).append_index_html_on_directories(true),
        )
        .layer(DefaultBodyLimit::max(32 * 1024));

    if let Some(origin) = &state.config.frontend_origin {
        let origin: HeaderValue = origin
            .parse()
            .expect("FRONTEND_ORIGIN must be a valid HTTP origin");
        router = router.layer(
            CorsLayer::new()
                .allow_credentials(true)
                .allow_origin(origin)
                .allow_methods([Method::GET, Method::POST, Method::PUT])
                .allow_headers([
                    header::CONTENT_TYPE,
                    header::AUTHORIZATION,
                    header::HeaderName::from_static("x-idempotency-key"),
                ]),
        );
    }
    router.with_state(state)
}

async fn config(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({ "payments_ready": state.config.payments_ready(), "currency": "INR" }))
}

async fn catalogue(State(state): State<Arc<AppState>>) -> ApiResult<Json<Value>> {
    let conn = state.connection()?;
    Ok(Json(json!({ "products": store::products(&conn)? })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct QuoteRequest {
    items: Vec<store::Item>,
}

async fn quote(
    State(state): State<Arc<AppState>>,
    Json(body): Json<QuoteRequest>,
) -> ApiResult<Json<store::Quote>> {
    Ok(Json(store::quote(&*state.connection()?, &body.items)?))
}

fn authorize(headers: &HeaderMap, expected: &str) -> ApiResult<()> {
    let supplied = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or_default();
    if expected.is_empty() || !bool::from(supplied.as_bytes().ct_eq(expected.as_bytes())) {
        return Err(AppError::unauthorized());
    }
    Ok(())
}

async fn admin_catalogue(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    authorize(&headers, &state.config.admin_token)?;
    catalogue(State(state)).await
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ProductUpdate {
    price_paise: i64,
    active: bool,
    version: i64,
}

async fn update_product(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(body): Json<ProductUpdate>,
) -> ApiResult<Json<Value>> {
    authorize(&headers, &state.config.admin_token)?;
    if !(100..=100_000_000).contains(&body.price_paise) {
        return Err(AppError::bad("Price must be between ₹1 and ₹10,00,000."));
    }
    let conn = state.connection()?;
    let changed = conn.execute(
        "UPDATE products SET price_paise=?2,active=?3,version=version+1 WHERE id=?1 AND version=?4",
        params![id, body.price_paise, body.active, body.version],
    )?;
    if changed != 1 {
        return Err(AppError::conflict(
            "The product changed. Reload the catalogue before saving.",
        ));
    }
    Ok(Json(json!({ "products": store::products(&conn)? })))
}

async fn admin_settings(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<Json<store::Settings>> {
    authorize(&headers, &state.config.admin_token)?;
    Ok(Json(store::settings(&*state.connection()?)?))
}

async fn update_settings(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<store::Settings>,
) -> ApiResult<Json<store::Settings>> {
    authorize(&headers, &state.config.admin_token)?;
    if !(0..=1_000_000).contains(&body.shipping_paise)
        || !(0..=100_000_000).contains(&body.free_shipping_min_paise)
    {
        return Err(AppError::bad(
            "Delivery values are outside the supported range.",
        ));
    }
    let conn = state.connection()?;
    let changed = conn.execute(
        "UPDATE settings SET shipping_paise=?1,free_shipping_min_paise=?2,version=version+1 WHERE id=1 AND version=?3",
        params![body.shipping_paise, body.free_shipping_min_paise, body.version],
    )?;
    if changed != 1 {
        return Err(AppError::conflict(
            "Delivery settings changed. Reload before saving.",
        ));
    }
    Ok(Json(store::settings(&conn)?))
}

async fn admin_orders(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    authorize(&headers, &state.config.admin_token)?;
    let conn = state.connection()?;
    Ok(Json(json!({ "orders": fulfilment::list(&conn,None)? })))
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Customer {
    full_name: String,
    email: String,
    phone: String,
    address: String,
    address2: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
}

impl Customer {
    fn validate(&mut self) -> ApiResult<()> {
        for value in [
            &mut self.full_name,
            &mut self.email,
            &mut self.phone,
            &mut self.address,
            &mut self.address2,
            &mut self.city,
            &mut self.state,
            &mut self.pincode,
            &mut self.country,
        ] {
            *value = value.trim().to_owned();
        }
        if self.full_name.is_empty()
            || self.full_name.len() > 100
            || self.email.len() > 150
            || !self
                .email
                .split_once('@')
                .is_some_and(|(name, domain)| !name.is_empty() && domain.contains('.'))
            || self.phone.len() != 10
            || !self.phone.bytes().all(|byte| byte.is_ascii_digit())
            || self.address.is_empty()
            || self.address.len() > 180
            || self.address2.len() > 100
            || self.city.is_empty()
            || self.city.len() > 80
            || self.state.is_empty()
            || self.state.len() > 80
            || self.pincode.len() != 6
            || !self.pincode.bytes().all(|byte| byte.is_ascii_digit())
            || self.country != "India"
        {
            return Err(AppError::bad(
                "Complete a valid Indian billing and delivery address.",
            ));
        }
        Ok(())
    }
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Package {
    kind: String,
    ids: Vec<String>,
    quantity: i64,
    capacity: Option<usize>,
}

fn validate_packages(packages: &[Package], items: &[store::Item]) -> ApiResult<()> {
    use std::collections::BTreeMap;
    if packages.is_empty() {
        return Ok(());
    }
    if packages.len() > 100 {
        return Err(AppError::bad("Too many packages."));
    }
    let mut packed = BTreeMap::new();
    for package in packages {
        let valid = match package.kind.as_str() {
            "pack" => {
                package.ids.len() == 1
                    && package.capacity.is_none()
                    && ["chataka", "cream", "peri", "salt"].contains(&package.ids[0].as_str())
            }
            "combo" => {
                package.ids.len() == 1
                    && store::combo_ids(&package.ids[0]).is_some()
                    && package.capacity.is_none()
            }
            "box" => {
                matches!(package.capacity, Some(4) | Some(6))
                    && package
                        .ids
                        .iter()
                        .all(|id| ["chataka", "cream", "peri", "salt"].contains(&id.as_str()))
                    && package.ids.len() >= 2
                    && package.ids.len() <= package.capacity.unwrap_or(0)
            }
            _ => false,
        };
        if !valid || !(1..=99).contains(&package.quantity) {
            return Err(AppError::bad("Invalid package contents or size."));
        }
        for id in &package.ids {
            *packed.entry(id.clone()).or_insert(0i64) += package.quantity;
        }
    }
    let mut ordered = BTreeMap::new();
    for item in items {
        *ordered.entry(item.id.clone()).or_insert(0i64) += item.quantity;
    }
    if packed != ordered {
        return Err(AppError::bad("Package contents do not match the order."));
    }
    Ok(())
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct OrderRequest {
    items: Vec<store::Item>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    packages: Vec<Package>,
    customer: Customer,
    over14: bool,
    expected_total_paise: i64,
}

fn order_response(order: &store::Order, key_id: &str) -> Value {
    json!({
        "id": order.id, "amount_paise": order.amount, "status": order.status,
        "razorpay_order_id": order.provider_id, "key_id": key_id, "order_token": order.token, "currency":"INR",
    })
}

async fn create_order(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(mut body): Json<OrderRequest>,
) -> ApiResult<Json<Value>> {
    if !state.config.payments_ready() {
        return Err(AppError::unavailable(
            "Razorpay is not configured on the server.",
        ));
    }
    if !body.over14 {
        return Err(AppError::bad(
            "Confirm that you are over 14 to place your own order.",
        ));
    }
    body.customer.validate()?;
    validate_packages(&body.packages, &body.items)?;
    let key = headers
        .get("x-idempotency-key")
        .and_then(|value| value.to_str().ok())
        .filter(|key| Uuid::parse_str(key).is_ok())
        .ok_or_else(|| AppError::bad("A valid checkout request reference is required."))?;
    let details =
        serde_json::to_string(&body).map_err(|_| AppError::bad("Invalid order details."))?;
    let request_hash = hex::encode(Sha256::digest(details.as_bytes()));
    let id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let amount;

    {
        let mut conn = state.connection()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        if let Some(existing) = store::order_by_key(&tx, key)? {
            if existing.request_hash != request_hash {
                return Err(AppError::conflict(
                    "This request reference belongs to different order details.",
                ));
            }
            if existing.provider_id.is_none() {
                return Err(AppError::conflict(
                    "Order creation needs reconciliation. Check the dashboard using the original order reference.",
                ));
            }
            return Ok(Json(order_response(&existing, &state.config.razorpay_key)));
        }
        let quote = store::quote(&tx, &body.items)?;
        if quote.total_paise != body.expected_total_paise {
            return Err(AppError::conflict(
                "Prices or delivery charges changed. Review your order again.",
            ));
        }
        amount = quote.total_paise;
        tx.execute(
            "INSERT INTO orders(id,idempotency_key,request_hash,access_token,amount,status,details) VALUES(?1,?2,?3,?4,?5,'creating',?6)",
            params![id, key, request_hash, token, amount, details],
        )?;
        if let Some(account) = accounts::user(&tx, &headers)? {
            if account["email"].as_str() != Some(&body.customer.email.to_lowercase()) {
                return Err(AppError::bad(
                    "Use your account email for this order, or sign out to checkout as a guest.",
                ));
            }
            tx.execute(
                "INSERT INTO order_owners(order_id,user_id) VALUES(?1,?2)",
                params![id, account["id"].as_str()],
            )?;
        }
        tx.commit()?;
    }

    let provider_id = match payments::create_order(&state, &id, amount).await {
        Ok(provider_id) => provider_id,
        Err(error) => {
            state
                .connection()?
                .execute("UPDATE orders SET status='needs_review' WHERE id=?1", [&id])?;
            return Err(AppError {
                status: error.status,
                message: format!("{} Order reference: {}.", error.message, id),
            });
        }
    };
    let conn = state.connection()?;
    conn.execute(
        "UPDATE orders SET provider_id=?2,status='created' WHERE id=?1",
        params![id, provider_id],
    )?;
    let order = store::order_by_id(&conn, &id)?
        .ok_or_else(|| AppError::unavailable("Could not read the created order."))?;
    Ok(Json(order_response(&order, &state.config.razorpay_key)))
}

async fn order_status(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let conn = state.connection()?;
    let order = store::order_by_id(&conn, &id)?.ok_or_else(AppError::unauthorized)?;
    authorize(&headers, &order.token)?;
    Ok(Json(
        json!({ "id": order.id, "status":order.status,"amount_paise":order.amount,"currency":"INR" }),
    ))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct VerifyRequest {
    order_id: String,
    payment_id: String,
    signature: String,
}

async fn verify_payment(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<VerifyRequest>,
) -> ApiResult<Json<Value>> {
    let order = store::order_by_id(&*state.connection()?, &body.order_id)?
        .ok_or_else(AppError::unauthorized)?;
    authorize(&headers, &order.token)?;
    let provider_id = order
        .provider_id
        .as_ref()
        .ok_or_else(|| AppError::conflict("The payment order has not been created."))?;
    let signed = format!("{}|{}", provider_id, body.payment_id);
    if !payments::verify_signature(
        &state.config.razorpay_secret,
        signed.as_bytes(),
        &body.signature,
    ) {
        return Err(AppError::bad("The payment signature is invalid."));
    }
    if order.status == "paid" {
        return Ok(Json(json!({ "id":order.id,"status":"paid" })));
    }
    let payment = payments::fetch_payment(&state, &body.payment_id).await?;
    if payment["order_id"] != provider_id.as_str()
        || payment["amount"].as_i64() != Some(order.amount)
        || payment["currency"] != "INR"
    {
        return Err(AppError::bad("The payment does not match this order."));
    }
    let status = if payment["status"] == "captured" {
        store::mark_paid(&*state.connection()?, &order.id, &body.payment_id)?;
        "paid"
    } else {
        "pending"
    };
    Ok(Json(json!({ "id":order.id,"status":status })))
}

async fn webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> ApiResult<Json<Value>> {
    if state.config.webhook_secret.is_empty() {
        return Err(AppError::unavailable(
            "Webhook verification is not configured.",
        ));
    }
    let signature = headers
        .get("x-razorpay-signature")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if !payments::verify_signature(&state.config.webhook_secret, &body, signature) {
        return Err(AppError::bad("Invalid webhook signature."));
    }
    let data: Value =
        serde_json::from_slice(&body).map_err(|_| AppError::bad("Invalid webhook body."))?;
    let event = data["event"].as_str().unwrap_or_default();
    if event != "payment.captured" && event != "order.paid" {
        return Ok(Json(json!({"ok":true})));
    }
    let payment = &data["payload"]["payment"]["entity"];
    let provider_id = payment["order_id"]
        .as_str()
        .ok_or_else(|| AppError::bad("Missing payment order reference."))?;
    let payment_id = payment["id"]
        .as_str()
        .ok_or_else(|| AppError::bad("Missing payment reference."))?;
    if payment["status"] != "captured" {
        return Err(AppError::bad("The payment is not captured."));
    }
    let event_id = headers
        .get("x-razorpay-event-id")
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned)
        .unwrap_or_else(|| hex::encode(Sha256::digest(&body)));
    let mut conn = state.connection()?;
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let Some(order) = store::order_by_provider(&tx, provider_id)? else {
        return Ok(Json(json!({"ok":true})));
    };
    if payment["amount"].as_i64() != Some(order.amount) || payment["currency"] != "INR" {
        return Err(AppError::bad("Webhook amount does not match the order."));
    }
    let inserted = tx.execute(
        "INSERT OR IGNORE INTO webhook_events(id) VALUES(?1)",
        [&event_id],
    )?;
    if inserted == 1 {
        store::mark_paid(&tx, &order.id, payment_id)?;
    }
    tx.commit()?;
    Ok(Json(json!({"ok":true})))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::{Body, to_bytes},
        http::Request,
    };
    use hmac::{Hmac, Mac};
    use std::sync::atomic::{AtomicBool, AtomicI64, AtomicUsize, Ordering};
    use tower::ServiceExt;

    fn settings(base: String) -> Config {
        Config {
            bind: "127.0.0.1:0".into(),
            database: ":memory:".into(),
            frontend_dir: "../dist".into(),
            frontend_origin: None,
            admin_token: "a-test-admin-token-with-32-characters".into(),
            razorpay_key: "rzp_test_example".into(),
            razorpay_secret: "test-payment-secret".into(),
            webhook_secret: "test-webhook-secret".into(),
            razorpay_base: base,
        }
    }

    fn signature(secret: &str, bytes: &[u8]) -> String {
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(bytes);
        hex::encode(mac.finalize().into_bytes())
    }

    async fn call(
        router: &Router,
        method: &str,
        path: &str,
        body: Value,
        headers: &[(&str, &str)],
    ) -> (StatusCode, Value) {
        let mut builder = Request::builder()
            .method(method)
            .uri(path)
            .header("content-type", "application/json");
        for (key, value) in headers {
            builder = builder.header(*key, *value);
        }
        let response = router
            .clone()
            .oneshot(builder.body(Body::from(body.to_string())).unwrap())
            .await
            .unwrap();
        let status = response.status();
        let bytes = to_bytes(response.into_body(), 32768).await.unwrap();
        (status, serde_json::from_slice(&bytes).unwrap())
    }

    #[test]
    fn six_pouch_boxes_preserve_their_contents() {
        let items = vec![
            store::Item {
                id: "chataka".into(),
                quantity: 3,
            },
            store::Item {
                id: "cream".into(),
                quantity: 3,
            },
        ];
        let mut packages = vec![Package {
            kind: "box".into(),
            ids: vec![
                "chataka".into(),
                "chataka".into(),
                "chataka".into(),
                "cream".into(),
                "cream".into(),
                "cream".into(),
            ],
            quantity: 1,
            capacity: Some(6),
        }];
        assert!(validate_packages(&packages, &items).is_ok());
        packages[0].capacity = Some(4);
        assert!(validate_packages(&packages, &items).is_err());
        packages[0].capacity = Some(6);
        packages[0].ids.pop();
        assert!(validate_packages(&packages, &items).is_err());
    }

    #[test]
    fn hmac_matches_known_vector_and_rejects_changed_bytes() {
        let expected = "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8";
        assert!(payments::verify_signature(
            "key",
            b"The quick brown fox jumps over the lazy dog",
            expected
        ));
        assert!(!payments::verify_signature(
            "key",
            b"The quick brown fox jumps over the lazy dog.",
            expected
        ));
        assert!(!payments::verify_signature("key", b"anything", "not-hex"));
    }

    #[tokio::test]
    async fn prices_orders_and_webhooks_remain_consistent() {
        struct Gateway {
            calls: AtomicUsize,
            amount: AtomicI64,
            captured: AtomicBool,
        }
        let gateway = Arc::new(Gateway {
            calls: AtomicUsize::new(0),
            amount: AtomicI64::new(0),
            captured: AtomicBool::new(false),
        });
        let create_gateway = gateway.clone();
        let fetch_gateway = gateway.clone();
        let mock = Router::new().route("/orders", post(move |Json(body): Json<Value>| {
            let state = create_gateway.clone();
            async move {
                state.calls.fetch_add(1, Ordering::SeqCst);
                let amount = body["amount"].as_i64().unwrap();
                state.amount.store(amount, Ordering::SeqCst);
                Json(json!({"id":"order_test","amount":amount,"currency":"INR"}))
            }
        })).route("/payments/pay_test", get(move || {
            let state = fetch_gateway.clone();
            async move { Json(json!({
                "id":"pay_test", "order_id":"order_test", "amount":state.amount.load(Ordering::SeqCst),
                "currency":"INR","status":if state.captured.load(Ordering::SeqCst) {"captured"} else {"authorized"}
            })) }
        }));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let task = tokio::spawn(async move {
            axum::serve(listener, mock).await.unwrap();
        });
        let state = Arc::new(AppState::new(settings(base)).unwrap());
        let router = app(state.clone());
        let admin = "Bearer a-test-admin-token-with-32-characters";

        assert_eq!(
            call(
                &router,
                "PUT",
                "/api/admin/products/chataka",
                json!({"price_paise":23200,"active":true,"version":1}),
                &[]
            )
            .await
            .0,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            call(
                &router,
                "PUT",
                "/api/admin/products/chataka",
                json!({"price_paise":23200,"active":true,"version":1}),
                &[("authorization", admin)]
            )
            .await
            .0,
            StatusCode::OK
        );
        assert_eq!(
            call(
                &router,
                "PUT",
                "/api/admin/products/chataka",
                json!({"price_paise":100,"active":true,"version":1}),
                &[("authorization", admin)]
            )
            .await
            .0,
            StatusCode::CONFLICT
        );
        assert_eq!(
            call(
                &router,
                "POST",
                "/api/quote",
                json!({"items":[{"id":"unknown","quantity":1}]}),
                &[]
            )
            .await
            .0,
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            call(
                &router,
                "POST",
                "/api/quote",
                json!({"items":[{"id":"cream","quantity":99},{"id":"cream","quantity":1}]}),
                &[]
            )
            .await
            .0,
            StatusCode::BAD_REQUEST
        );
        let (_, quote) = call(
            &router,
            "POST",
            "/api/quote",
            json!({"items":[{"id":"chataka","quantity":1},{"id":"cream","quantity":2}]}),
            &[],
        )
        .await;
        assert_eq!(quote["total_paise"], 59200);
        let key = Uuid::new_v4().to_string();
        let headers = [("x-idempotency-key", key.as_str())];
        let mut body = json!({
            "items":[{"id":"chataka","quantity":1},{"id":"cream","quantity":2}],
            "expected_total_paise":1, "over14":true,
            "packages":[{"kind":"box","ids":["chataka","cream","cream"],"quantity":1,"capacity":4}],
            "customer":{"full_name":"Test Customer","email":"test@example.com","phone":"9000000000","address":"1 Test Street","address2":"","city":"Mumbai","state":"Maharashtra","pincode":"400001","country":"India"}
        });
        assert_eq!(
            call(&router, "POST", "/api/orders", body.clone(), &headers)
                .await
                .0,
            StatusCode::CONFLICT
        );
        assert_eq!(gateway.calls.load(Ordering::SeqCst), 0);
        body["expected_total_paise"] = json!(59200);
        let (status, order) = call(&router, "POST", "/api/orders", body.clone(), &headers).await;
        assert_eq!(status, StatusCode::OK);
        let saved: String = state
            .connection()
            .unwrap()
            .query_row(
                "SELECT details FROM orders WHERE id=?1",
                [order["id"].as_str().unwrap()],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            serde_json::from_str::<Value>(&saved).unwrap()["packages"][0]["capacity"],
            4
        );
        assert_eq!(
            call(&router, "POST", "/api/orders", body.clone(), &headers)
                .await
                .1["id"],
            order["id"]
        );
        assert_eq!(gateway.calls.load(Ordering::SeqCst), 1);
        body["customer"]["full_name"] = json!("Changed customer");
        assert_eq!(
            call(&router, "POST", "/api/orders", body, &headers).await.0,
            StatusCode::CONFLICT
        );
        let bearer = format!("Bearer {}", order["order_token"].as_str().unwrap());
        let id = order["id"].as_str().unwrap();
        let signed = signature("test-payment-secret", b"order_test|pay_test");
        let mut verification = json!({"order_id":id,"payment_id":"pay_test","signature":"bad"});
        assert_eq!(
            call(
                &router,
                "POST",
                "/api/payments/verify",
                verification.clone(),
                &[("authorization", &bearer)]
            )
            .await
            .0,
            StatusCode::BAD_REQUEST
        );
        verification["signature"] = json!(signed);
        assert_eq!(
            call(
                &router,
                "POST",
                "/api/payments/verify",
                verification,
                &[("authorization", &bearer)]
            )
            .await
            .1["status"],
            "pending"
        );

        gateway.captured.store(true, Ordering::SeqCst);
        gateway.amount.store(1, Ordering::SeqCst);
        let captured_check = json!({"order_id":id,"payment_id":"pay_test","signature":signature("test-payment-secret",b"order_test|pay_test")});
        assert_eq!(
            call(
                &router,
                "POST",
                "/api/payments/verify",
                captured_check.clone(),
                &[("authorization", &bearer)]
            )
            .await
            .0,
            StatusCode::BAD_REQUEST
        );
        gateway.amount.store(59200, Ordering::SeqCst);
        assert_eq!(
            call(
                &router,
                "POST",
                "/api/payments/verify",
                captured_check,
                &[("authorization", &bearer)]
            )
            .await
            .1["status"],
            "paid"
        );
        let mut hook = json!({"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test","order_id":"order_test","amount":1,"currency":"INR","status":"captured"}}}});
        let signed_hook = signature("test-webhook-secret", hook.to_string().as_bytes());
        assert_eq!(
            call(
                &router,
                "POST",
                "/api/webhooks/razorpay",
                hook.clone(),
                &[("x-razorpay-signature", &signed_hook)]
            )
            .await
            .0,
            StatusCode::BAD_REQUEST
        );
        hook["payload"]["payment"]["entity"]["amount"] = json!(59200);
        let signed_hook = signature("test-webhook-secret", hook.to_string().as_bytes());
        let hook_headers = [
            ("x-razorpay-signature", signed_hook.as_str()),
            ("x-razorpay-event-id", "event_test"),
        ];
        assert_eq!(
            call(
                &router,
                "POST",
                "/api/webhooks/razorpay",
                hook.clone(),
                &hook_headers
            )
            .await
            .0,
            StatusCode::OK
        );
        assert_eq!(
            call(
                &router,
                "POST",
                "/api/webhooks/razorpay",
                hook,
                &hook_headers
            )
            .await
            .0,
            StatusCode::OK
        );
        let (_, saved) = call(
            &router,
            "GET",
            &format!("/api/orders/{id}"),
            Value::Null,
            &[("authorization", &bearer)],
        )
        .await;
        assert_eq!(saved["status"], "paid");
        assert_eq!(
            call(
                &router,
                "PUT",
                "/api/admin/settings",
                json!({"shipping_paise":4900,"free_shipping_min_paise":40000,"version":1}),
                &[("authorization", admin)]
            )
            .await
            .0,
            StatusCode::OK
        );
        let (_, single) = call(
            &router,
            "POST",
            "/api/quote",
            json!({"items":[{"id":"cream","quantity":1}]}),
            &[],
        )
        .await;
        assert_eq!(single["shipping_paise"], 4900);
        let (_, multiple) = call(
            &router,
            "POST",
            "/api/quote",
            json!({"items":[{"id":"cream","quantity":3}]}),
            &[],
        )
        .await;
        assert_eq!(multiple["shipping_paise"], 0);
        assert_eq!(
            call(
                &router,
                "PUT",
                "/api/admin/products/cream",
                json!({"price_paise":18000,"active":false,"version":1}),
                &[("authorization", admin)]
            )
            .await
            .0,
            StatusCode::OK
        );
        assert_eq!(
            call(
                &router,
                "POST",
                "/api/quote",
                json!({"items":[{"id":"cream","quantity":1}]}),
                &[]
            )
            .await
            .0,
            StatusCode::BAD_REQUEST
        );
        let conn = state.connection().unwrap();
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM webhook_events", [], |row| row
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
        drop(conn);
        task.abort();
    }
}
