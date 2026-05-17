import * as THREE from 'three'
import { createStarfield } from './starfield'
import { createShootingStars } from './shooting-stars'

export function initBackground(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setSize(canvas.clientWidth, canvas.clientHeight)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0a0a) // matches app --k-bg-base

  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 5000)
  camera.position.set(0, 30, 220)
  camera.lookAt(0, 0, 0)

  const isMobile = window.innerWidth < 768
  const starfield = createStarfield(isMobile ? 2500 : 6000, 1400)
  scene.add(starfield)

  const shootingStars = createShootingStars(isMobile ? 1 : 2)
  scene.add(shootingStars.mesh)

  let raf = 0

  function animate() {
    raf = requestAnimationFrame(animate)
    starfield.rotation.y += 0.000045
    starfield.rotation.x += 0.000012
    shootingStars.update()
    renderer.render(scene, camera)
  }
  animate()

  function onResize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  window.addEventListener('resize', onResize)

  return { onResize, dispose: () => { cancelAnimationFrame(raf); renderer.dispose() } }
}
