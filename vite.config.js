import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { products } from './src/catalog.js'
import { renderPage } from './src/templates.js'

const routes = {
  '/index.html': ['home', 'Pick your crunch'],
  '/shop/index.html': ['shop', 'Shop'],
  '/build-a-box/index.html': ['box', 'Build a box'],
  '/cart/index.html': ['cart', 'Your cart'],
}
for (const product of products) {
  routes['/shop/' + product.slug + '/index.html'] = ['product', product.name, product]
}

export default defineConfig({
  appType: 'mpa',
  input: Object.keys(routes).map(path => resolve(import.meta.dirname, '.' + path)),
  plugins: [{
    name: 'panpops-page-templates',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        const route = context.filename.slice(import.meta.dirname.length)
        const [page, title, product] = routes[route] ?? routes['/index.html']
        return html.replace('@@TITLE@@', title)
          .replace('@@PAGE@@', page)
          .replace('<!-- CONTENT -->', () => renderPage(page, product))
      },
    },
  }],
})
