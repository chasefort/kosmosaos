import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { useGraphStore, useVisibleGraph } from '../../store/graph.store'
import { useAppStore } from '../../store/app.store'
import { heatToHex } from '../utils/graph-algorithms'
import { getSimAlpha, tickSim, pinNode as simPin, unpinNode as simUnpin, reheatSim } from '../layout/force-layout'
import { getSmartLabelDecisions } from '../smart-labels'
import { LABEL_VISUALS, NODE_COLORS } from '../graph-visuals'

// Color map based on node type
export const typeColors: Record<string, string> = {
    ...NODE_COLORS,
}

/** Returns the set of node IDs that are direct neighbors of the given node */
function buildNeighborSet(visibleEdges: ReturnType<typeof useVisibleGraph>['visibleEdges'], selectedId: string | null): Set<string> {
    if (!selectedId) return new Set()
    const set = new Set<string>()
    for (const e of visibleEdges) {
        if (e.fromId === selectedId) set.add(e.toId)
        if (e.toId   === selectedId) set.add(e.fromId)
    }
    return set
}

export function NodeLayer() {
    const { visibleNodes, visibleEdges } = useVisibleGraph()
    const layoutNodes = useGraphStore(s => s.layoutNodes)
    const setLayoutNodes = useGraphStore(s => s.setLayoutNodes)
    const {
        hoveredNodeId, selectedNodeId,
        setHoveredNodeId, setSelectedNodeId, setFlyToTarget, setContextMenu,
        replayActive, replayEvents, replayPlayhead,
        heatmapMode, nodeHeatmap,
        tracePath,
        draggingNodeId, setDraggingNodeId,
        nodeFlashTimestamps,
    } = useAppStore()
    const { pinNode: storePinNode, unpinNode: storeUnpinNode } = useGraphStore()
    const nodeSizeMulti = useGraphStore(s => s.nodeSizeMulti)
    const theme = useGraphStore(s => s.theme)

    const meshRef = useRef<THREE.InstancedMesh>(null)
    const dummy    = useMemo(() => new THREE.Object3D(), [])
    const colorObj = useMemo(() => new THREE.Color(), [])

    /** Per-node flash timestamps for replay: nodeId → ms when last activated */
    const flashTimestamps = useRef<Map<string, number>>(new Map())
    const lastFlashedPlayhead = useRef<number>(-1)

    const neighborSet = useMemo(
        () => buildNeighborSet(visibleEdges, selectedNodeId),
        [visibleEdges, selectedNodeId]
    )

    // ── Instance matrix (scale + position) ───────────────────────────────────
    useEffect(() => {
        if (!meshRef.current || visibleNodes.length === 0 || Object.keys(layoutNodes).length === 0) return

        const hasSelection = !!selectedNodeId

        visibleNodes.forEach((node, i) => {
            const lNode = layoutNodes[node.id]
            if (!lNode) return

            const isSelected = node.id === selectedNodeId
            const isNeighbor = neighborSet.has(node.id)
            const isHovered  = node.id === hoveredNodeId
            const isDragging = node.id === draggingNodeId

            let scale: number
            if      (isDragging)                 scale = 2.2 * nodeSizeMulti
            else if (isSelected)                 scale = 1.9 * nodeSizeMulti
            else if (isNeighbor)                 scale = 1.15 * nodeSizeMulti
            else if (isHovered && !hasSelection) scale = 1.2 * nodeSizeMulti
            else if (hasSelection)               scale = 0.75 * nodeSizeMulti
            else                                 scale = 1.0 * nodeSizeMulti

            dummy.position.set(lNode.x, lNode.y, lNode.z)
            dummy.scale.setScalar(scale)
            dummy.updateMatrix()
            meshRef.current!.setMatrixAt(i, dummy.matrix)
        })

        meshRef.current.instanceMatrix.needsUpdate = true
    }, [visibleNodes, layoutNodes, hoveredNodeId, selectedNodeId, neighborSet, dummy, nodeSizeMulti, draggingNodeId])

    // ── Colors (every frame for smooth animations) ────────────────────────────
    useFrame(() => {
        if (!meshRef.current || visibleNodes.length === 0) return

        const hasSelection = !!selectedNodeId
        const now          = Date.now()

        if (replayActive && replayEvents.length > 0 && replayPlayhead !== lastFlashedPlayhead.current) {
            lastFlashedPlayhead.current = replayPlayhead
            const ev = replayEvents[replayPlayhead]
            if (ev) for (const nodeId of ev.nodeIds) flashTimestamps.current.set(nodeId, now)
        }

        visibleNodes.forEach((node, i) => {
            const isSelected = node.id === selectedNodeId
            const isNeighbor = neighborSet.has(node.id)
            const isHovered  = node.id === hoveredNodeId
            const inTrace    = tracePath.length > 0 && tracePath.includes(node.id)
            const isDragging = node.id === draggingNodeId

            if (heatmapMode) {
                const heat = nodeHeatmap[node.id] ?? 0
                colorObj.setHex(heatToHex(heat))
                if (hasSelection && !isSelected && !isNeighbor) colorObj.multiplyScalar(0.3)
            } else {
                if (theme === 'cyberpunk') {
                    if      (node.type === 'agent') colorObj.setHex(0xff00ff)
                    else if (node.type === 'tool')  colorObj.setHex(0x00ffff)
                    else if (node.type === 'model') colorObj.setHex(0xffff00)
                    else if (node.type === 'file')  colorObj.setHex(0x555555)
                    else                            colorObj.setHex(0x00ff00)
                } else if (theme === 'nebula') {
                    colorObj.set(typeColors[node.type] || '#ffffff')
                    colorObj.offsetHSL(0.08, 0.5, -0.05)
                } else {
                    colorObj.set(typeColors[node.type] || '#ffffff')
                }

                if (isDragging) {
                    // Bright white-hot glow while dragging
                    colorObj.r = Math.min(1, colorObj.r + 0.7)
                    colorObj.g = Math.min(1, colorObj.g + 0.7)
                    colorObj.b = Math.min(1, colorObj.b + 0.7)
                } else if (isSelected) {
                    colorObj.offsetHSL(0, 0.1, 0.35)
                } else if (isNeighbor) {
                    colorObj.offsetHSL(0, 0, 0.18)
                } else if (isHovered && !hasSelection) {
                    colorObj.offsetHSL(0, 0, 0.2)
                } else if (hasSelection) {
                    colorObj.multiplyScalar(0.05)
                }
            }

            if (inTrace) {
                const pulse = 0.7 + 0.3 * Math.sin(now * 0.004)
                colorObj.lerp(new THREE.Color('#00ffff'), pulse * 0.65)
            }

            // Replay-driven flash (local ref)
            const flashTime = flashTimestamps.current.get(node.id)
            if (flashTime !== undefined) {
                const age = now - flashTime
                if (age < 1500) {
                    const flash = Math.pow(1 - age / 1500, 0.5)
                    colorObj.r = Math.min(1, colorObj.r + flash * 0.9)
                    colorObj.g = Math.min(1, colorObj.g + flash * 0.9)
                    colorObj.b = Math.min(1, colorObj.b + flash * 0.9)
                } else {
                    flashTimestamps.current.delete(node.id)
                }
            }
            // Live ingest flash (from store)
            const liveFlashTime = nodeFlashTimestamps[node.id]
            if (liveFlashTime !== undefined) {
                const age = now - liveFlashTime
                if (age < 4000) {
                    const flash = Math.pow(1 - age / 4000, 0.5)
                    colorObj.r = Math.min(1, colorObj.r + flash * 0.9)
                    colorObj.g = Math.min(1, colorObj.g + flash * 0.9)
                    colorObj.b = Math.min(1, colorObj.b + flash * 0.9)
                }
            }

            meshRef.current!.setColorAt(i, colorObj)
        })

        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
    })

    // ── Pointer interactions ──────────────────────────────────────────────────
    // Track pointer-down data to distinguish click vs drag
    const pointerDownData = useRef<{ instanceId: number; x: number; y: number } | null>(null)

    const handlePointerOver = (e: any) => {
        e.stopPropagation()
        if (e.instanceId !== undefined && visibleNodes[e.instanceId]) {
            setHoveredNodeId(visibleNodes[e.instanceId].id)
        }
    }

    const handlePointerOut = () => setHoveredNodeId(null)

    const handlePointerDown = (e: any) => {
        e.stopPropagation()
        if (e.instanceId === undefined || !visibleNodes[e.instanceId]) return
        pointerDownData.current = { instanceId: e.instanceId, x: e.clientX, y: e.clientY }
        // Capture so we keep events even if pointer leaves the mesh
        ;(e.target as any)?.setPointerCapture?.(e.pointerId)
    }

    const handleClick = (e: any) => {
        e.stopPropagation()
        if (e.instanceId !== undefined && visibleNodes[e.instanceId]) {
            // Only select if we didn't drag (moved less than 5px)
            if (pointerDownData.current) {
                const dx = Math.abs(e.clientX - pointerDownData.current.x)
                const dy = Math.abs(e.clientY - pointerDownData.current.y)
                if (dx < 5 && dy < 5) setSelectedNodeId(visibleNodes[e.instanceId].id)
            } else {
                setSelectedNodeId(visibleNodes[e.instanceId].id)
            }
        }
        pointerDownData.current = null
    }

    const handleDoubleClick = (e: any) => {
        e.stopPropagation()
        if (e.instanceId !== undefined && visibleNodes[e.instanceId]) {
            const node = visibleNodes[e.instanceId]
            const lNode = layoutNodes[node.id]
            if (lNode) {
                setSelectedNodeId(node.id)
                setFlyToTarget({ x: lNode.x, y: lNode.y, z: lNode.z })
            }
        }
    }

    const handleContextMenu = (e: any) => {
        e.stopPropagation()
        if (e.instanceId !== undefined && visibleNodes[e.instanceId]) {
            const node = visibleNodes[e.instanceId]
            setContextMenu({ nodeId: node.id, screenX: e.nativeEvent?.clientX ?? 0, screenY: e.nativeEvent?.clientY ?? 0 })
        }
    }

    const handlePointerMissed = () => {
        setSelectedNodeId(null)
        setContextMenu(null)
    }

    if (visibleNodes.length === 0 || Object.keys(layoutNodes).length === 0) return null

    return (
        <>
            <instancedMesh
                ref={meshRef}
                args={[undefined, undefined, visibleNodes.length]}
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
                onPointerDown={handlePointerDown}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu}
                onPointerMissed={handlePointerMissed}
            >
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.85}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </instancedMesh>

            <NodeLabels neighborSet={neighborSet} />
            <ScreenProjector />

            {/* Handles live drag math inside R3F context */}
            <DragHandler
                visibleNodes={visibleNodes}
                layoutNodes={layoutNodes}
                setLayoutNodes={setLayoutNodes}
                draggingNodeId={draggingNodeId}
                setDraggingNodeId={setDraggingNodeId}
                storePinNode={storePinNode}
                storeUnpinNode={storeUnpinNode}
                pointerDownData={pointerDownData}
                setSelectedNodeId={setSelectedNodeId}
            />

            {/* Pushes live sim positions to the store while sim is warm */}
            <SimulationTicker
                layoutNodes={layoutNodes}
                setLayoutNodes={setLayoutNodes}
                visibleNodes={visibleNodes}
            />
        </>
    )
}

