use crate::*;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::SaltString};
use rusqlite::OptionalExtension;

pub fn initialize(db: &Connection) -> rusqlite::Result<()> {
    db.execute_batch("CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_attempts(email TEXT PRIMARY KEY,attempts INTEGER NOT NULL,started INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS order_owners(order_id TEXT PRIMARY KEY REFERENCES orders(id),user_id TEXT NOT NULL REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS fulfilment(order_id TEXT PRIMARY KEY REFERENCES orders(id),status TEXT NOT NULL DEFAULT 'received',tracking TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS order_events(id INTEGER PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),status TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);")
}

fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
fn digest(value: &str) -> String {
    hex::encode(Sha256::digest(value.as_bytes()))
}
fn cookie_token(headers: &HeaderMap) -> &str {
    headers
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .split(';')
        .find_map(|v| v.trim().strip_prefix("panpops_session="))
        .unwrap_or("")
}
pub fn user(db: &Connection, headers: &HeaderMap) -> ApiResult<Option<Value>> {
    Ok(db.query_row("SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires>?2",params![digest(cookie_token(headers)),now()],|r|Ok(json!({"id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?,"email":r.get::<_,String>(2)?}))).optional()?)
}
fn same_origin(state: &AppState, headers: &HeaderMap) -> ApiResult<()> {
    if let Some(origin) = headers.get(header::ORIGIN).and_then(|v| v.to_str().ok()) {
        let host = headers
            .get(header::HOST)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let local_dev = state.config.bind.starts_with("127.0.0.1:")
            && (host.starts_with("127.0.0.1:") || host.starts_with("localhost:"))
            && ["http://127.0.0.1:5173", "http://localhost:5173"].contains(&origin);
        let allowed = local_dev
            || origin == format!("http://{host}")
            || origin == format!("https://{host}")
            || state.config.frontend_origin.as_deref() == Some(origin);
        if !allowed {
            return Err(AppError::bad("This request must come from the storefront."));
        }
    }
    if headers.get("sec-fetch-site").and_then(|v| v.to_str().ok()) == Some("cross-site") {
        return Err(AppError::bad("Cross-site requests are not accepted."));
    }
    Ok(())
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Credentials {
    email: String,
    password: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    over14: bool,
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<Credentials>,
) -> ApiResult<Response> {
    authenticate(state, headers, body, true).await
}
pub async fn login(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<Credentials>,
) -> ApiResult<Response> {
    authenticate(state, headers, body, false).await
}
async fn authenticate(
    state: Arc<AppState>,
    headers: HeaderMap,
    body: Credentials,
    register: bool,
) -> ApiResult<Response> {
    static HASH_SLOTS: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(4);
    let _slot = HASH_SLOTS.try_acquire().map_err(|_| AppError {
        status: StatusCode::TOO_MANY_REQUESTS,
        message: "Sign-in is busy. Please retry shortly.".into(),
    })?;
    same_origin(&state, &headers)?;
    let email = body.email.trim().to_lowercase();
    if email.len() > 150
        || !email.contains('@')
        || body.password.len() < 12
        || body.password.len() > 128
        || (register && (!body.over14 || body.name.trim().is_empty() || body.name.len() > 100))
    {
        return Err(AppError::bad(
            "Enter a valid email, name, age confirmation and a password of 12–128 characters.",
        ));
    }
    {
        let db = state.connection()?;
        db.execute("DELETE FROM auth_attempts WHERE started<?1", [now() - 900])?;
        let active: i64 = db.query_row("SELECT COUNT(*) FROM auth_attempts", [], |r| r.get(0))?;
        if active >= 1000 {
            return Err(AppError::unavailable(
                "Sign-in is busy. Please retry later.",
            ));
        }
        db.execute("INSERT INTO auth_attempts(email,attempts,started) VALUES(?1,1,?2) ON CONFLICT(email) DO UPDATE SET attempts=attempts+1",params![email,now()])?;
        let attempts: i64 = db.query_row(
            "SELECT attempts FROM auth_attempts WHERE email=?1",
            [&email],
            |r| r.get(0),
        )?;
        if attempts > 10 {
            return Err(AppError {
                status: StatusCode::TOO_MANY_REQUESTS,
                message: "Too many attempts. Try again in 15 minutes.".into(),
            });
        }
    }
    let existing: Option<(String, String)> = state
        .connection()?
        .query_row(
            "SELECT id,password_hash FROM users WHERE email=?1",
            [&email],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    let password = body.password;
    let stored = existing.as_ref().map(|(_, hash)| hash.clone());
    let result = tokio::task::spawn_blocking(move || {
        if register {
            let salt = SaltString::encode_b64(Uuid::new_v4().as_bytes()).map_err(|_| ())?;
            Argon2::default()
                .hash_password(password.as_bytes(), &salt)
                .map(|hash| hash.to_string())
                .map_err(|_| ())
        } else {
            // Perform the same expensive hash on an unknown email to avoid an easy timing oracle.
            let salt = SaltString::encode_b64(b"panpops-dummy-salt").map_err(|_| ())?;
            let fallback = Argon2::default()
                .hash_password(b"invalid-password", &salt)
                .map_err(|_| ())?
                .to_string();
            let encoded = stored.unwrap_or(fallback);
            let hash = PasswordHash::new(&encoded).map_err(|_| ())?;
            Argon2::default()
                .verify_password(password.as_bytes(), &hash)
                .map_err(|_| ())?;
            Ok(String::new())
        }
    })
    .await
    .map_err(|_| AppError::unavailable("Please retry signing in."))?
    .map_err(|_| AppError::bad("Email or password is incorrect."))?;
    let db = state.connection()?;
    let id = if register {
        if existing.is_some() {
            return Err(AppError::bad(
                "Unable to create this account. Try signing in.",
            ));
        }
        let id = Uuid::new_v4().to_string();
        db.execute(
            "INSERT INTO users(id,name,email,password_hash) VALUES(?1,?2,?3,?4)",
            params![id, body.name.trim(), email, result],
        )
        .map_err(|_| AppError::bad("Unable to create this account. Try signing in."))?;
        id
    } else {
        existing
            .ok_or_else(|| AppError::bad("Email or password is incorrect."))?
            .0
    };
    db.execute("DELETE FROM auth_attempts WHERE email=?1", [&email])?;
    db.execute("DELETE FROM sessions WHERE expires<=?1", [now()])?;
    let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    db.execute(
        "INSERT INTO sessions(token_hash,user_id,expires) VALUES(?1,?2,?3)",
        params![digest(&token), id, now() + 604800],
    )?;
    let secure = if state
        .config
        .frontend_origin
        .as_deref()
        .unwrap_or("")
        .starts_with("https:")
        || headers
            .get(header::ORIGIN)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .starts_with("https:")
    {
        "; Secure"
    } else {
        ""
    };
    let cookie =
        format!("panpops_session={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800{secure}");
    Ok((
        [
            (header::SET_COOKIE, cookie),
            (header::CACHE_CONTROL, "no-store".into()),
        ],
        Json(json!({"ok":true})),
    )
        .into_response())
}
pub async fn me(State(state): State<Arc<AppState>>, headers: HeaderMap) -> ApiResult<Response> {
    let account = user(&*state.connection()?, &headers)?.ok_or_else(AppError::unauthorized)?;
    Ok((
        [(header::CACHE_CONTROL, "no-store")],
        Json(json!({"user":account})),
    )
        .into_response())
}
pub async fn logout(State(state): State<Arc<AppState>>, headers: HeaderMap) -> ApiResult<Response> {
    same_origin(&state, &headers)?;
    state.connection()?.execute(
        "DELETE FROM sessions WHERE token_hash=?1",
        [digest(cookie_token(&headers))],
    )?;
    Ok((
        [(
            header::SET_COOKIE,
            "panpops_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        )],
        Json(json!({"ok":true})),
    )
        .into_response())
}
pub async fn orders(State(state): State<Arc<AppState>>, headers: HeaderMap) -> ApiResult<Response> {
    let db = state.connection()?;
    let account = user(&db, &headers)?.ok_or_else(AppError::unauthorized)?;
    let orders = crate::fulfilment::list(&db, Some(account["id"].as_str().unwrap()))?;
    Ok((
        [(header::CACHE_CONTROL, "no-store")],
        Json(json!({"orders":orders})),
    )
        .into_response())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::{Body, to_bytes},
        http::Request,
    };
    use tower::ServiceExt;
    #[tokio::test]
    async fn checkout_attaches_an_order_to_the_signed_in_customer() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let mock = Router::new().route(
            "/orders",
            post(|Json(body): Json<Value>| async move {
                Json(json!({"id":"order_mock_owned","amount":body["amount"],"currency":"INR"}))
            }),
        );
        let server = tokio::spawn(async move { axum::serve(listener, mock).await.unwrap() });
        let mut config = state().config.clone();
        config.razorpay_base = base;
        config.razorpay_key = "rzp_test_example".into();
        config.razorpay_secret = "example".into();
        let state = Arc::new(AppState::new(config).unwrap());
        let router = app(state.clone());
        let (_,_,cookie)=call(&router,"/api/account/register","POST",json!({"email":"owner@example.com","name":"Owner","password":"long-test-password","over14":true}),"",false).await;
        let body = json!({"items":[{"id":"fiery-pure","quantity":1}],"packages":[{"kind":"combo","ids":["fiery-pure"],"quantity":1,"capacity":null}],"over14":true,"expected_total_paise":36000,"customer":{"full_name":"Owner","email":"owner@example.com","phone":"9999999999","address":"Test address","address2":"","city":"Mumbai","state":"Maharashtra","pincode":"400001","country":"India"}});
        let request = Request::builder()
            .method("POST")
            .uri("/api/orders")
            .header("content-type", "application/json")
            .header("cookie", &cookie)
            .header("x-idempotency-key", Uuid::new_v4().to_string())
            .body(Body::from(body.to_string()))
            .unwrap();
        let response = router.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let (_, history, _) = call(
            &router,
            "/api/account/orders",
            "GET",
            json!({}),
            &cookie,
            false,
        )
        .await;
        assert_eq!(history["orders"].as_array().unwrap().len(), 1);
        assert_eq!(history["orders"][0]["items"][0]["id"], "fiery-pure");
        let invalid = Request::builder()
            .method("POST")
            .uri("/api/account/logout")
            .header("origin", "https://untrusted.example")
            .header("host", "127.0.0.1:3001")
            .header("cookie", &cookie)
            .body(Body::empty())
            .unwrap();
        assert_eq!(
            router.oneshot(invalid).await.unwrap().status(),
            StatusCode::BAD_REQUEST
        );
        server.abort();
    }
    async fn call(
        router: &Router,
        path: &str,
        method: &str,
        body: Value,
        cookie: &str,
        admin: bool,
    ) -> (StatusCode, Value, String) {
        let mut request = Request::builder()
            .uri(path)
            .method(method)
            .header("content-type", "application/json")
            .header("cookie", cookie);
        if admin {
            request = request.header(
                "authorization",
                "Bearer test-admin-token-at-least-32-characters",
            );
        }
        let response = router
            .clone()
            .oneshot(request.body(Body::from(body.to_string())).unwrap())
            .await
            .unwrap();
        let status = response.status();
        let cookie = response
            .headers()
            .get("set-cookie")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();
        let data =
            serde_json::from_slice(&to_bytes(response.into_body(), 65536).await.unwrap()).unwrap();
        (status, data, cookie)
    }
    fn state() -> Arc<AppState> {
        Arc::new(
            AppState::new(Config {
                bind: "127.0.0.1:0".into(),
                database: ":memory:".into(),
                frontend_dir: "../dist".into(),
                frontend_origin: None,
                admin_token: "test-admin-token-at-least-32-characters".into(),
                razorpay_key: String::new(),
                razorpay_secret: String::new(),
                webhook_secret: String::new(),
                razorpay_base: "http://127.0.0.1:1".into(),
            })
            .unwrap(),
        )
    }
    #[tokio::test]
    async fn accounts_protect_orders_and_share_dispatch_updates() {
        let state = state();
        let router = app(state.clone());
        let credentials = json!({"email":"shopper@example.com","name":"Test Shopper","password":"correct horse battery staple","over14":true});
        let (status, _, cookie) = call(
            &router,
            "/api/account/register",
            "POST",
            credentials.clone(),
            "",
            false,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("SameSite=Lax"));
        let (_, me, _) = call(&router, "/api/account/me", "GET", json!({}), &cookie, false).await;
        let id = me["user"]["id"].as_str().unwrap();
        {
            let db = state.connection().unwrap();
            let hash: String = db
                .query_row("SELECT password_hash FROM users", [], |r| r.get(0))
                .unwrap();
            assert!(hash.starts_with("$argon2id$"));
            assert!(!hash.contains("correct horse"));
            for order in ["owned", "other", "unpaid"] {
                db.execute("INSERT INTO orders(id,idempotency_key,request_hash,access_token,amount,status,details) VALUES(?1,?1,'hash','capability',36000,?2,?3)",params![order,if order=="unpaid" {"created"} else {"paid"},json!({"customer":{"email":"shopper@example.com"},"items":[{"id":"fiery-pure","quantity":1}]}).to_string()]).unwrap();
            }
            db.execute("INSERT INTO order_owners VALUES('owned',?1)", [id])
                .unwrap();
        }
        let (_, history, _) = call(
            &router,
            "/api/account/orders",
            "GET",
            json!({}),
            &cookie,
            false,
        )
        .await;
        assert_eq!(history["orders"].as_array().unwrap().len(), 1);
        assert_eq!(history["orders"][0]["id"], "owned");
        assert_eq!(
            call(&router, "/api/account/orders", "GET", json!({}), "", false)
                .await
                .0,
            StatusCode::UNAUTHORIZED
        );
        let update = json!({"status":"processing","tracking":"TEST-TRACK","version":0});
        assert_eq!(
            call(
                &router,
                "/api/admin/orders/owned",
                "PUT",
                update.clone(),
                "",
                false
            )
            .await
            .0,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            call(
                &router,
                "/api/admin/orders/unpaid",
                "PUT",
                update.clone(),
                "",
                true
            )
            .await
            .0,
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            call(
                &router,
                "/api/admin/orders/owned",
                "PUT",
                update.clone(),
                "",
                true
            )
            .await
            .0,
            StatusCode::OK
        );
        assert_eq!(
            call(&router, "/api/admin/orders/owned", "PUT", update, "", true)
                .await
                .0,
            StatusCode::CONFLICT
        );
        let (_, history, _) = call(
            &router,
            "/api/account/orders",
            "GET",
            json!({}),
            &cookie,
            false,
        )
        .await;
        assert_eq!(history["orders"][0]["fulfilment_status"], "processing");
        assert_eq!(history["orders"][0]["history"][0]["status"], "processing");
        assert_eq!(
            call(
                &router,
                "/api/admin/orders/owned",
                "PUT",
                json!({"status":"delivered","tracking":"","version":1}),
                "",
                true
            )
            .await
            .0,
            StatusCode::BAD_REQUEST
        );
        call(
            &router,
            "/api/account/logout",
            "POST",
            json!({}),
            &cookie,
            false,
        )
        .await;
        assert_eq!(
            call(&router, "/api/account/me", "GET", json!({}), &cookie, false)
                .await
                .0,
            StatusCode::UNAUTHORIZED
        );
        let mut wrong = credentials.clone();
        wrong["password"] = json!("wrong password long enough");
        assert_eq!(
            call(&router, "/api/account/login", "POST", wrong, "", false)
                .await
                .0,
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            call(
                &router,
                "/api/account/login",
                "POST",
                credentials,
                "",
                false
            )
            .await
            .0,
            StatusCode::OK
        );
    }
    #[test]
    fn combo_price_is_independent_from_custom_box_contents() {
        let state = state();
        let db = state.connection().unwrap();
        db.execute(
            "UPDATE products SET price_paise=29900 WHERE id='fiery-pure'",
            [],
        )
        .unwrap();
        let combo = store::quote(
            &db,
            &[store::Item {
                id: "fiery-pure".into(),
                quantity: 1,
            }],
        )
        .unwrap();
        let custom = store::quote(
            &db,
            &[
                store::Item {
                    id: "peri".into(),
                    quantity: 1,
                },
                store::Item {
                    id: "salt".into(),
                    quantity: 1,
                },
            ],
        )
        .unwrap();
        assert_eq!(combo.total_paise, 29900);
        assert_eq!(custom.total_paise, 36000);
        assert!(
            validate_packages(
                &[Package {
                    kind: "combo".into(),
                    ids: vec!["fiery-pure".into()],
                    quantity: 1,
                    capacity: None
                }],
                &[store::Item {
                    id: "fiery-pure".into(),
                    quantity: 1
                }]
            )
            .is_ok()
        );
        assert!(
            validate_packages(
                &[Package {
                    kind: "combo".into(),
                    ids: vec!["fiery-pure".into()],
                    quantity: 1,
                    capacity: None
                }],
                &[store::Item {
                    id: "peri".into(),
                    quantity: 1
                }]
            )
            .is_err()
        );
    }
}
