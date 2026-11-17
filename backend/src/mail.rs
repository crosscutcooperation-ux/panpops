use crate::*;
use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor, message::Mailbox,
    transport::smtp::authentication::Credentials,
};

#[derive(Clone)]
pub struct MailConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from: String,
    pub admin: String,
}

impl MailConfig {
    pub fn from_env() -> Result<Option<Self>, Box<dyn std::error::Error>> {
        let username = env::var("SMTP_USERNAME").unwrap_or_default();
        let password = env::var("SMTP_PASSWORD").unwrap_or_default();
        if username.is_empty() && password.is_empty() {
            return Ok(None);
        }
        let result = Self {
            host: env::var("SMTP_HOST")?,
            port: env::var("SMTP_PORT")
                .unwrap_or_else(|_| "465".into())
                .parse()?,
            from: env::var("SMTP_FROM")?,
            admin: env::var("ORDER_ADMIN_EMAIL")?,
            username,
            password,
        };
        if result.username.is_empty()
            || result.password.is_empty()
            || ![465, 587].contains(&result.port)
        {
            return Err(
                "Complete SMTP credentials and use TLS port 465 or STARTTLS port 587.".into(),
            );
        }
        result.from.parse::<Mailbox>()?;
        result.admin.parse::<Mailbox>()?;
        Ok(Some(result))
    }
}

pub fn initialize(db: &Connection) -> rusqlite::Result<()> {
    db.execute_batch(
        "CREATE TABLE IF NOT EXISTS email_outbox(
      id INTEGER PRIMARY KEY, dedupe_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
      order_id TEXT, recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER, sent_at INTEGER, last_error TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS email_due ON email_outbox(sent_at,next_attempt);",
    )
}

pub struct Draft<'a> {
    pub key: &'a str,
    pub kind: &'a str,
    pub order: Option<&'a str>,
    pub to: &'a str,
    pub subject: &'a str,
    pub body: &'a str,
    pub expires: Option<i64>,
}

pub fn queue(db: &Connection, message: Draft<'_>) -> ApiResult<()> {
    message
        .to
        .parse::<Mailbox>()
        .map_err(|_| AppError::bad("Enter a valid email address."))?;
    db.execute("INSERT OR IGNORE INTO email_outbox(dedupe_key,kind,order_id,recipient,subject,body,expires_at) VALUES(?1,?2,?3,?4,?5,?6,?7)",params![message.key,message.kind,message.order,message.to,message.subject,message.body,message.expires])?;
    Ok(())
}

