import { products, productById, comboById, boxName, productUrl, front, money, MIN_BOX, MAX_BOX } from './catalog.js'
import { icon } from './icons.js'
import { productStyle } from './collection-templates.js'
import { getCart, addLine, packSubtotal, MAX_QUANTITY } from './cart.js'
import { playCartArrival, playBoxArrival } from './cart-arrival.js'
import { flyPouch, animateElement } from './trolley-motion.js'

const motion = matchMedia('(prefers-reduced-motion: reduce)')
let notify
function addToCart(type, ids, quantity = 1, origin, comboId) {
  if (type === 'combo' ? comboById[comboId].active === false : ids.some(id => productById[id].active === false)) { notify('This selection is currently unavailable.'); return false }
  const before = getCart()
  const result = addLine(type, ids, quantity, undefined, comboId)
  const name = type === 'combo' ? comboById[comboId].name : type === 'box' ? boxName(ids) : productById[ids[0]].name
  if (!result.added) { notify('Your cart has reached the limit for this item.'); return false }
  notify(name + (result.added > 1 ? ' × ' + result.added : '') + ' added to cart.')
  if (origin) {
    if (type === 'box') playBoxArrival(origin.getBoundingClientRect(), before, getCart(), motion.matches)
    else playCartArrival(productById[ids[0]], origin.getBoundingClientRect(), before, getCart(), motion.matches)
  }
  return true
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
      const scenes = await import('./collection-scenes.js')
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

function bindDrag(element, { start, move, end, cancel }) {
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
  element.addEventListener('pointercancel', () => { drag = undefined; cancel?.() })
}

function initShop(root) {
  const grid = root.querySelector('[data-shop-grid]')
  const host = root.querySelector('[data-shop-canvas]')
  const filters = Array.from(root.querySelectorAll('[data-filter]'))
  const items = Array.from(root.querySelectorAll('[data-category]'))
  const toggle = root.querySelector('[data-shop-motion]')
  let playing = !motion.matches
  let scene
  let pending = false
  let visible = false
  let unavailable = false

  function syncMotion() {
    toggle.setAttribute('aria-pressed', String(playing))
    toggle.querySelector('span').textContent = playing ? 'on' : 'off'
    scene?.setMotion(playing)
  }
  async function load() {
    if (!visible || motion.matches || scene || pending || unavailable) return
    pending = true
    try {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('webgl2', { alpha: true, antialias: true })
      if (!context) { unavailable = true; return }
      const { createShopGallery } = await import('./collection-scenes.js')
      if (motion.matches) { context.getExtension('WEBGL_lose_context')?.loseContext(); return }
      scene = await createShopGallery(grid, host, canvas, context)
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault()
        scene?.dispose()
        scene = undefined
        unavailable = true
        playing = false
        syncMotion()
      }, { once: true })
      scene.setMotion(playing)
    } catch (error) {
      unavailable = true
      console.warn('The shop is using its still-image display.', error)
    } finally {
      pending = false
      if (unavailable) { playing = false; syncMotion() }
    }
  }
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return
    visible = true
    observer.disconnect()
    load()
  }, { rootMargin: '180px' })
  observer.observe(root)
  toggle.addEventListener('click', () => {
    if (motion.matches) return notify('Reduced motion is enabled in your system settings.')
    if (unavailable) return notify('Your browser is showing still product displays.')
    playing = !playing
    syncMotion()
  })
  motion.addEventListener('change', () => {
    playing = !motion.matches && !unavailable
    if (motion.matches) { scene?.dispose(); scene = undefined }
    else load()
    syncMotion()
  })
  filters.forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.filter
    filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)))
    items.forEach(item => { item.hidden = filter !== 'all' && item.dataset.category !== filter })
    const count = items.filter(item => !item.hidden).length
    root.querySelector('[data-shop-count]').textContent = count + (count === 1 ? ' selection' : ' selections') + ' to find your happy crunch.'
    scene?.refresh()
  }))
  root.querySelectorAll('[data-shop-add]').forEach(button => button.addEventListener('click', () => {
    const ids = button.dataset.shopAdd.split(',')
    addToCart(button.dataset.comboId ? 'combo' : 'pack', ids, 1, button, button.dataset.comboId)
  }))
  window.addEventListener('pagehide', event => { if (!event.persisted) scene?.dispose() })
  syncMotion()
}

