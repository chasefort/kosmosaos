import * as THREE from 'three/webgpu'
import { Fn, float, vec4, time, attribute, vertexColor } from 'three/tsl'
import type { KosmosEdge, KosmosNode } from '../../../../shared/types'
import { EDGE_TYPE_COLORS } from './type-palette'

/**
 * Edges as restrained constellation segments. Keep them delicate and legible,
 * with just enough shimmer to feel premium.
 */

export interface EdgesLayerHandle {
    line: THREE.LineSegments
    setEdges: (edges: KosmosEdge[], nodes: KosmosNode[]) => void
    /** Recompute edge geometry from current node positions. Cheap-ish; call sparingly. */
    rebuildGeometry: (positionsByNodeId: Record<string, [number, number, number]>) => void
    /** Pulse a single edge by id (call from live event handler) */
    pulseEdge: (edgeId: string) => void
    updateHighlights: (state: {
        hoveredId: string | null
        selectedId: string | null
        traceEdgeIds: string[]
    }) => void
    update: (deltaSeconds: number) => void
    dispose: () => void
}

const SEGMENTS = 1

interface EdgeRecord {
    id: string
    type: string
    fromId: string
    toId: string
    color: THREE.Color
}

export function createEdgesLayer(): EdgesLayerHandle {
    const geometry = new THREE.BufferGeometry()

    // Pre-allocate placeholder buffers (one degenerate segment) so the WebGPU
    // pipeline can compile before any edges have been pushed in.
    let positions = new Float32Array(6)
    let colors = new Float32Array(6)
    let progresses = new Float32Array([0, 1])
    let pulseAmounts = new Float32Array([0, 0])
    let focusAmounts = new Float32Array([1, 1])
    let edges: EdgeRecord[] = []

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('edgeProgress', new THREE.BufferAttribute(progresses, 1))
    geometry.setAttribute('edgePulse', new THREE.BufferAttribute(pulseAmounts, 1))
    geometry.setAttribute('edgeFocus', new THREE.BufferAttribute(focusAmounts, 1))

    const material = new THREE.LineBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    })
    material.vertexColors = true

    const aProgress = attribute('edgeProgress', 'float')
    const aPulse = attribute('edgePulse', 'float')
    const aFocus = attribute('edgeFocus', 'float')

    material.colorNode = Fn(() => {
        const shimmer = time.mul(0.28).add(aProgress.mul(6.2831)).sin().mul(0.08).add(0.92)
        const intensity = float(0.84).mul(shimmer).mul(aFocus).add(aPulse.mul(0.24))

        const vc = vertexColor().rgb
        const rgb = vc.mul(intensity)

        const alpha = float(0.26).mul(aFocus).add(aPulse.mul(0.16))
        return vec4(rgb, alpha)
    })()

    const line = new THREE.LineSegments(geometry, material)
    line.frustumCulled = false
    line.renderOrder = 1
    line.visible = false

    function setEdges(rawEdges: KosmosEdge[], nodes: KosmosNode[]) {
        const known = new Set(nodes.map(n => n.id))
        edges = rawEdges
            .filter(e => known.has(e.fromId) && known.has(e.toId))
            .map(e => ({
                id: e.id,
                type: e.type,
                fromId: e.fromId,
                toId: e.toId,
                color: new THREE.Color(EDGE_TYPE_COLORS[e.type] ?? 0x9ca3af),
            }))

        if (edges.length === 0) {
            line.visible = false
            return
        }

        const segCount = edges.length * SEGMENTS
        // LineSegments uses pairs; we lay out as a polyline expanded to pairs
        positions = new Float32Array(segCount * 2 * 3)
        colors = new Float32Array(segCount * 2 * 3)
        progresses = new Float32Array(segCount * 2)
        pulseAmounts = new Float32Array(segCount * 2)
        focusAmounts = new Float32Array(segCount * 2)

        // Pre-fill colors and progress (only positions vary per frame)
        for (let e = 0; e < edges.length; e++) {
            const c = edges[e].color
            for (let s = 0; s < SEGMENTS; s++) {
                const t0 = s / SEGMENTS
                const t1 = (s + 1) / SEGMENTS
                const baseIdx = (e * SEGMENTS + s) * 2
                colors[baseIdx * 3 + 0] = c.r
                colors[baseIdx * 3 + 1] = c.g
                colors[baseIdx * 3 + 2] = c.b
                colors[(baseIdx + 1) * 3 + 0] = c.r
                colors[(baseIdx + 1) * 3 + 1] = c.g
                colors[(baseIdx + 1) * 3 + 2] = c.b
                progresses[baseIdx + 0] = t0
                progresses[baseIdx + 1] = t1
                focusAmounts[baseIdx + 0] = 1
                focusAmounts[baseIdx + 1] = 1
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        geometry.setAttribute('edgeProgress', new THREE.BufferAttribute(progresses, 1))
        geometry.setAttribute('edgePulse', new THREE.BufferAttribute(pulseAmounts, 1))
        geometry.setAttribute('edgeFocus', new THREE.BufferAttribute(focusAmounts, 1))
        line.visible = true
    }

    const tmpA = new THREE.Vector3()
    const tmpB = new THREE.Vector3()
    function rebuildGeometry(positionsByNodeId: Record<string, [number, number, number]>) {
        for (let e = 0; e < edges.length; e++) {
            const rec = edges[e]
            const a = positionsByNodeId[rec.fromId]
            const b = positionsByNodeId[rec.toId]
            if (!a || !b) continue
            tmpA.set(a[0], a[1], a[2])
            tmpB.set(b[0], b[1], b[2])

            const baseIdx = e * 2
            positions[baseIdx * 3 + 0] = tmpA.x
            positions[baseIdx * 3 + 1] = tmpA.y
            positions[baseIdx * 3 + 2] = tmpA.z
            positions[(baseIdx + 1) * 3 + 0] = tmpB.x
            positions[(baseIdx + 1) * 3 + 1] = tmpB.y
            positions[(baseIdx + 1) * 3 + 2] = tmpB.z
        }
        const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
        posAttr.needsUpdate = true
        geometry.computeBoundingSphere()
    }

    // Per-edge pulse decay (separate from segment pulse buffer)
    const pulseState = new Map<string, number>()

    function pulseEdge(edgeId: string) {
        pulseState.set(edgeId, Math.min(2, (pulseState.get(edgeId) ?? 0) + 1))
    }

    function updateHighlights(state: {
        hoveredId: string | null
        selectedId: string | null
        traceEdgeIds: string[]
    }) {
        const traceEdges = new Set(state.traceEdgeIds)
        const focusNode = state.selectedId ?? state.hoveredId
        const hasFocus = !!focusNode || traceEdges.size > 0
        let dirty = false

        for (let e = 0; e < edges.length; e++) {
            const rec = edges[e]
            const touchesFocus = !!focusNode && (rec.fromId === focusNode || rec.toId === focusNode)
            const inTrace = traceEdges.has(rec.id)
            const target = !hasFocus ? 1 : inTrace ? 1.9 : touchesFocus ? 1.45 : 0.22
            const baseIdx = e * 2
            if (focusAmounts[baseIdx] !== target || focusAmounts[baseIdx + 1] !== target) {
                focusAmounts[baseIdx] = target
                focusAmounts[baseIdx + 1] = target
                dirty = true
            }
        }

        if (dirty) {
            const focusAttr = geometry.getAttribute('edgeFocus') as THREE.BufferAttribute
            if (focusAttr) focusAttr.needsUpdate = true
        }
    }

    function update(deltaSeconds: number) {
        const decay = Math.max(0, 1 - deltaSeconds * 1.4)
        let dirty = false
        for (let e = 0; e < edges.length; e++) {
            const rec = edges[e]
            const cur = pulseState.get(rec.id) ?? 0
            const next = cur > 0.001 ? cur * decay : 0
            if (next !== cur) {
                pulseState.set(rec.id, next)
                const baseIdx = e * 2
                pulseAmounts[baseIdx] = next
                pulseAmounts[baseIdx + 1] = next
                dirty = true
            }
        }
        if (dirty) {
            const pulseAttr = geometry.getAttribute('edgePulse') as THREE.BufferAttribute
            pulseAttr.needsUpdate = true
        }
    }

    return {
        line,
        setEdges,
        rebuildGeometry,
        pulseEdge,
        updateHighlights,
        update,
        dispose() {
            geometry.dispose()
            material.dispose()
        },
    }
}
