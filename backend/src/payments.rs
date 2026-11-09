use crate::{ApiResult, AppError, AppState};
use hmac::{Hmac, Mac};
use serde_json::{Value, json};
use sha2::Sha256;

pub fn verify_signature(secret: &str, body: &[u8], signature: &str) -> bool {
    let Ok(bytes) = hex::decode(signature) else {
        return false;
    };
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(body);
    mac.verify_slice(&bytes).is_ok()
}

pub async fn create_order(state: &AppState, id: &str, amount: i64) -> ApiResult<String> {
    let result = state.client.post(format!("{}/orders", state.config.razorpay_base))
        .basic_auth(&state.config.razorpay_key, Some(&state.config.razorpay_secret))
        .json(&json!({ "amount": amount, "currency": "INR", "receipt": id }))
        .send().await.map_err(|_| AppError::unavailable("Could not confirm order creation. Retain the order reference and check the Razorpay dashboard before trying a new order."))?;
    if !result.status().is_success() {
        return Err(AppError::unavailable(
            "Razorpay did not accept the order. Check the server credentials and dashboard using the order reference.",
        ));
    }
    let data: Value = result.json().await.map_err(|_| {
        AppError::unavailable(
            "Razorpay returned an unreadable response. Check the order reference before retrying.",
        )
    })?;
    if data["amount"].as_i64() != Some(amount) || data["currency"] != "INR" {
        return Err(AppError::unavailable(
            "The payment order amount could not be confirmed.",
        ));
    }
    data["id"]
        .as_str()
        .filter(|id| !id.is_empty() && id.len() <= 100)
        .map(str::to_owned)
        .ok_or_else(|| AppError::unavailable("The payment order reference is missing."))
}

pub async fn fetch_payment(state: &AppState, payment_id: &str) -> ApiResult<Value> {
    if !payment_id.starts_with("pay_")
        || !payment_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_')
        || payment_id.len() > 100
    {
        return Err(AppError::bad("Invalid payment reference."));
    }
    let response = state.client.get(format!("{}/payments/{}", state.config.razorpay_base, payment_id))
        .basic_auth(&state.config.razorpay_key, Some(&state.config.razorpay_secret))
        .send().await.map_err(|_| AppError::unavailable("Payment verification is pending. Check this order again before paying a second time."))?;
    if !response.status().is_success() {
        return Err(AppError::unavailable(
            "Could not confirm the payment status. Please check this order again.",
        ));
    }
    response
        .json()
        .await
        .map_err(|_| AppError::unavailable("Could not read the payment status."))
}
