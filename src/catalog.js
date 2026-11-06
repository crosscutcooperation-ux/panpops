export const products = [
  { id: 'chataka', slug: 'chataka-pataka', name: 'Chataka Pataka', note: 'Tangy masala', description: 'A bold, tangy masala crunch with a lively kick.', accent: '#a23828', stage: '#5c231d', light: '#bf5840', pack: '#962c2c' },
  { id: 'cream', slug: 'cream-and-onion', name: 'Cream & Onion', note: 'Creamy & savoury', description: 'A mellow, creamy crunch with a savoury onion finish.', accent: '#41633e', stage: '#273d29', light: '#6d8759', pack: '#37613b' },
  { id: 'peri', slug: 'peri-peri', name: 'Peri Peri', note: 'Fiery & zesty', description: 'A bright, zesty bite with a fiery finish.', accent: '#ac3226', stage: '#641e18', light: '#d35137', pack: '#e4372d' },
  { id: 'salt', slug: 'himalayan-pink-salt', name: 'Himalayan Pink Salt', note: 'Light & salty', description: 'A light, crisp bite with a touch of pink salt.', accent: '#935056', stage: '#59373f', light: '#b97077', pack: '#c96c72' },
].map(product => ({ ...product, price: 180, weight: 50 }))

export const productById = Object.fromEntries(products.map(product => [product.id, product]))
export const money = amount => '₹' + amount.toLocaleString('en-IN')
export const productUrl = product => '/shop/' + product.slug + '/'
export const front = product => '/media/' + product.id + '.webp'
export const back = product => '/media/' + product.id + '-back.webp'
export const MIN_BOX = 2
export const MAX_BOX = 4
