import * as THREE from 'three'
import { NODES, EDGES, TYPE_COLORS, EDGE_COLORS, type SiteNode } from './nodes-data'
import { initPanel, openPanel, closePanel } from './panel'
import { createStarfield } from '../background/starfield'
import { createShootingStars } from '../background/shooting-stars'

// ─── Constants ────────────────────────────────────────────────────────────────
const INITIAL_SPREAD  = 150
const EDGE_REST_LEN   = 85
const CHILD_REST_LEN  = 50
const SPRING_K        = 0.014
const REPULSE_K       = 16000
const DAMP            = 0.80
const GRAVITY_K       = 0.004
const SETTLE_STEPS    = 320
const EXPAND_STEPS    = 120

const ORBIT_SENS      = 0.006
const ORBIT_DIST_DEF  = 370
const ORBIT_DIST_MIN  = 130
const ORBIT_DIST_MAX  = 800

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodeObj {
  node:         SiteNode
  pos:          THREE.Vector3   // physics position
  vel:          THREE.Vector3
  mesh:         THREE.Group
  coreMesh:     THREE.Mesh
  hitMesh:      THREE.Mesh      // invisible larger sphere for raycasting
  glowMeshes:   THREE.Mesh[]
  selRing:      THREE.Mesh
  labelEl:      HTMLElement
  visible:      boolean
  opacity:      number
  targetOpacity: number
  renderScale:  number
  targetScale:  number
  floatSeed:    number
}

interface EdgeObj {
  from:          string
  to:            string
  line:          THREE.Line
  geo:           THREE.BufferGeometry
  isChildEdge:   boolean
}

// ─── Module state ─────────────────────────────────────────────────────────────
let renderer:   THREE.WebGLRenderer
let scene:      THREE.Scene
let camera:     THREE.PerspectiveCamera
let canvasEl:   HTMLCanvasElement
let labelsEl:   HTMLElement | null = null
let starPoints: THREE.Points | null = null
let shootingStarUpdate: (() => void) | null = null

const nodeObjs = new Map<string, NodeObj>()
const hitMeshToId = new Map<THREE.Mesh, string>()
let edgeObjs: EdgeObj[] = []

let selectedId:       string | null = null
let hoveredId:        string | null = null
let expandedFeatures  = false
let panelOpen         = false

// Orbit camera
let orbitPhi   = 1.1     // angle from +Y axis (radians)
let orbitTheta = 0.3     // angle around Y axis (radians)
let orbitDist  = ORBIT_DIST_DEF
let isDragging = false
let mouseDownPos = new THREE.Vector2()
let lastMouse    = new THREE.Vector2()

// Touch
let lastTouchDist   = 0
let touchStartCenter = new THREE.Vector2()

const raycaster = new THREE.Raycaster()
raycaster.params.Line = { threshold: 3 }

// ─── Public init ─────────────────────────────────────────────────────────────

export function initGraph(canvas: HTMLCanvasElement) {
  canvasEl  = canvas
  labelsEl  = document.getElementById('node-labels')

  // Wire panel close → deselect
  initPanel(() => deselect())

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(canvas.clientWidth, canvas.clientHeight)

  // Scene + camera
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0a0a)

  camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 5000)
  syncCamera()

  // Galaxy starfield + shooting stars (same as app)
  starPoints = createStarfield(6000, 1400)
  scene.add(starPoints)
  const ss = createShootingStars(2)
  scene.add(ss.mesh)
  shootingStarUpdate = ss.update

  // Graph
  buildNodeObjects()
  runForceLayout(SETTLE_STEPS, false)
  buildEdgeObjects()

  // Events
  canvas.addEventListener('mousedown',  onMouseDown)
  window.addEventListener('mousemove',  onMouseMove)
  window.addEventListener('mouseup',    onMouseUp)
  canvas.addEventListener('mouseleave', onMouseLeave)
  canvas.addEventListener('wheel',      onWheel, { passive: false })
  canvas.addEventListener('touchstart', onTouchStart, { passive: true })
  canvas.addEventListener('touchmove',  onTouchMove,  { passive: false })
  canvas.addEventListener('touchend',   onTouchEnd)
  window.addEventListener('resize',     onResize)

  // Listen for programmatic node selection (e.g. "Get Kosmos" button)
  window.addEventListener('kosmos:select-node', ((e: CustomEvent) => {
    const nodeId = e.detail?.nodeId
    if (nodeId && nodeObjs.has(nodeId)) {
      selectNode(nodeId)
      wirePanelCopyButton()
    }
  }) as EventListener)

  requestAnimationFrame(animate)
}

