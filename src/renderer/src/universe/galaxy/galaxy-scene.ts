import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { KosmosNode, KosmosEdge } from '../../../../shared/types'
import type { LayoutNode } from '../layout/force-layout'
import { createStarfieldLayer, type StarfieldLayerHandle } from './starfield-layer'
import { createCoreLayer, faceCoreToCamera, type CoreLayerHandle } from './core-layer'
import { createNodesLayer, type NodesLayerHandle } from './nodes-layer'
import { createEdgesLayer, type EdgesLayerHandle } from './edges-layer'
import { createPostFx, type PostFxHandle } from './post-fx'
import { projectToSpiral } from './spiral-layout'
import { CONSTELLATION_BACKGROUND, LABEL_VISUALS } from '../graph-visuals'

/**
 * Vanilla-three orchestrator for the WebGPU constellation renderer. Owns the
 * WebGPURenderer, scene, camera, controls, post-FX, and per-frame loop.
 * Exposes a small surface so the React shell can push graph data and pull
 * picking results without knowing anything about three.
 */

export interface GalaxySceneCallbacks {
    onHoverChange: (id: string | null) => void
    onSelect: (id: string | null) => void
    onContextMenu: (id: string | null, screenX: number, screenY: number) => void
    onFatalError?: (error: Error) => void
}

export interface FrameState {
    hoveredId: string | null
    selectedId: string | null
    flashes: Record<string, number>
    heatmapMode: boolean
    nodeHeatmap: Record<string, number>
    tracePath: string[]
    traceEdgeIds: string[]
    flyToTarget: { x: number; y: number; z: number } | null
    autoOrbit: boolean
    draggingNodeId: string | null
}

export interface GalaxySceneHandle {
    canvas: HTMLCanvasElement
    /** Push new graph data (nodes/edges + their current laid-out positions). */
    setGraph: (
        nodes: KosmosNode[],
        edges: KosmosEdge[],
        layoutNodes: Record<string, LayoutNode>,
    ) => void
    /** Update only positions (call from sim ticks). */
    updateLayout: (layoutNodes: Record<string, LayoutNode>) => void
    /** Update per-frame state from React stores. */
    setFrameState: (state: FrameState) => void
    /** Trigger a pulse on the galactic core (call when a run starts). */
    pulseCore: (intensity?: number) => void
    /** Trigger an edge pulse (call when a runtime call fires). */
    pulseEdge: (edgeId: string) => void
    /** Capture a PNG snapshot of the current frame as a data URL. */
    captureSnapshot: () => Promise<string | null>
    getLabelAnchors: () => LabelAnchor[]
    resize: (w: number, h: number) => void
    dispose: () => void
}

export interface LabelAnchor {
    id: string
    x: number
    y: number
    depth: number
    visible: boolean
}

interface InternalState {
    nodes: KosmosNode[]
    edges: KosmosEdge[]
    layoutNodes: Record<string, LayoutNode>
    /** Spiral-projected positions per node id, recomputed on each updateLayout */
    projected: Record<string, [number, number, number]>
    frame: FrameState
}

