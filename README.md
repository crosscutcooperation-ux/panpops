# PanPops · The Flavour Crossing

Private PanPops storefront prototype with an interactive homepage, animated cart overview, checkout terminal, and preview account screens.

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
- Checkout packs the selection into the trolley beside a terminal-style billing form. It requires a fresh review when the basket changes before completion.
- Login and registration demonstrate the account screens and require the shopper to confirm they are over 14. Use sample details. Only the preview name, email, and age confirmation are stored for the browser tab. Passwords are discarded.
- Preview checkout uses sample details and collects no payment. Completing the demo empties the local cart.

The cart supports previously saved combo boxes. Motion has a still presentation when reduced motion is enabled.

## Source

`src/templates.js` and `src/commerce-templates.js` render the pages. `src/cart.js` is the shared cart store. `src/trolley-motion.js` provides the shared trolley presentation and pouch effects. The original Three.js pouch models remain in `src/scenes.js`.

PanPops packaging images are sourced from the [current PanPops storefront](https://panvibesonline.com/). Bodoni Moda and Manrope are distributed under their bundled OFL licenses.
