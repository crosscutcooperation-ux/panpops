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
    world, key, rim, invalidate,
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

export async function createTurntable(host, canvas, context) {
  const pouches = await Promise.all(products.map(pack))
  const scene = studio(host, canvas, context, { height: 3.08, minWidth: 3.24 })
  const deck = pedestal(1.14, products[0])
  deck.root.position.y = -1.03
  scene.world.add(deck.root, ...pouches)
  stageSeeds(scene.world)
  let active = 0
  let travel = 1
  let started = 0
  let origin = []
  let destination = []

  function layout() {
    const side = Math.min(1.82, scene.width * .313)
    const scale = scene.width < 3.8 ? .64 : .70
    return pouches.map((_, index) => {
      switch ((index - active + pouches.length) % pouches.length) {
        case 0: return { x: 0, y: .066, z: .23, size: 1, yaw: -.075, roll: -.045 }
        case 1: return { x: side, y: -.12, z: -.45, size: scale, yaw: -.48, roll: -.18 }
        case 2: return { x: 0, y: -.23, z: -1.2, size: .34, yaw: .2, roll: 0 }
        default: return { x: -side, y: -.12, z: -.45, size: scale, yaw: .48, roll: .18 }
      }
    })
  }

  let poses = layout()
  function draw(frames) {
    pouches.forEach((pouch, index) => {
      const { x, y, z, size, yaw, roll } = frames[index]
      pouch.position.set(x, y, z)
      pouch.rotation.set(-.025, yaw, roll)
      pouch.scale.setScalar(size)
      const brightness = mix(.67, 1, T.MathUtils.clamp((size - .4) / .6, 0, 1))
      pouch.children.forEach(mesh => mesh.material.color.setScalar(brightness))
    })
  }

  function select(next, direction, immediate = false) {
    active = next
    travel = direction
    deck.theme(products[active])
    scene.rim.color.set(products[active].light).lerp(new T.Color('#fff0d7'), .55)
    destination = layout()
    if (immediate) {
      started = 0
      poses = destination
      draw(poses)
    } else {
      started = performance.now()
      origin = poses
    }
    scene.invalidate()
  }

  scene.onResize(() => select(active, travel, true))
  scene.animate(now => {
    if (!started) return false
    const progress = Math.min(1, (now - started) / 590)
    const t = ease(progress)
    poses = origin.map((from, index) => {
      const to = destination[index]
      return {
        x: mix(from.x,to.x,t),
        y: mix(from.y,to.y,t) + Math.sin(progress * Math.PI) * (index === active ? .13 : -.04),
        z: mix(from.z,to.z,t),
        size: mix(from.size,to.size,t),
        yaw: mix(from.yaw,to.yaw,t) + Math.sin(progress * Math.PI) * travel * -.28,
        roll: mix(from.roll,to.roll,t),
      }
    })
    draw(poses)
    if (progress === 1) started = 0
    return !!started
  })
  select(0, 1, true)
  return { select, dispose: scene.dispose }
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

  scene.animate(now => {
    const rotationActive = Math.abs(targetYaw - yaw) > .002 || Math.abs(targetPitch - pitch) > .002
    yaw = rotationActive ? mix(yaw, targetYaw, .19) : targetYaw
    pitch = rotationActive ? mix(pitch, targetPitch, .19) : targetPitch
    const popTime = poppedAt ? (now - poppedAt) / 1080 : -1
    drawPop(popTime)
    const bounce = popTime >= 0 && popTime < 1 ? Math.sin(popTime * Math.PI * 3) * (1 - popTime) : 0
    pouch.rotation.set(pitch, yaw, -.035 - bounce * .075)
    pouch.position.y = .077 + bounce * .14
    if (popTime >= 1) poppedAt = 0
    return rotationActive || !!poppedAt
  })

  return {
    flip(reversed, immediate = false) {
      const wanted = reversed ? Math.PI : -.09
      targetYaw = wanted + Math.round((yaw - wanted) / TAU) * TAU
      targetPitch = -.035
      if (immediate) { yaw = targetYaw; pitch = targetPitch }
      scene.invalidate()
    },
    startDrag() { dragYaw = yaw; dragPitch = pitch },
    drag(dx, dy) {
      targetYaw = dragYaw + dx * .014
      targetPitch = T.MathUtils.clamp(dragPitch + dy * .008, -.6, .6)
      scene.invalidate()
    },
    pop() { poppedAt = performance.now(); scene.invalidate() },
    dispose: scene.dispose,
  }
}

