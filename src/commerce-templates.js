import { icon } from './icons.js'
import { renderTrolley } from './trolley.js'

const step = (number, label) => '<p class="commerce-kicker"><span>' + number + '</span>' + label + '</p>'
const ageControl = () => `
  <label class="age-control">
    <input type="checkbox" name="over14" required>
    <span>I am over 14 and can place my own order.</span>
  </label>
  <p class="age-help">If you are 14 or younger, ask a parent or guardian to place the order.</p>`

export function cartPage() {
  return `
    <section class="shell commerce-page" data-cart-page>
      <div class="commerce-heading">
        <div>${step('01', 'YOUR SELECTION')}<h1>Your crunch,<br>unpacked.</h1></div>
        <p>Everything you picked, ready for a closer look.</p>
      </div>
      <div class="cart-experience" data-cart-experience data-phase="entering" aria-busy="true">
        <p class="experience-status" data-experience-status role="status">Bringing your cart around…</p>
        <ul class="cart-lineup" data-cart-lineup aria-label="Products in your cart"></ul>
        <div class="cart-dock">
          ${renderTrolley('overview', 'journey-trolley', 'data-journey-trolley aria-hidden="true"')}
          <span class="dock-mark" aria-hidden="true">PANPOPS / PACKING STATION</span>
        </div>
        <aside class="cart-commands" data-cart-commands hidden>
          <p class="commerce-kicker">READY WHEN YOU ARE</p>
          <div class="basket-subtotal"><span>Subtotal</span><strong data-cart-subtotal></strong></div>
          <p class="subtotal-note">Delivery and payment will be connected for launch.</p>
          <a class="commerce-button" href="/checkout/">Go to checkout ${icon('arrow')}</a>
          <button class="commerce-button secondary" type="button" data-empty-cart>Empty cart ${icon('close')}</button>
        </aside>
        <div class="cart-cleared" data-cart-empty hidden>
          <h2>Your cart is empty.</h2>
          <p>There’s always room for another flavour.</p>
          <a class="commerce-button" href="/#products">Continue shopping ${icon('arrow')}</a>
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
      <div class="commerce-heading">
        <div>${step('02', 'CHECKOUT')}<h1>One last stop.</h1></div>
        <a class="quiet-link" href="/cart/">Back to your cart</a>
      </div>
      <div class="checkout-layout" data-checkout-layout>
        <div class="checkout-bagging">
          <div class="bagging-topline"><span class="status-light"></span><span data-bagging-status role="status">Packing your selection</span></div>
          <div class="checkout-packing-scene" data-packing-scene>
            <div class="packing-lineup" data-packing-lineup aria-hidden="true"></div>
            ${renderTrolley('checkout', 'checkout-trolley', 'data-checkout-trolley aria-hidden="true"')}
            <span class="dock-mark" aria-hidden="true">PANPOPS / BAGGING AREA</span>
          </div>
          <div class="bagging-receipt">
            <p class="commerce-kicker">IN YOUR CART</p>
            <ul data-checkout-items aria-label="Order items"></ul>
            <div class="basket-subtotal"><span>Subtotal</span><strong data-checkout-subtotal></strong></div>
            <div class="receipt-barcode" aria-hidden="true"></div>
            <small>PanPops checkout preview</small>
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
                <button class="commerce-button" type="submit">Review demo order ${icon('arrow')}</button>
              </form>
            </div>
            <div data-checkout-review hidden>
              <div class="screen-step"><span>01 / DETAILS</span><span class="current">02 / REVIEW</span></div>
              <h2>Ready for your crunch?</h2>
              <p class="form-intro">Check the details below before completing this demo.</p>
              <section class="review-address" aria-label="Billing and delivery address"><h3>Billing & delivery</h3><p data-review-address></p></section>
              <ul class="review-items" data-review-items></ul>
              <div class="basket-subtotal"><span>Demo subtotal</span><strong data-review-subtotal></strong></div>
              <p class="form-intro">This preview places a demo order in your browser. No payment is collected or delivery arranged.</p>
              <p class="form-message" data-review-message role="status"></p>
              <button class="commerce-button" type="button" data-place-demo-order>Place demo order ${icon('check')}</button>
              <button class="commerce-button secondary" type="button" data-edit-details>Edit details</button>
            </div>
            <div class="demo-complete" data-checkout-complete hidden role="status">
              <span class="completion-mark">${icon('check')}</span>
              <p class="commerce-kicker">PREVIEW COMPLETE</p>
              <h2>Your crunch is packed.</h2>
              <p>You’ve completed the demo checkout. No payment was collected and no delivery will be made.</p>
              <a class="commerce-button" href="/#products">Continue shopping ${icon('arrow')}</a>
            </div>
          </div>
          <div class="terminal-foot"><span>CHECKOUT TERMINAL</span><span>●</span></div>
          <div class="terminal-stand" aria-hidden="true"></div>
        </div>
      </div>
      <div class="checkout-empty" data-checkout-empty hidden>
        <h2>Your cart is empty.</h2><p>Add a flavour before checking out.</p>
        <a class="commerce-button" href="/#products">Continue shopping ${icon('arrow')}</a>
      </div>
    </section>`
}

export function accountPage(mode) {
  const register = mode === 'register'
  return `
    <section class="shell commerce-page account-page">
      <div class="account-art" aria-hidden="true">
        <p class="commerce-kicker">A LITTLE CRUNCH GOES A LONG WAY</p>
        <h2>Good to<br>have you here.</h2>
        <div class="account-pouches">
          <img src="/media/chataka.webp" width="680" height="925" alt="">
          <img src="/media/cream.webp" width="680" height="925" alt="">
          <img src="/media/salt.webp" width="680" height="925" alt="">
        </div>
      </div>
      <div class="account-card">
        ${step(register ? 'HELLO' : 'WELCOME BACK', 'PANPOPS')}
        <h1>${register ? 'Create an account.' : 'Login.'}</h1>
        <p class="form-intro">Use a sample email and password to try this preview.</p>
        <form method="post" data-account-form="${mode}">
          ${register ? billingField('Full name', 'fullName', 'required maxlength="100" autocomplete="off"') : ''}
          ${billingField('Email address', 'email', 'type="email" required maxlength="150" autocomplete="off"')}
          <label class="form-field"><span>Password</span>
            <span class="password-field"><input name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password" placeholder="At least 8 characters"><button type="button" class="password-toggle" data-toggle-password aria-label="Show password">${icon('eye')}</button></span>
          </label>
          ${ageControl()}
          <p class="form-message" data-account-message role="status"></p>
          <button class="commerce-button" type="submit">${register ? 'Create preview account' : 'Login to preview'} ${icon('arrow')}</button>
        </form>
        <p class="account-switch">${register ? 'Already have an account?' : 'New to PanPops?'} <a href="${register ? '/login/' : '/register/'}" data-account-switch>${register ? 'Login' : 'Create an account'}</a></p>
      </div>
    </section>`
}
