import { getCart } from './cart.js'
import { front, productById } from './catalog.js'

export function initBoxInspector() {
  const dialog = document.querySelector('[data-box-dialog]')
  let trigger
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-inspect-box]')
    if (!button) return
    const line = getCart().find(line => line.key === button.dataset.inspectBox && line.type === 'box')
    if (!line) return
    trigger = button
    dialog.querySelector('[data-box-inspector-count]').textContent = line.ids.length + ' pouches · ' + (line.capacity || 4) + '-pouch box'
    const contents = dialog.querySelector('[data-box-inspector-contents]')
    contents.dataset.capacity = line.capacity || 4
    contents.innerHTML = line.ids.map(id => '<img width="680" height="925" src="' + front(productById[id]) + '" alt="' + productById[id].name + ' pouch">').join('')
    dialog.showModal()
  })
  dialog.querySelector('[data-close-box]').addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
  dialog.addEventListener('close', () => trigger?.focus({ preventScroll: true }))
}
