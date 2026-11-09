export function prepareTextFields(form) {
  form.addEventListener('input', event => {
    if (event.target instanceof HTMLInputElement) event.target.setCustomValidity('')
  })
}

export function validateTextFields(form) {
  for (const input of form.querySelectorAll('input[required]')) {
    if (['checkbox', 'password'].includes(input.type)) continue
    input.value = input.value.trim()
    input.setCustomValidity(input.value ? '' : 'Please enter a value.')
  }
  return form.reportValidity()
}
