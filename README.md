# PanPops · The Flavour Crossing

Private PanPops storefront prototype with an interactive homepage, animated cart overview, checkout terminal, and preview account screens. A separate Rust/Axum service provides editable prices, delivery rules, persisted orders, and Razorpay verification.

## Run locally

```sh
npm ci
npm run dev
```

`npm run build` builds the HTML pages and assets into `dist/`. `npm run preview` serves that build locally.

## Review the flow

- The homepage reveal and makhana burst replay when the section comes back into view.
- Selecting a strip adds one pouch to the browser cart. The trolley arrives with the existing selection before catching the new pouch.
- The cart page unpacks saved items into a line. Each item has quantity and removal controls. Empty cart dissolves the visible pouches and clears the saved basket.
- Cart and checkout trolleys enter from the viewport bottom. Checkout scans each pouch's back, builds a running receipt, and packs the trolley beside the billing terminal. It requires a fresh review when the basket changes before completion.
- Login and registration demonstrate the account screens and require the shopper to confirm they are over 14. Use sample details. Only the preview name, email, and age confirmation are stored for the browser tab. Passwords are discarded.
- Preview checkout uses sample details and collects no payment. Completing the demo empties the local cart.

The cart supports previously saved combo boxes. Motion has a still presentation when reduced motion is enabled.

## Rust pricing and payments

Follow [backend/README.md](backend/README.md) to run the Rust service and manage prices at `/admin/`. Follow [backend/RAZORPAY_SETUP.md](backend/RAZORPAY_SETUP.md) to connect Test Mode keys, configure capture and webhooks, test, and switch to Live Mode. The private review Site remains a browser-local demo until a separately hosted Rust API is configured in the frontend build.

## Source

`src/templates.js` and `src/commerce-templates.js` render the pages. `src/cart.js` is the shared cart store. `src/trolley-motion.js` provides the shared trolley presentation and pouch effects. The original Three.js pouch models remain in `src/scenes.js`.

PanPops packaging images are sourced from the [current PanPops storefront](https://panvibesonline.com/). Bodoni Moda and Manrope are distributed under their bundled OFL licenses.
