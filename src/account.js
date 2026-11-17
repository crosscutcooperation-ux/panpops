import { prepareTextFields, validateTextFields } from './forms.js'
import { request, jsonRequest, backendEnabled } from './api.js'
import { renderOrder } from './order-ui.js'

let currentAccount = null
export const getPreviewAccount = () => currentAccount
export async function loadAccount() {
  if (!backendEnabled) return
  try { currentAccount = (await request('account/me')).user }
  catch (error) { if (error.status !== 401) console.warn('Account connection unavailable.') }
  const link = document.querySelector('[data-account-link]')
  if (link && currentAccount) { link.href = '/account/'; link.textContent = 'My account' }
  if (currentAccount) document.querySelectorAll('[data-auth-nav]').forEach(link => { link.hidden = true })
}
export function initAccountPage() {
  const form = document.querySelector('[data-account-form]')
  const message = document.querySelector('[data-account-message]')
  prepareTextFields(form)
  const password = form.elements.password
  const toggle = document.querySelector('[data-toggle-password]')
  const next = new URLSearchParams(location.search).get('next') === 'checkout' ? '/checkout/' : '/account/'
  const token = new URLSearchParams(location.hash.slice(1)).get('verify')
  if (token) {
    history.replaceState(null, '', location.pathname + location.search)
    const panel = document.querySelector('[data-email-confirmation]')
    form.hidden = true
    panel.hidden = false
    const confirm = panel.querySelector('button')
    confirm.addEventListener('click', async () => {
      confirm.disabled = true
      message.textContent = 'Confirming your email…'
      try {
        await jsonRequest('account/verify-email', { token })
        message.textContent = 'Email confirmed. You can now log in.'
      } catch (error) { message.textContent = error.message }
      panel.hidden = true
      form.hidden = false
      form.elements.email.focus()
    }, { once: true })
  }
  if (next === '/checkout/') document.querySelector('[data-account-switch]').search = '?next=checkout'
  toggle.addEventListener('click', () => {
    password.type = password.type === 'password' ? 'text' : 'password'
    toggle.setAttribute('aria-label', password.type === 'text' ? 'Hide password' : 'Show password')
    toggle.setAttribute('aria-pressed', String(password.type === 'text'))
  })
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (!validateTextFields(form)) return
    const submit = form.querySelector('[type=submit]')
    submit.disabled = true
    message.textContent = ''
    try {
      const response = await jsonRequest('account/' + form.dataset.accountForm, { name: form.elements.fullName?.value.trim() || '', email: form.elements.email.value.trim(), password: password.value, over14: form.elements.over14.checked })
      password.value = ''
      if (response.verification_required) { message.textContent = response.message; return }
      location.assign(next)
    } catch (error) { message.textContent = error.message }
    finally { submit.disabled = false }
  })
}
export async function initMyAccount(root) {
  const message = root.querySelector('[data-account-status]')
  if (!currentAccount) { message.textContent = 'Sign in to see your orders.'; root.querySelector('[data-account-login]').hidden = false; return }
  root.querySelector('[data-account-name]').textContent = currentAccount.name
  root.querySelector('[data-account-email]').textContent = currentAccount.email
  root.querySelector('[data-account-controls]').hidden = false
  async function refresh() {
    try {
      const { orders } = await request('account/orders')
      root.querySelector('[data-customer-orders]').replaceChildren(...orders.map(order => renderOrder(order)))
      message.textContent = orders.length ? 'Your latest order updates are shown below.' : 'No orders yet. Checkout while signed in to see your orders here.'
    } catch (error) { message.textContent = error.message }
  }
  root.querySelector('[data-refresh-orders]').addEventListener('click', refresh)
  root.querySelector('[data-signout]').addEventListener('click', async () => {
    try { await jsonRequest('account/logout', {}); location.assign('/login/') }
    catch (error) { message.textContent = error.message }
  })
  const interval = setInterval(() => { if (!document.hidden) refresh() }, 30000)
  window.addEventListener('pagehide', () => clearInterval(interval), { once: true })
  await refresh()
}