function initProduct(root) {
  const combo = comboById[root.dataset.product]
  const product = combo ? { ...productById[combo.ids[0]], ...combo, weight: combo.ids.length * 50 } : productById[root.dataset.product]
  const unit = combo ? 'combo' : 'pouch'
  const stage = root.querySelector('[data-stage]')
  const count = root.querySelector('[data-product-quantity]')
  const decrease = root.querySelector('[data-quantity="-1"]')
  const increase = root.querySelector('[data-quantity="1"]')
  const add = root.querySelector('[data-add]')
  const flip = root.querySelector('[data-flip]')
  const labelPanel = root.querySelector('[data-label-panel]')
  const presets = Array.from(root.querySelectorAll('[data-quantity-preset]'))
  const summary = root.querySelector('[data-quantity-summary]')
  const addTotal = root.querySelector('[data-add-total]')
  let reversed = false
  let quantity = 1
  const rotation = root.querySelector('[data-product-motion]')
  let playing = !motion.matches

  const getScene = mountScene(stage, async (scenes, ...args) => {
    const scene = await scenes.createProduct(...args, product)
    scene.flip(reversed, true)
    scene.setMotion(playing)
    return scene
  })

  function chooseQuantity(value) {
    quantity = Math.max(1, Math.min(MAX_QUANTITY, value))
    count.value = quantity
    decrease.disabled = quantity === 1
    increase.disabled = quantity === MAX_QUANTITY
    presets.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.quantityPreset) === quantity)))
    const total = money(product.price * quantity)
    summary.innerHTML = quantity + ' ' + unit + (quantity === 1 ? '' : 's') + ' · ' + product.weight * quantity + ' g total <strong>' + total + '</strong>'
    addTotal.textContent = total
  }

  presets.forEach(button => button.addEventListener('click', () => chooseQuantity(Number(button.dataset.quantityPreset))))
  decrease.addEventListener('click', () => chooseQuantity(quantity - 1))
  increase.addEventListener('click', () => chooseQuantity(quantity + 1))
  add.disabled = product.active === false
  if (add.disabled) add.textContent = 'Currently unavailable'
  add.addEventListener('click', () => addToCart(combo ? 'combo' : 'pack', combo ? combo.ids : [product.id], quantity, add, combo?.id))
  flip.addEventListener('click', () => {
    reversed = !reversed
    flip.setAttribute('aria-expanded', String(reversed))
    flip.innerHTML = icon('spin') + (combo ? (reversed ? ' View fronts of packs' : ' View backs of packs') : (reversed ? ' View front of pack' : ' View back of pack'))
    labelPanel.hidden = !reversed
    stage.querySelector('.product-front').hidden = reversed
    stage.querySelector('.product-back').hidden = !reversed
    getScene()?.flip(reversed)
  })
  rotation.addEventListener('click', () => {
    if (motion.matches) return notify('Reduced motion is enabled in your system settings.')
    playing = !playing
    rotation.setAttribute('aria-pressed', String(playing))
    rotation.querySelector('span').textContent = playing ? 'on' : 'off'
    getScene()?.setMotion(playing)
  })
  motion.addEventListener('change', () => {
    playing = !motion.matches
    rotation.setAttribute('aria-pressed', String(playing))
    rotation.querySelector('span').textContent = playing ? 'on' : 'off'
  })
  rotation.setAttribute('aria-pressed', String(playing))
  rotation.querySelector('span').textContent = playing ? 'on' : 'off'
  bindDrag(stage, {
    start() { getScene()?.startDrag() },
    move(dx, dy) { getScene()?.drag(dx, dy) },
    end() { getScene()?.endDrag() },
    cancel() { getScene()?.endDrag() },
  })
  stage.querySelector('[data-drag-hint]').hidden = false
  chooseQuantity(1)

}

