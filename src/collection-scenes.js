import * as T from 'three'
import { products, back, MAX_BOX } from './catalog.js'

const TAU = Math.PI * 2
const mix = T.MathUtils.lerp
const ease = t => 1 - (1 - t) ** 3
const textureLoader = new T.TextureLoader()

function studio(host, canvas, context, options = {}) {
  const renderer = new T.WebGLRenderer({ canvas, context, alpha: true, antialias: true })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65))
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.NeutralToneMapping
  const world = new T.Scene()
  const camera = new T.OrthographicCamera(-2, 2, 1.5, -1.5, .1, 40)
  camera.position.set(0, options.cameraY ?? .48, 8)
  camera.lookAt(0, options.lookY ?? 0, 0)

  const fill = new T.HemisphereLight('#fff2de', '#b68677', 1.5)
  const key = new T.DirectionalLight('#fff3df', 2.0)
  key.position.set(-2.8, 4.5, 5.5)
  const rim = new T.DirectionalLight('#ffd7ae', 1.9)
  rim.position.set(3.5, 2.8, -3)
  world.add(fill, key, rim)

  let request = 0
  let disposed = false
  let viewportWidth = 0
  let renderFrame = () => false
  let onResize = () => {}

  function invalidate() {
    if (request || disposed) return
    request = requestAnimationFrame(now => {
      request = 0
      const active = renderFrame(now)
      renderer.render(world, camera)
      if (active) invalidate()
    })
  }

  function resize() {
    if (disposed) return
    const width = host.clientWidth
    const height = host.clientHeight
    if (!width || !height) return
    const aspect = width / height
    const viewHeight = Math.max(options.height ?? 3.0, (options.minWidth ?? 2.6) / aspect)
    viewportWidth = viewHeight * aspect
    camera.left = -viewportWidth / 2
    camera.right = viewportWidth / 2
    camera.top = viewHeight / 2
    camera.bottom = -viewHeight / 2
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    onResize()
    invalidate()
  }

  const resizeObserver = new ResizeObserver(resize)
  host.replaceChildren(canvas)
  resizeObserver.observe(host)
  resize()

  return {
    world, camera, key, rim, invalidate,
    get width() { return viewportWidth },
    animate(fn) { renderFrame = fn; invalidate() },
    onResize(fn) { onResize = fn },
    dispose() {
      disposed = true
      resizeObserver.disconnect()
      cancelAnimationFrame(request)
      const geometries = new Set()
      const materials = new Set()
      const textures = new Set()
      world.traverse(object => {
        if (object.geometry) geometries.add(object.geometry)
        if (object.material) {
          for (const material of [object.material].flat()) {
            materials.add(material)
            for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
          }
        }
      })
      textures.forEach(texture => texture.dispose())
      materials.forEach(material => material.dispose())
      geometries.forEach(geometry => geometry.dispose())
      renderer.dispose()
    },
  }
}

