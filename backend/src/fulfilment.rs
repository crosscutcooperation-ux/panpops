use crate::*;
pub fn list(db: &Connection, user: Option<&str>) -> ApiResult<Vec<Value>> {
    let mut statement=db.prepare("SELECT o.id,o.amount,o.status,o.created_at,o.details,COALESCE(f.status,'received'),COALESCE(f.tracking,''),COALESCE(f.version,0) FROM orders o LEFT JOIN fulfilment f ON f.order_id=o.id WHERE (?1 IS NULL OR EXISTS(SELECT 1 FROM order_owners ow WHERE ow.order_id=o.id AND ow.user_id=?1)) ORDER BY o.created_at DESC,o.rowid DESC LIMIT 100")?;
    let rows = statement.query_map([user], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, i64>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, String>(3)?,
            r.get::<_, String>(4)?,
            r.get::<_, String>(5)?,
            r.get::<_, String>(6)?,
            r.get::<_, i64>(7)?,
        ))
    })?;
    let mut result = Vec::new();
    for row in rows {
        let (id, amount, payment, created, details, status, tracking, version) = row?;
        let details: Value = serde_json::from_str(&details).unwrap_or(json!({}));
        let mut events =
            db.prepare("SELECT status,created_at FROM order_events WHERE order_id=?1 ORDER BY id")?;
        let history = events
            .query_map([&id], |r| {
                Ok(json!({"status":r.get::<_,String>(0)?,"created_at":r.get::<_,String>(1)?}))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        result.push(json!({"id":id,"amount_paise":amount,"status":payment,"created_at":created,"customer":details["customer"],"items":details["items"],"packages":details["packages"],"fulfilment_status":status,"tracking":tracking,"version":version,"history":history}));
    }
    Ok(result)
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Update {
    status: String,
    tracking: String,
    version: i64,
}
pub async fn update(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(body): Json<Update>,
) -> ApiResult<Json<Value>> {
    authorize(&headers, &state.config.admin_token)?;
    if ![
        "received",
        "processing",
        "ready_for_pickup",
        "picked_up",
        "out_for_delivery",
        "delivered",
        "cancelled",
    ]
    .contains(&body.status.as_str())
        || body.tracking.len() > 200
    {
        return Err(AppError::bad(
            "Invalid delivery status or tracking reference.",
        ));
    }
    let mut db = state.connection()?;
    let tx = db.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let order = store::order_by_id(&tx, &id)?.ok_or_else(|| AppError::bad("Order not found."))?;
    if order.status != "paid" && body.status != "cancelled" {
        return Err(AppError::bad(
            "Payment must be captured before dispatching an order.",
        ));
    }
    tx.execute(
        "INSERT OR IGNORE INTO fulfilment(order_id,version) VALUES(?1,0)",
        [&id],
    )?;
    let current: String = tx.query_row(
        "SELECT status FROM fulfilment WHERE order_id=?1",
        [&id],
        |r| r.get(0),
    )?;
    let allowed = current == body.status
        || match current.as_str() {
            "received" => ["processing", "cancelled"].contains(&body.status.as_str()),
            "processing" => ["ready_for_pickup", "out_for_delivery", "cancelled"]
                .contains(&body.status.as_str()),
            "ready_for_pickup" => {
                ["picked_up", "out_for_delivery", "cancelled"].contains(&body.status.as_str())
            }
            "picked_up" => ["out_for_delivery", "delivered"].contains(&body.status.as_str()),
            "out_for_delivery" => body.status == "delivered",
            _ => false,
        };
    if !allowed {
        return Err(AppError::bad(
            "This status change is not available from the current stage.",
        ));
    }
    if tx.execute("UPDATE fulfilment SET status=?2,tracking=?3,version=version+1 WHERE order_id=?1 AND version=?4",params![id,body.status,body.tracking.trim(),body.version])?!=1 {return Err(AppError::conflict("This order changed. Reload before saving."));}
    if current != body.status {
        tx.execute(
            "INSERT INTO order_events(order_id,status) VALUES(?1,?2)",
            params![id, body.status],
        )?;
    }
    tx.commit()?;
    Ok(Json(json!({"ok":true})))
}
