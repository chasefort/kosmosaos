import { useMemo, useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useVisibleGraph, useGraphStore } from '../../store/graph.store'
import { useAppStore } from '../../store/app.store'
import { EDGE_COLORS } from '../graph-visuals'

// Temporary vectors reused per frame to avoid allocations
const _src = new THREE.Vector3()
const _tgt = new THREE.Vector3()
const _mid = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _up  = new THREE.Vector3(0, 1, 0)
const _alt = new THREE.Vector3(1, 0, 0)
const _white = new THREE.Color('#eef6ff')

/** Per-edge-type colors — distinct from node type colors */
export const edgeTypeColors: Record<string, string> = {
    ...EDGE_COLORS,
}

const EDGE_RADIUS = 0.075
const EDGE_GLOW_RADIUS = 0.17
const ARROW_RADIUS = 0.22
const ARROW_HEIGHT = 1.3

/** Minimum edge length (world units) to render a visible line */
const MIN_EDGE_LENGTH = 0.5
/** Minimum edge length to place an arrowhead (avoids degenerate quaternions) */
const MIN_ARROW_LENGTH = 3.0

function getEdgeFocus(edge: { fromId: string, toId: string }, selectedNodeId: string | null, hoveredNodeId: string | null) {
    const hasSelection = !!selectedNodeId
    const isConnected = edge.fromId === selectedNodeId || edge.toId === selectedNodeId
    const isHovered = edge.fromId === hoveredNodeId || edge.toId === hoveredNodeId

    if (isConnected) return 1.0
    if (isHovered && !hasSelection) return 0.82
    if (hasSelection) return 0.1
    return 0.5
}