function pouchGeometry(face) {
  const positions = [], uv = [], indices = []
  const columns = 38
  const rows = 46
  for (let row = 0; row <= rows; row++) {
    const v = row / rows
    for (let col = 0; col <= columns; col++) {
      const u = col / columns
      const h = u * 2 - 1
      const corner = Math.abs(h) ** 8 * (.035 * Math.exp(-v * 42) - .022 * Math.exp(-(1 - v) * 55))
      const halfWidth = .633 + .091 * v - Math.abs(corner) * .32
      const taper = Math.sqrt(Math.max(0, 1 - h * h))
      const body = Math.sin(Math.PI * v) ** .56
      const seal = Math.exp(-((v - .918) ** 2) * 2950) * .018
      const crease = (Math.sin(u * 32 + v * 9) + .48 * Math.sin(u * 57 - v * 9)) * .009
      const puff = .252 * taper * body + (crease + seal) * taper * body
      positions.push(h * halfWidth, (v - .5) * 2.02 + corner, face * puff)
      uv.push(face === 1 ? u : 1 - u, v)
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const i = row * (columns + 1) + col
      const j = i + columns + 1
      if (face === 1) indices.push(i, i + 1, j, i + 1, j + 1, j)
      else indices.push(i, j, i + 1, i + 1, j, j + 1)
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

async function pack(product) {
  const [frontTexture, backTexture] = await Promise.all([
    textureLoader.loadAsync('/media/' + product.id + '-texture.webp'),
    textureLoader.loadAsync(back(product)),
  ])
  const group = new T.Group()
  for (const [index, map] of [frontTexture, backTexture].entries()) {
    map.colorSpace = T.SRGBColorSpace
    map.anisotropy = 6
    const material = new T.MeshPhysicalMaterial({
      map, roughness: .67, metalness: .04, clearcoat: .22, clearcoatRoughness: .65,
    })
    group.add(new T.Mesh(pouchGeometry(index === 0 ? 1 : -1), material))
  }
  return group
}

function pedestal(radius, product) {
  const root = new T.Group()
  const material = new T.MeshStandardMaterial({ color: product.stage, roughness: .73, metalness: .1 })
  const top = new T.MeshStandardMaterial({ color: product.light, roughness: .68, metalness: .12 })
  root.add(new T.Mesh(new T.CylinderGeometry(radius * 1.035, radius, .15, 72), [material, top, material]))
  const edge = new T.Mesh(new T.TorusGeometry(radius, .012, 8, 72), new T.MeshStandardMaterial({
    color: '#f2cca2', roughness: .7, metalness: .12,
  }))
  edge.rotation.x = -Math.PI / 2
  edge.position.y = .045
  root.add(edge)
  return {
    root,
    theme(next) { material.color.set(next.stage); top.color.set(next.light) },
  }
}

function seedGeometry() {
  const shape = new T.IcosahedronGeometry(1, 3)
  const position = shape.attributes.position
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index)
    const y = position.getY(index)
    const z = position.getZ(index)
    const variation = 1 + .10 * Math.sin(x * 8 + y * 5) + .074 * Math.cos(z * 11 - x * 8) + .035 * Math.sin(y * 23 + z * 19)
    position.setXYZ(index, x * variation, y * .84 * variation, z * .91 * variation)
  }
  shape.computeVertexNormals()
  return shape
}

function seedMaterials() {
  return ['#fae1ab', '#edc489', '#f5d5a0', '#dfab72'].map(color =>
    new T.MeshStandardMaterial({ color, roughness: .87 })
  )
}

function scatteredSeeds(group, geometry, materials, positions) {
  positions.forEach(([x, y, z, size], index) => {
    const seed = new T.Mesh(geometry, materials[index % materials.length])
    seed.position.set(x, y, z)
    seed.rotation.set(index * .6, index * 1.4, index * .76)
    seed.scale.setScalar(size)
    group.add(seed)
  })
}

function stageSeeds(group) {
  scatteredSeeds(group, seedGeometry(), seedMaterials(), [
    [-1.04,-.96,.35,.087],[-.9,-.97,.55,.061],[-.73,-1,.67,.062],[-1.14,-.98,.1,.052],
    [.95,-.98,.33,.085],[.75,-.98,.64,.058],[1.04,-.97,.17,.047],[1.12,-.94,.31,.045],
  ])
}

function onionProps(world) {
  const inner = new T.MeshStandardMaterial({ color: '#eee3bd', roughness: .74 })
  const edge = new T.MeshStandardMaterial({ color: '#af809c', roughness: .7 })
  for (const [index, side] of [-1, 1, -1, 1].entries()) {
    const curve = new T.CatmullRomCurve3(Array.from({ length: 24 }, (_, point) => {
      const angle = point / 23 * Math.PI * 1.35 + .18
      const size = .21 + index * .033
      return new T.Vector3(Math.cos(angle) * size, Math.sin(angle) * size * .78, Math.sin(angle * .8) * .06)
    }))
    const ribbon = new T.Mesh(new T.TubeGeometry(curve, 30, .018, 6, false), index % 2 ? inner : edge)
    ribbon.position.set(side * (.9 + (index % 3) * .1), -.79 + index * .07, .24 - index * .045)
    ribbon.rotation.set(-.4 + index * .16, side * .28, side * .42)
    ribbon.scale.set(1.03, 1.38, 1)
    world.add(ribbon)
  }
}

function saltProps(world) {
  const geometry = new T.IcosahedronGeometry(1, 0)
  const colors = ['#f6dfcf', '#eeb3aa', '#ffd7d0'].map(color => new T.MeshStandardMaterial({ color, roughness: .8, flatShading: true }))
  for (let i = 0; i < 22; i++) {
    const stone = new T.Mesh(geometry, colors[i % colors.length])
    const side = i % 2 === 0 ? -1 : 1
    stone.position.set(side * (.69 + (i % 7) * .065), -1.01 + (i % 3) * .035, .24 + (i % 8) * .058)
    stone.rotation.set(i * .67, i * .33, i * .15)
    stone.scale.setScalar(.028 + (i % 5) * .013)
    world.add(stone)
  }
}

function popEffect(world) {
  const geometry = seedGeometry()
  const material = seedMaterials()
  const dust = new T.MeshStandardMaterial({ color: '#e88643', roughness: .95 })
  const group = new T.Group()
  group.visible = false
  const particles = Array.from({ length: 58 }, (_, i) => {
    const crumb = i > 19
    const mesh = new T.Mesh(geometry, crumb ? dust : material[i % material.length])
    const angle = i * 2.39996
    const reach = .6 + (i % 9) * .082
    group.add(mesh)
    return { mesh, angle, reach, scale: crumb ? .012 + i % 4 * .004 : .054 + i % 6 * .008, delay: (i % 7) * .021 }
  })
  world.add(group)
  return function draw(t) {
    group.visible = t >= 0 && t < 1
    if (!group.visible) return
    for (const { mesh, angle, reach, scale, delay } of particles) {
      const life = T.MathUtils.clamp((t - delay) / (1 - delay), 0, 1)
      const wave = angle + life * 2.5
      const distance = ease(life) * reach
      mesh.position.set(Math.cos(wave) * distance * 1.23, .43 + Math.sin(wave) * distance * .62 + Math.sin(life * Math.PI) * .41 - life * life * .8, .46 + Math.sin(wave) * .27)
      mesh.rotation.set(life * 6 + angle, life * 5, angle + life * 3)
      mesh.scale.setScalar(scale * Math.min(1, life * 19) * (1 - life ** 3))
    }
  }
}

export async function createProduct(host, canvas, context, product) {
  const pouch = await pack(product)
  const scene = studio(host, canvas, context, { height: 2.93, minWidth: 2.72 })
  const deck = pedestal(product.id === 'salt' ? 1.03 : 1.12, product.id === 'salt'
    ? { stage: '#be9992', light: '#f5d4c8' } : product)
  deck.root.position.y = -1.02
  pouch.position.y = .077
  scene.world.add(deck.root, pouch)
  if (product.id === 'cream') onionProps(scene.world)
  else if (product.id === 'salt') saltProps(scene.world)
  else stageSeeds(scene.world)
  if (product.id === 'peri') scene.rim.color.set('#ef6350')
  const drawPop = product.id === 'chataka' ? popEffect(scene.world) : () => {}

  let yaw = -.09
  let pitch = -.035
  let targetYaw = yaw
  let targetPitch = pitch
  let dragYaw = yaw
  let dragPitch = pitch
  let poppedAt = 0
  let playing = true
  let dragging = false
  let resumeAt = 0
  let lastFrame = performance.now()

  scene.animate(now => {
    const delta = Math.min((now - lastFrame) / 1000, .06)
    lastFrame = now
    const spinning = playing && !dragging && now >= resumeAt && !document.hidden
    if (spinning) targetYaw += delta * TAU / 26
    const rotationActive = Math.abs(targetYaw - yaw) > .002 || Math.abs(targetPitch - pitch) > .002
    yaw = rotationActive ? mix(yaw, targetYaw, .19) : targetYaw
    pitch = rotationActive ? mix(pitch, targetPitch, .19) : targetPitch
    const popTime = poppedAt ? (now - poppedAt) / 1080 : -1
    drawPop(popTime)
    const bounce = popTime >= 0 && popTime < 1 ? Math.sin(popTime * Math.PI * 3) * (1 - popTime) : 0
    pouch.rotation.set(pitch, yaw, -.035 - bounce * .075)
    pouch.position.y = .077 + bounce * .14
    if (popTime >= 1) poppedAt = 0
    return playing || rotationActive || !!poppedAt
  })

  return {
    flip(reversed, immediate = false) {
      const wanted = reversed ? Math.PI : -.09
      targetYaw = wanted + Math.round((yaw - wanted) / TAU) * TAU
      targetPitch = -.035
      if (immediate) { yaw = targetYaw; pitch = targetPitch }
      resumeAt = reversed ? Infinity : performance.now() + (immediate ? 1800 : 3500)
      scene.invalidate()
    },
    setMotion(value) {
      playing = value
      if (value) resumeAt = 0
      lastFrame = performance.now()
      scene.invalidate()
    },
    startDrag() { dragging = true; dragYaw = yaw; dragPitch = pitch },
    drag(dx, dy) {
      targetYaw = dragYaw + dx * .014
      targetPitch = T.MathUtils.clamp(dragPitch + dy * .008, -.6, .6)
      scene.invalidate()
    },
    endDrag() { dragging = false; resumeAt = performance.now() + 2200; scene.invalidate() },
    pop() { poppedAt = performance.now(); scene.invalidate() },
    dispose: scene.dispose,
  }
}

export async function createTurntable(host, canvas, context) {
  const pouches = await Promise.all(products.map(pack))
  const scene = studio(host, canvas, context, { height: 3.35, minWidth: 4.8, cameraY: .12 })
  scene.world.add(...pouches)
  pouches.forEach((pouch, index) => { pouch.userData.productIndex = index })
  let active = 0
  let playing = true
  let inView = true
  let phase = 0
  let previousTime = 0
  let started = 0
  let origin = []
  let destination = []
  const pointer = new T.Vector2()
  const follow = new T.Vector2()
  const raycaster = new T.Raycaster()

  function layout() {
    const compact = host.clientWidth < 600
    const side = Math.min(3.45, scene.width * (compact ? .35 : .31))
    return pouches.map((_, index) => {
      switch ((index - active + pouches.length) % pouches.length) {
        case 0: return { x: compact ? -.20 : -.53, y: -.18, z: .65, size: compact ? 1.06 : 1.13, yaw: -.13, roll: -.07 }
        case 1: return { x: side, y: compact ? -.05 : .08, z: -.25, size: compact ? .66 : .83, yaw: -.30, roll: -.19 }
        case 2: return { x: compact ? .48 : .83, y: compact ? 1.04 : .65, z: -.9, size: compact ? .56 : .62, yaw: .25, roll: .12 }
        default: return { x: -side, y: compact ? .12 : -.02, z: -.1, size: compact ? .68 : .86, yaw: .31, roll: .19 }
      }
    })
  }

  let poses = layout()
  function draw() {
    pouches.forEach((pouch, index) => {
      const pose = poses[index]
      const wave = phase * .95 + index * 1.65
      pouch.position.set(pose.x + Math.sin(wave * .7) * .065 + follow.x * (.05 + pose.size * .055),
        pose.y + Math.sin(wave) * .105 + follow.y * .035, pose.z + Math.cos(wave * .6) * .055)
      pouch.rotation.set(Math.sin(wave * .8) * .045, pose.yaw + Math.sin(wave * .7) * .14 + follow.x * .08,
        pose.roll + Math.sin(wave * .85) * .045)
      pouch.scale.setScalar(pose.size)
    })
  }

  function select(next, direction = 1, immediate = false) {
    active = next
    destination = layout()
    if (immediate) {
      started = 0
      poses = destination
      draw()
    } else {
      origin = poses.map(pose => ({ ...pose }))
      started = performance.now()
    }
    scene.invalidate()
  }

  scene.onResize(() => select(active, 1, true))
  scene.animate(now => {
    const dt = previousTime ? Math.min((now - previousTime) / 1000, .05) : 0
    previousTime = now
    if (playing && inView) phase += dt
    follow.lerp(pointer, .045)
    if (started) {
      const progress = Math.min(1, (now - started) / 900)
      const t = ease(progress)
      poses = origin.map((from, index) => {
        const to = destination[index]
        return Object.fromEntries(Object.keys(from).map(key => [key, mix(from[key], to[key], t) +
          (key === 'y' ? Math.sin(progress * Math.PI) * (index === active ? .20 : -.10) : 0)]))
      })
      if (progress === 1) started = 0
    }
    draw()
    return inView && (playing || !!started || follow.distanceTo(pointer) > .001)
  })
  const observer = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting
    previousTime = 0
    if (inView) scene.invalidate()
  })
  observer.observe(host)
  function onVisibility() {
    inView = !document.hidden
    previousTime = 0
    if (inView) scene.invalidate()
  }
  document.addEventListener('visibilitychange', onVisibility)
  select(0, 1, true)
  return {
    select,
    setMotion(value) { playing = value; previousTime = 0; scene.invalidate() },
    pointer(x, y) { pointer.set(x, y); scene.invalidate() },
    pick(x, y) {
      raycaster.setFromCamera(new T.Vector2(x, y), scene.camera)
      const hit = raycaster.intersectObjects(pouches, true)[0]
      return hit ? hit.object.parent.userData.productIndex : null
    },
    dispose() {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      scene.dispose()
    },
  }
}


