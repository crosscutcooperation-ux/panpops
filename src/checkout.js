import { prepareTextFields, validateTextFields } from './forms.js'
import { front, productById, money } from './catalog.js'
import { getCart, clearCart, lineSubtotal, boxDescription } from './cart.js'
import { getPreviewAccount } from './account.js'
import { fillTrolley, enterTrolley, flyPouch } from './trolley-motion.js'

const nameOf = line => line.type === 'box' ? 'Custom box' : productById[line.ids[0]].name
const fingerprint = lines => JSON.stringify(lines.map(({ key, quantity }) => [key, quantity]).sort())
const subtotal = lines => lines.reduce((total, line) => total + lineSubtotal(line), 0)

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
  const status = root.querySelector('[data-bagging-status]')
  const place = root.querySelector('[data-place-demo-order]')
  const reviewMessage = root.querySelector('[data-review-message]')
  let reviewedCart = null
  let finished = false
  let packingEpoch = 0

  const account = getPreviewAccount()
  if (account) {
    if (account.name !== 'PanPops guest') form.elements.fullName.value = account.name
    form.elements.email.value = account.email
    form.elements.over14.checked = true
  }

  function renderSummary(lines) {
    const items = root.querySelector('[data-checkout-items]')
    items.innerHTML = lines.map(line => '<li><span>' + line.quantity + ' × ' + nameOf(line) + '</span><strong>' + money(lineSubtotal(line)) + '</strong></li>').join('')
    root.querySelector('[data-checkout-subtotal]').textContent = money(subtotal(lines))
    layout.hidden = !lines.length
    empty.hidden = !!lines.length
  }

  async function packSelection() {
    const epoch = ++packingEpoch
    const lines = getCart()
    renderSummary(lines)
    if (!lines.length) return
    lineup.innerHTML = lines.map(line => '<div class="packing-item"><img src="' + front(productById[line.ids[0]]) + '" alt=""></div>').join('')
    lineup.hidden = false
    scene.dataset.phase = 'entering'
    fillTrolley(trolley, [])
    await enterTrolley(trolley)
    if (epoch !== packingEpoch) return
    scene.dataset.phase = 'packing'
    const packed = new Set()
    await Promise.all([...lineup.children].map(async (item, index) => {
      const line = lines[index]
      await flyPouch(productById[line.ids[0]], item.getBoundingClientRect(), trolley.querySelector('[data-arrival-target]').getBoundingClientRect(), index * 120)
      if (epoch !== packingEpoch) return
      item.style.visibility = 'hidden'
      packed.add(line.key)
      fillTrolley(trolley, lines.filter(candidate => packed.has(candidate.key)))
    }))
    if (epoch !== packingEpoch) return
    fillTrolley(trolley, lines)
    scene.dataset.phase = 'packed'
    lineup.hidden = true
    status.textContent = 'All packed. Ready for checkout.'
  }

  form.addEventListener('invalid', event => {
    root.querySelector('[data-checkout-message]').textContent = event.target.name === 'over14'
      ? 'Please confirm you are over 14 to place an order yourself.'
      : 'Please check the highlighted field.'
  }, true)

  form.addEventListener('submit', event => {
    event.preventDefault()
    if (!validateTextFields(form)) return
    const lines = getCart()
    if (!lines.length) { renderSummary(lines); return }
    const values = new FormData(form)
    const text = name => String(values.get(name) || '').trim()
    root.querySelector('[data-review-address]').textContent = [
      text('fullName'), text('email') + ' · ' + text('phone'), text('address'),
      text('address2'), text('city') + ', ' + text('state') + ' ' + text('pincode'), text('country'),
    ].filter(Boolean).join('\n')

    root.querySelector('[data-review-items]').innerHTML = lines.map(line =>
      '<li><span>' + line.quantity + ' × ' + nameOf(line) +
      (line.type === 'box' ? '<small>' + boxDescription(line.ids) + '</small>' : '') +
      '</span><strong>' + money(lineSubtotal(line)) + '</strong></li>'
    ).join('')
    root.querySelector('[data-review-subtotal]').textContent = money(subtotal(lines))
    reviewedCart = fingerprint(lines)
    reviewMessage.textContent = ''
    place.disabled = false
    details.hidden = true
    review.hidden = false
    review.querySelector('h2').tabIndex = -1
    review.querySelector('h2').focus({ preventScroll: true })
  })

  root.querySelector('[data-edit-details]').addEventListener('click', () => {
    review.hidden = true
    details.hidden = false
    form.elements.fullName.focus({ preventScroll: true })
  })

  place.addEventListener('click', () => {
    if (!reviewedCart || fingerprint(getCart()) !== reviewedCart) {
      reviewMessage.textContent = 'Your cart changed. Go back to details and review your selection again.'
      place.disabled = true
      return
    }
    if (!getCart().length) { renderSummary([]); return }
    finished = true
    place.disabled = true
    clearCart()
    details.hidden = true
    review.hidden = true
    complete.hidden = false
    status.textContent = 'Demo checkout complete.'
    complete.querySelector('h2').tabIndex = -1
    complete.querySelector('h2').focus({ preventScroll: true })
  })

  window.addEventListener('panpops-cart', () => {
    if (finished) return
    packingEpoch += 1
    const lines = getCart()
    renderSummary(lines)
    lineup.hidden = true
    fillTrolley(trolley, lines)
    scene.dataset.phase = 'packed'
    status.textContent = lines.length ? 'Your selection is up to date.' : 'Your cart is empty.'
    if (!review.hidden) {
      reviewedCart = null
      place.disabled = true
      reviewMessage.textContent = 'Your cart changed. Go back to details and review your selection again.'
    }
  })

  packSelection().catch(() => {
    fillTrolley(trolley, getCart())
    lineup.hidden = true
    status.textContent = 'Your selection is ready.'
  })
}
