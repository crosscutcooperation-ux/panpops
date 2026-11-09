import { front } from './catalog.js'
import { fillTrolley } from './trolley-motion.js'

const train = document.querySelector('[data-cart-train]')
const packs = train.querySelector('[data-train-packs]')
const target = train.querySelector('[data-arrival-target]')
let queue = Promise.resolve()

function move(element, frames, duration, easing) {
  return element.animate(frames, { duration, easing, fill: 'both' })
}

async function throwPouch(product, origin) {
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
    await move(pouch, [
      { transform: 'rotate(-12deg) scale(1)' },
      { transform: 'translate(' + dx * .48 + 'px,' + (dy * .46 - 94) + 'px) rotate(18deg) scale(.79)', offset: .48 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(-12deg) scale(.37)' },
    ], 620, 'cubic-bezier(.32,.12,.44,1)').finished
  } finally {
    pouch.remove()
  }
}

async function runArrival(product, origin, before, after, reduceMotion) {
  train.hidden = false
  try {
    if (reduceMotion) {
      fillTrolley(train, after)
      await new Promise(resolve => setTimeout(resolve, 850))
      return
    }

    fillTrolley(train, before)
    const incoming = move(train, [{ transform: 'translateX(-105vw)' }, { transform: 'translateX(0)' }], 460, 'cubic-bezier(.18,.8,.27,1)')
    await incoming.finished
    incoming.cancel()
    await throwPouch(product, origin)
    fillTrolley(train, after)
    const landing = move(train, [
      { transform: 'translateY(0)' }, { transform: 'translateY(7px)', offset: .25 }, { transform: 'translateY(0)' },
    ], 470, 'ease-out')
    await landing.finished
    landing.cancel()
    await move(train, [{ transform: 'translateX(0)' }, { transform: 'translateX(108vw)' }], 490, 'cubic-bezier(.55,.05,.8,.44)').finished
  } finally {
    train.hidden = true
    train.getAnimations().forEach(animation => animation.cancel())
  }
}

export function playCartArrival(product, origin, before, after, reduceMotion) {
  queue = queue.then(() => runArrival(product, origin, before, after, reduceMotion)).catch(() => {
    // The cart was already saved when the pouch was selected.
  })
}
