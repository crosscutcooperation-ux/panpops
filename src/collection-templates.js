import { products, productById, combos, money, productUrl, front, back, MAX_BOX } from './catalog.js'
import { icon } from './icons.js'

export const productStyle = product => '--accent:' + product.accent + ';--stage:' + product.stage + ';--light:' + product.light + ';--packet:' + product.pack
const eyebrow = label => '<p class="eyebrow">' + label + '</p>'

function packImage(product, className = '', lazy = false) {
  return '<img class="' + className + '" src="' + front(product) + '" width="680" height="925" alt="' + product.name + ' PanPops pouch"' + (lazy ? ' loading="lazy"' : '') + '>'
}

function shopSelection(standalone = false, recommendedFor = null) {
  const items = [
    ...products.map(product => ({ ...product, ids: [product.id], category: 'single', url: productUrl(product), note: product.note })),
    ...combos.map(combo => ({ ...combo, category: 'combo' + combo.ids.length, url: '/shop/combos/' + combo.id + '/', note: combo.ids.map(id => productById[id].name).join(' + ') })),
  ].filter(item => !recommendedFor || item.id !== recommendedFor.id)
  const filters = [['all', 'Show all'], ['single', 'Single packs'], ['combo2', '2-pack combos'], ['combo3', '3-pack combos'], ['combo4', '4-pack combo'], ['custom', 'Build your own']]
  const headingId = recommendedFor ? 'recommended-heading' : 'shop-heading'
  const heading = recommendedFor ? 'Recommended for you' : 'Our products'
  return `
    <section class="shop-selection ${standalone ? 'shop-standalone' : ''} ${recommendedFor ? 'shop-recommendations' : ''}" id="${recommendedFor ? 'recommended-products' : 'our-products'}" data-shop aria-labelledby="${headingId}">
      <div class="shell">
        <div class="shop-heading">
          <p class="studio-kicker"><i></i> ${recommendedFor ? 'MORE TO CRUNCH ON' : 'THE PANPOPS SHOP'}</p>
          <h${standalone ? '1' : '2'} id="${headingId}">${heading}<span>.</span></h${standalone ? '1' : '2'}>
          <p>${recommendedFor ? 'Keep exploring. Your next favourite is right here.' : 'Pick your crunch. Find your favourites. Make it a box.'}</p>
        </div>
        <div class="shop-toolbar">
          ${recommendedFor ? '<a class="recommendations-all" href="/shop/">Shop all products ' + '</a>' : '<div class="shop-filters" role="group" aria-label="Filter products">' + filters.map(([value, label]) => `<button type="button" data-filter="${value}" aria-pressed="${value === 'all'}">${label}</button>`).join('') + '</div>'}
          <button class="motion-toggle" type="button" data-shop-motion aria-pressed="true">${icon('spin')} Rotation <span>on</span></button>
        </div>
        <div class="shop-grid" data-shop-grid>
          <div class="shop-canvas" data-shop-canvas aria-hidden="true"></div>
          ${items.map((item, index) => {
            const product = productById[item.ids[0]]
            return `<article class="shop-item" data-category="${item.category}" style="${productStyle(product)}">
              <a class="shop-display" href="${item.url}" data-display="${item.ids.join(',')}" aria-label="Open ${item.name}">
                <span class="display-number">${String(index + 1).padStart(2, '0')}</span>
                ${item.ids.length > 1 ? `<span class="display-pack">PACK OF ${item.ids.length}</span>` : ''}
                <div class="display-stills display-count-${item.ids.length}" aria-hidden="true">${item.ids.map(id => packImage(productById[id], '', true)).join('')}</div>
                <div class="display-plinth" aria-hidden="true"></div>
              </a>
              <div class="shop-item-copy">
                <p class="studio-kicker">${item.ids.length === 1 ? 'ROASTED MAKHANA / 50 G' : item.ids.length + ' FLAVOURS / ' + item.ids.length * 50 + ' G'}</p>
                <h3><a href="${item.url}">${item.name}</a></h3>
                <p class="shop-item-note">${item.note}</p>
                <div class="shop-item-buy"><span><b data-selection-price="${item.ids.join(',')}" ${item.ids.length > 1 ? 'data-combo-price="' + item.id + '"' : ''}>${money(item.price)}</b> <small>${item.ids.length === 1 ? '/ pouch' : '/ combo'}</small></span><button type="button" data-shop-add="${item.ids.join(',')}" ${item.ids.length > 1 ? 'data-combo-id="' + item.id + '"' : ''} aria-label="Add ${item.name} to cart">${icon('plus')}</button></div>
              </div>
            </article>`
          }).join('')}
          <article class="shop-item shop-custom" data-category="custom" style="--accent:#876044;--stage:#78513b;--light:#bc9366">
            <a class="shop-display custom-display" href="/build-a-box/" data-display="box" aria-label="Open the build your own snack box page">
              <span class="display-number">10</span><span class="display-pack">YOUR MIX</span>
              <div class="custom-box-still" aria-hidden="true"><div>${products.map(product => packImage(product, '', true)).join('')}</div></div>
            </a>
            <div class="shop-item-copy"><p class="studio-kicker">2–6 POUCHES / ALL YOUR FAVOURITES</p><h3><a href="/build-a-box/">Build a box</a></h3><p class="shop-item-note">A little spicy. A little creamy. Entirely yours.</p><div class="shop-item-buy"><span>From <b data-selection-price="minimum-box">${money(Math.min(...products.map(product => product.price)) * 2)}</b></span><a href="/build-a-box/" aria-label="Choose your box flavours">${icon('plus')}</a></div></div>
          </article>
        </div>
        <div class="shop-bottom"><p data-shop-count role="status" aria-live="polite">${items.length + 1} ways to find your happy crunch.</p><span class="studio-kicker">SLOW TURNS. BIG CRUNCH.</span></div>
      </div>
    </section>`
}

