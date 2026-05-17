/**
 * ShootingStars — occasional streaking comet-like objects in the 3D scene.
 *
 * Uses a single LineSegments mesh with vertex colors so each star
 * can have a gradient from dark tail → bright head.
 * Additive blending makes them glow against the dark background.
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGraphStore } from '../../store/graph.store'

const NUM_SLOTS = 5  // max concurrent streaks (most will be waiting at any time)

// ── Star state ─────────────────────────────────────────────────────────────────
interface StarState {
    x: number; y: number; z: number        // current head position
    dx: number; dy: number; dz: number     // normalized direction
    speed: number
    trailLength: number
    life: number
    maxLife: number
    waitFrames: number                     // frames to wait before next fire
    tint: number                           // 0=ice-blue, 1=cool-blue, 2=lavender
}

function rng(min: number, max: number) {
    return min + Math.random() * (max - min)
}

function newStar(waitOverride?: number): StarState {
    // Spawn across full spherical volume rather than just a flat disc
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = rng(500, 2000)
    
    const x = r * Math.sin(phi) * Math.cos(theta)
    const y = r * Math.cos(phi)
    const z = r * Math.sin(phi) * Math.sin(theta)

    // Direction: random traversing the scene
    const dir = new THREE.Vector3(
        rng(-1, 1),
        rng(-1, 1),
        rng(-1, 1),
    ).normalize()

    return {
        x, y, z,
        dx: dir.x, dy: dir.y, dz: dir.z,
        speed:       rng(12, 24),
        trailLength: rng(40, 80),
        life:        0,
        maxLife:     Math.floor(rng(100, 180)),
        waitFrames:  waitOverride ?? Math.floor(rng(500, 1800)),
        tint:        Math.floor(Math.random() * 3),
    }
}

// [tailR,G,B,  headR,G,B]  — head brightness baked into RGB so alpha fade works
// via additive blending (brightness ≈ visibility against black)
const TINTS = [
    [0.04, 0.06, 0.22,   0.82, 0.88, 1.00],   // ice blue
    [0.06, 0.04, 0.20,   0.72, 0.78, 1.00],   // deep blue
    [0.08, 0.04, 0.18,   0.88, 0.80, 1.00],   // lavender-white
]

// ── Component ──────────────────────────────────────────────────────────────────
export function ShootingStars() {
    const particleSpeedMulti = useGraphStore(s => s.particleSpeedMulti)
    const particleCountMulti = useGraphStore(s => s.particleCountMulti)

    const geomRef = useRef<THREE.BufferGeometry>(null)

    const posArray = useMemo(() => new Float32Array(NUM_SLOTS * 2 * 3), [])
    const colArray = useMemo(() => new Float32Array(NUM_SLOTS * 2 * 3), [])

    const stars = useRef<StarState[]>(
        // Stagger initial delays so they don't all fire at once
        Array.from({ length: NUM_SLOTS }, (_, i) => newStar(i * 280 + 80))
    )

    useFrame(() => {
        for (let i = 0; i < NUM_SLOTS; i++) {
            const s    = stars.current[i]
            const p    = i * 6   // base index into posArray / colArray

            // ── Waiting phase ──────────────────────────────────────────────
            if (s.waitFrames > 0) {
                s.waitFrames -= particleCountMulti
                if (s.waitFrames <= 0) s.waitFrames = 0 // catch to release this frame
            }
            if (s.waitFrames > 0) {
                // park points far off screen so they don't draw
                posArray[p]   = 0; posArray[p+1] = 99999; posArray[p+2] = 0
                posArray[p+3] = 0; posArray[p+4] = 99999; posArray[p+5] = 0
                colArray.fill(0, p, p + 6)
                continue
            }

            // ── Active streaking ───────────────────────────────────────────
            s.life++
            if (s.life >= s.maxLife) {
                stars.current[i] = newStar()   // respawn with random wait
                continue
            }

            // Smooth fade-in / fade-out envelope
            const t       = s.life / s.maxLife
            const fadeIn  = Math.min(t * 7,       1)   // 14% of life to reach full
            const fadeOut = Math.min((1 - t) * 6, 1)   // last 17% fades out
            const alpha   = fadeIn * fadeOut

            // Advance head
            s.x += s.dx * s.speed * particleSpeedMulti
            s.y += s.dy * s.speed * particleSpeedMulti
            s.z += s.dz * s.speed * particleSpeedMulti

            // Tail trails behind
            posArray[p]   = s.x - s.dx * s.trailLength
            posArray[p+1] = s.y - s.dy * s.trailLength
            posArray[p+2] = s.z - s.dz * s.trailLength
            posArray[p+3] = s.x
            posArray[p+4] = s.y
            posArray[p+5] = s.z

            // Vertex colors: tail = dim, head = bright (scaled by alpha)
            const c = TINTS[s.tint]
            colArray[p]   = c[0] * alpha * 0.3   // tail R
            colArray[p+1] = c[1] * alpha * 0.3   // tail G
            colArray[p+2] = c[2] * alpha * 0.3   // tail B
            colArray[p+3] = c[3] * alpha          // head R
            colArray[p+4] = c[4] * alpha          // head G
            colArray[p+5] = c[5] * alpha          // head B
        }

        if (geomRef.current) {
            (geomRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
            (geomRef.current.attributes.color    as THREE.BufferAttribute).needsUpdate = true
        }
    })

    return (
        <lineSegments>
            <bufferGeometry ref={geomRef}>
                <bufferAttribute
                    attach="attributes-position"
                    count={NUM_SLOTS * 2}
                    array={posArray}
                    itemSize={3}
                />
                <bufferAttribute
                    attach="attributes-color"
                    count={NUM_SLOTS * 2}
                    array={colArray}
                    itemSize={3}
                />
            </bufferGeometry>
            <lineBasicMaterial
                vertexColors
                transparent
                opacity={1}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </lineSegments>
    )
}
