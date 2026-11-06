import { products, front } from './catalog.js'

const paths = {
  cart: 'M2 3h3l3 13h11l3-9H6m3 13h.01m9 0h.01',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
}
export const icon = name => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="' + paths[name] + '"/></svg>'
const logo = '<img src="/media/logo.png" width="353" height="104" alt="PanVibes PanPops">'

function header() {
  return `
    <a class="skip" href="#main">Skip to content</a>
    <header class="topbar" id="top">
      <nav class="shell nav-shell" aria-label="Main navigation">
        <a class="brand" href="#top" aria-label="PanPops home">${logo}</a>
        <div class="nav-pages">
          <a href="#top" aria-current="page">Home</a>
          <a href="#products">Products</a>
          <button type="button" data-future-page>About Us</button>
          <button type="button" data-future-page>Contact</button>
        </div>
        <div class="nav-actions">
          <button class="cart-trigger" type="button" data-open-cart aria-label="Cart, 0 items" aria-haspopup="dialog">${icon('cart')}<span data-cart-count>0</span></button>
          <button type="button" data-future-page>Login</button>
          <button type="button" data-future-page>Register</button>
        </div>
      </nav>
    </header>`
}

function home() {
  return `
    <section class="hero-placeholder" aria-label="PanPops roasted makhana">
      <img src="${front(products[0])}" width="680" height="925" alt="PanPops Chataka Pataka roasted makhana pouch" fetchpriority="high">
    </section>
    <section id="products" class="flavour-crossing" aria-labelledby="crossing-heading">
      <div class="crossing-heading shell">
        <h1 id="crossing-heading">Pick your crunch.</h1>
        <p>Tap a pouch to add it to your cart.</p>
      </div>
      <div class="crossing-stage" data-crossing>
        ${products.map(product => `
          <button class="crossing-band crossing-${product.id}" type="button" data-crossing-add="${product.id}" style="--accent:${product.accent};--stage:${product.stage};--light:${product.light}" aria-label="Add ${product.name} to cart">
            <span class="crossing-art" data-crossing-art aria-hidden="true">
              <span class="crossing-particles">${'<i></i>'.repeat(6)}</span>
              <img class="crossing-pack" src="${front(product)}" width="680" height="925" alt="">
            </span>
            <span class="crossing-buy">Add to cart ${icon('plus')}</span>
          </button>`).join('')}
        <div class="scene-host crossing-scene" data-scene aria-hidden="true"></div>
      </div>
    </section>`
}

function cart() {
  return `
    <div class="cart-train" data-cart-train aria-hidden="true" hidden>
      <div class="cart-train-packs" data-train-packs></div>
      <div class="cart-train-target" data-arrival-target></div>
      <svg viewBox="0 0 310 186" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21h35l35 130h163m-186-90h243l-43 72H76" stroke-width="7"/>
        <path d="M67 85h216M73 110h194M107 61l14 72m31-72 6 72m37-72-6 72m49-72-18 72m56-72-30 72" stroke-width="3"/>
        <circle cx="111" cy="169" r="12" fill="#3c2418" stroke-width="5"/>
        <circle cx="228" cy="169" r="12" fill="#3c2418" stroke-width="5"/>
      </svg>
    </div>
    <dialog class="cart-drawer" data-cart-dialog aria-labelledby="cart-heading">
      <div class="cart-drawer-header">
        <div><p>PanPops</p><h2 id="cart-heading">Your cart</h2></div>
        <form method="dialog"><button class="icon-button" type="submit" aria-label="Close cart">${icon('close')}</button></form>
      </div>
      <div data-cart-view></div>
    </dialog>
    <div class="toast" role="status" aria-live="polite"></div>`
}

export function renderPage() {
  return header() + '<main id="main">' + home() + '</main>' + `
    <footer class="footer"><div class="shell footer-inner">
      <a class="brand" href="#top" aria-label="PanPops home">${logo}</a>
      <p>Roasted makhana. Four ways to crunch.</p>
    </div></footer>` + cart()
}
