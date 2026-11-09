import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { renderPage } from './src/templates.js'

const routes = {
  '/index.html': ['home', 'Pick your crunch'],
  '/cart/index.html': ['cart', 'Your cart'],
  '/checkout/index.html': ['checkout', 'Checkout'],
  '/login/index.html': ['login', 'Login'],
  '/admin/index.html': ['admin', 'Prices & orders'],
  '/register/index.html': ['register', 'Create an account'],
}

export default defineConfig({
  appType: 'mpa',
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  input: Object.keys(routes).map(path => resolve(import.meta.dirname, '.' + path)),
  plugins: [{
    name: 'panpops-page-template',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        const path = context.filename.slice(import.meta.dirname.length)
        const [page, title] = routes[path] ?? routes['/index.html']
        return html.replace('<!-- CONTENT -->', () => renderPage(page))
          .replace('<title>Pick your crunch · PanPops</title>', '<title>' + title + ' · PanPops</title>')
          .replace('<body>', '<body data-page="' + page + '">')
      },
    },
  }],
})
