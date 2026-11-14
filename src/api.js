import { productById, comboById } from './catalog.js'

const configuredBase = import.meta.env.VITE_API_BASE_URL
export const backendEnabled = Boolean(configuredBase)
const base = String(configuredBase || '/api').replace(/\/$/, '')

export async function request(path, options = {}) {
  if (!backendEnabled) throw new Error('Connect the Rust server to use live pricing and payments.')
  const response = await fetch(base + '/' + path, { credentials: 'include', ...options, signal: AbortSignal.timeout(25000) })
  let data
  try { data = await response.json() }
  catch { throw new Error('The server response could not be read. Check the API address.') }
  if (!response.ok) {
    const error = new Error(data.error || 'The request could not be completed.')
    error.status = response.status
    throw error
  }
  return data
}

export function jsonRequest(path, body, options = {}) {
  return request(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body),
    method: options.method || 'POST',
  })
}

export async function loadCatalogue() {
  if (!backendEnabled) return
  const data = await request('products')
  for (const product of data.products) {
    const local = productById[product.id] || comboById[product.id]
    if (!local) continue
    local.price = product.price_paise / 100
    local.active = product.active
    local.version = product.version
  }
}

export function orderItems(lines) {
  const quantities = new Map()
  for (const line of lines) {
    for (const id of line.type === 'combo' ? [line.comboId] : line.ids) quantities.set(id, (quantities.get(id) || 0) + line.quantity)
  }
  return [...quantities].map(([id, quantity]) => ({ id, quantity }))
}

export async function quoteCart(lines) {
  if (backendEnabled) return jsonRequest('quote', { items: orderItems(lines) })
  const subtotal = lines.reduce((sum, line) => sum + (line.type === 'combo' ? Math.round(comboById[line.comboId].price * 100) : line.ids.reduce((value, id) => value + Math.round(productById[id].price * 100), 0)) * line.quantity, 0)
  return { subtotal_paise: subtotal, shipping_paise: 0, total_paise: subtotal, currency: 'INR' }
}
