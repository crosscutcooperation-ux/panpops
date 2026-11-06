import { products, productById, productUrl, front, money, MIN_BOX, MAX_BOX } from './catalog.js'
import { icon, productStyle } from './templates.js'
import { getCart, addLine, changeQuantity, removeLine, boxDescription, packSubtotal, lineSubtotal, MAX_QUANTITY } from './cart.js'

const motion = matchMedia('(prefers-reduced-motion: reduce)')
const toast = document.querySelector('.toast')
let toastTimer

function notify(message) {
  toast.textContent = message
  toast.classList.add('visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3300)
}

function addToCart(type, ids, quantity = 1) {
  const result = addLine(type, ids, quantity)
  const name = type === 'box' ? 'Custom box' : productById[ids[0]].name
  if (result.added === 0) notify('Your cart has reached the limit for this item.')
  else if (!result.persisted) notify(name + ' added for this page. Browser storage is unavailable.')
  else if (result.added < quantity) notify('Added ' + result.added + '. Your cart has reached the limit for this item.')
  else notify(name + (result.added > 1 ? ' × ' + result.added : '') + ' added to cart.')
  return result.added > 0
}

function updateCartBadge() {
  const quantity = getCart().reduce((total, line) => total + line.quantity, 0)
  const badge = document.querySelector('[data-cart-count]')
  badge.textContent = quantity
  badge.closest('a').setAttribute('aria-label', 'Cart, ' + quantity + (quantity === 1 ? ' item' : ' items'))
}

function mountScene(stage, create) {
  const host = stage.querySelector('[data-scene]')
  let scene
  let pending = false
  let visible = false

  function remove() {
    delete stage.dataset.ready
    scene?.dispose()
    scene = undefined
    host.replaceChildren()
  }

  async function load() {
    if (!visible || motion.matches || pending || scene) return
    pending = true
    try {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('webgl2', { alpha: true, antialias: true })
      if (!context) return
      const scenes = await import('./scenes.js')
      if (motion.matches) {
        context.getExtension('WEBGL_lose_context')?.loseContext()
        return
      }
      canvas.addEventListener('webglcontextlost', remove, { once: true })
      scene = await create(scenes, host, canvas, context)
      if (motion.matches || context.isContextLost()) remove()
      else stage.dataset.ready = ''
    } catch {
      remove()
    } finally {
      pending = false
    }
  }

  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return
    observer.disconnect()
    visible = true
    requestAnimationFrame(() => requestAnimationFrame(load))
  }, { rootMargin: '120px' })
  observer.observe(stage)
  motion.addEventListener('change', () => motion.matches ? remove() : load())
  return () => scene
}

function bindDrag(element, { start, move, end }) {
  let drag
  element.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('button, a')) return
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
    element.setPointerCapture(event.pointerId)
    start?.()
  })
  element.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return
    move?.(event.clientX - drag.x, event.clientY - drag.y)
  })
  element.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    drag = undefined
    end?.(dx, dy)
  })
  element.addEventListener('pointercancel', () => { drag = undefined })
}

function initCarousel(root) {
  const stage = root.querySelector('[data-stage]')
  const stills = Array.from(root.querySelectorAll('.carousel-pack'))
  const tabs = Array.from(root.querySelectorAll('[data-pick]'))
  const index = root.querySelector('[data-current-index]')
  const counter = root.querySelector('[data-stage-counter]')
  const name = root.querySelector('[data-active-name]')
  const note = root.querySelector('[data-active-note]')
  const link = root.querySelector('[data-active-link]')
  let active = 0
  const getScene = mountScene(stage, async (scenes, ...args) => {
    const scene = await scenes.createTurntable(...args)
    scene.select(active, 1, true)
    return scene
  })

  function select(next, direction) {
    const target = (next + products.length) % products.length
    if (target === active) return
    const delta = (target - active + products.length) % products.length
    active = target
    const product = products[active]
    root.style.cssText = productStyle(product)
    index.textContent = '0' + (active + 1)
    counter.textContent = index.textContent + ' / 04'
    name.textContent = product.name
    note.textContent = product.note
    link.href = productUrl(product)
    tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === active)))
    stills.forEach((image, i) => {
      image.className = 'carousel-pack ' + ['center','next','parked','prev'][(i - active + products.length) % products.length]
    })
    getScene()?.select(active, direction ?? (delta === 3 ? -1 : 1))
  }

  root.querySelectorAll('[data-step]').forEach(button => {
    button.addEventListener('click', () => select(active + Number(button.dataset.step), Number(button.dataset.step)))
  })
  tabs.forEach(tab => tab.addEventListener('click', () => select(Number(tab.dataset.pick))))
  root.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    select(active + direction, direction)
    if (event.target.closest('[data-pick]')) tabs[active].focus()
  })
  bindDrag(stage, { end(dx, dy) {
    if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy)) {
      const direction = dx < 0 ? 1 : -1
      select(active + direction, direction)
    }
  } })
}