pub fn queue_order(db: &Connection, id: &str, admin: Option<&str>) -> ApiResult<()> {
    let (details, amount, method, status): (String, i64, String, String) = db.query_row(
        "SELECT details,amount,payment_method,status FROM orders WHERE id=?1",
        [id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    )?;
    if status != "paid" && !(method == "cod" && status == "cod_pending") {
        return Ok(());
    }
    let data: Value = serde_json::from_str(&details)
        .map_err(|_| AppError::unavailable("Could not prepare the order email."))?;
    let customer = &data["customer"];
    let text = |key: &str| customer[key].as_str().unwrap_or("");
    let receipt = &data["receipt"];
    let mut items = String::new();
    if let Some(lines) = receipt["items"].as_array() {
        for line in lines {
            items.push_str(&format!(
                "{} x {} — INR {:.2}\n",
                line["quantity"],
                line["name"].as_str().unwrap_or("PanPops"),
                line["total_paise"].as_i64().unwrap_or(0) as f64 / 100.0
            ));
        }
    } else if let Some(lines) = data["items"].as_array() {
        for line in lines {
            items.push_str(&format!(
                "{} x {}\n",
                line["quantity"],
                line["id"].as_str().unwrap_or("PanPops")
            ));
        }
    }
    let payment = if method == "cod" {
        "Cash on delivery — payment due when delivered"
    } else {
        "Paid online through Razorpay"
    };
    let address = [
        text("full_name"),
        text("address"),
        text("address2"),
        text("city"),
        text("state"),
        text("pincode"),
        text("country"),
    ]
    .into_iter()
    .filter(|s| !s.is_empty())
    .collect::<Vec<_>>()
    .join(", ");
    let summary = format!(
        "Order: {id}\nPayment: {payment}\n\n{items}\nDiscount: INR {:.2}\nDelivery: INR {:.2}\nTotal: INR {:.2}\n\nDeliver to: {address}\nPhone: {}\nEmail: {}",
        receipt["discount_paise"].as_i64().unwrap_or(0) as f64 / 100.0,
        receipt["shipping_paise"].as_i64().unwrap_or(0) as f64 / 100.0,
        amount as f64 / 100.0,
        text("phone"),
        text("email")
    );
    queue(
        db,
        Draft {
            key: &format!("order:{id}:customer"),
            kind: "order_customer",
            order: Some(id),
            to: text("email"),
            subject: &format!("PanPops order confirmed · {}", &id[..id.len().min(8)]),
            body: &format!(
                "Hi {},\n\nThank you for your order.\n\n{summary}\n\nTrack your order in My account if you checked out while signed in. For help, reply to this email.\n\nPanPops team",
                text("full_name")
            ),
            expires: None,
        },
    )?;
    if let Some(admin) = admin {
        queue(
            db,
            Draft {
                key: &format!("order:{id}:admin"),
                kind: "order_admin",
                order: Some(id),
                to: admin,
                subject: &format!(
                    "New PanPops order · {} · {}",
                    if method == "cod" { "COD" } else { "PAID" },
                    &id[..id.len().min(8)]
                ),
                body: &format!(
                    "A new order is ready to prepare.\n\n{summary}\n\nManage it at https://panvibesonline.com/admin/"
                ),
                expires: None,
            },
        )?;
    }
    Ok(())
}

pub fn order_status(db: &Connection, id: &str) -> ApiResult<Vec<Value>> {
    let mut stmt = db.prepare(
        "SELECT kind,attempts,sent_at,last_error FROM email_outbox WHERE order_id=?1 ORDER BY id",
    )?;
    Ok(stmt.query_map([id],|r| {
        let attempts:i64=r.get(1)?;
        let sent:Option<i64>=r.get(2)?;
        Ok(json!({"kind":r.get::<_,String>(0)?,"status":if sent.is_some() {"sent"} else if attempts>=8 {"failed"} else {"queued"},"attempts":attempts,"last_error":r.get::<_,String>(3)?}))
    })?.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn spawn_worker(state: Arc<AppState>) -> ApiResult<()> {
    let Some(config) = &state.config.mail else {
        return Ok(());
    };
    let transport = if config.port == 465 {
        AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)
    } else {
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.host)
    }
    .map_err(|_| AppError::unavailable("Invalid SMTP configuration."))?
    .port(config.port)
    .credentials(Credentials::new(
        config.username.clone(),
        config.password.clone(),
    ))
    .timeout(Some(Duration::from_secs(15)))
    .build();
    let from = config.from.clone();
    tokio::spawn(async move {
        loop {
            if let Err(error) = deliver_pending(&state, &transport, &from).await {
                eprintln!("Email queue unavailable (HTTP {}).", error.status.as_u16());
            }
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    });
    Ok(())
}

async fn deliver_pending<T: AsyncTransport + Sync>(
    state: &AppState,
    transport: &T,
    from: &str,
) -> ApiResult<()> {
    let pending = {
        let db = state.connection()?;
        // Delete verification tokens and email bodies when their validity window ends.
        db.execute(
            "DELETE FROM email_verifications WHERE expires_at<=?1",
            [accounts::now()],
        )?;
        db.execute(
            "DELETE FROM email_outbox WHERE expires_at<=?1",
            [accounts::now()],
        )?;
        let mut stmt = db.prepare("SELECT id,recipient,subject,body FROM email_outbox WHERE sent_at IS NULL AND attempts<8 AND next_attempt<=?1 ORDER BY id LIMIT 10")?;
        stmt.query_map([accounts::now()], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?
    };
    for (id, to, subject, body) in pending {
        let message = Message::builder()
            .from(
                from.parse()
                    .map_err(|_| AppError::unavailable("Invalid sender address."))?,
            )
            .to(to
                .parse()
                .map_err(|_| AppError::bad("Invalid recipient address."))?)
            .subject(subject)
            .message_id(Some(format!("<panpops-{id}@panvibesonline.com>")))
            .body(body)
            .map_err(|_| AppError::unavailable("Could not prepare the email."))?;
        let result = transport.send(message).await;
        let db = state.connection()?;
        if result.is_ok() {
            db.execute(
                "UPDATE email_outbox SET sent_at=?2,body='',last_error='' WHERE id=?1",
                params![id, accounts::now()],
            )?;
        } else {
            // Never log SMTP responses: some providers include recipient addresses or credentials.
            db.execute("UPDATE email_outbox SET attempts=attempts+1,next_attempt=?2+MIN(3600,60*(1<<attempts)),last_error='SMTP delivery failed; check sender settings' WHERE id=?1",params![id,accounts::now()])?;
            eprintln!("Email delivery deferred; outbox id={id}.");
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use lettre::transport::stub::AsyncStubTransport;
    #[tokio::test]
    async fn email_failures_retry_and_success_clears_private_body() {
        let state = AppState::new(Config {
            bind: "127.0.0.1:0".into(),
            database: ":memory:".into(),
            frontend_dir: "../dist".into(),
            frontend_origin: None,
            admin_token: "test-admin-token-at-least-32-characters".into(),
            razorpay_key: String::new(),
            razorpay_secret: String::new(),
            webhook_secret: String::new(),
            razorpay_base: "http://127.0.0.1:1".into(),
            mail: None,
        })
        .unwrap();
        queue(
            &state.connection().unwrap(),
            Draft {
                key: "test",
                kind: "order_customer",
                order: None,
                to: "customer@example.com",
                subject: "Order test",
                body: "Private delivery details",
                expires: None,
            },
        )
        .unwrap();
        deliver_pending(
            &state,
            &AsyncStubTransport::new_error(),
            "sender@example.com",
        )
        .await
        .unwrap();
        {
            let db = state.connection().unwrap();
            let (attempts, next, sent): (i64, i64, Option<i64>) = db
                .query_row(
                    "SELECT attempts,next_attempt,sent_at FROM email_outbox",
                    [],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                )
                .unwrap();
            assert_eq!(attempts, 1);
            assert!(next > accounts::now());
            assert!(sent.is_none());
            db.execute("UPDATE email_outbox SET next_attempt=0", [])
                .unwrap();
        }
        deliver_pending(&state, &AsyncStubTransport::new_ok(), "sender@example.com")
            .await
            .unwrap();
        let db = state.connection().unwrap();
        let (body, sent): (String, Option<i64>) = db
            .query_row("SELECT body,sent_at FROM email_outbox", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .unwrap();
        assert!(sent.is_some());
        assert!(body.is_empty());
    }
}