export function shopPage() {
  return shopSelection(true)
}

export function comboPage(combo) {
  return productPage(combo)
}

export function productPage(selection) {
  const combo = Boolean(selection.ids)
  const product = combo ? { ...productById[selection.ids[0]], ...selection, weight: selection.ids.length * 50, note: 'A ready-made flavour mix', description: selection.ids.map(id => productById[id].name).join(' + ') + '. One 50 g pouch of each flavour.' } : selection
  const unit = combo ? 'combo' : 'pouch'
  return `
    <section class="shell inner-page product-page ${combo ? 'combo-product-page' : ''}" data-product="${product.id}" style="${productStyle(product)};--pack-count:${combo ? selection.ids.length : 1}">
      <div class="breadcrumbs"><a href="/shop/">Shop</a><span>/</span><span>${product.name}</span></div>
      <div class="product-layout">
        <div class="product-stage stage" data-stage>
          <div class="product-disc" aria-hidden="true"></div>
          <div class="product-stills">${combo ? '<div class="product-front combo-stills">' + selection.ids.map(id => packImage(productById[id])).join('') + '</div><div class="product-back combo-stills" hidden>' + selection.ids.map(id => '<img src="' + back(productById[id]) + '" alt="' + productById[id].name + ' back-of-pack label">').join('') + '</div>' : packImage(product, 'product-front') + '<img class="product-back" src="' + back(product) + '" width="946" height="1500" alt="' + product.name + ' back-of-pack label" hidden>'}</div>
          <div class="scene-host" data-scene aria-hidden="true"></div>
          <button class="motion-toggle product-motion" type="button" data-product-motion aria-pressed="true">${icon('spin')} Rotation <span>on</span></button>
          <span class="stage-hint" data-drag-hint hidden>${icon('spin')} DRAG TO ROTATE</span>
        </div>
        <div class="product-copy">
          ${eyebrow(product.note.toUpperCase())}
          <h1>${product.name}</h1>
          <p class="product-description">${product.description}</p>
          <p class="price-line"><strong ${combo ? 'data-combo-price' : 'data-unit-price'}="${product.id}">${money(product.price)}</strong><span>${product.weight} g ${unit}${combo ? ' · ' + selection.ids.length + ' pouches' : ''}</span></p>
          <div class="quantity-options">
            <p class="studio-kicker">CHOOSE YOUR QUANTITY</p>
            <div class="quantity-presets" role="group" aria-label="Choose ${unit} quantity">
              ${[1, 2, 3, 4].map(quantity => `<button type="button" data-quantity-preset="${quantity}" aria-label="${quantity} ${unit}${quantity === 1 ? '' : 's'}" aria-pressed="${quantity === 1}">×${quantity}</button>`).join('')}
              <a class="quantity-combo" href="/build-a-box/${combo ? '' : '?mix=' + product.id + ',' + product.id}">${combo ? 'Make your own mix' : 'Make a combo'}</a>
            </div>
          </div>
          <p class="quantity-summary" data-quantity-summary role="status" aria-live="polite">1 ${unit} · ${product.weight} g total <strong>${money(product.price)}</strong></p>
          <div class="product-buy">
            <div class="stepper" aria-label="Quantity">
              <button type="button" data-quantity="-1" aria-label="Decrease quantity" disabled>${icon('minus')}</button>
              <output data-product-quantity aria-live="polite">1</output>
              <button type="button" data-quantity="1" aria-label="Increase quantity">${icon('plus')}</button>
            </div>
            <button class="button" type="button" data-add="${product.id}">${icon('bag')} Add to cart <span data-add-total>${money(product.price)}</span></button>
          </div>
          <div class="product-actions">
            <button class="button secondary" type="button" data-flip aria-expanded="false">${icon('spin')} ${combo ? 'View backs of packs' : 'View back of pack'}</button>
          </div>
          <div class="label-panel" data-label-panel hidden>
            ${(combo ? selection.ids.map(id => productById[id]) : [product]).map(item => '<a href="' + back(item) + '" target="_blank" rel="noopener">Open ' + item.name + ' label</a>').join('')}
          </div>
          <a class="text-link" href="/build-a-box/">Mix it into a box </a>
        </div>
      </div>
    </section>
    ${shopSelection(false, product)}`
}

