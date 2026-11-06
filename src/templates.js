import { products, money, productUrl, front, back, MAX_BOX } from './catalog.js'

const paths = {
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  left: 'm15 5-7 7 7 7',
  right: 'm9 5 7 7-7 7',
  bag: 'M5 8h14l1 13H4L5 8Zm4 2V6a3 3 0 0 1 6 0v4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  spin: 'M20 11a8 8 0 1 0-2 6m2-11v5h-5',
  cube: 'm12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm-8 4.5 8 4.5 8-4.5M12 12v9',
  spark: 'm12 2 2 7 7 3-7 2-2 8-2-8-8-2 8-3 2-7Z',
  close: 'm6 6 12 12M6 18 18 6',
}
export const icon = name => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="' + paths[name] + '"/></svg>'
export const productStyle = product => '--accent:' + product.accent + ';--stage:' + product.stage + ';--light:' + product.light
const logo = '<img src="/media/logo.png" width="353" height="104" alt="PanVibes PanPops">'
const eyebrow = label => '<p class="eyebrow"><span></span>' + label + '</p>'
const link = (url, label, style = 'button') => '<a class="' + style + '" href="' + url + '">' + label + icon('arrow') + '</a>'
const current = active => active ? ' aria-current="page"' : ''

function header(page) {
  return `
    <a class="skip" href="#main">Skip to content</a>
    <header class="topbar">
      <div class="shell nav-shell">
        <a class="brand" href="/" aria-label="PanPops home">${logo}</a>
        <nav aria-label="Main navigation">
          <a href="/"${current(page === 'home')}>Flavour studio</a>
          <a href="/shop/"${current(page === 'shop' || page === 'product')}>Shop</a>
          <a href="/build-a-box/"${current(page === 'box')}>Build a box</a>
        </nav>
        <a class="bag-link" href="/cart/"${current(page === 'cart')} aria-label="Cart, 0 items">${icon('bag')}<span class="bag-name">Cart</span><span data-cart-count>0</span></a>
      </div>
    </header>`
}

function footer() {
  return `
    <footer class="footer">
      <div class="shell footer-inner">
        <a class="brand" href="/" aria-label="PanPops home">${logo}</a>
        <p>Roasted makhana. Four ways to crunch.</p>
        <nav aria-label="Footer"><a href="/shop/">Shop</a><a href="/build-a-box/">Build a box</a><a href="/cart/">Cart</a></nav>
      </div>
    </footer>
    <div class="toast" role="status" aria-live="polite"></div>`
}

function packImage(product, className = '', lazy = false) {
  return '<img class="' + className + '" src="' + front(product) + '" width="680" height="925" alt="' + product.name + ' PanPops pouch"' + (lazy ? ' loading="lazy"' : '') + '>'
}

function cards() {
  return products.map((product, index) => `
    <article class="pack-card" style="${productStyle(product)}">
      <a class="pack-card-art" href="${productUrl(product)}">
        <span aria-hidden="true">0${index + 1}</span>${packImage(product, '', true)}
      </a>
      <div class="pack-card-body">
        <p class="flavour-note">${product.note}</p>
        <h3><a href="${productUrl(product)}">${product.name}</a></h3>
        <div class="pack-card-buy"><span><strong>${money(product.price)}</strong><small> / ${product.weight} g</small></span><button class="icon-button outline" type="button" data-add="${product.id}" aria-label="Add ${product.name} to cart">${icon('plus')}</button></div>
      </div>
    </article>`).join('')
}

