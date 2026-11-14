import { products, productById, comboById, MIN_BOX, MAX_BOX } from './catalog.js'

const KEY = 'panpops-preview-cart-v1'
export const MAX_QUANTITY = 99

export function boxContents(ids) {
  return products.flatMap(product => ids.filter(id => id === product.id))
}

export function boxDescription(ids) {
  return products.filter(product => ids.includes(product.id)).map(product => {
    const count = ids.filter(id => id === product.id).length
    return count + ' × ' + product.name
  }).join(' · ')
}

function parseCart(raw) {
  const lines = JSON.parse(raw || '[]')
  if (!Array.isArray(lines)) return []
  return lines.flatMap(line => {
    if (!line || !Number.isInteger(line.quantity) || line.quantity < 1 || !Array.isArray(line.ids)) return []
    if (line.type === 'combo' && comboById[line.comboId]) return [makeLine('combo', comboById[line.comboId].ids, line.quantity, undefined, line.comboId)]
    if (!line.ids.every(id => Object.hasOwn(productById, id))) return []
    if (line.type === 'pack' && line.ids.length === 1) return [makeLine('pack', line.ids, line.quantity)]
    if (line.type === 'box' && line.ids.length >= MIN_BOX && line.ids.length <= MAX_BOX) {
      const capacity = line.capacity === 6 || line.ids.length > 4 ? 6 : 4
      if (line.ids.length > capacity) return []
      return [makeLine('box', line.ids, line.quantity, capacity)]
    }
    return []
  })
}

function makeLine(type, ids, quantity = 1, capacity = ids.length > 4 ? 6 : 4, comboId) {
  const sorted = boxContents(ids)
  const key = type + ':' + (type === 'combo' ? comboId : (type === 'box' ? capacity + ':' : '') + sorted.join('+'))
  return { key, type, ids: sorted, quantity: Math.min(MAX_QUANTITY, quantity), ...(type === 'box' ? { capacity } : {}), ...(type === 'combo' ? { comboId } : {}) }
}

function readCart() {
  try { return parseCart(localStorage.getItem(KEY)) }
  catch { return [] }
}

let cart = readCart()
let storageAvailable = true
export const getCart = () => cart

function update(lines) {
  cart = lines
  try {
    localStorage.setItem(KEY, JSON.stringify(cart))
    storageAvailable = true
  }
  catch { storageAvailable = false }
  window.dispatchEvent(new Event('panpops-cart'))
}

function syncCart() {
  cart = readCart()
  window.dispatchEvent(new Event('panpops-cart'))
}

window.addEventListener('storage', event => {
  if (event.key === KEY || event.key === null) syncCart()
})
window.addEventListener('pageshow', event => {
  if (event.persisted && storageAvailable) syncCart()
})

export function addLine(type, ids, quantity = 1, capacity, comboId) {
  if (type === 'combo') {
    const combo = comboById[comboId]
    if (!combo || combo.active === false) return { added: 0, persisted: storageAvailable }
    ids = combo.ids
  }
  if (!ids.length || ids.some(id => !Object.hasOwn(productById, id)) || (type === 'box' && (ids.length < MIN_BOX || ids.length > (capacity || (ids.length > 4 ? 6 : 4))))) return { added: 0, persisted: storageAvailable }
  const line = makeLine(type, ids, quantity, capacity, comboId)
  const match = cart.find(item => item.key === line.key)
  if (match?.quantity === MAX_QUANTITY) return { added: 0, persisted: storageAvailable }
  const added = Math.min(line.quantity, MAX_QUANTITY - (match?.quantity ?? 0))
  update(match
    ? cart.map(item => item.key === line.key ? { ...item, quantity: item.quantity + added } : item)
    : [...cart, line])
  return { added, persisted: storageAvailable }
}

export function changeQuantity(key, delta) {
  update(cart.flatMap(line => {
    if (line.key !== key) return [line]
    const quantity = Math.min(MAX_QUANTITY, line.quantity + delta)
    return quantity > 0 ? [{ ...line, quantity }] : []
  }))
}

export function clearCart() {
  update([])
}

export function removeLine(key) {
  update(cart.filter(line => line.key !== key))
}

export const packSubtotal = ids => ids.reduce((total, id) => total + productById[id].price, 0)
export const lineSubtotal = line => (line.type === 'combo' ? comboById[line.comboId].price : packSubtotal(line.ids)) * line.quantity
export const lineName = line => line.type === 'combo' ? comboById[line.comboId].name : line.type === 'box' ? 'Custom box' : productById[line.ids[0]].name
