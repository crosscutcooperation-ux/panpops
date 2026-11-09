# Connect PanPops to Razorpay

The frontend payment flow and Rust endpoints are implemented. Complete the account configuration below to connect your Razorpay account. Keep all private keys on the Rust server, outside Git and the frontend build.

## 1. Connect Test Mode

In your Razorpay Dashboard, switch to **Test Mode** and generate an API key pair. Put the values in `backend/.env` (or the hosting provider's secret environment settings):

```dotenv
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_TEST_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_SEPARATE_RANDOM_WEBHOOK_SECRET
```

Use a separate random webhook secret, for example one generated with `openssl rand -hex 32`. Retain your unique `ADMIN_TOKEN`. Restart Rust after changing environment variables. Do not add the key secret or webhook secret to any `VITE_` variable. The public key ID is returned only when opening the payment checkout.

Build and run the frontend/API together using the commands in [README.md](README.md). With gateway keys configured, the final order review shows **Pay with Razorpay**. It creates a server-priced order and opens Razorpay Standard Checkout. See the official [Standard Checkout integration steps](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/).

## 2. Configure capture and webhooks

Enable automatic capture in Razorpay for this integration, or arrange capture through your existing operations. The server confirms an order only after the provider reports the payment as **captured**. An authorized payment stays pending.

Deploy Rust behind public HTTPS. In the Razorpay Dashboard's Test Mode webhook settings, add:

```text
https://YOUR-API-HOST/api/webhooks/razorpay
```

Use the same value as `RAZORPAY_WEBHOOK_SECRET` and subscribe to `payment.captured` and `order.paid`. If the frontend and API share one origin, `YOUR-API-HOST` is your storefront host. A localhost address cannot receive Razorpay's public webhook requests.

The backend verifies `X-Razorpay-Signature` against the exact raw request bytes with the webhook secret. It checks order amount and INR currency and handles repeated event IDs without recording a second payment. Checkout signature verification separately uses the server's API key secret and stored Razorpay order ID. Reference: [Razorpay webhook validation and testing](https://razorpay.com/docs/webhooks/validate-test/).

## 3. Test the complete flow

1. Change a product price and delivery rule in `/admin/` and confirm cart, scanner receipt, review, and Razorpay all agree.
2. Make a Test Mode successful payment with Razorpay's documented test methods. Confirm the page reports Payment confirmed and the admin order is `paid`.
3. Test closing the payment window, a failed payment, and retrying the same order. Confirm neither action reports a successful payment prematurely.
4. Verify a captured-payment webhook is delivered successfully; retry the event and confirm the same order stays paid once.
5. Try a price edit between review and payment. The server should ask the shopper to review the updated total.

These account-level tests have not been run with your credentials. Automated backend tests use a local mock gateway and never charge money.

## 4. Switch to Live Mode

After completing Razorpay account activation and Test Mode checks, replace the test key ID and secret with your **Live Mode** pair. Add the webhook again in Live Mode with its own secret and set that secret on the server. Restart Rust. Test and Live Mode keys and webhook configurations are separate.

The private review Site stays in demo mode until it is rebuilt with your deployed API's URL. To connect that frontend to a separate Rust host, set `VITE_API_BASE_URL=https://YOUR-API-HOST/api` at build time and set `FRONTEND_ORIGIN` to the exact frontend origin on Rust.

## Order recovery

An uncertain provider response leaves a local order in `needs_review`, with its reference shown to the shopper. Find that reference in the admin order list and Razorpay's order `receipt` before creating another order. Do not mark it paid based on a screenshot or browser callback alone. A repeated checkout request reuses its existing provider order when creation was confirmed. If the provider order exists but was never linked locally, reconcile it operationally before retrying; no automatic reconciliation endpoint is provided.

If a payment remains pending, use **Check payment status** while the checkout page remains open and inspect webhook delivery and capture status in the Dashboard. Keep the order reference for support if the shopper reloads or leaves the page.
