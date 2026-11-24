import { productById, productUrl } from './catalog.js'

export const campaigns = [
  { id: 'chataka', title: ['Big on', 'chatpata.'], description: 'Tangy masala. A little heat. A whole lot of crunch.' },
  { id: 'cream', title: ['Take it', 'creamy.'], description: 'Your mellow moment, with a savoury onion finish.' },
  { id: 'peri', title: ['Turn up', 'the crunch.'], description: 'A fiery, zesty bite for your snack-time cravings.' },
  { id: 'salt', title: ['Keep it', 'light.'], description: 'A simple crunch with a touch of Himalayan pink salt.' },
]

export function heroCarousel() {
  return `<section class="campaign-hero" data-hero-carousel data-active="chataka" role="region" aria-roledescription="carousel" aria-label="Discover PanPops flavours" tabindex="0">
    <div class="campaign-track" id="hero-campaign-track" data-hero-track>
      ${campaigns.map((campaign, index) => {
        const product = productById[campaign.id]
        return `<article class="campaign-slide campaign-${campaign.id}" data-hero-slide role="group" aria-roledescription="slide" aria-label="${index + 1} of 4: ${product.name}" ${index ? 'aria-hidden="true" inert' : ''}>
          <img class="campaign-scene" src="/media/hero/${campaign.id}-campaign.jpg" width="1852" height="848" alt="${product.name} PanPops pouch with roasted makhana and flavour ingredients" ${index ? 'loading="lazy"' : 'fetchpriority="high"'}>
          <div class="campaign-copy"><p class="campaign-eyebrow">${product.name}</p><h2>${campaign.title.join('<br>')}</h2><p class="campaign-description">${campaign.description}</p><a class="campaign-shop" href="${productUrl(product)}">Shop ${product.name}</a></div>
        </article>`
      }).join('')}
    </div>
    <div class="campaign-controls" data-hero-controls hidden>
      <div class="campaign-direction"><button type="button" data-hero-step="-1" aria-label="Previous banner">Prev</button><span aria-hidden="true">/</span><button type="button" data-hero-step="1" aria-label="Next banner">Next</button></div>
      <div class="campaign-dots" aria-label="Choose a flavour banner">${campaigns.map((campaign, index) => `<button type="button" data-hero-dot="${index}" aria-label="Show ${productById[campaign.id].name} banner" aria-current="${index === 0}"><span></span></button>`).join('')}</div>
      <button class="campaign-pause" type="button" data-hero-pause aria-label="Pause banner rotation">Pause</button>
    </div>
    <p class="campaign-announcement" data-hero-announcement aria-live="polite" aria-atomic="true"></p>
  </section>`
}

export function initHeroCarousel(root) {
  const track = root.querySelector('[data-hero-track]')
  const slides = [...track.querySelectorAll('[data-hero-slide]')]
  const dots = [...root.querySelectorAll('[data-hero-dot]')]
  const pause = root.querySelector('[data-hero-pause]')
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let active = 0
  let position = 1
  let busy = false
  let userPaused = motion.matches
  let focused = false
  let visible = true
  let timer
  let transitionTimer
  let pointer

  for (const [slide, prepend] of [[slides.at(-1), true], [slides[0], false]]) {
    const clone = slide.cloneNode(true)
    clone.inert = true
    clone.setAttribute('aria-hidden', 'true')
    if (prepend) track.prepend(clone)
    else track.append(clone)
  }
  function snap() {
    track.style.transition = 'none'
    track.style.transform = `translateX(${-position * 100}%)`
    // Flush the snap so the next deliberate movement starts from this position.
    void track.offsetWidth
    track.style.transition = ''
  }
  function schedule() {
    clearTimeout(timer)
    pause.textContent = userPaused ? 'Play' : 'Pause'
    pause.setAttribute('aria-label', userPaused ? 'Start banner rotation' : 'Pause banner rotation')
    if (!userPaused && !focused && visible && !document.hidden) timer = setTimeout(() => go(1, true), 5000)
  }
  function complete() {
    clearTimeout(transitionTimer)
    if (position === 0) { position = slides.length; snap() }
    if (position === slides.length + 1) { position = 1; snap() }
    busy = false
    schedule()
  }
  function go(delta, automatic = false) {
    if (busy || !delta) return
    position += delta
    active = (position - 1 + slides.length) % slides.length
    root.dataset.active = campaigns[active].id
    slides.forEach((slide, index) => {
      slide.inert = index !== active
      slide.setAttribute('aria-hidden', String(index !== active))
    })
    dots.forEach((dot, index) => dot.setAttribute('aria-current', String(index === active)))
    if (!automatic) root.querySelector('[data-hero-announcement]').textContent = `${active + 1} of 4: ${productById[campaigns[active].id].name}`
    busy = true
    track.style.transform = `translateX(${-position * 100}%)`
    if (motion.matches) complete()
    else transitionTimer = setTimeout(complete, 650)
    schedule()
  }
  track.addEventListener('transitionend', event => { if (event.target === track && event.propertyName === 'transform') complete() })
  root.querySelectorAll('[data-hero-step]').forEach(button => button.addEventListener('click', () => go(Number(button.dataset.heroStep))))
  dots.forEach((dot, index) => dot.addEventListener('click', () => go(index - active)))
  pause.addEventListener('click', () => { userPaused = !userPaused; if (!userPaused) focused = false; schedule() })
  // Mouse/touch navigation restarts the interval. Only keyboard focus pauses it
  // so a link cannot move away while someone is tabbing through the hero.
  root.addEventListener('focusin', event => { focused = event.target.matches(':focus-visible'); schedule() })
  root.addEventListener('focusout', event => { focused = !!event.relatedTarget && root.contains(event.relatedTarget) && event.relatedTarget.matches(':focus-visible'); schedule() })
  root.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    go(event.key === 'ArrowRight' ? 1 : -1)
  })
  root.addEventListener('pointerdown', event => { if (event.button === 0 && !event.target.closest('button,a')) pointer = { x: event.clientX, y: event.clientY } })
  root.addEventListener('pointerup', event => {
    if (!pointer) return
    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y
    pointer = null
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
  })
  root.addEventListener('pointercancel', () => { pointer = null })
  motion.addEventListener('change', () => { userPaused = motion.matches; complete() })
  document.addEventListener('visibilitychange', schedule)
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule() }).observe(root)
  window.addEventListener('pagehide', () => { clearTimeout(timer); clearTimeout(transitionTimer) })
  window.addEventListener('pageshow', schedule)
  snap()
  root.querySelector('[data-hero-controls]').hidden = false
  schedule()
}
