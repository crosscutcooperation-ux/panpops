import { front, back, products } from './catalog.js'

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

export function fillTrolley(trolley, lines) {
  const quantities = new Map()
  for (const line of lines) {
    for (const id of line.ids) quantities.set(id, (quantities.get(id) ?? 0) + line.quantity)
  }
  trolley.querySelector('[data-train-packs]').innerHTML = products.filter(product => quantities.has(product.id)).map(product => {
    const quantity = quantities.get(product.id)
    return '<span><img src="' + front(product) + '" alt="">' + (quantity > 1 ? '<b>' + quantity + '</b>' : '') + '</span>'
  }).join('')
}

export async function animateElement(element, frames, options) {
  if (reducedMotion.matches) return
  const animation = element.animate(frames, options)
  const stop = () => { if (reducedMotion.matches) animation.cancel() }
  reducedMotion.addEventListener('change', stop)
  try { await animation.finished }
  catch (error) { if (error.name !== 'AbortError') throw error }
  finally {
    animation.cancel()
    reducedMotion.removeEventListener('change', stop)
  }
}

export function enterTrolley(trolley) {
  return animateElement(trolley, [
    { transform: 'translateY(110vh)' },
    { transform: 'translateY(0)' },
  ], { duration: 650, easing: 'cubic-bezier(.18,.8,.27,1)' })
}

export async function flyPouch(product, start, end, delay = 0, face = 'front') {
  if (reducedMotion.matches) return
  const width = Math.min(136, Math.max(45, end.width))
  const height = width * 925 / 680
  const startX = start.left + start.width / 2 - width / 2
  const startY = start.top + start.height / 2 - height / 2
  const dx = end.left + end.width / 2 - startX - width / 2
  const dy = end.top + end.height / 2 - startY - height / 2
  const image = new Image()
  image.src = face === 'back' ? back(product) : front(product)
  image.alt = ''
  image.className = 'cart-flight'
  Object.assign(image.style, { left: startX + 'px', top: startY + 'px', width: width + 'px', opacity: '0' })
  document.body.append(image)
  try {
    await animateElement(image, [
      { transform: 'translate(0,0) rotate(-12deg) scale(.58)', opacity: 1 },
      { transform: 'translate(' + dx * .5 + 'px,' + (dy * .5 - 105) + 'px) rotate(9deg) scale(.93)', offset: .5, opacity: 1 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(0) scale(1)', opacity: 1 },
    ], { duration: 680, delay, easing: 'cubic-bezier(.3,.12,.38,1)', fill: 'both' })
  } finally { image.remove() }
}

export async function dissolvePouches(elements) {
  if (reducedMotion.matches) return
  const canvas = document.createElement('canvas')
  canvas.className = 'dust-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  const ratio = Math.min(devicePixelRatio || 1, 1.5)
  const width = innerWidth
  const height = innerHeight
  canvas.width = width * ratio
  canvas.height = height * ratio
  const context = canvas.getContext('2d')
  if (!context) return
  context.scale(ratio, ratio)
  const grains = []
  for (const image of elements) {
    const bounds = image.getBoundingClientRect()
    if (!image.complete || !image.naturalWidth || bounds.bottom < 0 || bounds.top > height) continue
    const sample = document.createElement('canvas')
    sample.width = Math.max(1, Math.round(bounds.width))
    sample.height = Math.max(1, Math.round(bounds.height))
    const paint = sample.getContext('2d', { willReadFrequently: true })
    if (!paint) continue
    paint.drawImage(image, 0, 0, sample.width, sample.height)
    const pixels = paint.getImageData(0, 0, sample.width, sample.height).data
    for (let y = 0; y < sample.height; y += 5) {
      for (let x = 0; x < sample.width; x += 5) {
        const at = (y * sample.width + x) * 4
        if (pixels[at + 3] < 32) continue
        const seed = Math.sin(x * 17.7 + y * 39.3) * 43758.54
        const noise = seed - Math.floor(seed)
        grains.push({
          x: bounds.left + x, y: bounds.top + y,
          delay: (1 - x / sample.width) * .28,
          drift: 50 + noise * 145, lift: -30 - noise * 85,
          color: 'rgb(' + pixels[at] + ',' + pixels[at + 1] + ',' + pixels[at + 2] + ')',
          size: 3 + noise * 3,
        })
      }
    }
  }

  document.body.append(canvas)
  const oldStyles = elements.map(element => element.style.visibility)
  elements.forEach(element => { element.style.visibility = 'hidden' })
  let frame
  try {
    await new Promise(resolve => {
      const start = performance.now()
      const draw = now => {
        const t = Math.min(1, (now - start) / 1150)
        context.clearRect(0, 0, width, height)
        for (const grain of grains) {
          const life = Math.max(0, Math.min(1, (t - grain.delay) / (1 - grain.delay)))
          context.globalAlpha = 1 - life
          context.fillStyle = grain.color
          const size = grain.size * (1 - life * .65)
          context.fillRect(grain.x + grain.drift * life, grain.y + grain.lift * life + Math.sin(life * 6) * 9, size, size)
        }
        if (t === 1 || reducedMotion.matches) resolve()
        else frame = requestAnimationFrame(draw)
      }
      frame = requestAnimationFrame(draw)
    })
  } finally {
    cancelAnimationFrame(frame)
    canvas.remove()
    elements.forEach((element, index) => { element.style.visibility = oldStyles[index] })
  }
}
