# Production deployment

The production service runs as the unprivileged `panpops` system user. Nginx
terminates TLS for `panvibesonline.com` and proxies the same-origin frontend
and `/api` requests to Axum on `127.0.0.1:3001`. The canonical host is
`https://panvibesonline.com`; `https://www.panvibesonline.com` and the EC2 IP
redirect to it. A Let's Encrypt certificate covers both domain names and is
renewed by Certbot's scheduled task.

Runtime state is intentionally outside release directories:

- `/etc/panpops.env`: root-owned secrets and runtime configuration (`0600`)
- `/var/lib/panpops/panpops.sqlite3`: orders, accounts and catalogue data
- `/var/www/panpops/releases/<git-sha>`: immutable release directories
- `/var/www/panpops/current`: symlink to the active release

To roll back, repoint `/var/www/panpops/current` to the preceding release and
restart `panpops.service`. Database migrations are additive, so the database is
preserved across a code rollback.

The Nginx policy begins with CSP in report-only mode so Razorpay Standard
Checkout can be observed without blocking payments. Promote it to an enforcing
`Content-Security-Policy` header only after production checkout telemetry shows
the final Razorpay origins required by the account's enabled payment methods.

The Razorpay webhook is
`https://panvibesonline.com/api/webhooks/razorpay`. It accepts signed
`payment.captured` and `order.paid` notifications with the secret configured
in `/etc/panpops.env`.

SMTP credentials also live in `/etc/panpops.env`: `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, and `ORDER_ADMIN_EMAIL`.
The running Rust service owns the durable email worker; no separate mail daemon
is needed. Order emails are queued atomically after a COD order or a captured
online payment. The dashboard shows delivery status; check service logs for
outbox IDs if a message is deferred. Logs omit addresses, message bodies and
SMTP responses. Email failures do not cancel orders.

Before the 0.2.0 rollout, back up the database with SQLite's backup API and keep
the previous release and environment file. The migration adds payment methods,
verification metadata and the mail outbox, and expires existing login sessions.
Existing customers confirm their email on their next login. Test SMTP
authentication and worker delivery to controlled mailboxes before switching the
production symlink. Never use real customer addresses for deployment tests.
