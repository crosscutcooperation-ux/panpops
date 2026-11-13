# PanPops · The Flavour Crossing

A private homepage prototype for PanPops roasted makhana. Four colour strips share the original textured Three.js pouch models.

## Run locally

```sh
npm ci
npm run dev
```

`npm run build` builds the homepage and assets into `dist/`. `npm run preview` serves that build locally.

The development and preview servers listen on your network interfaces. To view the site on another device connected to the same network, run the server and open the **Network** URL Vite prints in the terminal. If it is not reachable, check that your firewall allows the server port.

The strip reveal and makhana burst replay each time the section comes back into view. Selecting a strip adds one pouch to the browser cart. The animated cart shows the existing contents before the new pouch lands. The navigation cart opens the same saved basket for review.

PanPops packaging images are sourced from the [current PanPops storefront](https://panvibesonline.com/). Bodoni Moda is distributed under its bundled OFL license.
