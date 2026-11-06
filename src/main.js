import { productById, front, money } from './catalog.js'
import { icon } from './templates.js'
import { playCartArrival } from './cart-arrival.js'
import { getCart, addLine, changeQuantity, removeLine, boxDescription, lineSubtotal, MAX_QUANTITY } from './cart.js'

const motion = matchMedia('(prefers-reduced-motion: reduce)')
const toast = document.querySelector('.toast')
let toastTimer

function notify(message) {
  toast.textContent = message
  toast.classList.add('visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3300)
}

function addToCart(product, origin) {
  const before = getCart()
  const result = addLine('pack', [product.id])
  if (!result.added) {
    notify('Your cart has reached the limit for this item.')
    return
  }
  notify(result.persisted ? product.name + ' added to cart.' : product.name + ' added for this page.')
  playCartArrival(product, origin.getBoundingClientRect(), before, getCart(), motion.matches)
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

function initCrossing(stage) {
  const bands = Array.from(stage.querySelectorAll('[data-crossing-add]'))
  const anchors = bands.map(band => band.querySelector('[data-crossing-art]'))
  const progress = bands.map(() => motion.matches ? 1 : 0)
  const started = new Map()
  let frame = 0
  const getScene = mountScene(stage, async (scenes, ...args) => {
    const scene = await scenes.createCrossing(...args, anchors)
    scene.pose(progress)
    return scene
  })

  function render() {
    bands.forEach((band, index) => band.style.setProperty('--rise', progress[index]))
    getScene()?.pose(progress)
  }

  function animate(now) {
    frame = 0
    for (const [index, start] of started) {
      const fraction = Math.max(0, Math.min(1, (now - start) / 980))
      progress[index] = 1 - (1 - fraction) ** 3
      if (fraction === 1) started.delete(index)
    }
    render()
    if (started.size) frame = requestAnimationFrame(animate)
  }

  const observer = new IntersectionObserver(entries => {
    const now = performance.now()
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < .18) continue
      observer.unobserve(entry.target)
      const index = anchors.indexOf(entry.target)
      started.set(index, now + index * 75)
    }
    if (started.size && !frame) frame = requestAnimationFrame(animate)
  }, { threshold: .18 })

  if (!motion.matches) anchors.forEach(anchor => observer.observe(anchor))
  motion.addEventListener('change', () => {
    if (!motion.matches) return
    observer.disconnect()
    started.clear()
    cancelAnimationFrame(frame)
    frame = 0
    progress.fill(1)
    render()
  })

  bands.forEach((band, index) => {
    const product = productById[band.dataset.crossingAdd]
    band.addEventListener('click', () => addToCart(product, anchors[index]))
  })
  render()
}

function initCart() {
  const trigger = document.querySelector('[data-open-cart]')
  const badge = trigger.querySelector('[data-cart-count]')
  const dialog = document.querySelector('[data-cart-dialog]')
  const view = dialog.querySelector('[data-cart-view]')
  trigger.addEventListener('click', () => dialog.showModal())

  function render() {
    const lines = getCart()
    const count = lines.reduce((total, line) => total + line.quantity, 0)
    badge.textContent = count
    trigger.setAttribute('aria-label', 'Cart, ' + count + (count === 1 ? ' item' : ' items'))

    const focused = document.activeElement?.closest('[data-cart-action]')
    if (!lines.length) {
      view.innerHTML = '<p class="cart-empty">Your cart is empty.</p>'
      if (focused) dialog.querySelector('[aria-label="Close cart"]').focus()
      return
    }

    const rows = lines.map(line => {
      const product = productById[line.ids[0]]
      const name = line.type === 'box' ? 'Custom box' : product.name
      return `
        <li class="cart-row">
          <div class="cart-row-art">${line.ids.map(id => '<img src="' + front(productById[id]) + '" alt="">').join('')}</div>
          <div class="cart-row-info">
            <h3>${name}</h3>
            ${line.type === 'box' ? '<p>' + boxDescription(line.ids) + '</p>' : ''}
            <div class="cart-quantity">
              <button type="button" data-cart-action="decrease" data-key="${line.key}" aria-label="Decrease ${name} quantity">${icon('minus')}</button>
              <span>${line.quantity}</span>
              <button type="button" data-cart-action="increase" data-key="${line.key}" aria-label="Increase ${name} quantity"${line.quantity >= MAX_QUANTITY ? ' disabled' : ''}>${icon('plus')}</button>
            </div>
          </div>
          <div class="cart-row-total">
            <strong>${money(lineSubtotal(line))}</strong>
            <button type="button" data-cart-action="remove" data-key="${line.key}" aria-label="Remove ${name}">Remove</button>
          </div>
        </li>`
    }).join('')
    const total = lines.reduce((sum, line) => sum + lineSubtotal(line), 0)
    view.innerHTML = '<ul class="cart-list">' + rows + '</ul><div class="cart-subtotal"><span>Subtotal</span><strong>' + money(total) + '</strong></div>'

    if (focused) {
      const controls = [...view.querySelectorAll('[data-cart-action]:not(:disabled)')]
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
    else changeQuantity(key, cartAction === 'increase' ? 1 : -1)
  })
  window.addEventListener('panpops-cart', render)
  render()
}

document.querySelectorAll('[data-future-page]').forEach(button => {
  button.addEventListener('click', () => notify(button.textContent + ' is coming soon.'))
})
initCrossing(document.querySelector('[data-crossing]'))
initCart()
