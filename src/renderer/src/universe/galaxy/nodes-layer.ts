import * as THREE from 'three/webgpu'
import {
    Fn,
    time,
    attribute,
    vec3,
} from 'three/tsl'
import InstancedPointsGeometry from 'three/examples/jsm/geometries/InstancedPointsGeometry.js'
import type { KosmosNode } from '../../../../shared/types'
import { NODE_TYPE_PALETTE } from './type-palette'
import { heatToHex } from '../utils/graph-algorithms'

/**
 * Star-like nodes rendered as instanced quads (InstancedPointsGeometry +
 * InstancedPointsNodeMaterial) for WebGPU compatibility. CPU-side picking
 * against a flat positions buffer.
 */

export interface NodesLayerHandle {
    mesh: THREE.Mesh
    setNodes: (nodes: KosmosNode[]) => void
    updatePositions: (getPos: (id: string, i: number) => [number, number, number] | null) => void
    updateHighlights: (state: {
        hoveredId: string | null
        selectedId: string | null
        flashes: Record<string, number>
        heatmapMode: boolean
        nodeHeatmap: Record<string, number>
        tracePath: string[]
        now: number
    }) => void
    pickAtRay: (ray: THREE.Ray, maxDistance: number) => string | null
    dispose: () => void
}

const BASE_SIZE = 14
const HOVER_BOOST = 1.7
const SELECT_BOOST = 2.15
const FLASH_DURATION_MS = 1200

