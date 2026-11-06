import { defineConfig } from 'vite'
import { renderPage } from './src/templates.js'

export default defineConfig({
  appType: 'mpa',
  plugins: [{
    name: 'panpops-page-template',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replace('<!-- CONTENT -->', () => renderPage()),
    },
  }],
})
