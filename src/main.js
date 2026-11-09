import { initAdminPage } from './admin.js'
import { loadCatalogue } from './api.js'
import { productById } from './catalog.js'
import { playCartArrival } from './cart-arrival.js'
import { getCart, addLine } from './cart.js'
import { initCartPage } from './cart-page.js'
import { initCheckoutPage } from './checkout.js'
import { initAccountPage } from './account.js'

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
  if (product.active === false) {
    notify('This flavour is currently unavailable.')
    return
  }
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
  const visible = new Set()
  const started = new Map()
  let inSection = false
  let frame = 0

  function poses() {
    return progress.map(value => ({
      rise: 1 - (1 - Math.min(1, value / .56)) ** 3,
      burst: Math.max(0, (value - .38) / .62),
    }))
  }

  const getScene = mountScene(stage, async (scenes, ...args) => {
    const scene = await scenes.createCrossing(...args, anchors)
    scene.pose(poses())
    return scene
  })

  function render() {
    const state = poses()
    bands.forEach((band, index) => {
      band.style.setProperty('--rise', state[index].rise)
      band.style.setProperty('--burst', state[index].burst)
    })
    getScene()?.pose(state)
  }

  function reset(value) {
    started.clear()
    cancelAnimationFrame(frame)
    frame = 0
    progress.fill(value)
    render()
  }

  function animate(now) {
    frame = 0
    for (const [index, start] of started) {
      const fraction = Math.max(0, Math.min(1, (now - start) / 1160))
      progress[index] = fraction
      if (fraction === 1) started.delete(index)
    }
    render()
    if (started.size) frame = requestAnimationFrame(animate)
  }

  function startVisible() {
    if (!inSection || motion.matches) return
    const now = performance.now()
    for (const index of visible) {
      if (progress[index] === 0 && !started.has(index)) started.set(index, now + index * 65)
    }
    if (started.size && !frame) frame = requestAnimationFrame(animate)
  }

  const artObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const index = anchors.indexOf(entry.target)
      if (entry.isIntersecting && entry.intersectionRatio >= .18) visible.add(index)
      else visible.delete(index)
    }
    startVisible()
  }, { threshold: .18 })

  let sectionObserver
  function observeSection() {
    sectionObserver?.disconnect()
    const inset = Math.round(innerHeight * .24)
    sectionObserver = new IntersectionObserver(([entry]) => {
      const wasInSection = inSection
      inSection = entry.isIntersecting && entry.intersectionRatio >= .08
      if (inSection) startVisible()
      else if (wasInSection) reset(0)
    }, { rootMargin: '0px 0px -' + inset + 'px 0px', threshold: .08 })
    sectionObserver.observe(stage)
  }

  function observe() {
    observeSection()
    anchors.forEach(anchor => artObserver.observe(anchor))
  }

  if (!motion.matches) observe()
  window.addEventListener('resize', () => {
    if (!motion.matches) observeSection()
  })
  motion.addEventListener('change', () => {
    sectionObserver?.disconnect()
    artObserver.disconnect()
    visible.clear()
    inSection = false
    reset(motion.matches ? 1 : 0)
    if (!motion.matches) observe()
  })

  bands.forEach((band, index) => {
    const product = productById[band.dataset.crossingAdd]
    band.addEventListener('click', () => addToCart(product, anchors[index]))
  })
  render()
}

document.querySelectorAll('[data-future-page]').forEach(button => {
  button.addEventListener('click', () => notify(button.textContent + ' is coming soon.'))
})
async function startStore() {
  try { await loadCatalogue() }
  catch (error) { notify('Live prices are unavailable. ' + error.message) }
  const admin = document.querySelector('[data-admin-page]')
  if (admin) initAdminPage(admin)
  const crossing = document.querySelector('[data-crossing]')
  if (crossing) initCrossing(crossing)
  const cartPage = document.querySelector('[data-cart-page]')
  if (cartPage) initCartPage(cartPage, notify)
  const checkout = document.querySelector('[data-checkout-page]')
  if (checkout) initCheckoutPage(checkout)
  if (document.querySelector('[data-account-form]')) initAccountPage(notify)
}
startStore()

function updateCartCount() {
  const count = getCart().reduce((total, line) => total + line.quantity, 0)
  document.querySelector('[data-cart-count]').textContent = count
  document.querySelector('[data-cart-link]').setAttribute('aria-label', 'Cart, ' + count + (count === 1 ? ' item' : ' items'))
}
window.addEventListener('panpops-cart', updateCartCount)
window.addEventListener('pageshow', updateCartCount)
updateCartCount()
