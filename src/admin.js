import { backendEnabled, request, jsonRequest } from './api.js'
import { money } from './catalog.js'

export function initAdminPage(root) {
  const connect = root.querySelector('[data-admin-connect]')
  const content = root.querySelector('[data-admin-content]')
  const message = root.querySelector('[data-admin-message]')
  const productRows = root.querySelector('[data-admin-products]')
  const orderRows = root.querySelector('[data-admin-orders]')
  const settingsForm = root.querySelector('[data-admin-settings]')
  let token = ''
  let settings
  let catalogue = []

  if (!backendEnabled) {
    root.querySelector('[data-admin-mode]').textContent = 'Open this page on the Rust server, or configure VITE_API_BASE_URL and rebuild the frontend.'
    connect.inert = true
  }
  const headers = () => ({ Authorization: 'Bearer ' + token })
  const tell = error => { message.textContent = error.message || String(error) }

  function renderProducts(products) {
    catalogue = products
    productRows.replaceChildren()
    for (const product of products) {
      const row = document.createElement('tr')
      row.dataset.productId = product.id
      row.innerHTML = '<th scope="row"></th><td><input type="number" min="1" max="1000000" step=".01" required></td><td><input type="checkbox"></td><td><button class="quiet-control" type="button" data-save-product>Save</button></td>'
      row.querySelector('th').textContent = product.name
      const price = row.querySelector('[type="number"]')
      price.value = (product.price_paise / 100).toFixed(2)
      price.setAttribute('aria-label', product.name + ' price in rupees')
      const active = row.querySelector('[type="checkbox"]')
      active.checked = product.active
      active.setAttribute('aria-label', product.name + ' available')
      row.querySelector('button').setAttribute('aria-label', 'Save ' + product.name)
      productRows.append(row)
    }
  }

  async function load() {
    const [products, delivery, orders] = await Promise.all([
      request('admin/products', { headers: headers() }),
      request('admin/settings', { headers: headers() }),
      request('admin/orders', { headers: headers() }),
    ])
    renderProducts(products.products)
    settings = delivery
    settingsForm.elements.shipping.value = (settings.shipping_paise / 100).toFixed(2)
    settingsForm.elements.threshold.value = (settings.free_shipping_min_paise / 100).toFixed(2)
    orderRows.replaceChildren()
    for (const order of orders.orders) {
      const row = document.createElement('tr')
      for (const value of [order.id, money(order.amount_paise / 100), order.status, order.created_at]) {
        const cell = document.createElement('td')
        cell.textContent = value
        row.append(cell)
      }
      orderRows.append(row)
    }
    connect.hidden = true
    content.hidden = false
  }

  connect.addEventListener('submit', async event => {
    event.preventDefault()
    token = connect.elements.token.value.trim()
    const button = connect.querySelector('button')
    button.disabled = true
    try {
      await load()
      connect.elements.token.value = ''
      message.textContent = ''
    } catch (error) { token = ''; tell(error) }
    finally { button.disabled = false }
  })

  productRows.addEventListener('click', async event => {
    const button = event.target.closest('[data-save-product]')
    if (!button) return
    const row = button.closest('tr')
    const price = row.querySelector('[type="number"]')
    if (!price.reportValidity()) return
    const product = catalogue.find(product => product.id === row.dataset.productId)
    button.disabled = true
    try {
      const data = await jsonRequest('admin/products/' + encodeURIComponent(product.id), {
        price_paise: Math.round(Number(price.value) * 100),
        active: row.querySelector('[type="checkbox"]').checked,
        version: product.version,
      }, { method: 'PUT', headers: headers() })
      renderProducts(data.products)
      message.textContent = product.name + ' saved.'
    } catch (error) { tell(error) }
    finally { button.disabled = false }
  })

  settingsForm.addEventListener('submit', async event => {
    event.preventDefault()
    const button = settingsForm.querySelector('button')
    button.disabled = true
    try {
      settings = await jsonRequest('admin/settings', {
        shipping_paise: Math.round(Number(settingsForm.elements.shipping.value) * 100),
        free_shipping_min_paise: Math.round(Number(settingsForm.elements.threshold.value) * 100),
        version: settings.version,
      }, { method: 'PUT', headers: headers() })
      message.textContent = 'Delivery settings saved.'
    } catch (error) { tell(error) }
    finally { button.disabled = false }
  })
  root.querySelector('[data-admin-reload]').addEventListener('click', () => load().then(() => { message.textContent = 'Up to date.' }).catch(tell))
  root.querySelector('[data-admin-lock]').addEventListener('click', () => {
    token = ''
    content.hidden = true
    connect.hidden = false
    productRows.replaceChildren()
    orderRows.replaceChildren()
    message.textContent = ''
    connect.elements.token.focus()
  })
}
