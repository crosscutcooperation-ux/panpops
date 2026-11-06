# PanPops · The Flavour Turntable

A private, multi-page storefront prototype for PanPops roasted makhana. The four product worlds, home turntable and packing tray share one textured Three.js pouch design.

## Run locally

```sh
npm ci
npm run dev
```

`npm run build` builds the eight HTML pages and their assets into `dist/`. `npm run preview` serves that build locally.

## Edit

- `src/catalog.js` holds the flavour copy, preview prices and studio colours.
- `src/templates.js` and `src/style.css` define the page layouts and still-image views.
- `src/scenes.js` defines the pouch geometry, turntable choreography, product props and tray.
- `src/cart.js` handles the demo cart in browser storage.

PanPops packaging images are sourced from the [current PanPops storefront](https://panvibesonline.com/). Manrope is distributed under its bundled OFL license.

The order review uses demo prices and browser storage. The existing PHP catalogue, cart, delivery logic and Razorpay flow are production integration work.