// ─── Camera ───────────────────────────────────────────────────────────────────

function syncCamera() {
  const sp = Math.sin(orbitPhi)
  const cp = Math.cos(orbitPhi)
  const st = Math.sin(orbitTheta)
  const ct = Math.cos(orbitTheta)
  camera.position.set(orbitDist * sp * st, orbitDist * cp, orbitDist * sp * ct)
  camera.lookAt(0, 0, 0)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nodeRadius(node: SiteNode): number {
  return node.radius * 0.48
}

function hexColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

function makeSphere(r: number, colorHex: number, opacity: number, additive: boolean): THREE.Mesh {
  const geo = new THREE.SphereGeometry(r, 20, 14)
  const mat = new THREE.MeshBasicMaterial({
    color:       colorHex,
    transparent: true,
    opacity,
    depthWrite:  false,
    blending:    additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
  return new THREE.Mesh(geo, mat)
}

// ─── Build nodes ─────────────────────────────────────────────────────────────

function buildNodeObjects() {
  if (!labelsEl) return

  for (const node of NODES) {
    const colorStr = TYPE_COLORS[node.type] ?? '#94a3b8'
    const colorInt = hexColor(colorStr)
    const r        = nodeRadius(node)
    const isChild  = node.parent === 'features'

    const group = new THREE.Group()
    group.userData.nodeId = node.id

    // Core sphere
    const core = makeSphere(r, colorInt, 0.92, false)
    core.userData.nodeId = node.id
    group.add(core)

    const glowMeshes: THREE.Mesh[] = []

    // Inner glow
    const g1 = makeSphere(r * 1.6,  colorInt, 0.20, true); group.add(g1); glowMeshes.push(g1)
    // Outer glow
    const g2 = makeSphere(r * 2.8,  colorInt, 0.07, true); group.add(g2); glowMeshes.push(g2)
    // Far halo
    const g3 = makeSphere(r * 4.5,  colorInt, 0.03, true); group.add(g3); glowMeshes.push(g3)

    // Selection ring
    const ringGeo = new THREE.TorusGeometry(r * 2.0, r * 0.14, 8, 40)
    const ringMat = new THREE.MeshBasicMaterial({ color: colorInt, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    const selRing = new THREE.Mesh(ringGeo, ringMat)
    selRing.rotation.x = Math.PI / 2
    group.add(selRing)

    // Invisible hit sphere (generously sized for easy clicking)
    const hitGeo = new THREE.SphereGeometry(r * 2.2, 8, 6)
    const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.FrontSide })
    const hitMesh = new THREE.Mesh(hitGeo, hitMat)
    hitMesh.userData.nodeId = node.id
    group.add(hitMesh)
    hitMeshToId.set(hitMesh, node.id)

    // Initial physics position
    const phi   = Math.acos(2 * Math.random() - 1)
    const theta = Math.random() * Math.PI * 2
    const dist  = INITIAL_SPREAD * (0.25 + Math.random() * 0.75)
    const pos   = new THREE.Vector3(
      dist * Math.sin(phi) * Math.cos(theta),
      dist * Math.cos(phi),
      dist * Math.sin(phi) * Math.sin(theta)
    )
    if (node.id === 'kosmos') pos.set(0, 0, 0)
    if (isChild) pos.set(0, 0, 0)

    group.position.copy(pos)
    if (isChild) group.visible = false
    scene.add(group)

    // HTML label
    const labelEl = document.createElement('div')
    labelEl.className = 'node-label-el'
    if (isChild) labelEl.style.display = 'none'
    labelEl.innerHTML = `
      <span class="nle-name">${node.label}</span>
      <span class="nle-type" style="color:${colorStr}">${node.type.replace(/_/g, ' ')}</span>
      ${node.expandable ? `<span class="nle-expand">[ expand ]</span>` : ''}
    `
    labelsEl.appendChild(labelEl)

    nodeObjs.set(node.id, {
      node, pos, vel: new THREE.Vector3(),
      mesh: group, coreMesh: core, hitMesh, glowMeshes, selRing,
      labelEl,
      visible: !isChild,
      opacity: 0,  targetOpacity: isChild ? 0 : 1,
      renderScale: 0.01, targetScale: isChild ? 0 : 1,
      floatSeed: Math.random() * Math.PI * 2,
    })
  }
}

// ─── Force layout ─────────────────────────────────────────────────────────────

function buildEdgeMap(): Map<string, number> {
  const m = new Map<string, number>()
  for (const edge of EDGES) {
    const toNode = NODES.find(n => n.id === edge.to)
    m.set(`${edge.from}--${edge.to}`, toNode?.parent === 'features' ? CHILD_REST_LEN : EDGE_REST_LEN)
  }
  return m
}

function forceStep(nodes: NodeObj[], edgeMap: Map<string, number>, includeChildren: boolean) {
  const N = nodes.length
  for (let i = 0; i < N; i++) {
    const a = nodes[i]
    if (!includeChildren && a.node.parent === 'features') continue

    // Pin the root node at origin
    if (a.node.id === 'kosmos') {
      a.vel.set(0, 0, 0)
      a.pos.set(0, 0, 0)
      continue
    }

    const force = new THREE.Vector3()

    // Repulsion
    for (let j = 0; j < N; j++) {
      if (i === j) continue
      const b = nodes[j]
      if (!includeChildren && b.node.parent === 'features') continue
      const diff = new THREE.Vector3().subVectors(a.pos, b.pos)
      const dist2 = diff.lengthSq()
      if (dist2 < 0.001) continue
      force.addScaledVector(diff.normalize(), REPULSE_K / dist2)
    }

    // Spring edges
    for (const [key, restLen] of edgeMap) {
      const [fid, tid] = key.split('--')
      const myId = a.node.id
      if (fid !== myId && tid !== myId) continue
      const otherId = fid === myId ? tid : fid
      const other   = nodeObjs.get(otherId)
      if (!other) continue
      if (!includeChildren && other.node.parent === 'features') continue
      const diff = new THREE.Vector3().subVectors(other.pos, a.pos)
      const dist = diff.length()
      if (dist < 0.001) continue
      force.addScaledVector(diff.normalize(), SPRING_K * (dist - restLen))
    }

    // Central gravity
    force.addScaledVector(a.pos.clone().negate(), GRAVITY_K)

    a.vel.add(force)
    a.vel.multiplyScalar(DAMP)
    a.pos.add(a.vel)
  }
}

function runForceLayout(steps: number, includeChildren: boolean) {
  const nodes = [...nodeObjs.values()]
  const edgeMap = buildEdgeMap()

  for (let i = 0; i < steps; i++) {
    forceStep(nodes, edgeMap, includeChildren)
  }

  // Sync mesh positions
  for (const obj of nodeObjs.values()) {
    if (!includeChildren && obj.node.parent === 'features') continue
    obj.mesh.position.copy(obj.pos)
  }
}

// ─── Build edges ──────────────────────────────────────────────────────────────

function buildEdgeObjects() {
  edgeObjs = []
  for (const edge of EDGES) {
    const fromObj = nodeObjs.get(edge.from)
    const toObj   = nodeObjs.get(edge.to)
    if (!fromObj || !toObj) continue

    const isChildEdge = toObj.node.parent === 'features'
    const color = new THREE.Color(EDGE_COLORS[edge.type] ?? '#94a3b8')

    const positions = new Float32Array(6)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const mat = new THREE.LineBasicMaterial({
      color, transparent: true,
      opacity: isChildEdge ? 0 : 0.22,
      depthWrite: false, blending: THREE.AdditiveBlending,
    })

    const line = new THREE.Line(geo, mat)
    scene.add(line)
    edgeObjs.push({ from: edge.from, to: edge.to, line, geo, isChildEdge })
  }
}


// ─── Animation loop ───────────────────────────────────────────────────────────

let lastT = 0

function animate(t: number) {
  requestAnimationFrame(animate)

  const dt = Math.min(t - lastT, 50)
  lastT = t

  // Slow auto-rotate when idle
  if (!isDragging && !panelOpen) {
    orbitTheta += 0.00015 * Math.max(dt, 16)
    syncCamera()
  }

  if (starPoints) starPoints.rotation.y += 0.000035
  if (shootingStarUpdate) shootingStarUpdate()

  // Update node state
  for (const [id, obj] of nodeObjs) {
    const isChild = obj.node.parent === 'features'

    // Lerp opacity
    obj.opacity += (obj.targetOpacity - obj.opacity) * 0.1
    if (Math.abs(obj.targetOpacity - obj.opacity) < 0.001) obj.opacity = obj.targetOpacity

    // Lerp scale
    obj.renderScale += (obj.targetScale - obj.renderScale) * 0.10
    if (Math.abs(obj.targetScale - obj.renderScale) < 0.001) obj.renderScale = obj.targetScale

    // Show/hide
    if (isChild) {
      if (obj.opacity < 0.01 && !obj.visible) {
        obj.mesh.visible = false
      } else {
        obj.mesh.visible = true
      }
    } else if (!obj.mesh.visible) {
      obj.mesh.visible = true
    }

    // Gentle float (offset Y slightly)
    const floatY = Math.sin(t * 0.00042 * (0.7 + obj.floatSeed * 0.4) + obj.floatSeed) * 2.2

    // Update mesh position (pos = physics anchor, add float)
    obj.mesh.position.set(obj.pos.x, obj.pos.y + floatY, obj.pos.z)
    obj.mesh.scale.setScalar(obj.renderScale)

    // Core opacity
    ;(obj.coreMesh.material as THREE.MeshBasicMaterial).opacity = obj.opacity

    // Glow opacity layers: base values × opacity
    const GLOW_BASE = [0.20, 0.07, 0.03]
    for (let i = 0; i < obj.glowMeshes.length; i++) {
      ;(obj.glowMeshes[i].material as THREE.MeshBasicMaterial).opacity = GLOW_BASE[i] * obj.opacity
    }

    // Selection ring
    const isSelected = id === selectedId
    const ringMat    = obj.selRing.material as THREE.MeshBasicMaterial
    ringMat.opacity += ((isSelected ? 0.65 : 0) - ringMat.opacity) * 0.14
    // Gentle ring pulse when selected
    if (isSelected) {
      const pulse = 1 + Math.sin(t * 0.003) * 0.06
      obj.selRing.scale.setScalar(pulse)
    }

    // Hover: brighten inner glow slightly
    if (id === hoveredId && id !== selectedId) {
      ;(obj.glowMeshes[0].material as THREE.MeshBasicMaterial).opacity = 0.55 * obj.opacity
    }

    // Update expand hint
    if (obj.node.expandable) {
      const hint = obj.labelEl.querySelector('.nle-expand')
      if (hint) hint.textContent = expandedFeatures ? '[ collapse ]' : '[ expand ]'
    }
  }

  // Update edges
  for (const edgeObj of edgeObjs) {
    const fromObj = nodeObjs.get(edgeObj.from)
    const toObj   = nodeObjs.get(edgeObj.to)
    if (!fromObj || !toObj) continue

    // Target opacity
    let targetOp: number
    if (edgeObj.isChildEdge) {
      targetOp = expandedFeatures ? 0.22 * toObj.opacity : 0
    } else if (selectedId && (edgeObj.from === selectedId || edgeObj.to === selectedId)) {
      targetOp = 0.55
    } else {
      targetOp = 0.22
    }

    const mat = edgeObj.line.material as THREE.LineBasicMaterial
    mat.opacity += (targetOp - mat.opacity) * 0.12

    // Update geometry
    const buf = edgeObj.geo.attributes.position as THREE.BufferAttribute
    const fp  = fromObj.mesh.position
    const tp  = toObj.mesh.position
    buf.setXYZ(0, fp.x, fp.y, fp.z)
    buf.setXYZ(1, tp.x, tp.y, tp.z)
    buf.needsUpdate = true
  }

  updateLabels(t)
  renderer.render(scene, camera)
}

// ─── Labels ───────────────────────────────────────────────────────────────────

function updateLabels(t: number) {
  if (!labelsEl) return
  const w = canvasEl.clientWidth
  const h = canvasEl.clientHeight
  const focalLen = h / 2 / Math.tan(camera.fov * Math.PI / 360)

  for (const [, obj] of nodeObjs) {
    const labelEl = obj.labelEl

    if (obj.opacity < 0.02) {
      labelEl.style.display = 'none'
      continue
    }

    const worldPos = obj.mesh.position.clone()
    const projected = worldPos.project(camera)

    // Behind camera?
    if (projected.z > 1) {
      labelEl.style.display = 'none'
      continue
    }

    const sx = (projected.x + 1) * 0.5 * w
    const sy = (-projected.y + 1) * 0.5 * h

    // Compute screen-space radius to offset label below sphere
    const depth   = camera.position.distanceTo(worldPos)
    const screenR = nodeRadius(obj.node) * obj.renderScale * focalLen / depth
    const yOffset = screenR + 8

    labelEl.style.display  = ''
    labelEl.style.opacity  = String(obj.opacity)
    labelEl.style.left     = `${sx}px`
    labelEl.style.top      = `${sy + yOffset}px`
  }
}

// ─── Raycasting ───────────────────────────────────────────────────────────────

function getNodeAtMouse(clientX: number, clientY: number): string | null {
  const rect = canvasEl.getBoundingClientRect()
  const nx   = ((clientX - rect.left) / rect.width) * 2 - 1
  const ny   = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera)

  const hitMeshes = [...hitMeshToId.keys()].filter(m => {
    const obj = nodeObjs.get(m.userData.nodeId)
    return obj && obj.opacity > 0.25
  })

  const hits = raycaster.intersectObjects(hitMeshes, false)
  if (!hits.length) return null
  return hits[0].object.userData.nodeId as string
}

// ─── Interaction ──────────────────────────────────────────────────────────────

function onMouseDown(e: MouseEvent) {
  isDragging = true
  mouseDownPos.set(e.clientX, e.clientY)
  lastMouse.set(e.clientX, e.clientY)
  canvasEl.style.cursor = 'grabbing'
}

function onMouseMove(e: MouseEvent) {
  if (isDragging) {
    const dx = e.clientX - lastMouse.x
    const dy = e.clientY - lastMouse.y
    orbitTheta -= dx * ORBIT_SENS
    orbitPhi    = Math.max(0.15, Math.min(Math.PI - 0.15, orbitPhi + dy * ORBIT_SENS))
    lastMouse.set(e.clientX, e.clientY)
    syncCamera()
    return
  }

  // Hover detection
  const id = getNodeAtMouse(e.clientX, e.clientY)
  if (id !== hoveredId) {
    hoveredId = id
    canvasEl.style.cursor = id ? 'pointer' : ''
  }
}

function onMouseUp(e: MouseEvent) {
  const wasDragging = isDragging
  isDragging = false
  canvasEl.style.cursor = hoveredId ? 'pointer' : ''

  // Only treat as click if mouse barely moved
  const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y)
  if (wasDragging && dist > 5) return

  handleClick(e.clientX, e.clientY)
}

function onMouseLeave() {
  if (isDragging) return
  hoveredId = null
  canvasEl.style.cursor = ''
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  orbitDist = Math.max(ORBIT_DIST_MIN, Math.min(ORBIT_DIST_MAX, orbitDist + e.deltaY * 0.6))
  syncCamera()
}

function handleClick(clientX: number, clientY: number) {
  const id = getNodeAtMouse(clientX, clientY)

  if (!id) {
    if (selectedId) deselect()
    return
  }

  if (id === selectedId) {
    const node = NODES.find(n => n.id === id)
    if (!node?.expandable) { deselect(); return }
  }

  const node = NODES.find(n => n.id === id)
  if (node?.expandable) toggleExpand(id)

  selectNode(id)
}

// ─── Wire panel copy button ─────────────────────────────────────────────────

function wirePanelCopyButton() {
  // Delay slightly to let the DOM update after openPanel
  requestAnimationFrame(() => {
    const copyBtn = document.getElementById('panel-copy-btn')
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const pre = copyBtn.closest('.ps-install-block')?.querySelector('.ps-install-body')
        const text = pre?.textContent ?? ''
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = 'Copied!'
          setTimeout(() => { copyBtn.textContent = 'Copy' }, 2000)
        })
      })
    }

    // Wire "Get Kosmos — Free" button in root Kosmos panel
    const getKosmosBtn = document.getElementById('panel-get-kosmos-btn')
    if (getKosmosBtn) {
      getKosmosBtn.addEventListener('click', () => {
        selectNode('download')
        wirePanelCopyButton()
      })
    }
  })
}

