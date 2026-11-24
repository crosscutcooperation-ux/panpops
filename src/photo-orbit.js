// Keep the supplied packet photographs facing the shopper as they orbit.
// Continuous movement runs through Web Animations; JS only scrubs a swipe.
export function createPhotoOrbit(stage, images, onActive) {
  const duration = 24000
  const turn = Math.PI * 2
  let animations = []
  let playing = true
  let visible = false
  let selecting = false
  let request = 0
  let disposed = false
  stage.dataset.photoOrbit = ''

  const time = () => Number(animations[0]?.currentTime ?? 0)
  function syncPlayback() {
    for (const animation of animations) {
      if (playing && visible && !document.hidden && !selecting) animation.play()
      else animation.pause()
    }
  }
  function drawFrames() {
    const current = time()
    animations.forEach(animation => animation.cancel())
    const radius = Math.min(stage.clientWidth * .32, 420)
    const rise = Math.min(stage.clientHeight * .16, 85)
    animations = images.map((image, index) => {
      const frames = Array.from({ length: 121 }, (_, step) => {
        const angle = (index / images.length - step / 120) * turn
        const depth = Math.cos(angle)
        return {
          transform: `translate(-50%,-50%) translate3d(${Math.sin(angle) * radius}px,${depth * rise}px,${depth * 100}px) scale(${.68 + depth * .23}) rotate(${-Math.sin(angle) * 9}deg)`,
        }
      })
      const animation = image.animate(frames, { duration, iterations: Infinity, easing: 'linear' })
      animation.currentTime = current
      return animation
    })
    syncPlayback()
  }
  function reportActive() {
    if (selecting || !visible || document.hidden) return
    const phase = ((time() % duration) + duration) % duration
    onActive(Math.round(phase / duration * images.length) % images.length)
  }
  const timer = setInterval(reportActive, 200)
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    syncPlayback()
  })
  visibility.observe(stage)
  const resize = new ResizeObserver(drawFrames)
  resize.observe(stage)
  document.addEventListener('visibilitychange', syncPlayback)
  const stop = () => { visible = false; syncPlayback() }
  const resume = () => { visibility.unobserve(stage); visibility.observe(stage) }
  window.addEventListener('pagehide', stop)
  window.addEventListener('pageshow', resume)
  drawFrames()

  return {
    select(index, direction = 1, immediate = false) {
      cancelAnimationFrame(request)
      const from = time()
      const cycle = Math.floor(from / duration)
      let target = cycle * duration + index / images.length * duration
      if (direction > 0 && target < from) target += duration
      if (direction < 0 && target > from) target -= duration
      // WAAPI clamps negative times before the first iteration.
      const shift = Math.min(from, target) < 0 ? duration : 0
      const start = from + shift
      target += shift
      if (immediate || !playing) {
        animations.forEach(animation => { animation.currentTime = target })
        selecting = false
        syncPlayback()
        return
      }
      selecting = true
      syncPlayback()
      const started = performance.now()
      function step(now) {
        if (disposed) return
        const progress = Math.min(1, (now - started) / 700)
        const eased = 1 - (1 - progress) ** 3
        animations.forEach(animation => { animation.currentTime = start + (target - start) * eased })
        if (progress < 1) request = requestAnimationFrame(step)
        else { selecting = false; syncPlayback(); reportActive() }
      }
      request = requestAnimationFrame(step)
    },
    setMotion(value) {
      playing = value
      if (!value) { cancelAnimationFrame(request); selecting = false }
      syncPlayback()
    },
    pick() { return null },
    dispose() {
      disposed = true
      clearInterval(timer)
      cancelAnimationFrame(request)
      animations.forEach(animation => animation.cancel())
      resize.disconnect()
      visibility.disconnect()
      document.removeEventListener('visibilitychange', syncPlayback)
      window.removeEventListener('pagehide', stop)
      window.removeEventListener('pageshow', resume)
    },
  }
}