function initProduct(root) {
  const product = productById[root.dataset.product]
  const stage = root.querySelector('[data-stage]')
  const count = root.querySelector('[data-product-quantity]')
  const decrease = root.querySelector('[data-quantity="-1"]')
  const increase = root.querySelector('[data-quantity="1"]')
  const add = root.querySelector('[data-add]')
  const flip = root.querySelector('[data-flip]')
  const labelPanel = root.querySelector('[data-label-panel]')
  let reversed = false
  let quantity = 1

  const getScene = mountScene(stage, async (scenes, ...args) => {
    const scene = await scenes.createProduct(...args, product)
    scene.flip(reversed, true)
    return scene
  })

  function change(delta) {
    quantity = Math.max(1, Math.min(MAX_QUANTITY, quantity + delta))
    count.value = quantity
    decrease.disabled = quantity === 1
    increase.disabled = quantity === MAX_QUANTITY
  }

  decrease.addEventListener('click', () => change(-1))
  increase.addEventListener('click', () => change(1))
  add.addEventListener('click', () => addToCart('pack', [product.id], quantity))
  flip.addEventListener('click', () => {
    reversed = !reversed
    flip.setAttribute('aria-expanded', String(reversed))
    flip.innerHTML = icon('spin') + (reversed ? ' View front of pack' : ' View back of pack')
    labelPanel.hidden = !reversed
    stage.querySelector('.product-front').hidden = reversed
    stage.querySelector('.product-back').hidden = !reversed
    getScene()?.flip(reversed)
  })
  bindDrag(stage, { start() { getScene()?.startDrag() }, move(dx, dy) { getScene()?.drag(dx, dy) } })
  stage.querySelector('[data-drag-hint]').hidden = false

  root.querySelector('[data-pop]')?.addEventListener('click', () => {
    const scene = getScene()
    if (scene) scene.pop()
    else if (!motion.matches) {
      const effect = stage.querySelector('.pop-still')
      effect.classList.remove('is-popping')
      requestAnimationFrame(() => requestAnimationFrame(() => effect.classList.add('is-popping')))
    } else notify('A tangy burst of roasted makhana.')
  })
}

function initBox(root) {
  const stage = root.querySelector('[data-stage]')
  const slots = Array.from(root.querySelectorAll('.tray-slot img'))
  const add = root.querySelector('[data-add-box]')
  const actions = Array.from(root.querySelectorAll('[data-box-id]'))
  const quantities = Array.from(root.querySelectorAll('[data-box-quantity]'))
  const total = root.querySelector('[data-box-total]')
  const count = root.querySelector('[data-box-count]')
  const status = root.querySelector('[data-box-status]')
  let selected = []
  const getScene = mountScene(stage, async (scenes, ...args) => {
    const scene = await scenes.createTray(...args)
    scene.setContents(selected, true)
    return scene
  })

  function render() {
    const number = selected.length
    slots.forEach((slot, index) => {
      const id = selected[index]
      slot.hidden = !id
      if (id) slot.src = front(productById[id])
    })
    for (const quantity of quantities) quantity.value = selected.filter(id => id === quantity.dataset.boxQuantity).length
    for (const action of actions) {
      action.disabled = action.dataset.delta === '1' ? number >= MAX_BOX : !selected.includes(action.dataset.boxId)
    }
    add.disabled = number < MIN_BOX
    total.textContent = money(packSubtotal(selected))
    count.textContent = number + ' / ' + MAX_BOX + ' POUCHES'
    status.textContent = number >= MAX_BOX ? 'Your box is full.' :
      number >= MIN_BOX ? 'Your box is ready to add.' :
      number === 1 ? 'Choose 1 more pouch.' : 'Choose at least ' + MIN_BOX + ' pouches.'
    getScene()?.setContents(selected)
  }

  for (const action of actions) action.addEventListener('click', () => {
    const { boxId, delta } = action.dataset
    if (delta === '1' && selected.length < MAX_BOX) selected = [...selected, boxId]
    else if (delta === '-1') {
      const index = selected.lastIndexOf(boxId)
      if (index >= 0) selected = selected.filter((_, position) => position !== index)
    }
    render()
  })

  add.addEventListener('click', () => {
    if (selected.length < MIN_BOX || !addToCart('box', selected)) return
    selected = []
    render()
  })
}

