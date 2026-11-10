import { products, front } from './catalog.js'

import { icon } from './icons.js'
import { inspectorTemplate } from './parcel-art.js'
import { renderTrolley } from './trolley.js'
import { cartPage, checkoutPage, accountPage, adminPage } from './commerce-templates.js'
import { shopPage, productPage, boxPage, flavourStudio } from './collection-templates.js'

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
          <a href="/shop/"${page === 'shop' || page === 'product' ? ' aria-current="page"' : ''}>Products</a>
          <a href="/build-a-box/"${page === 'box' ? ' aria-current="page"' : ''}>Build a Box</a>
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
      <div class="crossing-stage" data-crossing>
        <div class="crossing-heading">
          <h1 id="crossing-heading">Pick your crunch.</h1>
          <p>Tap a pouch to add it to your cart.</p>
        </div>
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
    </section>
    <div class="catalog-section">${flavourStudio()}${boxPage(true)}</div>`
}

export function renderPage(page = 'home', product) {
  const pages = {
    home,
    shop: () => '<div class="catalog-section">' + shopPage() + '</div>',
    product: () => '<div class="catalog-section">' + productPage(product) + '</div>',
    box: () => '<div class="catalog-section">' + boxPage() + '</div>',
    cart: cartPage,
    admin: adminPage,
    checkout: checkoutPage,
    login: () => accountPage('login'),
    register: () => accountPage('register'),
  }
  return header(page) + '<main id="main">' + pages[page]() + '</main>' + `
    <footer class="footer"><div class="shell footer-inner">
      <a class="brand" href="/#top" aria-label="PanPops home">${logo}</a>
      <p>Roasted makhana. Four ways to crunch.</p>
    </div></footer>` +
    inspectorTemplate() + renderTrolley('arrival', 'cart-train', 'data-cart-train aria-hidden="true" hidden') +
    '<div class="toast" role="status" aria-live="polite"></div>'
}
