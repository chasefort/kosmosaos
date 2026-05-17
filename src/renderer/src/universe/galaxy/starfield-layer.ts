import * as THREE from 'three/webgpu'
import {
    Fn,
    time,
    attribute,
} from 'three/tsl'
import InstancedPointsGeometry from 'three/examples/jsm/geometries/InstancedPointsGeometry.js'

/**
 * Sparse background stars that keep the scene feeling premium without turning
 * into a galaxy illustration.
 */

interface StarLayerConfig {
    count: number
    minRadius: number
    maxRadius: number
    sizeMin: number
    sizeMax: number
    colorPalette: number[]
    twinkleSpeed: number
    rotationSpeed: number
}

const LAYERS: StarLayerConfig[] = [
    {
        count: 1800,
        minRadius: 1600,
        maxRadius: 2400,
        sizeMin: 0.55,
        sizeMax: 1.15,
        colorPalette: [0xdce8ff, 0xe9eef8, 0xf2e9dc, 0xc4b5fd],
        twinkleSpeed: 0.1,
        rotationSpeed: 0.0001,
    },
    {
        count: 620,
        minRadius: 900,
        maxRadius: 1500,
        sizeMin: 0.75,
        sizeMax: 1.55,
        colorPalette: [0xf6f9ff, 0xe9f2ff, 0xfff4de, 0xbfdbfe],
        twinkleSpeed: 0.2,
        rotationSpeed: 0.0002,
    },
    {
        count: 120,
        minRadius: 500,
        maxRadius: 900,
        sizeMin: 1.05,
        sizeMax: 2.1,
        colorPalette: [0xffffff, 0xf4f8ff, 0xfff3dd, 0xddd6fe],
        twinkleSpeed: 0.28,
        rotationSpeed: 0.0003,
    },
]

function sampleOnShell(rMin: number, rMax: number): [number, number, number] {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 2 - 1)
    const r = rMin + Math.random() * (rMax - rMin)
    return [
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
    ]
}

export interface StarfieldLayerHandle {
    group: THREE.Group
    update: (deltaSeconds: number) => void
    dispose: () => void
}

export function createStarfieldLayer(): StarfieldLayerHandle {
    const group = new THREE.Group()
    const meshes: THREE.Mesh[] = []

    for (const layer of LAYERS) {
        const positions = new Float32Array(layer.count * 3)
        const colors = new Float32Array(layer.count * 3)
        const sizes = new Float32Array(layer.count)
        const phases = new Float32Array(layer.count)

        const palette = layer.colorPalette.map((hex) => new THREE.Color(hex))

        for (let i = 0; i < layer.count; i++) {
            const [x, y, z] = sampleOnShell(layer.minRadius, layer.maxRadius)
            positions[i * 3] = x
            positions[i * 3 + 1] = y
            positions[i * 3 + 2] = z

            const c = palette[(Math.random() * palette.length) | 0]
            const jitter = 0.42 + Math.random() * 0.28
            colors[i * 3] = c.r * jitter
            colors[i * 3 + 1] = c.g * jitter
            colors[i * 3 + 2] = c.b * jitter

            sizes[i] = layer.sizeMin + Math.random() * (layer.sizeMax - layer.sizeMin)
            phases[i] = Math.random() * Math.PI * 2
        }

        const geometry = new InstancedPointsGeometry() as any
        geometry.setPositions(positions)
        geometry.setColors(colors)
        geometry.setAttribute('starSize', new THREE.InstancedBufferAttribute(sizes, 1))
        geometry.setAttribute('starPhase', new THREE.InstancedBufferAttribute(phases, 1))

        const starSize = attribute('starSize', 'float')
        const starPhase = attribute('starPhase', 'float')
        const twinkleSpeed = layer.twinkleSpeed

        const material = new THREE.InstancedPointsNodeMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        } as any)
        material.vertexColors = true

        material.pointWidthNode = starSize

        const instanceColor = attribute('instanceColor', 'vec3')
        material.pointColorNode = Fn(() => {
            const twinkle = time.mul(twinkleSpeed).add(starPhase).sin().mul(0.08).add(0.44)
            return instanceColor.mul(twinkle)
        })()

        const mesh = new THREE.Mesh(geometry, material)
        mesh.frustumCulled = false
        group.add(mesh)
        meshes.push(mesh)
    }

    return {
        group,
        update(deltaSeconds: number) {
            for (let i = 0; i < meshes.length; i++) {
                meshes[i].rotation.y += LAYERS[i].rotationSpeed * deltaSeconds * 60
            }
        },
        dispose() {
            for (const m of meshes) {
                m.geometry.dispose()
                ;(m.material as THREE.Material).dispose()
            }
        },
    }
}
