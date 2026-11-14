import { products, front } from './catalog.js'

import { icon } from './icons.js'
import { inspectorTemplate } from './parcel-art.js'
import { renderTrolley } from './trolley.js'
import { cartPage, checkoutPage, accountPage, adminPage, myAccountPage } from './commerce-templates.js'
import { shopPage, productPage, comboPage, boxPage, flavourStudio } from './collection-templates.js'

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
          <a href="/about/"${page === 'about' ? ' aria-current="page"' : ''}>About Us</a>
          <a href="/contact/"${page === 'contact' ? ' aria-current="page"' : ''}>Contact</a>
        </div>
        <div class="nav-actions">
          <a class="cart-trigger" href="/cart/" data-cart-link aria-label="Cart, 0 items">${icon('cart')}<span data-cart-count>0</span></a>
          <a href="/login/" data-auth-nav>Login</a>
          <a href="/account/" data-account-link>My account</a>
          <a href="/register/" data-auth-nav>Register</a>
        </div>
      </nav>
    </header>`
}

function home() {
  return `
    <section class="hero-video" aria-label="PanPops makhana production">
      <div class="hero-video-stage">
        <video class="hero-video-player" src="/media/makhana-production.mp4" autoplay muted loop playsinline preload="auto" aria-label="PanPops makhana production video"></video>
      </div>
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

function aboutPage() {
  return `
    <section class="shell brand-page about-page">
      <p class="brand-eyebrow">PANVIBES / PANPOPS</p>
      <h1>A little more thought<br>in every crunch.</h1>
      <p class="brand-lede">PanVibes is built around more mindful snacking. PanPops brings that idea to roasted makhana—crisp, full of flavour and made for a considered snack break.</p>
      <div class="brand-gallery" aria-label="PanPops flavour collection">
        ${products.map(product => `
          <figure style="--flavour-color:${product.accent}">
            <div><img src="${front(product)}" width="680" height="925" alt="${product.name} PanPops roasted makhana pouch" loading="lazy"></div>
            <figcaption>${product.name}</figcaption>
          </figure>`).join('')}
      </div>
      <div class="brand-story">
        <div>
          <p class="brand-label">OUR APPROACH</p>
          <p>Each PanPops flavour starts with roasted makhana, then takes its own direction—from tangy Chataka Pataka and fiery Peri Peri to mellow Cream &amp; Onion and Himalayan Pink Salt.</p>
        </div>
        <div>
          <p class="brand-label">MADE FOR YOUR MOMENT</p>
          <p>Some days call for a little heat; others, a quieter crunch. Pick a pouch, find your favourite, or bring a few flavours together in a box of your own.</p>
          <a class="brand-text-link" href="/shop/">Explore the flavours <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <blockquote>Good snacking should feel considered—and still be fun.</blockquote>
    </section>`
}

function contactPage() {
  return `
    <section class="shell brand-page contact-page">
      <p class="brand-eyebrow">GET IN TOUCH</p>
      <h1>We’d be glad<br>to hear from you.</h1>
      <p class="brand-lede">For questions about PanPops, products or an order, reach the PanVibes team using one of the contacts below.</p>
      <div class="contact-details">
        <a class="contact-detail" href="mailto:info@panvibesexim.com">
          <span class="brand-label">EMAIL</span>
          <strong>info@panvibesexim.com</strong>
          <span>For general and product enquiries</span>
        </a>
        <a class="contact-detail" href="https://wa.me/919987587872" target="_blank" rel="noopener noreferrer">
          <span class="brand-label">WHATSAPP</span>
          <strong>+91 99875 87872</strong>
          <span>Message PanVibes on WhatsApp</span>
        </a>
      </div>
      <div class="contact-address">
        <p class="brand-label">PANVIBES EXIM</p>
        <address>Akshar Business Park, W-2106,<br>Janta Market Road, Sector 25,<br>Vashi, Navi Mumbai, Maharashtra 400703, India</address>
        <a class="brand-text-link" href="tel:+912245686161">+91 22 4568 6161</a>
      </div>
      <nav class="contact-social" aria-label="PanVibes social media">
        <a href="https://www.instagram.com/panvibes.exim/" target="_blank" rel="noopener noreferrer">Instagram</a>
        <a href="https://www.facebook.com/panvibes.exim/" target="_blank" rel="noopener noreferrer">Facebook</a>
        <a href="https://www.linkedin.com/company/panvibes-exim/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      </nav>
    </section>`
}

export function renderPage(page = 'home', product) {
  const pages = {
    home,
    shop: () => '<div class="catalog-section">' + shopPage() + '</div>',
    product: () => '<div class="catalog-section" style="--product-wash-color:' + product.stage + '">' + productPage(product) + '</div>',
    box: () => '<div class="catalog-section">' + boxPage() + '</div>',
    cart: cartPage,
    admin: adminPage,
    account: myAccountPage,
    combo: () => '<div class="catalog-section" style="--product-wash-color:' + products.find(item => item.id === product.ids[0]).stage + '">' + comboPage(product) + '</div>',
    checkout: checkoutPage,
    login: () => accountPage('login'),
    register: () => accountPage('register'),
    about: aboutPage,
    contact: contactPage,
  }
  return header(page) + '<main id="main">' + pages[page]() + '</main>' + `
    <footer class="footer"><div class="shell footer-inner">
      <a class="brand" href="/#top" aria-label="PanPops home">${logo}</a>
      <p>Roasted makhana. Four ways to crunch.</p>
      <nav class="footer-links" aria-label="Footer navigation">
        <a href="/about/">About us</a>
        <a href="/contact/">Contact</a>
      </nav>
    </div></footer>` +
    inspectorTemplate() + renderTrolley('arrival', 'cart-train', 'data-cart-train aria-hidden="true" hidden') +
    '<div class="toast" role="status" aria-live="polite"></div>'
}
