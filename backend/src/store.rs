use crate::{ApiResult, AppError};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Serialize)]
pub struct Product {
    pub id: String,
    pub name: String,
    pub price_paise: i64,
    pub active: bool,
    pub version: i64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Settings {
    pub shipping_paise: i64,
    pub free_shipping_min_paise: i64,
    pub version: i64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Item {
    pub id: String,
    pub quantity: i64,
}

#[derive(Clone, Serialize)]
pub struct QuoteItem {
    pub id: String,
    pub name: String,
    pub quantity: i64,
    pub unit_price_paise: i64,
    pub total_paise: i64,
}

#[derive(Clone, Serialize)]
pub struct Quote {
    pub items: Vec<QuoteItem>,
    pub subtotal_paise: i64,
    pub discount_paise: i64,
    pub coupon_code: String,
    pub shipping_paise: i64,
    pub total_paise: i64,
    pub currency: &'static str,
}

#[derive(Clone)]
pub struct Order {
    pub id: String,
    pub request_hash: String,
    pub token: String,
    pub amount: i64,
    pub status: String,
    pub provider_id: Option<String>,
    pub payment_id: Option<String>,
}

pub fn initialize(conn: &Connection) -> rusqlite::Result<()> {
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.execute_batch(
        "PRAGMA foreign_keys=ON;
         CREATE TABLE IF NOT EXISTS products (
           id TEXT PRIMARY KEY, name TEXT NOT NULL, price_paise INTEGER NOT NULL CHECK(price_paise>=100),
           active INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1
         );
         CREATE TABLE IF NOT EXISTS settings (
           id INTEGER PRIMARY KEY CHECK(id=1), shipping_paise INTEGER NOT NULL DEFAULT 0,
           free_shipping_min_paise INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1
         );
         INSERT OR IGNORE INTO settings(id) VALUES(1);
         CREATE TABLE IF NOT EXISTS orders (
           id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
           access_token TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL,
           provider_id TEXT UNIQUE, payment_id TEXT UNIQUE, details TEXT NOT NULL,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         );
         CREATE TABLE IF NOT EXISTS coupons (
           code TEXT PRIMARY KEY, percent_basis_points INTEGER NOT NULL CHECK(percent_basis_points BETWEEN 1 AND 10000),
           min_subtotal_paise INTEGER NOT NULL CHECK(min_subtotal_paise>=0), max_discount_paise INTEGER NOT NULL CHECK(max_discount_paise>0), active INTEGER NOT NULL DEFAULT 1
         );
         INSERT OR IGNORE INTO coupons VALUES('CRUNCH15',1500,18000,29900,1);
         CREATE TABLE IF NOT EXISTS webhook_events (
           id TEXT PRIMARY KEY, received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         );",
    )?;
    for (id, name) in [
        ("chataka", "Chataka Pataka"),
        ("cream", "Cream & Onion"),
        ("peri", "Peri Peri"),
        ("salt", "Himalayan Pink Salt"),
    ] {
        conn.execute(
            "INSERT OR IGNORE INTO products(id,name,price_paise) VALUES(?1,?2,18000)",
            params![id, name],
        )?;
    }
    for (id, name, price) in [
        ("fiery-pure", "Fiery & Pure Duo", 36000),
        ("creamy-chatpata", "Creamy Chatpata Duo", 36000),
        ("classic", "Classic Trio", 54000),
        ("spicy", "Spicy Trio", 54000),
        ("ultimate", "Ultimate Box", 72000),
    ] {
        conn.execute(
            "INSERT OR IGNORE INTO products(id,name,price_paise) VALUES(?1,?2,?3)",
            params![id, name, price],
        )?;
    }
    Ok(())
}

pub fn combo_ids(id: &str) -> Option<&'static [&'static str]> {
    match id {
        "fiery-pure" => Some(&["peri", "salt"]),
        "creamy-chatpata" => Some(&["chataka", "cream"]),
        "classic" => Some(&["cream", "peri", "salt"]),
        "spicy" => Some(&["chataka", "peri", "salt"]),
        "ultimate" => Some(&["chataka", "cream", "peri", "salt"]),
        _ => None,
    }
}

#[cfg(test)]
mod coupon_tests {
    use super::*;
    #[test]
    fn coupons_are_validated_capped_and_keep_delivery_separate() {
        let db = Connection::open_in_memory().unwrap();
        initialize(&db).unwrap();
        let one = vec![Item {
            id: "chataka".into(),
            quantity: 1,
        }];
        let discounted = quote_with_coupon(&db, &one, " crunch15 ").unwrap();
        assert_eq!(discounted.coupon_code, "CRUNCH15");
        assert_eq!(discounted.discount_paise, 2700);
        assert_eq!(discounted.total_paise, 15300);
        let large = quote_with_coupon(
            &db,
            &[Item {
                id: "ultimate".into(),
                quantity: 4,
            }],
            "CRUNCH15",
        )
        .unwrap();
        assert_eq!(large.discount_paise, 29900);
        assert!(quote_with_coupon(&db, &one, "NOTREAL").is_err());
        assert!(quote_with_coupon(&db, &one, "<script>").is_err());
        db.execute("UPDATE settings SET shipping_paise=5000", [])
            .unwrap();
        assert_eq!(
            quote_with_coupon(&db, &one, "CRUNCH15")
                .unwrap()
                .total_paise,
            20300
        );
        db.execute(
            "UPDATE products SET price_paise=10000 WHERE id='chataka'",
            [],
        )
        .unwrap();
        assert!(quote_with_coupon(&db, &one, "CRUNCH15").is_err());
        db.execute("UPDATE coupons SET active=0", []).unwrap();
        assert!(
            quote_with_coupon(
                &db,
                &[Item {
                    id: "ultimate".into(),
                    quantity: 1
                }],
                "CRUNCH15"
            )
            .is_err()
        );
        assert_eq!(quote(&db, &one).unwrap().discount_paise, 0);
    }
}

pub fn products(conn: &Connection) -> ApiResult<Vec<Product>> {
    let mut stmt =
        conn.prepare("SELECT id,name,price_paise,active,version FROM products ORDER BY rowid")?;
    let rows = stmt.query_map([], |row| {
        Ok(Product {
            id: row.get(0)?,
            name: row.get(1)?,
            price_paise: row.get(2)?,
            active: row.get(3)?,
            version: row.get(4)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn settings(conn: &Connection) -> ApiResult<Settings> {
    Ok(conn.query_row(
        "SELECT shipping_paise,free_shipping_min_paise,version FROM settings WHERE id=1",
        [],
        |row| {
            Ok(Settings {
                shipping_paise: row.get(0)?,
                free_shipping_min_paise: row.get(1)?,
                version: row.get(2)?,
            })
        },
    )?)
}

pub fn quote(conn: &Connection, items: &[Item]) -> ApiResult<Quote> {
    quote_with_coupon(conn, items, "")
}

pub fn quote_with_coupon(conn: &Connection, items: &[Item], code: &str) -> ApiResult<Quote> {
    if items.is_empty() || items.len() > 9 {
        return Err(AppError::bad("Select between one and nine product types."));
    }
    let mut quantities = BTreeMap::new();
    for item in items {
        if item.quantity < 1 || item.quantity > 99 {
            return Err(AppError::bad("Quantities must be between 1 and 99."));
        }
        let total = quantities.entry(item.id.clone()).or_insert(0i64);
        *total += item.quantity;
        if *total > 99 {
            return Err(AppError::bad("Maximum 99 pouches per flavour."));
        }
    }
    let catalogue = products(conn)?;
    let mut lines = Vec::new();
    for (id, quantity) in quantities {
        let product = catalogue
            .iter()
            .find(|product| product.id == id && product.active)
            .ok_or_else(|| AppError::bad("A selected product is unavailable."))?;
        lines.push(QuoteItem {
            id,
            name: product.name.clone(),
            quantity,
            unit_price_paise: product.price_paise,
            total_paise: quantity * product.price_paise,
        });
    }
    let subtotal = lines.iter().map(|line| line.total_paise).sum::<i64>();
    let coupon_code = code.trim().to_ascii_uppercase();
    if coupon_code.len() > 40
        || !coupon_code
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(AppError::bad("Enter a valid coupon code."));
    }
    let discount = if coupon_code.is_empty() {
        0
    } else {
        let rule:Option<(i64,i64,i64)>=conn.query_row("SELECT percent_basis_points,min_subtotal_paise,max_discount_paise FROM coupons WHERE code=?1 AND active=1",[&coupon_code],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional()?;
        let (basis, minimum, cap) =
            rule.ok_or_else(|| AppError::bad("This coupon is invalid or no longer available."))?;
        if subtotal < minimum {
            return Err(AppError::bad(&format!(
                "This coupon needs a minimum product subtotal of ₹{:.2}.",
                minimum as f64 / 100.0
            )));
        }
        (subtotal * basis / 10000).min(cap).min(subtotal)
    };
    let delivery = settings(conn)?;
    let shipping =
        if delivery.free_shipping_min_paise > 0 && subtotal >= delivery.free_shipping_min_paise {
            0
        } else {
            delivery.shipping_paise
        };
    let total = subtotal - discount + shipping;
    if !(100..=2_000_000_000).contains(&total) {
        return Err(AppError::bad(
            "The order total is outside the supported range.",
        ));
    }
    Ok(Quote {
        items: lines,
        subtotal_paise: subtotal,
        discount_paise: discount,
        coupon_code,
        shipping_paise: shipping,
        total_paise: total,
        currency: "INR",
    })
}

pub fn order_by_key(conn: &Connection, key: &str) -> ApiResult<Option<Order>> {
    order_query(
        conn,
        "SELECT id,request_hash,access_token,amount,status,provider_id,payment_id FROM orders WHERE idempotency_key=?1",
        key,
    )
}

pub fn order_by_id(conn: &Connection, id: &str) -> ApiResult<Option<Order>> {
    order_query(
        conn,
        "SELECT id,request_hash,access_token,amount,status,provider_id,payment_id FROM orders WHERE id=?1",
        id,
    )
}

pub fn order_by_provider(conn: &Connection, id: &str) -> ApiResult<Option<Order>> {
    order_query(
        conn,
        "SELECT id,request_hash,access_token,amount,status,provider_id,payment_id FROM orders WHERE provider_id=?1",
        id,
    )
}

fn order_query(conn: &Connection, sql: &str, value: &str) -> ApiResult<Option<Order>> {
    Ok(conn
        .query_row(sql, [value], |row| {
            Ok(Order {
                id: row.get(0)?,
                request_hash: row.get(1)?,
                token: row.get(2)?,
                amount: row.get(3)?,
                status: row.get(4)?,
                provider_id: row.get(5)?,
                payment_id: row.get(6)?,
            })
        })
        .optional()?)
}

pub fn mark_paid(conn: &Connection, id: &str, payment_id: &str) -> ApiResult<()> {
    conn.execute(
        "UPDATE orders SET status='paid',payment_id=?2 WHERE id=?1 AND status!='paid'",
        params![id, payment_id],
    )?;
    Ok(())
}