export async function createTray(host, canvas, context) {
  const models = await Promise.all(products.map(pack))
  const scene = studio(host, canvas, context, { height: 3.0, minWidth: 3.1, cameraY: .13, lookY: .0 })
  const tray = new T.Group()
  tray.rotation.set(-.52, -.045, -.14)
  tray.position.y = .055
  scene.world.add(tray)
  const library = new T.Group()
  library.visible = false
  library.add(...models)
  scene.world.add(library)
  const sources = Object.fromEntries(products.map((product, index) => [product.id, models[index]]))
  const base = new T.MeshStandardMaterial({ color: '#bd8a5b', roughness: .96 })
  const wall = new T.MeshStandardMaterial({ color: '#e4b987', roughness: .89 })
  const slot = new T.MeshStandardMaterial({ color: '#a7734b', roughness: .97 })
  function board(width, height, depth, x, y, z, material) {
    const piece = new T.Mesh(new T.BoxGeometry(width,height,depth),material)
    piece.position.set(x,y,z)
    tray.add(piece)
  }
  board(2.69, 2.40, .15, 0, 0, -.09, base)
  for (const side of [-1,1]) {
    board(2.71, .10, .32, 0, side * 1.17, .05, wall)
    board(.10, 2.23, .32, side * 1.30, 0, .05, wall)
  }
  const places = Array.from({ length: MAX_BOX }, (_, index) => new T.Vector3(index % 2 ? .644 : -.644, index < 2 ? .567 : -.567, .135))
  for (const { x, y } of places) board(1.22, 1.066, .018, x, y, -.006, slot)
  board(.048, 2.24, .105, 0, 0, .033, wall)
  board(2.52, .044, .105, 0, 0, .032, wall)

  let pieces = []
  function setContents(ids, immediate = false) {
    const available = [...pieces]
    const timestamp = performance.now()
    pieces = ids.map((id, index) => {
      const oldIndex = available.findIndex(piece => piece.id === id)
      const target = places[index]
      if (oldIndex >= 0) {
        const [piece] = available.splice(oldIndex, 1)
        if (piece.target === target) return piece
        piece.origin = piece.mesh.position.clone()
        piece.target = target
        piece.start = timestamp
        return piece
      }
      const mesh = sources[id].clone()
      mesh.scale.setScalar(.49)
      mesh.rotation.z = index % 2 ? .05 : -.044
      const origin = immediate ? target.clone() : target.clone().add(new T.Vector3(index % 2 ? .12 : -.12, .19, 1.45))
      mesh.position.copy(origin)
      tray.add(mesh)
      return { id, mesh, origin, target, start: immediate ? 0 : timestamp }
    })
    for (const piece of available) tray.remove(piece.mesh)
    scene.invalidate()
  }
  scene.animate(now => {
    let active = false
    for (const piece of pieces) {
      if (!piece.start) continue
      const t = Math.min(1, (now - piece.start) / 420)
      piece.mesh.position.lerpVectors(piece.origin, piece.target, ease(t))
      piece.mesh.position.z += Math.max(0, Math.sin((t - .52) * Math.PI * 2)) * (1 - t) * .16
      if (t === 1) piece.start = 0
      else active = true
    }
    return active
  })
  return { setContents, dispose: scene.dispose }
}

export async function createCrossing(host, canvas, context, anchors) {
  const pouches = await Promise.all(products.map(pack))
  const scene = studio(host, canvas, context, { height: 3.6, minWidth: 1, cameraY: 0 })
  const shape = seedGeometry()
  const materials = seedMaterials()
  const trails = pouches.map((pouch, index) => {
    const seeds = Array.from({ length: 6 }, (_, grain) => {
      const mesh = new T.Mesh(shape, materials[(index + grain) % materials.length])
      scene.world.add(mesh)
      return mesh
    })
    scene.world.add(pouch)
    return seeds
  })

  let current = anchors.map(() => 0)
  function pose(progress = current) {
    current = progress
    const bounds = host.getBoundingClientRect()
    if (!bounds.width || !scene.width) return
    const unit = scene.width / bounds.width

    anchors.forEach((anchor, index) => {
      const art = anchor.getBoundingClientRect()
      const rise = progress[index]
      const direction = index % 2 === 0 ? 1 : -1
      const x = (art.left + art.width / 2 - bounds.left - bounds.width / 2) * unit
      const y = (bounds.top + bounds.height / 2 - art.top - art.height / 2) * unit
      const scale = art.height * unit / 2.02
      const pouch = pouches[index]

      pouch.position.set(x - direction * scale * (1 - rise) * .29, y - scale * (1 - rise) * .78, 0)
      pouch.scale.setScalar(scale * (.69 + rise * .31))
      pouch.rotation.set(.05 + (1 - rise) * .42, direction * (rise * .18 - (1 - rise) * .72), direction * (.58 - rise * .33))
      pouch.visible = rise > .025

      trails[index].forEach((seed, grain) => {
        const spread = rise * (grain + 2) / 7
        seed.position.set(
          x + direction * scale * (.19 + spread * .95),
          y + scale * (.43 + spread * .79 + Math.sin(grain * 3.3) * .21),
          .06 + spread * .14,
        )
        seed.scale.setScalar(scale * (.055 + (grain % 3) * .016) * rise)
        seed.rotation.set(grain + rise * 1.5, grain * .7, rise * 2.3)
        seed.visible = rise > .1
      })
    })
    scene.invalidate()
  }

  scene.onResize(() => pose())
  pose()
  return { pose, dispose: scene.dispose }
}