export async function createGalaxyScene(
    canvas: HTMLCanvasElement,
    callbacks: GalaxySceneCallbacks,
    initialSize: { width: number; height: number },
): Promise<GalaxySceneHandle> {
    const toError = (error: unknown): Error => error instanceof Error ? error : new Error(String(error))
    const renderer = new THREE.WebGPURenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    const initialW = Math.max(1, Math.floor(initialSize.width))
    const initialH = Math.max(1, Math.floor(initialSize.height))
    renderer.setSize(initialW, initialH, false)
    renderer.setClearColor(new THREE.Color(CONSTELLATION_BACKGROUND.clear), 1)
    await renderer.init()

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(CONSTELLATION_BACKGROUND.clear)
    const galaxyRoot = new THREE.Group()
    scene.add(galaxyRoot)

    const camera = new THREE.PerspectiveCamera(45, initialW / initialH, 1, 6000)
    camera.position.set(0, 60, 230)

    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 30
    controls.maxDistance = 5000

    const starfield: StarfieldLayerHandle = createStarfieldLayer()
    galaxyRoot.add(starfield.group)

    const core: CoreLayerHandle = createCoreLayer()
    galaxyRoot.add(core.group)

    const nodes: NodesLayerHandle = createNodesLayer()
    galaxyRoot.add(nodes.mesh)

    const edges: EdgesLayerHandle = createEdgesLayer()
    galaxyRoot.add(edges.line)

    const postFx: PostFxHandle = createPostFx(renderer, scene, camera)

    const internal: InternalState = {
        nodes: [],
        edges: [],
        layoutNodes: {},
        projected: {},
        frame: {
            hoveredId: null,
            selectedId: null,
            flashes: {},
            heatmapMode: false,
            nodeHeatmap: {},
            tracePath: [],
            traceEdgeIds: [],
            flyToTarget: null,
            autoOrbit: false,
            draggingNodeId: null,
        },
    }

    function computeProjectedCenter(projected: Record<string, [number, number, number]>): { x: number; z: number } {
        const values = Object.values(projected)
        if (values.length === 0) return { x: 0, z: 0 }

        let sumX = 0
        let sumZ = 0

        for (const [x, , z] of values) {
            sumX += x
            sumZ += z
        }

        return {
            x: sumX / values.length,
            z: sumZ / values.length,
        }
    }

    function recomputeProjected() {
        const projected: Record<string, [number, number, number]> = {}
        for (const node of internal.nodes) {
            const ln = internal.layoutNodes[node.id]
            if (!ln) continue
            const p = projectToSpiral({ x: ln.x, y: ln.y, z: ln.z }, node)
            projected[node.id] = [p.x, p.y, p.z]
        }
        const center = computeProjectedCenter(projected)
        for (const id of Object.keys(projected)) {
            projected[id][0] -= center.x
            projected[id][2] -= center.z
        }
        internal.projected = projected
    }

    function fitCameraToGraph() {
        const values = Object.values(internal.projected)
        if (values.length === 0) return

        let maxRadius = 80
        for (const [x, y, z] of values) {
            maxRadius = Math.max(maxRadius, Math.sqrt(x * x + y * y + z * z))
        }

        const distance = Math.min(2800, Math.max(260, maxRadius * 1.45))
        camera.position.set(0, Math.max(70, distance * 0.16), distance)
        controls.target.set(0, 0, 0)
        controls.update()
    }

    function setGraph(
        nextNodes: KosmosNode[],
        nextEdges: KosmosEdge[],
        layoutNodes: Record<string, LayoutNode>,
    ) {
        internal.nodes = nextNodes
        internal.edges = nextEdges
        internal.layoutNodes = layoutNodes
        nodes.setNodes(nextNodes)
        edges.setEdges(nextEdges, nextNodes)
        recomputeProjected()
        fitCameraToGraph()
        nodes.updatePositions((id) => internal.projected[id] ?? null)
        edges.rebuildGeometry(internal.projected)
    }

    function updateLayout(layoutNodes: Record<string, LayoutNode>) {
        internal.layoutNodes = layoutNodes
        recomputeProjected()
        nodes.updatePositions((id) => internal.projected[id] ?? null)
        edges.rebuildGeometry(internal.projected)
    }

    function setFrameState(state: FrameState) {
        internal.frame = state
    }

    // ── Picking ───────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const tmpNDC = new THREE.Vector2()

    function pickFromClient(clientX: number, clientY: number): string | null {
        const rect = canvas.getBoundingClientRect()
        tmpNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1
        tmpNDC.y = -(((clientY - rect.top) / rect.height) * 2 - 1)
        raycaster.setFromCamera(tmpNDC, camera)
        // Distance threshold scales with camera distance — closer = stricter
        const dist = camera.position.distanceTo(controls.target)
        const threshold = Math.max(4, dist * 0.018)
        return nodes.pickAtRay(raycaster.ray, threshold)
    }

    let lastHoveredId: string | null = null

    const onPointerMove = (ev: PointerEvent) => {
        const id = pickFromClient(ev.clientX, ev.clientY)
        if (id !== lastHoveredId) {
            lastHoveredId = id
            callbacks.onHoverChange(id)
            canvas.style.cursor = id ? 'pointer' : ''
        }
    }
    const onPointerDown = (ev: PointerEvent) => {
        if (ev.button === 2) return
        const id = pickFromClient(ev.clientX, ev.clientY)
        callbacks.onSelect(id)
    }
    const onContextMenu = (ev: MouseEvent) => {
        ev.preventDefault()
        const id = pickFromClient(ev.clientX, ev.clientY)
        callbacks.onContextMenu(id, ev.clientX, ev.clientY)
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('contextmenu', onContextMenu)

    // ── Render loop ───────────────────────────────────────────────────────
    let running = true
    let lastTs = performance.now()
    const flyToTargetVec = new THREE.Vector3()
    const cameraTargetVec = new THREE.Vector3()

    const tick = async () => {
        if (!running) return
        const now = performance.now()
        const dt = Math.min(0.1, (now - lastTs) / 1000)
        lastTs = now

        // Camera animations
        if (internal.frame.flyToTarget) {
            const selectedProjected = internal.frame.selectedId ? internal.projected[internal.frame.selectedId] : null
            if (selectedProjected) {
                flyToTargetVec.set(
                    selectedProjected[0],
                    selectedProjected[1],
                    selectedProjected[2],
                )
            } else {
                flyToTargetVec.set(
                    internal.frame.flyToTarget.x,
                    internal.frame.flyToTarget.y,
                    internal.frame.flyToTarget.z,
                )
            }
            cameraTargetVec.set(
                flyToTargetVec.x,
                flyToTargetVec.y + 12,
                flyToTargetVec.z + 60,
            )
            camera.position.lerp(cameraTargetVec, 0.05)
            controls.target.lerp(flyToTargetVec, 0.05)
        }

        if (internal.frame.autoOrbit && !internal.frame.draggingNodeId) {
            controls.autoRotate = true
            controls.autoRotateSpeed = 0.4
        } else {
            controls.autoRotate = false
        }

        controls.update()

        // Layer updates
        starfield.update(dt)
        core.update(dt)
        edges.update(dt)
        edges.updateHighlights({
            hoveredId: internal.frame.hoveredId,
            selectedId: internal.frame.selectedId,
            traceEdgeIds: internal.frame.traceEdgeIds,
        })
        nodes.updateHighlights({
            hoveredId: internal.frame.hoveredId,
            selectedId: internal.frame.selectedId,
            flashes: internal.frame.flashes,
            heatmapMode: internal.frame.heatmapMode,
            nodeHeatmap: internal.frame.nodeHeatmap,
            tracePath: internal.frame.tracePath,
            now: Date.now(),
        })
        faceCoreToCamera(core.group, camera)

        try {
            await postFx.render()
        } catch (err) {
            console.error('[galaxy-scene] render failed', err)
            running = false
            callbacks.onFatalError?.(toError(err))
            return
        }

        if (running) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    return {
        canvas,
        setGraph,
        updateLayout,
        setFrameState,
        pulseCore: (intensity = 1) => core.pulse(intensity),
        pulseEdge: (id) => edges.pulseEdge(id),
        async captureSnapshot() {
            try {
                return canvas.toDataURL('image/png')
            } catch (err) {
                console.error('[galaxy-scene] snapshot failed', err)
                return null
            }
        },
        getLabelAnchors() {
            const rect = canvas.getBoundingClientRect()
            const width = rect.width || canvas.clientWidth || 1
            const height = rect.height || canvas.clientHeight || 1
            const anchors: LabelAnchor[] = []
            const tmp = new THREE.Vector3()
            for (const node of internal.nodes) {
                const p = internal.projected[node.id]
                if (!p) continue
                tmp.set(p[0], p[1] + 8, p[2]).project(camera)
                const distance = camera.position.distanceTo(new THREE.Vector3(p[0], p[1], p[2]))
                const distanceVisible = distance < LABEL_VISUALS.minOpacityDistance
                anchors.push({
                    id: node.id,
                    x: ((tmp.x + 1) / 2) * width,
                    y: ((-tmp.y + 1) / 2) * height,
                    depth: distance,
                    visible: tmp.z < 1 && distanceVisible,
                })
            }
            return anchors
        },
        resize(w: number, h: number) {
            camera.aspect = w / h
            camera.updateProjectionMatrix()
            postFx.setSize(w, h)
        },
        dispose() {
            running = false
            canvas.removeEventListener('pointermove', onPointerMove)
            canvas.removeEventListener('pointerdown', onPointerDown)
            canvas.removeEventListener('contextmenu', onContextMenu)
            controls.dispose()
            starfield.dispose()
            core.dispose()
            nodes.dispose()
            edges.dispose()
            postFx.dispose()
            renderer.dispose()
        },
    }
}
