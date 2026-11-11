# PanPops · The Flavour Crossing

Private PanPops storefront prototype with an interactive homepage, animated cart overview, checkout terminal, and preview account screens. A separate Rust/Axum service provides editable prices, delivery rules, persisted orders, and Razorpay verification.

The supplied **Our Products** and **Our Flavours** apps are integrated into the same multi-page site: `/shop/` has rotating single-pack and combo displays, each flavour has a direct product URL, the homepage includes the floating flavour studio below the original crossing followed by the picture-based box builder, and `/build-a-box/` packs two to six pouches into a four- or six-slot 3D box. The selected components use the ZIP's Montserrat, Manrope, and Space Mono fonts. All purchase controls share the existing persisted cart and Rust price catalogue.

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

## Vercel preview

The root `vercel.json` configures two services: the Vite storefront (`app`) and the Rust/Axum API (`backend`). The storefront is public on all non-API paths, while `/api/*` is routed to the backend. No service binding is needed because browser requests use the public same-origin `/api` route.

This Vercel setup is preview-only. Vercel function instances use SQLite at `/tmp/panpops.sqlite3`; the file is temporary and isolated to each warm instance, so prices and orders can reset or differ between instances. Razorpay payments are disabled automatically on Vercel. Do not use this deployment to accept real orders or payments. For production, move the backend to durable shared storage before enabling checkout.

Set `ADMIN_TOKEN` in the Vercel project environment settings to a random value of at least 32 characters to use the temporary admin API. Do not commit the token or Razorpay credentials.

## Source

`src/templates.js` and `src/commerce-templates.js` render the pages. `src/cart.js` is the shared cart store. `src/trolley-motion.js` provides the shared trolley presentation and pouch effects. The original Three.js pouch models remain in `src/scenes.js`.

`src/collection-templates.js`, `src/collections.js`, `src/collection-scenes.js`, and `src/catalog-pages.css` contain the selected ZIP components and their integration. These styles are scoped to the imported sections so the homepage crossing and checkout retain their layouts.

PanPops packaging images are sourced from the [PanPops storefront](https://panvibesonline.com/). Montserrat, Manrope, and Space Mono are served locally with their bundled OFL licenses.

The box builder animates picture selections into the tray and closes its lid before sending a sealed box to the trolley. Boxes remain sealed in cart and checkout; selecting a box opens its contents for inspection. Cart storage retains each box’s capacity and full contents, including legacy saved boxes. Rust orders validate and retain package metadata alongside server-priced product quantities.