function selectNode(id: string) {
  selectedId = id
  panelOpen  = true
  openPanel(id)

  const hint = document.getElementById('hint')
  if (hint) hint.style.opacity = '0'

  // Intro card stays permanently visible — no dismissal

  // Wire copy button if the panel has one (e.g., Get Kosmos panel)
  wirePanelCopyButton()
}

function deselect() {
  selectedId = null
  panelOpen  = false
  closePanel()
}

function toggleExpand(id: string) {
  if (id !== 'features') return
  expandedFeatures = !expandedFeatures

  const children = ['universe-map', 'session-replay', 'health-analysis', 'flow-chart', 'live-streaming']
  const featObj  = nodeObjs.get('features')

  if (expandedFeatures) {
    // Position children randomly around features
    const fpos = featObj?.pos ?? new THREE.Vector3()
    children.forEach((cid, i) => {
      const obj   = nodeObjs.get(cid)
      if (!obj) return
      const angle = (i / children.length) * Math.PI * 2
      const r     = CHILD_REST_LEN * 0.7
      obj.pos.set(
        fpos.x + Math.cos(angle) * r + (Math.random() - 0.5) * 20,
        fpos.y + (Math.random() - 0.5) * 30,
        fpos.z + Math.sin(angle) * r + (Math.random() - 0.5) * 20
      )
      obj.vel.set(0, 0, 0)
      obj.visible       = true
      obj.targetOpacity = 1
      obj.targetScale   = 1
      obj.mesh.position.copy(obj.pos)
      obj.mesh.visible  = true
    })

    // Settle children into natural positions
    runForceLayout(EXPAND_STEPS, true)
    children.forEach(cid => {
      const obj = nodeObjs.get(cid)
      if (obj) obj.mesh.position.copy(obj.pos)
    })
  } else {
    children.forEach(cid => {
      const obj = nodeObjs.get(cid)
      if (!obj) return
      obj.targetOpacity = 0
      obj.targetScale   = 0
      setTimeout(() => {
        if (!expandedFeatures) {
          obj.visible = false
          obj.mesh.visible = false
        }
      }, 500)
    })
  }
}

