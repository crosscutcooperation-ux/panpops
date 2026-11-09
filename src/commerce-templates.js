import { icon } from './icons.js'
import { renderTrolley } from './trolley.js'

const ageControl = () => `
  <label class="age-control">
    <input type="checkbox" name="over14" required>
    <span>I am over 14 and can place my own order.</span>
  </label>
  <p class="age-help">If you are 14 or younger, ask a parent or guardian to place the order.</p>`

export function cartPage() {
  return `
    <section class="shell commerce-page" data-cart-page>
      <div class="commerce-heading compact-heading"><h1>Your cart</h1></div>
      <div class="cart-experience" data-cart-experience data-phase="entering" aria-busy="true">
        <p class="experience-status" data-experience-status role="status">Bringing your cart around…</p>
        <ul class="cart-lineup" data-cart-lineup aria-label="Products in your cart"></ul>
        <div class="cart-dock">
          ${renderTrolley('overview', 'journey-trolley', 'data-journey-trolley aria-hidden="true"')}
          <span class="dock-mark" aria-hidden="true">PANPOPS / PACKING STATION</span>
        </div>
        <aside class="cart-commands" data-cart-commands hidden>

          <div class="basket-subtotal"><span>Subtotal</span><strong data-cart-subtotal></strong></div>
          <p class="subtotal-note">Delivery is calculated at checkout.</p>
          <a class="commerce-button" href="/checkout/">Go to checkout</a>
          <button class="commerce-button secondary" type="button" data-empty-cart>Empty cart</button>
        </aside>
        <div class="cart-cleared" data-cart-empty hidden>
          <h2>Your cart is empty.</h2>

          <a class="commerce-button" href="/#products">Continue shopping</a>
        </div>
      </div>
    </section>`
}

function billingField(label, name, attributes, className = '') {
  return '<label class="form-field ' + className + '"><span>' + label + '</span><input name="' + name + '" ' + attributes + '></label>'
}

export function checkoutPage() {
  return `
    <section class="shell commerce-page checkout-page" data-checkout-page>
      <div class="commerce-heading compact-heading">
        <div><h1>Checkout</h1></div>
        <a class="quiet-link" href="/cart/">Back to your cart</a>
      </div>
      <div class="checkout-layout" data-checkout-layout>
        <div class="checkout-bagging">
          <div class="bagging-topline"><span class="status-light"></span><span data-bagging-status role="status">Packing your selection</span></div>
          <div class="checkout-packing-scene" data-packing-scene>
            <div class="packing-lineup" data-packing-lineup aria-hidden="true"></div>
            ${renderTrolley('checkout', 'checkout-trolley', 'data-checkout-trolley aria-hidden="true"')}
            <div class="scanner-pad" data-scanner-pad aria-hidden="true"><img data-scanner-image alt="" hidden><span class="scanner-beam"></span></div>
            <div class="scanner-readout"><span data-scanned-name>Ready to scan</span><strong data-scanned-amount>₹0</strong></div>
          </div>
          <div class="bagging-receipt">
            <p class="commerce-kicker">SCANNED ITEMS</p>
            <ul data-checkout-items aria-label="Order items"></ul>
            <div class="basket-subtotal"><span>Subtotal</span><strong data-checkout-subtotal></strong></div>
            <div class="receipt-delivery"><span>Delivery</span><strong data-checkout-shipping></strong></div>
            <div class="basket-subtotal"><span>Total</span><strong data-checkout-total></strong></div>
            <div class="receipt-barcode" aria-hidden="true"></div>
            <small data-commerce-mode>Preview prices</small>
          </div>
        </div>
        <div class="terminal">
          <div class="terminal-bezel"><span>PanPops</span><span class="terminal-led"></span></div>
          <div class="terminal-screen">
            <div data-checkout-details>
              <div class="screen-step"><span>01 / DETAILS</span><span>02 / REVIEW</span></div>
              <h2>Billing & delivery</h2>
              <p class="form-intro">Enter sample details to try this checkout. This preview collects no payment.</p>
              <p class="guest-note">Have a preview account? <a href="/login/?next=checkout">Log in</a></p>
              <form data-checkout-form method="post">
                <div class="billing-grid">
                  ${billingField('Full name', 'fullName', 'required maxlength="100" autocomplete="name"', 'full-width')}
                  ${billingField('Email address', 'email', 'type="email" required maxlength="150" autocomplete="email"')}
                  ${billingField('Mobile number', 'phone', 'type="tel" inputmode="numeric" pattern="[0-9]{10}" minlength="10" maxlength="10" required autocomplete="tel-national" title="Enter a 10-digit mobile number"')}
                  ${billingField('Street address', 'address', 'required maxlength="180" autocomplete="address-line1"', 'full-width')}
                  ${billingField('Apartment, building, etc. (optional)', 'address2', 'maxlength="100" autocomplete="address-line2"', 'full-width')}
                  ${billingField('City', 'city', 'required maxlength="80" autocomplete="address-level2"')}
                  ${billingField('State', 'state', 'required maxlength="80" autocomplete="address-level1"')}
                  ${billingField('PIN code', 'pincode', 'inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" required autocomplete="postal-code" title="Enter a 6-digit PIN code"')}
                  <label class="form-field"><span>Country</span><select name="country" autocomplete="country-name"><option>India</option></select></label>
                </div>
                ${ageControl()}
                <p class="form-message" data-checkout-message role="status"></p>
                <button class="commerce-button" type="submit">Review order</button>
              </form>
            </div>
            <div data-checkout-review hidden>
              <div class="screen-step"><span>01 / DETAILS</span><span class="current">02 / REVIEW</span></div>
              <h2>Review your order</h2>
              <p class="form-intro">Check your address and selection.</p>
              <section class="review-address" aria-label="Billing and delivery address"><h3>Billing & delivery</h3><p data-review-address></p></section>
              <ul class="review-items" data-review-items></ul>
              <div class="basket-subtotal"><span>Total</span><strong data-review-subtotal></strong></div>
              <p class="form-intro" data-payment-note>This preview collects no payment.</p>
              <p class="form-message" data-review-message role="status"></p>
              <button class="commerce-button" type="button" data-place-demo-order>Complete preview</button>
              <button class="commerce-button secondary" type="button" data-edit-details>Edit details</button>
            </div>
            <div class="demo-complete" data-checkout-complete hidden role="status">
              <span class="completion-mark">${icon('check')}</span>
              <p class="commerce-kicker">PREVIEW COMPLETE</p>
              <h2>Order complete</h2>
              <p>You’ve completed the demo checkout. No payment was collected and no delivery will be made.</p>
              <a class="commerce-button" href="/#products">Continue shopping</a>
            </div>
          </div>
          <div class="terminal-foot"><span>CHECKOUT TERMINAL</span><span>●</span></div>
          <div class="terminal-stand" aria-hidden="true"></div>
        </div>
      </div>
      <div class="checkout-empty" data-checkout-empty hidden>
        <h2>Your cart is empty.</h2><p>Add a flavour before checking out.</p>
        <a class="commerce-button" href="/#products">Continue shopping</a>
      </div>
    </section>`
}

