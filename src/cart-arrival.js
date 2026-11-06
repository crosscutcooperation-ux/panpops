import { front } from './catalog.js'
import { getCart } from './cart.js'

const drawer = document.querySelector('[data-cart-arrival]')
const target = drawer.querySelector('[data-arrival-target]')
const landedPack = drawer.querySelector('[data-arrival-pack]')
const count = drawer.querySelector('[data-arrival-count]')
const name = drawer.querySelector('[data-arrival-name]')
let flights = 0
let closeTimer

async function throwPouch(product, origin) {
  await Promise.allSettled(drawer.getAnimations().map(animation => animation.finished))
  const end = target.getBoundingClientRect()
  const width = Math.max(46, Math.min(origin.width, 148))
  const height = width * 925 / 680
  const left = origin.left + (origin.width - width) / 2
  const top = origin.top + (origin.height - height) / 2
  const dx = end.left + end.width / 2 - left - width / 2
  const dy = end.top + end.height / 2 - top - height / 2

  const pouch = new Image()
  pouch.src = front(product)
  pouch.alt = ''
  pouch.className = 'cart-flight'
  Object.assign(pouch.style, { width: width + 'px', left: left + 'px', top: top + 'px' })
  document.body.append(pouch)

  try {
    await pouch.animate([
      { transform: 'rotate(-12deg) scale(1)' },
      { transform: 'translate(' + dx * .5 + 'px,' + (dy * .45 - 80) + 'px) rotate(20deg) scale(.82)', offset: .5 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(-12deg) scale(.32)', opacity: .95 },
    ], { duration: 590, easing: 'cubic-bezier(.32,.12,.44,1)', fill: 'forwards' }).finished
  } finally {
    pouch.remove()
  }
}

export async function playCartArrival(product, origin, reduceMotion) {
  clearTimeout(closeTimer)
  flights += 1
  const start = origin.getBoundingClientRect()
  drawer.dataset.open = ''
  drawer.getBoundingClientRect()

  try {
    if (!reduceMotion) await throwPouch(product, start)
  } catch {
    // Cart storage has already been updated, so still show the added item.
  } finally {
    landedPack.src = front(product)
    landedPack.hidden = false
    count.textContent = getCart().reduce((total, line) => total + line.quantity, 0)
    name.textContent = product.name + ' added'
    if (!reduceMotion) target.animate([
      { transform: 'translateY(0)' }, { transform: 'translateY(8px)' }, { transform: 'translateY(0)' },
    ], { duration: 245, easing: 'ease-out' })

    flights -= 1
    if (!flights) closeTimer = setTimeout(() => {
      delete drawer.dataset.open
    }, 800)
  }
}

drawer.addEventListener('transitionend', () => {
  if (drawer.hasAttribute('data-open')) return
  landedPack.hidden = true
  name.textContent = ''
  count.textContent = ''
})
