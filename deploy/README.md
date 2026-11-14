# Production deployment

The production service runs as the unprivileged `panpops` system user. Until
`panvibesonline.com` points at the EC2 instance, Nginx terminates TLS on the
public EC2 IP and proxies the same-origin frontend and `/api` requests to Axum
on `127.0.0.1:3001`. The intended canonical host is
`https://panvibesonline.com`; `https://www.panvibesonline.com` redirects to the
canonical apex host after both DNS records point to this instance.

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

The Razorpay webhook is planned as
`https://panvibesonline.com/api/webhooks/razorpay`. It cannot reach this
backend until the domain A record changes from the previous host to the EC2 IP.