// ─── DragHandler ─────────────────────────────────────────────────────────────
// Lives inside the Canvas so it can use useThree for camera/raycaster access.

interface DragHandlerProps {
    visibleNodes: ReturnType<typeof useVisibleGraph>['visibleNodes']
    layoutNodes: Record<string, any>
    setLayoutNodes: (l: Record<string, any>) => void
    draggingNodeId: string | null
    setDraggingNodeId: (id: string | null) => void
    storePinNode: (id: string) => void
    storeUnpinNode: (id: string) => void
    pointerDownData: React.MutableRefObject<{ instanceId: number; x: number; y: number } | null>
    setSelectedNodeId: (id: string | null) => void
}

function DragHandler({
    visibleNodes, layoutNodes, setLayoutNodes,
    draggingNodeId, setDraggingNodeId,
    storePinNode, storeUnpinNode,
    pointerDownData, setSelectedNodeId,
}: DragHandlerProps) {
    const { camera, gl } = useThree()
    const dragPlane   = useMemo(() => new THREE.Plane(), [])
    const raycaster   = useMemo(() => new THREE.Raycaster(), [])
    const mouse       = useMemo(() => new THREE.Vector2(), [])
    const intersection = useMemo(() => new THREE.Vector3(), [])
    const DRAG_THRESHOLD = 5 // px to distinguish click vs drag

    useEffect(() => {
        const canvas = gl.domElement

        const onPointerMove = (e: PointerEvent) => {
            if (!pointerDownData.current) return

            const { instanceId, x: startX, y: startY } = pointerDownData.current
            const dx = Math.abs(e.clientX - startX)
            const dy = Math.abs(e.clientY - startY)

            // Start dragging once we've moved past the threshold
            if (!draggingNodeId && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
                if (instanceId !== undefined && visibleNodes[instanceId]) {
                    const nodeId = visibleNodes[instanceId].id
                    const lNode = layoutNodes[nodeId]
                    if (lNode) {
                        // Build a plane facing the camera at the node's position
                        const nodePos = new THREE.Vector3(lNode.x, lNode.y, lNode.z)
                        const normal = camera.position.clone().sub(nodePos).normalize()
                        dragPlane.setFromNormalAndCoplanarPoint(normal, nodePos)
                        setDraggingNodeId(nodeId)
                        setSelectedNodeId(nodeId)
                    }
                }
            }

            // Update dragged node position
            if (draggingNodeId) {
                const rect = canvas.getBoundingClientRect()
                mouse.set(
                    ((e.clientX - rect.left) / rect.width) * 2 - 1,
                    -((e.clientY - rect.top) / rect.height) * 2 + 1
                )
                raycaster.setFromCamera(mouse, camera)
                if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
                    // Update both the sim node (so physics reacts) and the store
                    simPin(draggingNodeId, intersection.x, intersection.y, intersection.z)
                    setLayoutNodes({
                        ...layoutNodes,
                        [draggingNodeId]: {
                            ...layoutNodes[draggingNodeId],
                            x: intersection.x,
                            y: intersection.y,
                            z: intersection.z,
                        }
                    })
                }
            }
        }

        const onPointerUp = () => {
            if (draggingNodeId) {
                // Keep the node pinned at its final position — don't reheat the sim
                // so the rest of the graph stays exactly where it is
                storePinNode(draggingNodeId)
                setDraggingNodeId(null)
            }
            pointerDownData.current = null
        }

        canvas.addEventListener('pointermove', onPointerMove)
        canvas.addEventListener('pointerup', onPointerUp)
        return () => {
            canvas.removeEventListener('pointermove', onPointerMove)
            canvas.removeEventListener('pointerup', onPointerUp)
        }
    }, [
        draggingNodeId, visibleNodes, layoutNodes,
        camera, gl, raycaster, mouse, intersection, dragPlane,
        setDraggingNodeId, setLayoutNodes, storePinNode, storeUnpinNode,
        pointerDownData, setSelectedNodeId,
    ])

    return null
}