export function accountPage(mode) {
  const register = mode === 'register'
  return `
    <section class="shell commerce-page account-page">
      <div class="account-card">

        <h1>${register ? 'Register' : 'Login'}</h1>
        <p class="form-intro">Use a sample email and password to try this preview.</p>
        <form method="post" data-account-form="${mode}">
          ${register ? billingField('Full name', 'fullName', 'required maxlength="100" autocomplete="off"') : ''}
          ${billingField('Email address', 'email', 'type="email" required maxlength="150" autocomplete="off"')}
          <label class="form-field"><span>Password</span>
            <span class="password-field"><input name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password" placeholder="At least 8 characters"><button type="button" class="password-toggle" data-toggle-password aria-label="Show password">${icon('eye')}</button></span>
          </label>
          ${ageControl()}
          <p class="form-message" data-account-message role="status"></p>
          <button class="commerce-button" type="submit">${register ? 'Create preview account' : 'Login to preview'}</button>
        </form>
        <p class="account-switch">${register ? 'Already have an account?' : 'New to PanPops?'} <a href="${register ? '/login/' : '/register/'}" data-account-switch>${register ? 'Login' : 'Create an account'}</a></p>
      </div>
    </section>`
}

export function adminPage() {
  return `
    <section class="shell commerce-page admin-page" data-admin-page>
      <h1>Prices & orders</h1>
      <p class="form-intro" data-admin-mode>Use the administrator token configured on your Rust server.</p>
      <form class="admin-connect" data-admin-connect method="post">
        <label class="form-field"><span>Administrator token</span><input name="token" type="password" required minlength="32" autocomplete="off"></label>
        <button class="commerce-button" type="submit">Unlock</button>
      </form>
      <p class="form-message" data-admin-message role="status"></p>
      <div data-admin-content hidden>
        <div class="admin-toolbar"><button class="quiet-control" type="button" data-admin-reload>Reload</button><button class="quiet-control" type="button" data-admin-lock>Lock</button></div>
        <div class="admin-table-wrap">
          <table class="admin-table"><caption>Products</caption><thead><tr><th>Flavour</th><th>Price (₹)</th><th>Available</th><th></th></tr></thead><tbody data-admin-products></tbody></table>
        </div>
        <form class="admin-settings" data-admin-settings method="post">
          <h2>Delivery</h2>
          <label class="form-field"><span>Delivery charge (₹)</span><input name="shipping" type="number" step=".01" min="0" max="10000" required></label>
          <label class="form-field"><span>Free delivery from (₹, 0 disables)</span><input name="threshold" type="number" step=".01" min="0" max="1000000" required></label>
          <button class="commerce-button" type="submit">Save delivery</button>
        </form>
        <div class="admin-table-wrap"><table class="admin-table"><caption>Recent orders</caption><thead><tr><th>Order</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead><tbody data-admin-orders></tbody></table></div>
      </div>
    </section>`
}