function home() {
  const active = products[0]
  return `
    <section class="shell hero" data-carousel style="${productStyle(active)}">
      <div class="hero-copy">
        ${eyebrow('THE FLAVOUR STUDIO')}
        <h1>Pick your <br><em>crunch.</em></h1>
        <p class="hero-description">Four flavours of roasted makhana. Find the one you’re craving.</p>
      </div>
      <div class="hero-interaction">
        <div class="stage hero-stage" data-stage data-swipe>
          <div class="stage-id"><span></span> PANPOPS STUDIO</div>
          <div class="stage-rings" aria-hidden="true"></div>
          <div class="stage-floor" aria-hidden="true"></div>
          <div class="carousel-stills" aria-hidden="true">
            ${products.map((product, index) => packImage(product, 'carousel-pack ' + ['center','next','parked','prev'][index])).join('')}
          </div>
          <div class="scene-host" data-scene aria-hidden="true"></div>
          <div class="stage-controls">
            <button type="button" class="icon-button stage-button" data-step="-1" aria-label="Previous flavour">${icon('left')}</button>
            <span data-stage-counter>01 / 04</span>
            <button type="button" class="icon-button stage-button" data-step="1" aria-label="Next flavour">${icon('right')}</button>
          </div>
          <span class="stage-hint">${icon('spin')} SWIPE TO EXPLORE</span>
        </div>
        <div class="flavour-rail" aria-label="Choose a flavour">
          ${products.map((product, index) => `
            <button class="flavour-tab" type="button" data-pick="${index}" aria-label="${product.name}" aria-pressed="${index === 0}" style="${productStyle(product)}">
              ${packImage(product)}<span>${product.name}</span>
            </button>`).join('')}
        </div>
      </div>
      <div class="hero-selection">
        <div class="active-flavour" id="active-flavour" aria-live="polite">
          <span class="flavour-index" data-current-index>01</span>
          <div><h2 data-active-name>${active.name}</h2><p data-active-note>${active.note}</p></div>
        </div>
        <a class="button hero-action" data-active-link href="${productUrl(active)}">Explore flavour ${icon('arrow')}</a>
      </div>
    </section>
    <section class="lineup" aria-labelledby="lineup-heading">
      <div class="shell">
        <div class="section-heading">${eyebrow('THE LINEUP')}<h2 id="lineup-heading">Find your flavour.</h2></div>
        <div class="pack-grid">${cards()}</div>
      </div>
    </section>
    <section class="shell home-box">
      <div>${eyebrow('MIX & MATCH')}<h2>Make it your mix.</h2><p>Pick two to four pouches and pack a box with your favourites.</p>${link('/build-a-box/', 'Build a box')}</div>
      <div class="home-box-art" aria-hidden="true">${products.map(product => packImage(product, '', true)).join('')}</div>
    </section>`
}

function shop() {
  return `
    <section class="shell inner-page">
      <div class="page-heading">${eyebrow('THE LINEUP')}<h1>Shop the crunch.</h1><p>Four flavours of roasted makhana, ready to make your own.</p></div>
      <div class="pack-grid">${cards()}</div>
      <div class="quiet-callout"><div><h2>Want a little of everything?</h2><p>Choose the pouches that go in your box.</p></div>${link('/build-a-box/', 'Build a box', 'button secondary')}</div>
    </section>`
}

function productPage(product) {
  const number = products.indexOf(product) + 1
  return `
    <section class="shell inner-page product-page" data-product="${product.id}" style="${productStyle(product)}">
      <div class="breadcrumbs"><a href="/shop/">Shop</a><span>/</span><span>${product.name}</span></div>
      <div class="product-layout">
        <div class="product-stage stage" data-stage>
          <div class="stage-id"><span></span> FLAVOUR NO. 0${number}</div>
          <div class="stage-rings" aria-hidden="true"></div>
          <div class="stage-floor" aria-hidden="true"></div>
          <div class="product-stills">${packImage(product, 'product-front')}<img class="product-back" src="${back(product)}" width="946" height="1500" alt="${product.name} back-of-pack label" hidden></div>
          <div class="scene-host" data-scene aria-hidden="true"></div>
          <div class="pop-still" aria-hidden="true">${Array.from({ length: 13 }, (_, index) => '<i style="--i:' + index + '"></i>').join('')}</div>
          <span class="stage-hint" data-drag-hint hidden>${icon('spin')} DRAG TO ROTATE</span>
        </div>
        <div class="product-copy">
          ${eyebrow(product.note.toUpperCase())}
          <h1>${product.name}</h1>
          <p class="product-description">${product.description}</p>
          <p class="price-line"><strong>${money(product.price)}</strong><span>${product.weight} g pouch</span></p>
          <div class="product-buy">
            <div class="stepper" aria-label="Quantity">
              <button type="button" data-quantity="-1" aria-label="Decrease quantity" disabled>${icon('minus')}</button>
              <output data-product-quantity aria-live="polite">1</output>
              <button type="button" data-quantity="1" aria-label="Increase quantity">${icon('plus')}</button>
            </div>
            <button class="button" type="button" data-add="${product.id}">${icon('bag')} Add to cart</button>
          </div>
          <div class="product-actions">
            <button class="button secondary" type="button" data-flip aria-expanded="false">${icon('spin')} View back of pack</button>
            ${product.id === 'chataka' ? '<button class="button secondary pop-button" type="button" data-pop>' + icon('spark') + ' Pop the pack</button>' : ''}
          </div>
          <div class="label-panel" data-label-panel hidden>
            <a href="${back(product)}" target="_blank" rel="noopener">Open full-size label ${icon('arrow')}</a>
          </div>
          <a class="text-link" href="/build-a-box/">Mix it into a box ${icon('arrow')}</a>
        </div>
      </div>
      <div class="product-siblings"><span class="eyebrow">MORE FLAVOURS</span>${products.filter(item => item !== product).map(item => '<a href="' + productUrl(item) + '">' + item.name + icon('arrow') + '</a>').join('')}</div>
    </section>`
}

