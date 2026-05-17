/**
 * ShootingStars — comet-like streaks with vertex-colored trails.
 */

import * as THREE from 'three'

interface StarState {
  x: number; y: number; z: number
  dx: number; dy: number; dz: number
  speed: number
  trailLength: number
  life: number
  maxLife: number
  waitFrames: number
  tint: number
}

function rng(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function newStar(waitOverride?: number): StarState {
  const theta = Math.random() * Math.PI * 2
  const r = rng(450, 750)
  const x = r * Math.cos(theta)
  const y = rng(-100, 100)
  const z = r * Math.sin(theta)
  const dir = new THREE.Vector3(rng(-1, 1), rng(-0.25, 0.25), rng(-1, 1)).normalize()

  return {
    x, y, z,
    dx: dir.x, dy: dir.y, dz: dir.z,
    speed: rng(12, 24),
    trailLength: rng(40, 80),
    life: 0,
    maxLife: Math.floor(rng(100, 180)),
    waitFrames: waitOverride ?? Math.floor(rng(500, 1800)),
    tint: Math.floor(Math.random() * 3),
  }
}

const TINTS = [
  [0.08, 0.04, 0.20, 0.67, 0.55, 1.00],
  [0.06, 0.03, 0.18, 0.49, 0.36, 0.93],
  [0.10, 0.05, 0.22, 0.90, 0.80, 1.00],
]

export function createShootingStars(numSlots = 3) {
  const posArray = new Float32Array(numSlots * 2 * 3)
  const colArray = new Float32Array(numSlots * 2 * 3)
  const stars: StarState[] = Array.from({ length: numSlots }, (_, i) => newStar(i * 280 + 80))

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colArray, 3))

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const mesh = new THREE.LineSegments(geometry, material)

  function update() {
    for (let i = 0; i < numSlots; i++) {
      const s = stars[i]
      const p = i * 6
      if (s.waitFrames > 0) {
        s.waitFrames--
        posArray[p] = 0; posArray[p + 1] = 99999; posArray[p + 2] = 0
        posArray[p + 3] = 0; posArray[p + 4] = 99999; posArray[p + 5] = 0
        colArray.fill(0, p, p + 6)
        continue
      }
      s.life++
      if (s.life >= s.maxLife) { stars[i] = newStar(); continue }
      const t = s.life / s.maxLife
      const alpha = Math.min(t * 7, 1) * Math.min((1 - t) * 6, 1)
      s.x += s.dx * s.speed; s.y += s.dy * s.speed; s.z += s.dz * s.speed
      posArray[p]     = s.x - s.dx * s.trailLength
      posArray[p + 1] = s.y - s.dy * s.trailLength
      posArray[p + 2] = s.z - s.dz * s.trailLength
      posArray[p + 3] = s.x; posArray[p + 4] = s.y; posArray[p + 5] = s.z
      const c = TINTS[s.tint]
      colArray[p]     = c[0] * alpha * 0.3; colArray[p + 1] = c[1] * alpha * 0.3; colArray[p + 2] = c[2] * alpha * 0.3
      colArray[p + 3] = c[3] * alpha;       colArray[p + 4] = c[4] * alpha;       colArray[p + 5] = c[5] * alpha
    }
    ;(geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
  }

  return { mesh, update }
}
