# PanPops Rust backend

Axum serves the Vite multi-page frontend and a JSON API. SQLite stores product prices, availability, delivery settings, orders, and processed payment webhooks. All order amounts are calculated on the server in integer paise.

## Run with editable prices

Use Node 22.12+ and a current stable Rust toolchain. From the project root:

```sh
npm ci
VITE_API_BASE_URL=/api npm run build
cp backend/.env.example backend/.env
openssl rand -hex 32
```

Copy the generated random value into `ADMIN_TOKEN` in `backend/.env`. Keep the Razorpay fields empty to try pricing without payments. Then:

```sh
cd backend
cargo run --locked
```

Open <http://127.0.0.1:3001/>. Open <http://127.0.0.1:3001/admin/> and unlock it with your administrator token. Change each price in rupees, availability, delivery charge, and free-delivery threshold. The admin token stays in page memory and is cleared on reload or Lock. Set a unique token for each environment.

Initial prices are ₹180 per pouch. Delivery initially costs ₹0; configure the actual delivery policy before accepting orders. A threshold of 0 disables the free-delivery threshold. Saving a price changes subsequent quotes and orders. Already-created payment orders keep their original amount. Conflicting admin edits return a reload message rather than overwriting newer changes.

The database is created at `backend/data/panpops.sqlite3` when started from `backend/`. Prices survive restarts. Never store this directory inside the publicly served frontend. Back up SQLite with its online backup mechanism or stop the server before copying its database and WAL files together. Orders include billing and delivery details: restrict access to the data directory and backups.

For frontend development, keep the Rust server running and run this from the project root in another terminal:

```sh
VITE_API_BASE_URL=/api npm run dev
```

Vite proxies `/api` to port 3001. Leaving `VITE_API_BASE_URL` unset builds the browser-local demo used by the private review Site. The native Rust service needs its own host; the private Site's static hosting does not execute this server.

## Deploy

On a Rust-capable server, build the frontend with `VITE_API_BASE_URL=/api`, run `cargo build --release --locked` from `backend/`, and run `target/release/panpops-server` from that same directory with the environment configured. Keep it running with the host's process manager. Bind to loopback and place an HTTPS reverse proxy in front of port 3001. Configure request limits for the public order endpoint and restrict `/admin/` and `/api/admin/` to your operator access where possible. Keep SQLite on persistent disk, with one service instance per database file.

The Rust server can serve the whole frontend. If your existing PHP host serves the static pages, proxy `/api/` to this service and serve the new `dist/` files for these pages. No existing PHP installation, domain, or Razorpay account has been changed by this work.

For a separate frontend/API origin, build with `VITE_API_BASE_URL=https://YOUR-API-HOST/api` and set `FRONTEND_ORIGIN=https://YOUR-FRONTEND-HOST` on Rust. Use exact HTTPS origins, without a trailing path. Only the API URL is public frontend configuration; all secrets belong on the Rust server.

Connect payments using [RAZORPAY_SETUP.md](RAZORPAY_SETUP.md).

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Service health |
| `GET /api/config` | Currency and whether gateway credentials are configured |
| `GET /api/products` | Public product prices and availability |
| `POST /api/quote` | Quote `{ "items": [{ "id": "chataka", "quantity": 2 }] }` |
| `POST /api/orders` | Create a server-priced Razorpay order; UUID `X-Idempotency-Key` required |
| `GET /api/orders/{id}` | Status; order capability token required as Bearer authorization |
| `POST /api/payments/verify` | Verify signature, provider payment amount, currency, and capture status |
| `POST /api/webhooks/razorpay` | Raw-body HMAC-verified, duplicate-safe capture notification |
| `GET /api/admin/products` | Administrator catalogue |
| `PUT /api/admin/products/{id}` | Save `price_paise`, `active`, and current `version` |
| `GET /api/admin/settings` | Delivery settings and version |
| `PUT /api/admin/settings` | Save `shipping_paise`, `free_shipping_min_paise`, and current `version` |
| `GET /api/admin/orders` | Last 100 order references, amounts, and payment states |

All admin API routes require `Authorization: Bearer YOUR_ADMIN_TOKEN`. The admin screen sends this header automatically. Product IDs are `chataka`, `cream`, `peri`, and `salt`.

## Verification and scope

```sh
cargo test --locked
```

Tests exercise server-priced totals, delivery thresholds, unavailable products, optimistic updates, duplicate order requests, a known HMAC vector, amount mismatch rejection, authorized versus captured payments, and repeated signed webhooks using a local mock payment provider.

Razorpay operations require your account credentials; public checkout requires a deployed HTTPS service. Accounts now use Argon2id password hashes and seven-day HttpOnly cookie sessions. Registration requires an over-14 declaration and a password of at least 12 characters. Account recovery, email verification, inventory, refunds and tax invoicing are not implemented. The browser cart persists locally across pages and refreshes.

## Accounts and dispatch

Customers register at `/register/`, sign in at `/login/`, and view orders at `/account/`. Orders created while signed in are attached to that account; checkout must use the account email. Guest and historical orders are not automatically linked by email. My account refreshes every 30 seconds while visible and has a manual Refresh button.

The `/admin/` dashboard includes customer details, order filters, courier references and these fulfilment stages: received → processing → ready for pickup → picked up → out for delivery → delivered. Processing may also move directly to out for delivery. Cancellation is available before pickup. Dispatch requires a captured payment; delivery status does not change payment status. Every status update is recorded and checked against the current version to prevent conflicting edits.

The Email template selector prepares confirmation, preparation, pickup, delivery, cancellation and payment-pending messages. Compose email opens the operator's mail app for review and sending. There is no SMTP service or automatic email sending.

Five fixed combos have separate catalogue IDs and editable prices: `fiery-pure`, `creamy-chatpata`, `classic`, `spicy`, `ultimate`. They are sold as `combo` cart/package lines, distinct from a custom `box`. Custom boxes continue to use individual pouch prices. Existing saved custom boxes remain custom boxes.

Account endpoints: `POST /api/account/register`, `POST /api/account/login`, `POST /api/account/logout`, `GET /api/account/me`, `GET /api/account/orders`. Admin dispatch updates use `PUT /api/admin/orders/{id}` with `{status, tracking, version}` and the administrator Bearer token. Account reads return no-store responses. Password hashing has bounded concurrency, with per-email attempt limits. The same-origin Vite proxy on port 5173 is supported on a loopback-bound backend; configure `FRONTEND_ORIGIN` for a deployed separate frontend.

Orders may include a `packages` array (`kind`, `ids`, `quantity`, and `capacity`). Four- and six-pouch boxes keep their packaging information in the saved order. The server validates that package contents exactly match the priced item quantities. Legacy clients may omit this array.
