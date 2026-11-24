// Run: node checks/photo-orbit.mjs
import assert from 'node:assert/strict'
import { createPhotoOrbit } from '../src/photo-orbit.js'

const listeners = new Map()
globalThis.document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
globalThis.window = { addEventListener() {}, removeEventListener() {} }
globalThis.cancelAnimationFrame = () => {}
let visibility, report
const originalInterval = globalThis.setInterval
const originalClear = globalThis.clearInterval
globalThis.setInterval = fn => { report = fn; return 1 }
globalThis.clearInterval = () => { report = undefined }
globalThis.IntersectionObserver = class {
  constructor(fn) { visibility = fn }
  observe() {} unobserve() {} disconnect() {}
}
globalThis.ResizeObserver = class { observe() {} disconnect() {} }
const animations = []
const images = Array.from({ length: 4 }, () => ({ animate(frames, options) {
  assert.equal(options.iterations, Infinity)
  assert.equal(frames.length, 121)
  const animation = { currentTime: 0, play() { this.playing = true }, pause() { this.playing = false }, cancel() { this.cancelled = true } }
  animations.push(animation)
  return animation
} }))
let active
const orbit = createPhotoOrbit({ dataset: {}, clientWidth: 360, clientHeight: 480 }, images, index => { active = index })
visibility([{ isIntersecting: true }])
assert.ok(animations.every(a => a.playing))
orbit.select(3, -1, true)
assert.ok(animations.every(a => a.currentTime === 18000), 'Previous wraps without negative animation time')
report()
assert.equal(active, 3)
orbit.setMotion(false)
assert.ok(animations.every(a => !a.playing), 'Reduced motion pauses all packets')
orbit.select(0, 1, true)
report()
assert.equal(active, 0)
orbit.setMotion(true)
document.hidden = true
listeners.get('visibilitychange')()
assert.ok(animations.every(a => !a.playing), 'Hidden tabs pause')
orbit.dispose()
assert.ok(animations.every(a => a.cancelled))
assert.equal(report, undefined)
globalThis.setInterval = originalInterval
globalThis.clearInterval = originalClear
console.log('Photo orbit checks passed')
