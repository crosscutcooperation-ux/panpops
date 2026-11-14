import { productById, comboById, money } from './catalog.js'
export const statuses = { received: 'Order received', processing: 'Preparing your order', ready_for_pickup: 'Ready for pickup', picked_up: 'Picked up', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' }
const itemsText = order => (order.items || []).map(item => item.quantity + ' × ' + ((productById[item.id] || comboById[item.id])?.name || item.id)).join(', ')
export function renderOrder(order, admin = false, save) {
  const card = document.createElement('article')
  card.className = 'order-card'
  card.innerHTML = '<div class="order-card-top"><h2></h2><strong></strong></div><p class="order-items"></p><p class="order-payment"></p><p class="order-delivery"></p><p class="order-tracking"></p><ol class="order-history"></ol>'
  card.querySelector('h2').textContent = 'Order ' + order.id.slice(0, 8)
  card.querySelector('h2').title = order.id
  card.querySelector('strong').textContent = money(order.amount_paise / 100)
  card.querySelector('.order-items').textContent = itemsText(order)
  card.querySelector('.order-payment').textContent = 'Payment: ' + order.status + ' · ' + order.created_at + ' UTC'
  card.querySelector('.order-delivery').textContent = statuses[order.fulfilment_status] || order.fulfilment_status
  card.querySelector('.order-tracking').textContent = order.tracking ? 'Tracking: ' + order.tracking : ''
  for (const event of order.history || []) {
    const li = document.createElement('li')
    li.textContent = (statuses[event.status] || event.status) + ' · ' + event.created_at + ' UTC'
    card.querySelector('ol').append(li)
  }
  if (!admin) return card
  const customer = document.createElement('p')
  customer.textContent = [order.customer?.full_name, order.customer?.email, order.customer?.phone, order.customer?.address, order.customer?.address2, order.customer?.city, order.customer?.state, order.customer?.pincode].filter(Boolean).join(' · ')
  card.append(customer)
  const controls = document.createElement('form')
  controls.className = 'order-controls'
  controls.innerHTML = '<label>Delivery stage<select name="status"></select></label><label>Tracking / courier reference<input name="tracking" maxlength="200"></label><button class="quiet-control">Save update</button><label>Email template<select name="template"></select></label><a class="quiet-control">Compose email</a><p role="status"></p>'
  for (const [value, text] of Object.entries(statuses)) controls.elements.status.add(new Option(text, value))
  controls.elements.status.value = order.fulfilment_status
  controls.elements.tracking.value = order.tracking
  const templates = { confirmation: 'Order confirmation', processing: 'Preparing order', ready_for_pickup: 'Ready for pickup', picked_up: 'Pickup confirmation', out_for_delivery: 'Out for delivery', delivered: 'Delivery confirmation', cancelled: 'Cancellation', payment: 'Payment pending' }
  for (const [value,text] of Object.entries(templates)) controls.elements.template.add(new Option(text,value))
  controls.elements.template.value = order.status !== 'paid' ? 'payment' : order.fulfilment_status === 'received' ? 'confirmation' : order.fulfilment_status
  const email = controls.querySelector('a')
  function updateEmail() {
    const template = controls.elements.template.value
    const label = templates[template]
    const text = template === 'payment' ? 'Your payment is still pending. Please contact us if you need help completing your order.' : template === 'confirmation' ? 'Thank you for your order. Your payment has been received.' : 'Order update: ' + (statuses[template] || label) + '.'
    const body = 'Hi ' + (order.customer?.full_name || 'there') + ',\n\n' + text + '\n\nOrder: ' + order.id + '\nItems: ' + itemsText(order) + '\nTotal: ' + money(order.amount_paise / 100) + (order.tracking ? '\nTracking: ' + order.tracking : '') + '\n\nSee updates in My account on our website.\n\nPanPops team'
    email.href = 'mailto:' + encodeURIComponent(order.customer?.email || '') + '?subject=' + encodeURIComponent('PanPops · ' + label + ' · ' + order.id.slice(0, 8)) + '&body=' + encodeURIComponent(body)
  }
  controls.elements.template.addEventListener('change', updateEmail)
  updateEmail()
  controls.addEventListener('submit', async event => {
    event.preventDefault()
    const button = controls.querySelector('button')
    button.disabled = true
    try { await save(order, { status: controls.elements.status.value, tracking: controls.elements.tracking.value, version: order.version }) }
    catch (error) { controls.querySelector('[role=status]').textContent = error.message }
    finally { button.disabled = false }
  })
  card.append(controls)
  return card
}