// ─── Touch controls ───────────────────────────────────────────────────────────

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 1) {
    isDragging = true
    lastMouse.set(e.touches[0].clientX, e.touches[0].clientY)
    mouseDownPos.set(e.touches[0].clientX, e.touches[0].clientY)
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    lastTouchDist = Math.hypot(dx, dy)
  }
}

function onTouchMove(e: TouchEvent) {
  e.preventDefault()
  if (e.touches.length === 1 && isDragging) {
    const dx = e.touches[0].clientX - lastMouse.x
    const dy = e.touches[0].clientY - lastMouse.y
    orbitTheta -= dx * ORBIT_SENS
    orbitPhi    = Math.max(0.15, Math.min(Math.PI - 0.15, orbitPhi + dy * ORBIT_SENS))
    lastMouse.set(e.touches[0].clientX, e.touches[0].clientY)
    syncCamera()
  } else if (e.touches.length === 2) {
    const dx   = e.touches[0].clientX - e.touches[1].clientX
    const dy   = e.touches[0].clientY - e.touches[1].clientY
    const dist = Math.hypot(dx, dy)
    const delta = lastTouchDist - dist
    orbitDist   = Math.max(ORBIT_DIST_MIN, Math.min(ORBIT_DIST_MAX, orbitDist + delta * 1.2))
    lastTouchDist = dist
    syncCamera()
  }
}

function onTouchEnd(e: TouchEvent) {
  if (e.changedTouches.length === 1) {
    const dist = Math.hypot(
      e.changedTouches[0].clientX - mouseDownPos.x,
      e.changedTouches[0].clientY - mouseDownPos.y
    )
    if (dist < 8) {
      handleClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
    }
  }
  isDragging = false
}

// ─── Resize ───────────────────────────────────────────────────────────────────

function onResize() {
  const w = canvasEl.clientWidth
  const h = canvasEl.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