// ─── SimulationTicker ────────────────────────────────────────────────────────
// Runs inside the Canvas; pushes live sim positions to the store while warm.

function SimulationTicker({
    layoutNodes, setLayoutNodes, visibleNodes,
}: {
    layoutNodes: Record<string, any>
    setLayoutNodes: (l: Record<string, any>) => void
    visibleNodes: ReturnType<typeof useVisibleGraph>['visibleNodes']
}) {
    const tickCountRef = useRef(0)
    const draggingNodeId = useAppStore(s => s.draggingNodeId)

    useFrame(() => {
        const alpha = getSimAlpha()
        if (alpha <= 0.001) { tickCountRef.current = 0; return }

        // Don't run sim ticks while user is dragging — the drag handler owns
        // position updates for the dragged node, and we don't want the sim
        // to push other nodes around simultaneously.
        if (draggingNodeId) return

        // Run multiple ticks per frame when hot for faster settling
        const ticks = alpha > 0.1 ? 3 : 1
        let updatedNodes: any[] | null = null
        for (let i = 0; i < ticks; i++) {
            updatedNodes = tickSim()
        }

        if (!updatedNodes) return

        // Build updated layoutNodes dict from sim state
        // Only update nodes that are in visibleNodes (performance)
        const visibleSet = new Set(visibleNodes.map((n: any) => n.id))
        const next: Record<string, any> = { ...layoutNodes }
        let changed = false
        for (const n of updatedNodes) {
            if (visibleSet.has(n.id)) {
                next[n.id] = { ...n }
                changed = true
            }
        }
        if (changed) setLayoutNodes(next)

        tickCountRef.current++
    })

    return null
}