export function EdgeLayer() {
    const { visibleEdges } = useVisibleGraph()
    const layoutNodes = useGraphStore(s => s.layoutNodes)
    const edgeWidthMulti = useGraphStore(s => s.edgeWidthMulti)
    const theme = useGraphStore(s => s.theme)
    const { selectedNodeId, hoveredNodeId, traceEdgeIds } = useAppStore()

    const shaftsRef = useRef<THREE.InstancedMesh>(null)
    const shaftGlowRef = useRef<THREE.InstancedMesh>(null)
    const arrowsRef = useRef<THREE.InstancedMesh>(null)
    const arrowGlowRef = useRef<THREE.InstancedMesh>(null)
    const shaftDummy = useMemo(() => new THREE.Object3D(), [])
    const arrowDummy = useMemo(() => new THREE.Object3D(), [])
    const colorObj = useMemo(() => new THREE.Color(), [])

    // Pre-build THREE.Color objects per edge type
    const colorCache = useMemo(() => {
        const cache: Record<string, THREE.Color> = {}
        for (const [k, v] of Object.entries(edgeTypeColors)) {
            const c = new THREE.Color(v)
            if (theme === 'cyberpunk') c.offsetHSL(0.5, 1, 0.2)
            else if (theme === 'nebula') c.offsetHSL(0.1, 0.4, 0.1)
            cache[k] = c
        }
        return cache
    }, [theme])

    // ── Validated edges: only include edges where both endpoints have a layout position ──
    const validEdges = useMemo(() => {
        return visibleEdges.filter(e => {
            const src = layoutNodes[e.fromId]
            const tgt = layoutNodes[e.toId]
            if (!src || !tgt) return false
            // Skip zero-length edges (same position — often self-references or data issues)
            const dx = tgt.x - src.x, dy = tgt.y - src.y, dz = tgt.z - src.z
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
            return dist >= MIN_EDGE_LENGTH
        })
    }, [visibleEdges, layoutNodes])

    // ── Imperative edge update during drag OR layout switch ──────────────
    // Bypasses React's reconciler so edges follow nodes every frame during drag,
    // and snap immediately when layoutNodes reference changes (layout preset switch).
    const draggingNodeId = useAppStore(s => s.draggingNodeId)
    const layoutNodesRef = useRef(layoutNodes)

    const flushAllEdges = useCallback(() => {
        const shafts = shaftsRef.current
        const shaftGlow = shaftGlowRef.current
        const arrows = arrowsRef.current
        const arrowGlow = arrowGlowRef.current
        if (!shafts || !shaftGlow || !arrows || !arrowGlow) return

        let arrowIdx = 0
        validEdges.forEach((edge, edgeIdx) => {
            const src = layoutNodes[edge.fromId]
            const tgt = layoutNodes[edge.toId]
            if (!src || !tgt) return

            _src.set(src.x, src.y, src.z)
            _tgt.set(tgt.x, tgt.y, tgt.z)
            const edgeLen = _src.distanceTo(_tgt)
            if (edgeLen < MIN_EDGE_LENGTH) return

            const visibleLen = Math.max(edgeLen - 1.6, MIN_EDGE_LENGTH)
            _mid.copy(_src).lerp(_tgt, 0.5)
            _dir.subVectors(_tgt, _src).normalize()
            const dotY = Math.abs(_dir.dot(_up))

            shaftDummy.position.copy(_mid)
            shaftDummy.quaternion.setFromUnitVectors(dotY > 0.999 ? _alt : _up, _dir)
            shaftDummy.scale.set(
                EDGE_RADIUS * edgeWidthMulti,
                visibleLen,
                EDGE_RADIUS * edgeWidthMulti
            )
            shaftDummy.updateMatrix()
            shafts.setMatrixAt(edgeIdx, shaftDummy.matrix)

            shaftDummy.scale.set(
                EDGE_GLOW_RADIUS * edgeWidthMulti,
                visibleLen * 1.04,
                EDGE_GLOW_RADIUS * edgeWidthMulti
            )
            shaftDummy.updateMatrix()
            shaftGlow.setMatrixAt(edgeIdx, shaftDummy.matrix)

            if (edgeLen < MIN_ARROW_LENGTH) return

            const t = Math.min(0.8, 1 - (1.75 / edgeLen))
            arrowDummy.position.copy(_src).lerp(_tgt, t)
            arrowDummy.quaternion.setFromUnitVectors(dotY > 0.999 ? _alt : _up, _dir)
            arrowDummy.scale.set(
                ARROW_RADIUS * edgeWidthMulti,
                ARROW_HEIGHT * edgeWidthMulti,
                ARROW_RADIUS * edgeWidthMulti
            )
            arrowDummy.updateMatrix()
            arrows.setMatrixAt(arrowIdx, arrowDummy.matrix)

            arrowDummy.scale.set(
                ARROW_RADIUS * edgeWidthMulti * 1.9,
                ARROW_HEIGHT * edgeWidthMulti * 1.15,
                ARROW_RADIUS * edgeWidthMulti * 1.9
            )
            arrowDummy.updateMatrix()
            arrowGlow.setMatrixAt(arrowIdx, arrowDummy.matrix)

            arrowIdx++
        })

        shafts.count = validEdges.length
        shaftGlow.count = validEdges.length
        arrows.count = arrowIdx
        arrowGlow.count = arrowIdx
        shafts.instanceMatrix.needsUpdate = true
        shaftGlow.instanceMatrix.needsUpdate = true
        arrows.instanceMatrix.needsUpdate = true
        arrowGlow.instanceMatrix.needsUpdate = true
    }, [validEdges, layoutNodes, edgeWidthMulti, shaftDummy, arrowDummy])

    const flushEdgeColors = useCallback(() => {
        const shafts = shaftsRef.current
        const shaftGlow = shaftGlowRef.current
        const arrows = arrowsRef.current
        const arrowGlow = arrowGlowRef.current
        if (!shafts || !shaftGlow || !arrows || !arrowGlow) return

        let arrowIdx = 0
        validEdges.forEach((edge, edgeIdx) => {
            const baseColor = colorCache[edge.type] || colorCache['correlates']
            const focus = traceEdgeIds.includes(edge.id)
                ? 1.35
                : getEdgeFocus(edge, selectedNodeId, hoveredNodeId)
            const sparkle = 0.1 + Math.min((edge.weight ?? 1) * 0.03, 0.18)

            colorObj.copy(baseColor).lerp(_white, 0.14 + sparkle)
            shafts.setColorAt(edgeIdx, colorObj.multiplyScalar((0.45 + focus * 0.75) * Math.max(edgeWidthMulti, 0.45)))

            colorObj.copy(baseColor).lerp(_white, 0.3)
            shaftGlow.setColorAt(edgeIdx, colorObj.multiplyScalar(0.16 + focus * 0.28))

            const src = layoutNodes[edge.fromId]
            const tgt = layoutNodes[edge.toId]
            if (!src || !tgt) return
            _src.set(src.x, src.y, src.z)
            _tgt.set(tgt.x, tgt.y, tgt.z)
            if (_src.distanceTo(_tgt) < MIN_ARROW_LENGTH) return

            colorObj.copy(baseColor).lerp(_white, 0.22)
            arrows.setColorAt(arrowIdx, colorObj.multiplyScalar(0.55 + focus * 0.8))

            colorObj.copy(baseColor).lerp(_white, 0.42)
            arrowGlow.setColorAt(arrowIdx, colorObj.multiplyScalar(0.18 + focus * 0.32))
            arrowIdx++
        })

        if (shafts.instanceColor) shafts.instanceColor.needsUpdate = true
        if (shaftGlow.instanceColor) shaftGlow.instanceColor.needsUpdate = true
        if (arrows.instanceColor) arrows.instanceColor.needsUpdate = true
        if (arrowGlow.instanceColor) arrowGlow.instanceColor.needsUpdate = true
    }, [validEdges, colorCache, selectedNodeId, hoveredNodeId, traceEdgeIds, layoutNodes, edgeWidthMulti, colorObj])

    useFrame(() => {
        const layoutChanged = layoutNodesRef.current !== layoutNodes
        if (layoutChanged) layoutNodesRef.current = layoutNodes

        if (draggingNodeId || layoutChanged) flushAllEdges()
    })

    useEffect(() => {
        flushAllEdges()
    }, [flushAllEdges])

    useEffect(() => {
        flushEdgeColors()
    }, [flushEdgeColors])

    const maxInstances = validEdges.length || 1

    if (validEdges.length === 0) return null

    return (
        <>
            <instancedMesh ref={shaftGlowRef} args={[undefined, undefined, maxInstances]}>
                <cylinderGeometry args={[1, 1, 1, 14, 1, true]} />
                <meshBasicMaterial
                    transparent
                    opacity={0.28}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending}
                />
            </instancedMesh>

            <instancedMesh ref={shaftsRef} args={[undefined, undefined, maxInstances]}>
                <cylinderGeometry args={[1, 1, 1, 16, 1, true]} />
                <meshBasicMaterial
                    transparent
                    opacity={0.92}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending}
                />
            </instancedMesh>

            <instancedMesh ref={arrowGlowRef} args={[undefined, undefined, maxInstances]}>
                <coneGeometry args={[1, 1, 4, 1]} />
                <meshBasicMaterial
                    transparent
                    depthWrite={false}
                    opacity={0.3}
                    blending={THREE.AdditiveBlending}
                />
            </instancedMesh>

            <instancedMesh ref={arrowsRef} args={[undefined, undefined, maxInstances]}>
                <coneGeometry args={[1, 1, 4, 1]} />
                <meshBasicMaterial
                    transparent
                    depthWrite={false}
                    opacity={0.95}
                    blending={THREE.AdditiveBlending}
                />
            </instancedMesh>

            <EdgeLabels />
        </>
    )
}