export function boxPage(embedded = false) {
  return `
    <section id="build-box" class="shell inner-page box-builder ${embedded ? 'box-builder-home' : ''}" data-box>
      <div class="page-heading"><p class="eyebrow">MIX & MATCH</p><h${embedded ? '2' : '1'}>Build a box.</h${embedded ? '2' : '1'}><p>Tap a pack. Make it your mix.</p></div>
      <div class="box-layout">
        <div class="stage box-stage" data-stage data-capacity="4">
          <div class="tray-still" aria-hidden="true">${Array.from({ length: MAX_BOX }, (_, index) => `<div class="tray-slot" data-slot="${index}"><span>+</span><img alt="" hidden></div>`).join('')}</div>
          <div class="scene-host" data-scene aria-hidden="true"></div>
          <div class="box-fallback-lid" aria-hidden="true"><img src="/media/logo.png" alt=""></div>
          <div class="box-slot-targets" aria-hidden="true">${Array.from({ length: MAX_BOX }, () => '<span></span>').join('')}</div>
          <div class="stage-controls box-counter" data-box-count>0 / 4 POUCHES</div>
        </div>
        <div class="box-controls">
          <div class="box-picture-grid" role="group" aria-label="Choose your pouches">${products.map(product => `
            <div class="box-picture-tile" style="${productStyle(product)}">
              <button class="box-picture-add" type="button" data-box-pick="${product.id}" aria-label="Add ${product.name}" aria-pressed="false">${packImage(product)}<span class="tile-tick" aria-hidden="true">✓</span></button>
              <div class="box-tile-quantity"><button type="button" data-box-remove="${product.id}" aria-label="Remove ${product.name}" disabled>${icon('minus')}</button><output data-box-quantity="${product.id}" aria-label="${product.name} pouches">0</output><span data-unit-price="${product.id}">${money(product.price)}</span></div>
            </div>`).join('')}</div>
          <div class="summary-line"><span>Box subtotal</span><strong data-box-total>₹0</strong></div>
          <p class="box-status" data-box-status role="status">Choose at least 2 pouches.</p>
      <fieldset class="box-size"><legend>Box size</legend><label><input type="radio" name="box-size" value="4" checked><span>4 pouches</span></label><label><input type="radio" name="box-size" value="6"><span>6 pouches</span></label></fieldset>
          <p class="box-disclaimer">The box shown is for visual demonstration only. Your order includes the selected pouches; a physical box is not included.</p>
          <button class="button" type="button" data-add-box disabled>Close box & add to cart</button>
        </div>
      </div>
    </section>`
}


export function flavourStudio() {
  const active = products[0]
  return `
    <section id="flavours" class="flight-studio" data-carousel style="${productStyle(active)}" aria-label="Interactive PanPops flavour studio">
      <div class="shell flight-topline" aria-hidden="true"></div>
      <div class="flight-heading">
        <h2><span class="heading-our">Our</span> <span class="heading-flavours">flavours</span><span class="heading-period">.</span></h2>
        <p>Swipe or drag to explore the four flavours.</p>
      </div>
      <div class="flight-colour-panel">
      <div class="flight-stage" data-stage data-swipe tabindex="0" role="group" aria-label="Floating 3D makhana packets. Sweep the mouse sideways, swipe, drag, or use the left and right arrows to change flavour.">
        <div class="carousel-stills" aria-hidden="true">
          ${products.map((product, index) => packImage(product, 'carousel-pack ' + ['center','next','parked','prev'][index])).join('')}
        </div>
        <div class="scene-host" data-scene aria-hidden="true"></div>
        <button class="flight-arrow flight-previous" type="button" data-step="-1" aria-label="Previous flavour"><span class="flight-arrow-core" aria-hidden="true">Previous</span></button>
        <button class="flight-arrow flight-next" type="button" data-step="1" aria-label="Next flavour"><span class="flight-arrow-core" aria-hidden="true">Next</span></button>
      </div>
      <div class="shell flight-bottom">
        <div class="flight-selection" aria-live="polite" aria-atomic="true">
          <span class="flight-number" data-current-index>01</span>
          <div><p class="studio-kicker">ROASTED MAKHANA</p><h2 data-active-name>${active.name}</h2><p data-active-note>${active.note}</p></div>
        </div>
      </div>

      </div>
    </section>`
}
