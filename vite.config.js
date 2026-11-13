import { defineConfig } from 'vite'
import { renderPage } from './src/templates.js'

export default defineConfig({
  appType: 'mpa',
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
  plugins: [{
    name: 'panpops-page-template',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replace('<!-- CONTENT -->', () => renderPage()),
    },
  }],
})