/** Renders billboard text labels at edge midpoints for the selected node's connections */
function EdgeLabels() {
    const { visibleEdges } = useVisibleGraph()
    const layoutNodes    = useGraphStore(s => s.layoutNodes)
    const selectedNodeId = useAppStore(s => s.selectedNodeId)
    const showEdgeLabels = useGraphStore(s => s.showEdgeLabels)
    const labelsRef = useRef<(THREE.Object3D | null)[]>([])

    const connected = useMemo(() => {
        if (!selectedNodeId || !showEdgeLabels) return []
        return visibleEdges.filter(
            e => e.fromId === selectedNodeId || e.toId === selectedNodeId
        )
    }, [visibleEdges, selectedNodeId, showEdgeLabels])

    // Billboard: copy camera quaternion each frame so labels always face camera
    useFrame(({ camera }) => {
        for (let i = 0; i < labelsRef.current.length; i++) {
            const label = labelsRef.current[i]
            if (label) label.quaternion.copy(camera.quaternion)
        }
    })

    if (!selectedNodeId || connected.length === 0 || !showEdgeLabels) return null

    return (
        <>
            {connected.map((edge, i) => {
                const src = layoutNodes[edge.fromId]
                const tgt = layoutNodes[edge.toId]
                if (!src || !tgt) return null

                // Label at 50% (midpoint) of the edge
                const mx = (src.x + tgt.x) / 2
                const my = (src.y + tgt.y) / 2
                const mz = (src.z + tgt.z) / 2

                // Offset label slightly perpendicular so it doesn't sit on the line
                const color = edgeTypeColors[edge.type] ?? '#ffffff'

                return (
                    <Text
                        key={edge.id}
                        ref={(el: THREE.Object3D | null) => { labelsRef.current[i] = el }}
                        position={[mx, my + 0.6, mz]}
                        fontSize={0.5}
                        color={color}
                        anchorX="center"
                        anchorY="middle"
                        renderOrder={2}
                        fillOpacity={0.9}
                        outlineOpacity={0}
                        backgroundColor={null}
                        raycast={() => null}
                    >
                        {edge.type}
                    </Text>
                )
            })}
        </>
    )
}