function initBox(root) {
  const stage = root.querySelector('[data-stage]')
  const slots = [...root.querySelectorAll('.tray-slot img')]
  const add = root.querySelector('[data-add-box]')
  const picks = [...root.querySelectorAll('[data-box-pick]')]
  const removals = [...root.querySelectorAll('[data-box-remove]')]
  const sizeInputs = [...root.querySelectorAll('[name="box-size"]')]
  const status = root.querySelector('[data-box-status]')
  const requested = new URLSearchParams(location.search).get('mix')?.split(',') ?? []
  let selected = requested.length >= MIN_BOX && requested.length <= MAX_BOX && requested.every(id => Object.hasOwn(productById, id)) ? requested : []
  let capacity = selected.length > 4 ? 6 : 4
  let busy = false
  const getScene = mountScene(stage, async (scenes, ...args) => {
    const scene = await scenes.createTray(...args)
    scene.setCapacity(capacity)
    scene.setContents(selected, true)
    return scene
  })

  function render() {
    stage.dataset.capacity = capacity
    sizeInputs.forEach(input => { input.checked = Number(input.value) === capacity; input.disabled = busy })
    slots.forEach((slot, index) => {
      slot.closest('.tray-slot').hidden = index >= capacity
      slot.hidden = !selected[index]
      if (selected[index]) slot.src = front(productById[selected[index]])
    })
    root.querySelectorAll('[data-box-quantity]').forEach(output => { output.value = selected.filter(id => id === output.dataset.boxQuantity).length })
    picks.forEach(button => {
      const count = selected.filter(id => id === button.dataset.boxPick).length
      button.setAttribute('aria-pressed', String(count > 0))
      button.closest('.box-picture-tile').classList.toggle('is-selected', count > 0)
      button.disabled = busy || selected.length >= capacity || productById[button.dataset.boxPick].active === false
    })
    removals.forEach(button => { button.disabled = busy || !selected.includes(button.dataset.boxRemove) })
    add.disabled = busy || selected.length < MIN_BOX || selected.some(id => productById[id].active === false)
    root.querySelector('[data-box-total]').textContent = money(packSubtotal(selected))
    root.querySelector('[data-box-count]').textContent = selected.length + ' / ' + capacity + ' POUCHES'
    status.textContent = busy ? 'Packing your box…' : selected.length === capacity ? 'Your box is full.' : selected.length >= MIN_BOX ? 'Your box is ready. Add more or close it.' : 'Choose ' + (MIN_BOX - selected.length) + ' more pouch' + (MIN_BOX - selected.length === 1 ? '.' : 'es.')
  }
  function syncContents(immediate = false) { getScene()?.setContents(selected, immediate) }
  picks.forEach(button => button.addEventListener('click', async () => {
    if (busy || selected.length >= capacity) return
    const id = button.dataset.boxPick
    busy = true
    render()
    const target = root.querySelectorAll('.box-slot-targets span')[selected.length]
    try { await flyPouch(productById[id], button.querySelector('img').getBoundingClientRect(), target.getBoundingClientRect()) }
    finally {
      selected = [...selected, id]
      syncContents(true)
      busy = false
      render()
    }
  }))
  removals.forEach(button => button.addEventListener('click', () => {
    if (busy) return
    const index = selected.lastIndexOf(button.dataset.boxRemove)
    if (index >= 0) selected = selected.filter((_, position) => position !== index)
    syncContents()
    render()
  }))
  sizeInputs.forEach(input => input.addEventListener('change', () => {
    if (busy) return
    const next = Number(input.value)
    if (selected.length > next) {
      input.checked = false
      sizeInputs.find(control => Number(control.value) === capacity).checked = true
      status.textContent = 'Remove ' + (selected.length - next) + ' pouches before choosing the smaller box.'
      return
    }
    capacity = next
    getScene()?.setCapacity(capacity)
    syncContents(true)
    render()
  }))
  add.addEventListener('click', async () => {
    if (busy || selected.length < MIN_BOX) return
    const contents = [...selected]
    if (contents.some(id => productById[id].active === false)) return
    const before = getCart()
    const result = addLine('box', contents, 1, capacity)
    if (!result.added) { notify('Your cart has reached the limit for this box.'); return }
    busy = true
    render()
    stage.dataset.sealing = ''
    try {
      const scene = getScene()
      if (scene && !motion.matches) await scene.close()
      else await animateElement(stage.querySelector('.box-fallback-lid'), [{ opacity: 0, transform: 'translate(-50%,-150%) rotateX(-90deg)' }, { opacity: 1, transform: 'translate(-50%,-50%) rotateX(0)' }], { duration: 650, fill: 'both' })
      notify('Your sealed box has been added to cart.')
      stage.dataset.departing = ''
      await playBoxArrival(stage.getBoundingClientRect(), before, getCart(), motion.matches)
      selected = []
    } finally {
      delete stage.dataset.sealing
      delete stage.dataset.departing
      getScene()?.open()
      syncContents(true)
      busy = false
      render()
    }
  })
  render()
}