function box() {
  return `
    <section class="shell inner-page" data-box>
      <div class="page-heading">${eyebrow('MIX & MATCH')}<h1>Build a box.</h1><p>Choose two to four pouches. Mix flavours or double up on a favourite.</p></div>
      <div class="box-layout">
        <div class="stage box-stage" data-stage>
          <div class="stage-id"><span></span> THE PACKING STATION</div>
          <div class="tray-still" aria-hidden="true">
            ${Array.from({ length: MAX_BOX }, () => '<div class="tray-slot"><span>+</span><img alt="" hidden></div>').join('')}
          </div>
          <div class="scene-host" data-scene aria-hidden="true"></div>
          <div class="stage-controls box-counter" data-box-count>0 / 4 POUCHES</div>
        </div>
        <div class="box-controls">
          <div class="box-rows">${products.map(product => `
            <div class="box-row">
              ${packImage(product)}
              <div><h2>${product.name}</h2><span>${money(product.price)} / pouch</span></div>
              <div class="stepper" aria-label="${product.name} quantity">
                <button type="button" data-box-id="${product.id}" data-delta="-1" aria-label="Remove ${product.name}" disabled>${icon('minus')}</button>
                <output data-box-quantity="${product.id}">0</output>
                <button type="button" data-box-id="${product.id}" data-delta="1" aria-label="Add ${product.name}">${icon('plus')}</button>
              </div>
            </div>`).join('')}</div>
          <div class="summary-line"><span>Box subtotal</span><strong data-box-total>₹0</strong></div>
          <p class="box-status" data-box-status aria-live="polite">Choose at least 2 pouches.</p>
          <button class="button" type="button" data-add-box disabled>${icon('bag')} Add box to cart</button>
        </div>
      </div>
    </section>`
}

function cart() {
  return `
    <section class="shell inner-page cart-page">
      <div class="page-heading">${eyebrow('YOUR SELECTION')}<h1>Your cart.</h1></div>
      <div data-cart-view>
        <div class="empty-cart">${icon('bag')}<h2>Your cart is empty.</h2><p>Find a flavour to get started.</p>${link('/shop/', 'Explore the shop')}</div>
      </div>
      <dialog class="review-dialog" data-review-dialog>
        <form method="dialog"><button class="icon-button outline dialog-close" aria-label="Close order review">${icon('close')}</button></form>
        ${eyebrow('DEMO ORDER REVIEW')}
        <h2 id="review-title">Your crunch, packed.</h2>
        <div data-review-summary></div>
        <p class="review-note">This is a demo. No payment is collected and no order is placed.</p>
        <form method="dialog"><button class="button">Back to cart</button></form>
      </dialog>
    </section>`
}

export function renderPage(page, product) {
  const content = { home, shop, product: () => productPage(product), box, cart }[page]()
  return header(page) + '<main id="main">' + content + '</main>' + footer()
}
