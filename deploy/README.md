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

The Razorpay Test Mode webhook is
`https://panvibesonline.com/api/webhooks/razorpay`. It accepts signed
`payment.captured` and `order.paid` notifications with the secret configured
in `/etc/panpops.env`.
