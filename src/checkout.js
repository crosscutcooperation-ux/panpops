import { parcelImage, boxButton } from './parcel-art.js'
import { prepareTextFields, validateTextFields } from './forms.js'
import { productById, money, boxName } from './catalog.js'
import { getCart, clearCart, lineSubtotal } from './cart.js'
import { getPreviewAccount } from './account.js'
import { fillTrolley, enterTrolley, flyPouch, flyBox, animateElement } from './trolley-motion.js'
import { backendEnabled, request, jsonRequest, orderItems, quoteCart } from './api.js'

const nameOf = line => line.type === 'box' ? boxName(line.ids) : productById[line.ids[0]].name
const fingerprint = lines => JSON.stringify(lines.map(({ key, quantity }) => [key, quantity]).sort())
const subtotal = lines => lines.reduce((total, line) => total + lineSubtotal(line), 0)
const rupees = paise => money(paise / 100)
let razorpayScript

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve()
  if (!razorpayScript) razorpayScript = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = resolve
    script.onerror = () => { razorpayScript = null; script.remove(); reject(new Error('The payment window could not load. Please try again.')) }
    document.head.append(script)
  })
  return razorpayScript
}

export function initCheckoutPage(root) {
  const layout = root.querySelector('[data-checkout-layout]')
  const empty = root.querySelector('[data-checkout-empty]')
  const form = root.querySelector('[data-checkout-form]')
  prepareTextFields(form)
  const details = root.querySelector('[data-checkout-details]')
  const review = root.querySelector('[data-checkout-review]')
  const complete = root.querySelector('[data-checkout-complete]')
  const scene = root.querySelector('[data-packing-scene]')
  const lineup = root.querySelector('[data-packing-lineup]')
  const trolley = root.querySelector('[data-checkout-trolley]')
  const scanner = root.querySelector('[data-scanner-pad]')
  const scannerImage = root.querySelector('[data-scanner-image]')
  const status = root.querySelector('[data-bagging-status]')
  const place = root.querySelector('[data-place-demo-order]')
  const reviewMessage = root.querySelector('[data-review-message]')
  const detailsMessage = root.querySelector('[data-checkout-message]')
  const submit = form.querySelector('[type="submit"]')
  let reviewedCart = null
  let reviewedQuote = null
  let reviewedLines = []
  let finished = false
  let packingEpoch = 0
  let paymentAttempt = null
  let gatewayReady = !backendEnabled

  const account = getPreviewAccount()
  if (account) {
    if (account.name !== 'PanPops guest') form.elements.fullName.value = account.name
    form.elements.email.value = account.email
    form.elements.over14.checked = true
  }

  if (backendEnabled) {
    root.querySelector('[data-commerce-mode]').textContent = 'Prices supplied by PanPops'
    details.querySelector('.form-intro').textContent = 'Enter your billing and delivery details.'
    root.querySelector('[data-payment-note]').textContent = 'Payment opens securely through Razorpay.'
    place.textContent = 'Pay with Razorpay'
    request('config').then(config => {
      gatewayReady = config.payments_ready
      if (!gatewayReady) {
        place.disabled = true
        reviewMessage.textContent = 'Payment setup is required on the server.'
      }
    }).catch(error => {
      gatewayReady = false
      place.disabled = true
      detailsMessage.textContent = error.message
    })
  }

  function setEmptyState(lines) {
    layout.hidden = !lines.length
    empty.hidden = !!lines.length
  }

  async function currentQuote(lines) {
    const quote = await quoteCart(lines)
    for (const item of quote.items || []) {
      if (productById[item.id]) productById[item.id].price = item.unit_price_paise / 100
    }
    return quote
  }

  function renderReceipt(lines, quote, scanned) {
    const visibleLines = scanned ? lines.filter(line => scanned.has(line.key)) : lines
    root.querySelector('[data-checkout-items]').innerHTML = visibleLines.map(line => '<li><span>' + (line.type === 'box' ? boxButton(line) : '') + line.quantity + ' × ' + nameOf(line) + '</span><strong>' + (quote ? money(lineSubtotal(line)) : '—') + '</strong></li>').join('')
    const done = !scanned || scanned.size === lines.length
    const scannedAmount = quote ? Math.round(subtotal(visibleLines) * 100) : null
    root.querySelector('[data-checkout-subtotal]').textContent = quote ? rupees(scannedAmount) : '—'
    root.querySelector('[data-checkout-shipping]').textContent = quote && done ? rupees(quote.shipping_paise) : '—'
    root.querySelector('[data-checkout-total]').textContent = quote ? rupees(done ? quote.total_paise : scannedAmount) : '—'
  }

  async function packSelection() {
    const epoch = ++packingEpoch
    const lines = getCart()
    setEmptyState(lines)
    if (!lines.length) return
    const scanned = new Set()
    let quote = null
    let quoteError
    let scanComplete = false
    const quotePromise = currentQuote(lines).then(result => {
      if (epoch !== packingEpoch) return result
      quote = result
      renderReceipt(lines, quote, scanned)
      if (scanComplete) status.textContent = 'All items scanned.'
      return result
    }).catch(error => {
      if (epoch !== packingEpoch) return null
      quoteError = error
      detailsMessage.textContent = error.message
      if (scanComplete) status.textContent = 'All items scanned. Live prices are unavailable.'
      return null
    })
    renderReceipt(lines, quote, scanned)
    lineup.innerHTML = lines.map(line => '<div class="packing-item"><img src="' + parcelImage(line) + '" alt=""></div>').join('')
    lineup.hidden = false
    scene.dataset.phase = 'entering'
    fillTrolley(trolley, [])
    await enterTrolley(trolley)
    if (epoch !== packingEpoch) return
    scene.dataset.phase = 'scanning'

    for (const [index, item] of [...lineup.children].entries()) {
      const line = lines[index]
      const product = productById[line.ids[0]]
      if (line.type === 'box') await flyBox(item.getBoundingClientRect(), scanner.getBoundingClientRect())
      else await flyPouch(product, item.getBoundingClientRect(), scanner.getBoundingClientRect(), 0, 'back')
      if (epoch !== packingEpoch) return
      item.style.visibility = 'hidden'
      scannerImage.src = parcelImage(line, 'back')
      scannerImage.classList.toggle('scanning-box', line.type === 'box')
      scannerImage.hidden = false
      scanner.dataset.scanning = ''
      root.querySelector('[data-scanned-name]').textContent = line.quantity + ' × ' + nameOf(line)
      await animateElement(scanner.querySelector('.scanner-beam'), [
        { top: '8%', opacity: 1 }, { top: '90%', opacity: 1 },
      ], { duration: 480, easing: 'ease-in-out' })
      if (epoch !== packingEpoch) return
      scanned.add(line.key)
      renderReceipt(lines, quote, scanned)
      root.querySelector('[data-scanned-amount]').textContent = quote
        ? money(subtotal(lines.filter(candidate => scanned.has(candidate.key))))
        : '—'
      delete scanner.dataset.scanning
      const start = scannerImage.getBoundingClientRect()
      scannerImage.hidden = true
      if (line.type === 'box') await flyBox(start, trolley.querySelector('[data-arrival-target]').getBoundingClientRect())
      else await flyPouch(product, start, trolley.querySelector('[data-arrival-target]').getBoundingClientRect(), 0, 'back')
      if (epoch !== packingEpoch) return
      fillTrolley(trolley, lines.filter(candidate => scanned.has(candidate.key)))
      status.textContent = 'Scanned ' + (index + 1) + ' of ' + lines.length
    }

    scanComplete = true
    fillTrolley(trolley, lines)
    scene.dataset.phase = 'packed'
    lineup.hidden = true
    status.textContent = quote
      ? 'All items scanned.'
      : quoteError
        ? 'All items scanned. Live prices are unavailable.'
        : 'All items scanned. Checking live prices…'
  }

  function finish(orderId) {
    finished = true
    packingEpoch += 1
    lineup.hidden = true
    scannerImage.hidden = true
    delete scanner.dataset.scanning
    scene.dataset.phase = 'packed'
    fillTrolley(trolley, reviewedLines)
    place.disabled = true
    const purchased = paymentAttempt?.fingerprint || reviewedCart
    if (fingerprint(getCart()) === purchased) clearCart()
    details.hidden = true
    review.hidden = true
    complete.hidden = false
    if (backendEnabled) {
      complete.querySelector('h2').textContent = 'Payment confirmed'
      complete.querySelector('p:not(.commerce-kicker)').textContent = 'Your payment is recorded. Order reference ' + orderId + '.'
      complete.querySelector('.commerce-kicker').textContent = 'PANPOPS ORDER'
      status.textContent = 'Payment confirmed.'
    } else status.textContent = 'Preview complete.'
    complete.querySelector('h2').tabIndex = -1
    complete.querySelector('h2').focus({ preventScroll: true })
  }

  async function checkPaymentStatus() {
    const order = paymentAttempt.order
    const data = await request('orders/' + encodeURIComponent(order.id), { headers: { Authorization: 'Bearer ' + order.order_token } })
    if (data.status === 'paid') { finish(order.id); return true }
    reviewMessage.textContent = 'Payment confirmation is pending. Check its status before paying again.'
    place.textContent = 'Check payment status'
    place.disabled = false
    return false
  }

  async function startPayment() {
    if (paymentAttempt?.awaitingConfirmation) {
      await checkPaymentStatus()
      return
    }
    if (!gatewayReady) throw new Error('Payment setup is required on the server.')
    await loadRazorpay()
    const customer = Object.fromEntries(new FormData(form))
    const payload = {
      items: orderItems(getCart()),
      packages: getCart().map(({ type, ids, quantity, capacity }) => ({ kind: type, ids, quantity, capacity: type === 'box' ? capacity || 4 : null })),
      over14: form.elements.over14.checked,
      expected_total_paise: reviewedQuote.total_paise,
      customer: {
        full_name: customer.fullName, email: customer.email, phone: customer.phone,
        address: customer.address, address2: customer.address2 || '', city: customer.city,
        state: customer.state, pincode: customer.pincode, country: customer.country,
      },
    }
    const identity = JSON.stringify(payload)
    if (!paymentAttempt || paymentAttempt.identity !== identity) paymentAttempt = {
      key: crypto.randomUUID(), identity, fingerprint: reviewedCart,
    }
    const order = await jsonRequest('orders', payload, { headers: { 'X-Idempotency-Key': paymentAttempt.key } })
    paymentAttempt.order = order
    if (order.status === 'paid') { finish(order.id); return }

    const checkout = new window.Razorpay({
      key: order.key_id, amount: order.amount_paise, currency: order.currency,
      order_id: order.razorpay_order_id, name: 'PanPops', description: 'Roasted makhana',
      prefill: { name: customer.fullName, email: customer.email, contact: customer.phone },
      theme: { color: '#923b2c' },
      modal: { ondismiss() {
        if (paymentAttempt.awaitingConfirmation || finished) return
        place.disabled = false
        reviewMessage.textContent = 'The payment window was closed. You can reopen it for this order.'
      } },
      handler: async response => {
        paymentAttempt.awaitingConfirmation = true
        try {
          const verified = await jsonRequest('payments/verify', {
            order_id: order.id, payment_id: response.razorpay_payment_id, signature: response.razorpay_signature,
          }, { headers: { Authorization: 'Bearer ' + order.order_token } })
          if (verified.status === 'paid') finish(order.id)
          else await checkPaymentStatus()
        } catch (error) {
          reviewMessage.textContent = error.message + ' Check payment status before paying again.'
          place.textContent = 'Check payment status'
          place.disabled = false
        }
      },
    })
    checkout.on('payment.failed', () => {
      place.disabled = false
      reviewMessage.textContent = 'Payment was not completed. You can retry this order.'
    })
    checkout.open()
  }

  form.addEventListener('invalid', event => {
    detailsMessage.textContent = event.target.name === 'over14'
      ? 'Please confirm you are over 14 to place an order yourself.'
      : 'Please check the highlighted field.'
  }, true)

  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (!validateTextFields(form)) return
    const lines = getCart()
    if (!lines.length) { setEmptyState(lines); return }
    submit.disabled = true
    detailsMessage.textContent = ''
    try {
      const quote = await currentQuote(lines)
      if (fingerprint(getCart()) !== fingerprint(lines)) throw new Error('Your cart changed. Please review again.')
      reviewedQuote = quote
      const values = new FormData(form)
      const text = name => String(values.get(name) || '').trim()
      root.querySelector('[data-review-address]').textContent = [
        text('fullName'), text('email') + ' · ' + text('phone'), text('address'),
        text('address2'), text('city') + ', ' + text('state') + ' ' + text('pincode'), text('country'),
      ].filter(Boolean).join('\n')
      root.querySelector('[data-review-items]').innerHTML = lines.map(line =>
        '<li><span>' + line.quantity + ' × ' + nameOf(line) +
        (line.type === 'box' ? boxButton(line) + '<small>' + line.ids.length + ' pouches · sealed box</small>' : '') +
        '</span><strong>' + money(lineSubtotal(line)) + '</strong></li>'
      ).join('') + '<li><span>Delivery</span><strong>' + rupees(quote.shipping_paise) + '</strong></li>'
      root.querySelector('[data-review-subtotal]').textContent = rupees(quote.total_paise)
      renderReceipt(lines, quote)
      reviewedCart = fingerprint(lines)
      reviewedLines = lines
      reviewMessage.textContent = backendEnabled && !gatewayReady ? 'Payment setup is required on the server.' : ''
      place.disabled = backendEnabled && !gatewayReady
      details.hidden = true
      review.hidden = false
      review.querySelector('h2').tabIndex = -1
      review.querySelector('h2').focus({ preventScroll: true })
    } catch (error) { detailsMessage.textContent = error.message }
    finally { submit.disabled = false }
  })

  root.querySelector('[data-edit-details]').addEventListener('click', () => {
    review.hidden = true
    details.hidden = false
    form.elements.fullName.focus({ preventScroll: true })
  })

  place.addEventListener('click', async () => {
    if (backendEnabled && paymentAttempt?.awaitingConfirmation) {
      place.disabled = true
      try { await checkPaymentStatus() }
      catch (error) { reviewMessage.textContent = error.message; place.disabled = false }
      return
    }
    if (!reviewedCart || fingerprint(getCart()) !== reviewedCart) {
      reviewMessage.textContent = 'Your cart changed. Go back to details and review your selection again.'
      place.disabled = true
      return
    }
    if (!getCart().length) { setEmptyState([]); return }
    if (!backendEnabled) { finish(); return }
    place.disabled = true
    reviewMessage.textContent = 'Opening payment…'
    try { await startPayment() }
    catch (error) {
      reviewMessage.textContent = error.message
      place.disabled = false
      if (error.status === 409) {
        reviewedCart = null
        place.disabled = true
      }
    }
  })

  window.addEventListener('panpops-cart', async () => {
    if (finished) return
    packingEpoch += 1
    const epoch = packingEpoch
    const lines = getCart()
    setEmptyState(lines)
    lineup.hidden = true
    scannerImage.hidden = true
    delete scanner.dataset.scanning
    fillTrolley(trolley, lines)
    scene.dataset.phase = 'packed'
    status.textContent = lines.length ? 'Your selection is up to date.' : 'Your cart is empty.'
    if (lines.length) {
      try {
        const quote = await currentQuote(lines)
        if (epoch === packingEpoch) renderReceipt(lines, quote)
      } catch (error) { detailsMessage.textContent = error.message }
    }
    if (!review.hidden) {
      reviewedCart = null
      place.disabled = true
      reviewMessage.textContent = 'Your cart changed. Go back to details and review your selection again.'
    }
  })

  packSelection().catch(error => {
    fillTrolley(trolley, getCart())
    lineup.hidden = true
    scannerImage.hidden = true
    status.textContent = 'Please check your selection.'
    detailsMessage.textContent = error.message
  })
}