// ─── NodeLabels ───────────────────────────────────────────────────────────────
function NodeLabels({ neighborSet }: { neighborSet: Set<string> }) {
    const { visibleNodes, visibleEdges } = useVisibleGraph()
    const layoutNodes    = useGraphStore(s => s.layoutNodes)
    const selectedNodeId = useAppStore(s => s.selectedNodeId)
    const hoveredNodeId = useAppStore(s => s.hoveredNodeId)
    const draggingNodeId = useAppStore(s => s.draggingNodeId)
    const nameLabelsRef  = useRef<(THREE.Object3D | null)[]>([])
    const fileLabelsRef  = useRef<(THREE.Object3D | null)[]>([])

    const decisions = useMemo(() => getSmartLabelDecisions({
        nodes: visibleNodes,
        edges: visibleEdges,
        selectedId: selectedNodeId,
        hoveredId: hoveredNodeId,
        maxAutomaticLabels: LABEL_VISUALS.maxAutomaticLabels,
    }), [visibleNodes, visibleEdges, selectedNodeId, hoveredNodeId])

    useFrame(({ camera: cam }) => {
        const hasSelection = !!selectedNodeId

        for (let i = 0; i < visibleNodes.length; i++) {
            const nameLabel = nameLabelsRef.current[i]
            const fileLabel = fileLabelsRef.current[i]
            if (!nameLabel && !fileLabel) continue
            const node  = visibleNodes[i]
            const lNode = layoutNodes[node.id]
            if (!lNode) continue

            if (nameLabel) nameLabel.quaternion.copy(cam.quaternion)
            if (fileLabel) fileLabel.quaternion.copy(cam.quaternion)

            const dist = cam.position.distanceTo(new THREE.Vector3(lNode.x, lNode.y, lNode.z))
            let opacity = 1.0
            if      (dist > 520) opacity = 0.0
            else if (dist > 180) opacity = 1.0 - (dist - 180) / 340

            if (hasSelection && node.id !== selectedNodeId && !neighborSet.has(node.id)) opacity *= 0.04
            if (!decisions.get(node.id)?.visible) opacity = 0

            // Boost label opacity while dragging this node
            if (node.id === draggingNodeId) opacity = 1.0

            if (nameLabel && (nameLabel as any).material) (nameLabel as any).material.opacity = opacity
            if (fileLabel && (fileLabel as any).material) (fileLabel as any).material.opacity = opacity * 0.65
        }
    })

    if (Object.keys(layoutNodes).length === 0) return null

    return (
        <>
            {visibleNodes.map((node, i) => {
                const lNode = layoutNodes[node.id]
                if (!lNode) return null
                const color = typeColors[node.type] || '#ffffff'
                const firstPath = node.paths?.[0] ?? ''
                const fileName  = firstPath.split('/').pop() ?? ''
                const decision = decisions.get(node.id)
                if (!decision?.visible) return null
                const focus = node.id === selectedNodeId || node.id === hoveredNodeId || neighborSet.has(node.id)

                return (
                    <group key={node.id}>
                        <Text
                            ref={(el) => { nameLabelsRef.current[i] = el }}
                            position={[lNode.x, lNode.y + 1.9, lNode.z]}
                            fontSize={focus ? 1.05 : 0.82}
                            anchorX="center"
                            anchorY="bottom"
                            color={color}
                            renderOrder={2}
                            fillOpacity={focus ? 1 : 0.78}
                            outlineOpacity={0}
                            backgroundColor={null}
                            raycast={() => null}
                        >
                            {node.name}
                        </Text>
                        {focus && fileName && (
                            <Text
                                ref={(el) => { fileLabelsRef.current[i] = el }}
                                position={[lNode.x, lNode.y + 1.05, lNode.z]}
                                fontSize={0.6}
                                anchorX="center"
                                anchorY="bottom"
                                color={color}
                                renderOrder={2}
                                fillOpacity={0.65}
                                outlineOpacity={0}
                                backgroundColor={null}
                                raycast={() => null}
                            >
                                {fileName}
                            </Text>
                        )}
                    </group>
                )
            })}
        </>
    )
}

// ─── ScreenProjector ─────────────────────────────────────────────────────────
function ScreenProjector() {
    const { camera, gl } = useThree()
    const hoveredNodeId = useAppStore(s => s.hoveredNodeId)
    const layoutNodes = useGraphStore(s => s.layoutNodes)
    const setTooltipScreenPos = useAppStore(s => s.setTooltipScreenPos)
    const vec = useMemo(() => new THREE.Vector3(), [])

    useFrame(() => {
        if (!hoveredNodeId) { setTooltipScreenPos(null); return }
        const lNode = layoutNodes[hoveredNodeId]
        if (!lNode) { setTooltipScreenPos(null); return }

        vec.set(lNode.x, lNode.y + 2.5, lNode.z)
        vec.project(camera)

        const canvas = gl.domElement
        const x = ((vec.x + 1) / 2) * canvas.clientWidth
        const y = ((-vec.y + 1) / 2) * canvas.clientHeight

        if (vec.z < 1) setTooltipScreenPos({ x, y })
        else setTooltipScreenPos(null)
    })

    return null
}