// One renderer for the entire shop avoids a WebGL context per product card.
export async function createShopGallery(grid, host, canvas, context) {
  const models = await Promise.all(products.map(pack))
  const sources = Object.fromEntries(products.map((product, index) => [product.id, models[index]]))
  const renderer = new T.WebGLRenderer({ canvas, context, alpha: true, antialias: true })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35))
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.NeutralToneMapping
  const resources = new T.Scene()
  const library = new T.Group()
  library.visible = false
  library.add(...models)
  resources.add(library)

  const entries = Array.from(grid.querySelectorAll('[data-display]')).map((element, index) => {
    const custom = element.dataset.display === 'box'
    const ids = custom ? products.map(product => product.id) : element.dataset.display.split(',')
    const product = products.find(product => product.id === ids[0])
    const world = new T.Scene()
    const camera = new T.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, .1, 30)
    camera.position.set(0, .6, 7)
    camera.lookAt(0, 0, 0)
    const key = new T.DirectionalLight('#fff3df', 2)
    key.position.set(-3, 4, 5)
    const rim = new T.DirectionalLight('#ffe6bf', 1.4)
    rim.position.set(3, 2, -3)
    world.add(new T.HemisphereLight('#fff2de', '#a28568', 1.65), key, rim)
    const turntable = new T.Group()
    world.add(turntable)
    if (custom) {
      const tray = new T.Group()
      tray.rotation.x = -.42
      tray.position.y = -.1
      turntable.add(tray)
      const cardboard = new T.MeshStandardMaterial({ color: '#b88a5b', roughness: .9 })
      const edge = new T.MeshStandardMaterial({ color: '#e1b98a', roughness: .85 })
      const board = (w, h, d, x, y, z, material) => {
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material)
        mesh.position.set(x, y, z)
        tray.add(mesh)
      }
      board(2, .16, 1.48, 0, -.65, 0, cardboard)
      for (const side of [-1, 1]) {
        board(2.04, .48, .07, 0, -.43, side * .73, edge)
        board(.07, .48, 1.4, side, -.43, 0, edge)
      }
      board(.035, .31, 1.4, 0, -.46, 0, edge)
      ids.forEach((id, i) => {
        const pouch = sources[id].clone()
        pouch.scale.setScalar(.52)
        pouch.rotation.x = -.18
        pouch.position.set(i % 2 ? .49 : -.49, -.04, i < 2 ? -.35 : .35)
        tray.add(pouch)
      })
    } else {
      const deck = pedestal(ids.length === 1 ? .94 : 1.16, product)
      deck.root.position.y = -1.06
      turntable.add(deck.root)
      ids.forEach((id, i) => {
        const pouch = sources[id].clone()
        const scale = [1, .96, .79, .66, .56][ids.length]
        pouch.scale.setScalar(scale)
        pouch.position.set((i - (ids.length - 1) / 2) * (ids.length === 2 ? .88 : .63), -.96 + 1.01 * scale, (i % 2) * .12)
        pouch.rotation.z = ids.length === 1 ? -.025 : (i - (ids.length - 1) / 2) * -.055
        turntable.add(pouch)
      })
    }
    resources.add(world)
    return { element, world, camera, turntable, index, visible: false, x: 0, y: 0, width: 0, height: 0 }
  })
  host.replaceChildren(canvas)
  entries.forEach(entry => { entry.element.dataset.ready = '' })
  let request = 0
  let disposed = false
  let playing = true
  let angle = -.12
  let lastFrame = performance.now()
  let gridHeight = 0

  function draw(now) {
    request = 0
    if (disposed) return
    const delta = Math.min((now - lastFrame) / 1000, .06)
    lastFrame = now
    if (playing && !document.hidden) angle += delta * TAU / 30
    renderer.setScissorTest(false)
    renderer.clear()
    renderer.setScissorTest(true)
    for (const entry of entries) {
      if (!entry.visible || !entry.width || !entry.height) continue
      entry.turntable.rotation.y = angle
      const bottom = gridHeight - entry.y - entry.height
      renderer.setViewport(entry.x, bottom, entry.width, entry.height)
      renderer.setScissor(entry.x, bottom, entry.width, entry.height)
      renderer.render(entry.world, entry.camera)
    }
    if (playing && !document.hidden && entries.some(entry => entry.visible && entry.width)) invalidate()
  }
  function invalidate() {
    if (!request && !disposed) request = requestAnimationFrame(draw)
  }
  function refresh() {
    if (disposed) return
    const bounds = grid.getBoundingClientRect()
    gridHeight = bounds.height
    renderer.setSize(Math.max(1, bounds.width), Math.max(1, bounds.height), false)
    for (const entry of entries) {
      const rect = entry.element.getBoundingClientRect()
      entry.x = rect.left - bounds.left
      entry.y = rect.top - bounds.top
      entry.width = rect.width
      entry.height = rect.height
      const aspect = rect.width / (rect.height || 1)
      const height = Math.max(2.9, 2.65 / (aspect || 1))
      entry.camera.left = -height * aspect / 2
      entry.camera.right = height * aspect / 2
      entry.camera.top = height / 2
      entry.camera.bottom = -height / 2
      entry.camera.updateProjectionMatrix()
    }
    invalidate()
  }
  const intersections = new IntersectionObserver(changes => {
    for (const change of changes) {
      const entry = entries.find(entry => entry.element === change.target)
      entry.visible = change.isIntersecting
    }
    lastFrame = performance.now()
    invalidate()
  }, { rootMargin: '60px' })
  entries.forEach(entry => intersections.observe(entry.element))
  const sizes = new ResizeObserver(refresh)
  sizes.observe(grid)
  const onVisibility = () => { lastFrame = performance.now(); invalidate() }
  document.addEventListener('visibilitychange', onVisibility)
  refresh()
  return {
    refresh,
    setMotion(value) { playing = value; lastFrame = performance.now(); invalidate() },
    dispose() {
      disposed = true
      cancelAnimationFrame(request)
      intersections.disconnect()
      sizes.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      const geometries = new Set(), materials = new Set(), textures = new Set()
      resources.traverse(object => {
        if (object.geometry) geometries.add(object.geometry)
        for (const material of [object.material].flat().filter(Boolean)) {
          materials.add(material)
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
        }
      })
      textures.forEach(texture => texture.dispose())
      materials.forEach(material => material.dispose())
      geometries.forEach(geometry => geometry.dispose())
      renderer.dispose()
      host.replaceChildren()
      entries.forEach(entry => { delete entry.element.dataset.ready })
    },
  }
}

