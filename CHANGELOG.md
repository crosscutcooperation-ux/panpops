# Changelog

## 0.2.0 — 2026-11-17

### Added
- Cash on delivery checkout, COD filters in the order dashboard, and explicit cash collection when delivering an order.
- Email confirmation before account login, including existing accounts. Customers must log in again and confirm their address after this release.
- Automatic order confirmations to customers and the configured admin mailbox, with durable delivery retries and dashboard delivery states.

### Security
- Updated bundled SQLite to address [RUSTSEC-2026-0459](https://rustsec.org/advisories/RUSTSEC-2026-0459).