function initCart(view) {
  const empty = view.innerHTML
  const dialog = document.querySelector('[data-review-dialog]')
  const review = dialog.querySelector('[data-review-summary]')
  dialog.setAttribute('aria-labelledby', 'review-title')
  const nameOf = line => line.type === 'box' ? 'Custom box' : productById[line.ids[0]].name
  const totalOf = lines => money(lines.reduce((total, line) => total + lineSubtotal(line), 0))

  function render() {
    const lines = getCart()
    const focused = document.activeElement?.closest('[data-cart-action]')
    if (!lines.length) {
      view.innerHTML = empty
      if (focused) view.querySelector('a').focus()
      return
    }

    view.innerHTML = `<div class="cart-layout">
      <ul class="cart-list" aria-label="Cart items">${lines.map(line => `
        <li class="cart-row">
          <div class="cart-row-image">${line.type === 'box' ? icon('cube') : '<img src="' + front(productById[line.ids[0]]) + '" alt="">'}</div>
          <div><h2>${nameOf(line)}</h2><p>${line.type === 'box' ? boxDescription(line.ids) : productById[line.ids[0]].weight + ' g pouch'}</p>
            <button class="remove-button" type="button" data-key="${line.key}" data-cart-action="remove" aria-label="Remove ${nameOf(line)}">Remove</button></div>
          <div class="stepper" aria-label="${nameOf(line)} quantity">
            <button type="button" data-key="${line.key}" data-cart-action="decrease" aria-label="Decrease ${nameOf(line)} quantity">${icon('minus')}</button>
            <span>${line.quantity}</span>
            <button type="button" data-key="${line.key}" data-cart-action="increase" aria-label="Increase ${nameOf(line)} quantity"${line.quantity >= MAX_QUANTITY ? ' disabled' : ''}>${icon('plus')}</button>
          </div>
          <strong>${money(lineSubtotal(line))}</strong>
        </li>`).join('')}</ul>
      <section class="cart-summary" aria-label="Order summary">
        <h2>Order summary</h2><div class="summary-line"><span>Subtotal</span><strong>${totalOf(lines)}</strong></div>
        <p>Demo prices in INR.</p>
        <button type="button" class="button" data-cart-action="review">Review demo order ${icon('arrow')}</button>
      </section>
    </div>`

    if (focused) {
      const controls = Array.from(view.querySelectorAll('[data-cart-action]:not(:disabled)'))
      const replacement = controls.find(button => button.dataset.key === focused.dataset.key && button.dataset.cartAction === focused.dataset.cartAction)
      const nextFocus = replacement ?? controls[0]
      nextFocus?.focus()
    }
  }

  view.addEventListener('click', event => {
    const button = event.target.closest('[data-cart-action]')
    if (!button) return
    const { cartAction, key } = button.dataset
    if (cartAction === 'remove') removeLine(key)
    else if (cartAction === 'increase') changeQuantity(key, 1)
    else if (cartAction === 'decrease') changeQuantity(key, -1)
    else {
      const lines = getCart()
      review.innerHTML = '<ul>' + lines.map(line => '<li><span>' + line.quantity + ' × ' + nameOf(line) + '</span><strong>' + money(lineSubtotal(line)) + '</strong></li>').join('') +
        '</ul><div class="summary-line"><span>Demo subtotal</span><strong>' + totalOf(lines) + '</strong></div>'
      dialog.showModal()
    }
  })
  window.addEventListener('panpops-cart', render)
  render()
}

const carousel = document.querySelector('[data-carousel]')
if (carousel) initCarousel(carousel)
const product = document.querySelector('[data-product]')
if (product) initProduct(product)
const box = document.querySelector('[data-box]')
if (box) initBox(box)
const cartView = document.querySelector('[data-cart-view]')
if (cartView) initCart(cartView)

document.querySelectorAll('.pack-card [data-add]').forEach(button => {
  button.addEventListener('click', () => addToCart('pack', [button.dataset.add]))
})
window.addEventListener('panpops-cart', updateCartBadge)
window.addEventListener('pageshow', updateCartBadge)
updateCartBadge()