export async function createTray(host, canvas, context) {
  const models = await Promise.all(products.map(pack))
  const scene = studio(host, canvas, context, { height: 3.5, minWidth: 3.7, cameraY: .13 })
  const tray = new T.Group()
  tray.rotation.set(-.52, -.045, -.14)
  tray.position.y = -.12
  scene.world.add(tray)
  const library = new T.Group()
  library.visible = false
  library.add(...models)
  scene.world.add(library)
  const sources = Object.fromEntries(products.map((product, index) => [product.id, models[index]]))
  const base = new T.MeshStandardMaterial({ color: '#bd8a5b', roughness: .96 })
  const wall = new T.MeshStandardMaterial({ color: '#e4b987', roughness: .89 })
  const slotMaterial = new T.MeshStandardMaterial({ color: '#a7734b', roughness: .97 })
  const structure = new T.Group()
  tray.add(structure)
  const lid = new T.Group()
  tray.add(lid)
  let capacity = 4
  let places = []
  let pieces = []
  let closingAt = 0
  let closed = false
  let onClosed
  let logoTexture
  textureLoader.load('/media/logo.png', texture => {
    logoTexture = texture
    texture.colorSpace = T.SRGBColorSpace
    const logo = new T.Mesh(new T.PlaneGeometry(1.25,.37),new T.MeshBasicMaterial({ map:texture,transparent:true,side:T.DoubleSide,depthWrite:false }))
    logo.position.set(0,-1.1,.052)
    lid.add(logo)
    scene.invalidate()
  })
  function board(parent,w,h,d,x,y,z,material) {
    const mesh = new T.Mesh(new T.BoxGeometry(w,h,d),material)
    mesh.position.set(x,y,z)
    parent.add(mesh)
  }
  function setCapacity(next) {
    capacity = next === 6 ? 6 : 4
    structure.children.forEach(mesh => mesh.geometry.dispose())
    structure.clear()
    lid.children.filter(mesh => mesh.userData.board).forEach(mesh => { mesh.geometry.dispose(); lid.remove(mesh) })
    const columns = capacity === 6 ? 3 : 2
    const width = capacity === 6 ? 3.30 : 2.69
    const cell = (width - .18) / columns
    board(structure,width,2.4,.15,0,0,-.09,base)
    for (const side of [-1,1]) {
      board(structure,width,.1,.32,0,side*1.17,.05,wall)
      board(structure,.1,2.23,.32,side*(width/2-.05),0,.05,wall)
    }
    places = Array.from({length:capacity},(_,i)=>new T.Vector3((i%columns-(columns-1)/2)*cell,i<columns?.567:-.567,.135))
    places.forEach(({x,y})=>board(structure,cell-.05,1.066,.018,x,y,-.006,slotMaterial))
    for(let i=1;i<columns;i++) board(structure,.048,2.24,.105,-width/2+.09+i*cell,0,.033,wall)
    board(structure,width-.17,.044,.105,0,0,.032,wall)
    const panel = new T.Mesh(new T.BoxGeometry(width,2.4,.08),wall)
    panel.position.set(0,-1.2,0)
    panel.userData.board=true
    lid.add(panel)
    lid.position.set(0,1.2,.25)
    lid.rotation.x = closed ? 0 : -2.45
    scene.invalidate()
  }
  function setContents(ids, immediate = false) {
    pieces.forEach(piece=>tray.remove(piece.mesh))
    pieces=ids.slice(0,capacity).map((id,index)=>{
      const mesh=sources[id].clone()
      mesh.scale.setScalar(capacity===6?.43:.49)
      mesh.rotation.z=index%2?.05:-.044
      const target=places[index]
      const origin=immediate?target.clone():target.clone().add(new T.Vector3(0,.15,.7))
      mesh.position.copy(origin)
      tray.add(mesh)
      return {mesh,origin,target,start:immediate?0:performance.now()}
    })
    scene.invalidate()
  }
  scene.animate(now=>{
    let active=false
    pieces.forEach(piece=>{
      if(!piece.start)return
      const t=Math.min(1,(now-piece.start)/320)
      piece.mesh.position.lerpVectors(piece.origin,piece.target,ease(t))
      if(t===1)piece.start=0
      else active=true
    })
    if(closingAt){
      const t=Math.min(1,(now-closingAt)/700)
      lid.rotation.x=mix(-2.45,0,ease(t))
      active=t<1
      if(t===1){closingAt=0;closed=true;onClosed?.();onClosed=null}
    }
    return active
  })
  setCapacity(4)
  return {
    setContents,setCapacity,
    close(){return new Promise(resolve=>{onClosed=resolve;closingAt=performance.now();scene.invalidate()})},
    open(){closed=false;closingAt=0;lid.rotation.x=-2.45;scene.invalidate()},
    dispose(){onClosed?.();logoTexture?.dispose();scene.dispose()},
  }
}