export function createNodesLayer(): NodesLayerHandle {
    const geometry = new InstancedPointsGeometry() as any

    // Placeholder single-instance so the pipeline can compile before data arrives
    geometry.setPositions(new Float32Array(3))
    geometry.setColors(new Float32Array([0, 0, 0]))
    geometry.setAttribute('nodeSize', new THREE.InstancedBufferAttribute(new Float32Array([1]), 1))
    geometry.setAttribute('nodeEmissive', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1))
    geometry.setAttribute('nodePhase', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1))

    let positions = new Float32Array(3)
    let colors = new Float32Array([0, 0, 0])
    let baseColors = new Float32Array([0, 0, 0])
    let sizes = new Float32Array([1])
    let emissive = new Float32Array([0])
    let nodeIds: string[] = []

    const material = new THREE.InstancedPointsNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    } as any)
    material.vertexColors = true

    const aSize = attribute('nodeSize', 'float')
    const aEmissive = attribute('nodeEmissive', 'float')
    const aPhase = attribute('nodePhase', 'float')
    const instanceColor = attribute('instanceColor', 'vec3')

    material.pointWidthNode = aSize

    material.pointColorNode = Fn(() => {
        const breathe = time.mul(0.55).add(aPhase).sin().mul(0.018).add(1.0)
        const tint = instanceColor.mul(aEmissive.mul(0.22).add(0.92))
        const sparkle = vec3(1.0, 1.0, 1.0).mul(aEmissive.mul(0.12))
        return tint.add(sparkle).mul(breathe)
    })()

    const mesh = new THREE.Mesh(geometry, material)
    mesh.frustumCulled = false
    mesh.renderOrder = 5
    mesh.visible = false

    function setNodes(nodes: KosmosNode[]) {
        const n = nodes.length
        if (n === 0) {
            mesh.visible = false
            return
        }
        positions = new Float32Array(n * 3)
        colors = new Float32Array(n * 3)
        baseColors = new Float32Array(n * 3)
        sizes = new Float32Array(n)
        emissive = new Float32Array(n)
        const phases = new Float32Array(n)
        nodeIds = new Array(n)

        for (let i = 0; i < n; i++) {
            const node = nodes[i]
            const palette = NODE_TYPE_PALETTE[node.type] ?? { color: 0xffffff, emissive: 1 }
            const c = new THREE.Color(palette.color)
            colors[i * 3] = c.r
            colors[i * 3 + 1] = c.g
            colors[i * 3 + 2] = c.b
            baseColors[i * 3] = c.r
            baseColors[i * 3 + 1] = c.g
            baseColors[i * 3 + 2] = c.b
            sizes[i] = BASE_SIZE
            emissive[i] = palette.emissive * 0.52
            phases[i] = Math.random() * Math.PI * 2
            nodeIds[i] = node.id
        }

        geometry.setPositions(positions)
        geometry.setColors(colors)
        geometry.setAttribute('nodeSize', new THREE.InstancedBufferAttribute(sizes, 1))
        geometry.setAttribute('nodeEmissive', new THREE.InstancedBufferAttribute(emissive, 1))
        geometry.setAttribute('nodePhase', new THREE.InstancedBufferAttribute(phases, 1))
        mesh.visible = true
    }

    function updatePositions(getPos: (id: string, i: number) => [number, number, number] | null) {
        for (let i = 0; i < nodeIds.length; i++) {
            const p = getPos(nodeIds[i], i)
            if (!p) continue
            positions[i * 3] = p[0]
            positions[i * 3 + 1] = p[1]
            positions[i * 3 + 2] = p[2]
        }
        const attr = geometry.getAttribute('instancePosition')
        if (attr) attr.needsUpdate = true
    }

    function updateHighlights(state: {
        hoveredId: string | null
        selectedId: string | null
        flashes: Record<string, number>
        heatmapMode: boolean
        nodeHeatmap: Record<string, number>
        tracePath: string[]
        now: number
    }) {
        const traceSet = state.tracePath.length > 0 ? new Set(state.tracePath) : null
        let dirty = false
        let colorDirty = false
        for (let i = 0; i < nodeIds.length; i++) {
            const id = nodeIds[i]
            const flashTs = state.flashes[id]
            const flashAge = flashTs ? state.now - flashTs : Infinity
            const flashAmt = flashAge < FLASH_DURATION_MS
                ? (1 - flashAge / FLASH_DURATION_MS) * 1.6
                : 0

            const isHovered = state.hoveredId === id
            const isSelected = state.selectedId === id
            const inTrace = traceSet?.has(id) ?? false
            const hasFocus = !!state.selectedId || !!state.hoveredId || !!traceSet
            const isFocused = isSelected || isHovered || inTrace

            const targetSize = BASE_SIZE *
                (isSelected ? SELECT_BOOST : isHovered ? HOVER_BOOST : inTrace ? 1.45 : hasFocus ? 0.86 : 1) +
                flashAmt * 2.4

            const targetEmissive = (isSelected ? 1.62 : isHovered ? 1.25 : inTrace ? 1.18 : hasFocus && !isFocused ? 0.16 : 0.52) + flashAmt * 0.9

            if (sizes[i] !== targetSize || emissive[i] !== targetEmissive) {
                sizes[i] = targetSize
                emissive[i] = targetEmissive
                dirty = true
            }

            const c = state.heatmapMode
                ? new THREE.Color(heatToHex(state.nodeHeatmap[id] ?? 0))
                : new THREE.Color(baseColors[i * 3], baseColors[i * 3 + 1], baseColors[i * 3 + 2])

            if (hasFocus && !isFocused) c.multiplyScalar(0.32)
            if (isSelected || isHovered) c.lerp(new THREE.Color(0xffffff), 0.38)
            if (inTrace) c.lerp(new THREE.Color(0x67e8f9), 0.42)
            if (flashAmt > 0) c.lerp(new THREE.Color(0xffffff), Math.min(0.8, flashAmt * 0.45))

            if (
                colors[i * 3] !== c.r ||
                colors[i * 3 + 1] !== c.g ||
                colors[i * 3 + 2] !== c.b
            ) {
                colors[i * 3] = c.r
                colors[i * 3 + 1] = c.g
                colors[i * 3 + 2] = c.b
                colorDirty = true
            }
        }
        if (dirty) {
            const sizeAttr = geometry.getAttribute('nodeSize')
            const emAttr = geometry.getAttribute('nodeEmissive')
            if (sizeAttr) sizeAttr.needsUpdate = true
            if (emAttr) emAttr.needsUpdate = true
        }
        if (colorDirty) {
            const colorAttr = geometry.getAttribute('instanceColor')
            if (colorAttr) colorAttr.needsUpdate = true
        }
    }

    const tmpPoint = new THREE.Vector3()
    function pickAtRay(ray: THREE.Ray, maxDistance: number): string | null {
        let bestId: string | null = null
        let bestDist = maxDistance
        for (let i = 0; i < nodeIds.length; i++) {
            tmpPoint.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
            const d = ray.distanceToPoint(tmpPoint)
            const effective = d - sizes[i] * 0.5
            if (effective < bestDist) {
                bestDist = effective
                bestId = nodeIds[i]
            }
        }
        return bestId
    }

    return {
        mesh,
        setNodes,
        updatePositions,
        updateHighlights,
        pickAtRay,
        dispose() {
            geometry.dispose()
            material.dispose()
        },
    }
}
