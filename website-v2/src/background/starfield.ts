/**
 * Starfield — ported from Starfield.tsx
 * Galaxy-disc distribution, cosmic color palette, additive blending.
 */

import * as THREE from 'three'

export function createStarfield(count = 8000, radius = 1800): THREE.Points {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)

  // Cosmic color palette — purple-forward to match brand
  const palette = [
    [1.00, 1.00, 1.00],
    [0.90, 0.85, 1.00],
    [0.78, 0.65, 1.00],
    [0.65, 0.54, 0.98],
    [0.55, 0.45, 0.90],
    [0.48, 0.42, 0.80],
    [0.82, 0.90, 1.00],
    [0.50, 0.60, 0.95],
    [1.00, 0.88, 0.70],
    [0.28, 0.20, 0.50],
  ]
  const thresholds = [0.08, 0.18, 0.32, 0.48, 0.63, 0.75, 0.83, 0.91, 0.94, 1.00]

  for (let i = 0; i < count; i++) {
    const u = Math.random()
    const v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(2 * v - 1)
    const r = Math.pow(Math.random(), 1 / 3) * radius

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.cos(phi) * 0.18
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)

    const rand = Math.random()
    let idx = 0
    for (let k = 0; k < thresholds.length; k++) {
      if (rand < thresholds[k]) { idx = k; break }
    }
    const [cr, cg, cb] = palette[idx]
    const brightness = 0.55 + Math.random() * 0.45
    colors[i * 3]     = cr * brightness
    colors[i * 3 + 1] = cg * brightness
    colors[i * 3 + 2] = cb * brightness

    sizes[i] = Math.random() < 0.05 ? 2.5 + Math.random() * 1.5
             : Math.random() < 0.20 ? 1.5 + Math.random() * 0.8
             : 0.8 + Math.random() * 0.5
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  const material = new THREE.PointsMaterial({
    size: 1.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  return new THREE.Points(geometry, material)
}
