import { prepareTextFields, validateTextFields } from './forms.js'

const SESSION_KEY = 'panpops-preview-account-v1'

export function getPreviewAccount() {
  try {
    const account = JSON.parse(sessionStorage.getItem(SESSION_KEY))
    if (account?.over14 === true && typeof account.email === 'string' && typeof account.name === 'string') return account
  } catch {}
  return null
}

export function initAccountPage(notify) {
  const form = document.querySelector('[data-account-form]')
  const message = document.querySelector('[data-account-message]')
  prepareTextFields(form)
  const password = form.elements.password
  const toggle = document.querySelector('[data-toggle-password]')
  const destination = new URLSearchParams(location.search).get('next')
  const next = destination === 'checkout' ? '/checkout/' : '/cart/'
  const switchLink = document.querySelector('[data-account-switch]')
  if (destination === 'checkout') switchLink.search = '?next=checkout'

  toggle.addEventListener('click', () => {
    const show = password.type === 'password'
    password.type = show ? 'text' : 'password'
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password')
    toggle.setAttribute('aria-pressed', String(show))
  })
  form.addEventListener('invalid', event => {
    message.textContent = event.target.name === 'over14'
      ? 'Please confirm you are over 14 to place an order yourself.'
      : 'Please complete the highlighted field.'
  }, true)

  form.addEventListener('submit', event => {
    event.preventDefault()
    if (!validateTextFields(form)) return
    const account = {
      name: form.elements.fullName?.value.trim() || 'PanPops guest',
      email: form.elements.email.value.trim(),
      over14: form.elements.over14.checked,
    }
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(account)) }
    catch { notify('Your browser blocked saving the preview login. You can continue as a guest.') }
    password.value = ''
    location.assign(next)
  })
}
