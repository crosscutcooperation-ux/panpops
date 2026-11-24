# Changelog

## 0.3.1 — 2026-11-25

### Fixed
- Made the four flavour photographs orbit around one another, with swipe and arrow navigation along the same path.
- Made the hero advance every five seconds, including after mouse or touch navigation. Keyboard focus, explicit pause and reduced-motion preferences still pause autoplay.

## 0.3.0 — 2026-11-25

### Changed
- Added four original photographic hero campaigns with automatic horizontal slides, swipe, keyboard, pause, and reduced-motion support.
- Replaced rotating pouch viewers with the supplied product photos on individual product pages, combos, the shop, and flavour browsing. Original 3D source files remain available for future development.
- Updated pack imagery throughout shopping, box-building, cart and checkout displays.
- Removed white studio backgrounds from all four pack photos with transparent WebP cutouts, and enlarged the combo photo layout.

## 0.2.1 — 2026-11-17

### Changed
- Replaced the homepage hero image with the supplied looping, muted product video. The full frame remains visible on mobile, with a pause control and a still poster for reduced motion.

## 0.2.0 — 2026-11-17

### Added
- Cash on delivery checkout, COD filters in the order dashboard, and explicit cash collection when delivering an order.
- Email confirmation before account login, including existing accounts. Customers must log in again and confirm their address after this release.
- Automatic order confirmations to customers and the configured admin mailbox, with durable delivery retries and dashboard delivery states.

### Security
- Updated bundled SQLite to address [RUSTSEC-2026-0459](https://rustsec.org/advisories/RUSTSEC-2026-0459).
