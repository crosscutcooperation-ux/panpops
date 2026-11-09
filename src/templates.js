import { products, front } from './catalog.js'

import { icon } from './icons.js'
import { renderTrolley } from './trolley.js'
import { cartPage, checkoutPage, accountPage } from './commerce-templates.js'

export { icon } from './icons.js'
const logo = '<img src="/media/logo.png" width="353" height="104" alt="PanVibes PanPops">'

function header(page) {
  return `
    <a class="skip" href="#main">Skip to content</a>
    <header class="topbar" id="top">
      <nav class="shell nav-shell" aria-label="Main navigation">
        <a class="brand" href="/#top" aria-label="PanPops home">${logo}</a>
        <div class="nav-pages">
          <a href="/#top"${page === 'home' ? ' aria-current="page"' : ''}>Home</a>
          <a href="/#products">Products</a>
          <button type="button" data-future-page>About Us</button>
          <button type="button" data-future-page>Contact</button>
        </div>
        <div class="nav-actions">
          <a class="cart-trigger" href="/cart/" data-cart-link aria-label="Cart, 0 items">${icon('cart')}<span data-cart-count>0</span></a>
          <a href="/login/">Login</a>
          <a href="/register/">Register</a>
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

export function renderPage(page = 'home') {
  const pages = {
    home,
    cart: cartPage,
    checkout: checkoutPage,
    login: () => accountPage('login'),
    register: () => accountPage('register'),
  }
  return header(page) + '<main id="main">' + pages[page]() + '</main>' + `
    <footer class="footer"><div class="shell footer-inner">
      <a class="brand" href="/#top" aria-label="PanPops home">${logo}</a>
      <p>Roasted makhana. Four ways to crunch.</p>
    </div></footer>` +
    renderTrolley('arrival', 'cart-train', 'data-cart-train aria-hidden="true" hidden') +
    '<div class="toast" role="status" aria-live="polite"></div>'
}