function initCarousel(root) {
  const stage = root.querySelector('[data-stage]')
  const stills = Array.from(root.querySelectorAll('.carousel-pack'))
  const index = root.querySelector('[data-current-index]')
  const name = root.querySelector('[data-active-name]')
  const note = root.querySelector('[data-active-note]')
  const link = root.querySelector('[data-active-link]')
  const motionButton = root.querySelector('[data-motion]')
  let playing = !motion.matches
  let active = 0
  let lastSwitch = -Infinity
  let mouseGesture
  const getScene = mountScene(stage, async (scenes, ...args) => {
    const scene = await scenes.createTurntable(...args)
    scene.select(active, 1, true)
    scene.setMotion(playing)
    return scene
  })

  function select(next, direction) {
    const target = (next + products.length) % products.length
    if (target === active) return
    const delta = (target - active + products.length) % products.length
    active = target
    lastSwitch = performance.now()
    mouseGesture = undefined
    const product = products[active]
    root.style.cssText = productStyle(product)
    index.textContent = '0' + (active + 1)
    name.textContent = product.name
    note.textContent = product.note
    if (link) link.href = productUrl(product)
    root.querySelectorAll('[data-flavour]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.flavour) === active)))
    stills.forEach((image, i) => {
      image.className = 'carousel-pack ' + ['center','next','parked','prev'][(i - active + products.length) % products.length]
    })
    getScene()?.select(active, direction ?? (delta === 3 ? -1 : 1))
  }

  root.querySelectorAll('[data-flavour]').forEach(button => button.addEventListener('click', () => select(Number(button.dataset.flavour))))
  root.querySelectorAll('[data-step]').forEach(button => {
    button.addEventListener('click', () => select(active + Number(button.dataset.step), Number(button.dataset.step)))
  })
  function syncMotion() {
    motionButton?.setAttribute('aria-pressed', String(playing))
    if (motionButton) motionButton.querySelector('span').textContent = playing ? 'on' : 'off'
    root.toggleAttribute('data-paused', !playing)
    getScene()?.setMotion(playing)
  }
  motionButton?.addEventListener('click', () => {
    if (motion.matches) {
      notify('Reduced motion is enabled in your system settings.')
      return
    }
    playing = !playing
    syncMotion()
  })
  motion.addEventListener('change', () => { playing = !motion.matches; syncMotion() })
  syncMotion()
  const normalizedPointer = event => {
    const bounds = stage.getBoundingClientRect()
    return [(event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1]
  }
  // Treat a deliberate sideways mouse sweep as one swipe, without cursor parallax.
  stage.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || event.buttons || event.target.closest('button, a')) {
      mouseGesture = undefined
      return
    }
    const now = performance.now()
    if (now - lastSwitch < 900) {
      mouseGesture = undefined
      return
    }
    if (!mouseGesture || now - mouseGesture.at > 450) {
      mouseGesture = { x: event.clientX, y: event.clientY, at: now }
      return
    }
    const dx = event.clientX - mouseGesture.x
    const dy = event.clientY - mouseGesture.y
    const threshold = Math.max(65, Math.min(110, stage.clientWidth * .08))
    if (Math.abs(dy) > Math.abs(dx)) {
      mouseGesture = undefined
      return
    }
    if (Math.abs(dx) >= threshold) {
      const direction = dx < 0 ? 1 : -1
      select(active + direction, direction)
    }
  })
  stage.addEventListener('pointerleave', () => { mouseGesture = undefined })
  root.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    select(active + direction, direction)
  })
  let pointerDown
  stage.addEventListener('pointerdown', event => { pointerDown = event; mouseGesture = undefined })
  bindDrag(stage, { end(dx, dy) {
    if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy)) {
      const direction = dx < 0 ? 1 : -1
      select(active + direction, direction)
    } else if (Math.hypot(dx, dy) < 10 && pointerDown) {
      const picked = getScene()?.pick(...normalizedPointer(pointerDown))
      if (picked != null) select(picked)
    }
  } })
}


export function initCollections(tell) {
  notify = tell
  document.querySelectorAll('[data-unit-price]').forEach(element => { element.textContent = money(productById[element.dataset.unitPrice].price) })
  document.querySelectorAll('[data-selection-price]').forEach(element => {
    if (element.dataset.comboPrice) return
    const ids = element.dataset.selectionPrice
    const available = products.filter(product => product.active !== false)
    element.textContent = ids === 'minimum-box' && !available.length ? 'Unavailable' : money(ids === 'minimum-box' ? Math.min(...available.map(product => product.price)) * 2 : packSubtotal(ids.split(',')))
  })
  document.querySelectorAll('[data-combo-price]').forEach(element => { element.textContent = money(comboById[element.dataset.comboPrice].price) })
  document.querySelectorAll('[data-shop-add]').forEach(button => { button.disabled = button.dataset.comboId ? comboById[button.dataset.comboId].active === false : button.dataset.shopAdd.split(',').some(id => productById[id].active === false) })
  document.querySelectorAll('[data-shop]').forEach(initShop)
  const carousel = document.querySelector('[data-carousel]')
  if (carousel) initCarousel(carousel)
  const product = document.querySelector('[data-product]')
  if (product) initProduct(product)
  document.querySelectorAll('[data-box]').forEach(initBox)
}
