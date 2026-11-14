import { boxButton } from './parcel-art.js'
import { front, productById, money, boxName } from './catalog.js'
import { icon } from './icons.js'
import { getCart, removeLine, clearCart, changeQuantity, lineSubtotal, lineName, MAX_QUANTITY } from './cart.js'
import { fillTrolley, enterTrolley, flyPouch, flyBox, dissolvePouches, animateElement } from './trolley-motion.js'

export function initCartPage(root, notify) {
  const experience = root.querySelector('[data-cart-experience]')
  const list = root.querySelector('[data-cart-lineup]')
  const trolley = root.querySelector('[data-journey-trolley]')
  const target = trolley.querySelector('[data-arrival-target]')
  const commands = root.querySelector('[data-cart-commands]')
  const empty = root.querySelector('[data-cart-empty]')
  const status = root.querySelector('[data-experience-status]')
  let epoch = 0
  let ownMutation = false
  let busy = false

  function setPhase(phase) {
    experience.dataset.phase = phase
    busy = ['entering', 'unpacking', 'clearing', 'removing'].includes(phase)
    experience.setAttribute('aria-busy', String(busy))
    list.inert = busy
    commands.inert = busy
  }

  function render() {
    const lines = getCart()
    list.innerHTML = lines.map(line => {
      const product = productById[line.ids[0]]
      const name = lineName(line)
      return `
        <li class="cart-item" data-line-key="${line.key}">
          <div class="cart-item-art ${line.type === 'combo' ? 'combo-cart-art' : ''}">${line.type === 'box' ? boxButton(line) : line.ids.map(id => '<img src="' + front(productById[id]) + '" alt="' + productById[id].name + ' pouch">').join('')}</div>
          <div class="cart-card-info">
            <p class="item-weight">${line.type !== 'pack' ? line.ids.length + ' × 50 g' : product.weight + ' g pouch'}</p>
            <h2>${name}</h2>
            ${line.type === 'box' ? '<p class="combo-contents">' + line.ids.length + ' pouches · custom mix</p>' : ''}
            <strong class="item-price">${money(lineSubtotal(line))}</strong>
            <div class="cart-quantity">
              <button type="button" data-line-action="decrease" data-key="${line.key}" aria-label="Decrease ${name} quantity">${icon('minus')}</button>
              <span>${line.quantity}</span>
              <button type="button" data-line-action="increase" data-key="${line.key}" aria-label="Increase ${name} quantity"${line.quantity === MAX_QUANTITY ? ' disabled' : ''}>${icon('plus')}</button>
            </div>
            <button class="remove-item" type="button" data-line-action="remove" data-key="${line.key}" aria-label="Remove ${name}">Remove</button>
          </div>
        </li>`
    }).join('')
    root.querySelector('[data-cart-subtotal]').textContent = money(lines.reduce((sum, line) => sum + lineSubtotal(line), 0))
    empty.hidden = !!lines.length
    commands.hidden = !lines.length
    status.textContent = lines.length ? 'Your selection is ready.' : 'All clear.'
    fillTrolley(trolley, [])
    setPhase(lines.length ? 'ready' : 'empty')
  }

  async function unpack() {
    const turn = ++epoch
    const lines = getCart()
    render()
    if (!lines.length) return
    setPhase('entering')
    commands.hidden = true
    fillTrolley(trolley, lines)
    status.textContent = 'Bringing your cart around…'
    await enterTrolley(trolley)
    if (turn !== epoch) return
    setPhase('unpacking')
    status.textContent = 'Lining up your selection…'
    const cards = [...list.children]
    await Promise.all(cards.map(async (card, index) => {
      const art = card.querySelector('.cart-item-art')
      const line = lines[index]
      if (line.type === 'box') await flyBox(target.getBoundingClientRect(), art.getBoundingClientRect(), index * 110)
      else await flyPouch(productById[line.ids[0]], target.getBoundingClientRect(), art.getBoundingClientRect(), index * 110)
      if (turn !== epoch) return
      card.dataset.unpacked = ''
      fillTrolley(trolley, lines.slice(index + 1))
    }))
    if (turn !== epoch) return
    commands.hidden = false
    fillTrolley(trolley, [])
    status.textContent = 'Your selection is ready.'
    setPhase('ready')
  }

  function mutate(action) {
    ownMutation = true
    try { action() }
    finally { ownMutation = false }
  }

  list.addEventListener('click', async event => {
    const button = event.target.closest('[data-line-action]')
    if (!button || busy) return
    const { lineAction, key } = button.dataset
    const turn = ++epoch
    const card = button.closest('[data-line-key]')
    const itemWasRemoved = lineAction === 'remove' || (lineAction === 'decrease' && getCart().find(line => line.key === key)?.quantity === 1)
    mutate(() => {
      if (lineAction === 'remove') removeLine(key)
      else changeQuantity(key, lineAction === 'increase' ? 1 : -1)
    })
    if (itemWasRemoved) {
      setPhase('removing')
      await animateElement(card, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-24px)' }], { duration: 260, easing: 'ease-out' })
    }
    if (turn !== epoch) return
    render()
    const replacement = [...list.querySelectorAll('[data-line-action]:not(:disabled)')].find(control => control.dataset.key === key && control.dataset.lineAction === lineAction)
    const next = replacement ?? list.querySelector('[data-line-action]') ?? empty.querySelector('a')
    next?.focus({ preventScroll: true })
  })

  root.querySelector('[data-empty-cart]').addEventListener('click', async () => {
    if (busy || !getCart().length) return
    const turn = ++epoch
    const images = [...list.querySelectorAll('img')]
    setPhase('clearing')
    status.textContent = 'Clearing your cart…'
    mutate(clearCart)
    try {
      await Promise.all([
        dissolvePouches(images),
        ...[...list.querySelectorAll('.cart-card-info')].map(async info => {
          await animateElement(info, [{ opacity: 1 }, { opacity: 0 }], { duration: 600 })
          info.style.opacity = '0'
        }),
      ])
    } finally {
      if (turn === epoch) {
        render()
        notify('Your cart has been emptied.')
        empty.querySelector('a').focus({ preventScroll: true })
      }
    }
  })

  window.addEventListener('panpops-cart', () => {
    if (ownMutation) return
    epoch += 1
    render()
  })
  unpack().catch(() => render())
}
