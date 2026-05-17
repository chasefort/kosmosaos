import { useEffect, useMemo, useRef, useState } from 'react'
import { useGraphStore, useVisibleGraph } from '../../store/graph.store'
import { useAppStore } from '../../store/app.store'
import { tickSim } from '../layout/force-layout'
import { createGalaxyScene, type GalaxySceneHandle, type LabelAnchor } from './galaxy-scene'
import { CONSTELLATION_BACKGROUND, LABEL_VISUALS, NODE_COLORS } from '../graph-visuals'
import { getSmartLabelDecisions } from '../smart-labels'

/**
 * React shell for the WebGPU constellation renderer. Owns the canvas div, instantiates
 * the vanilla three scene once, and keeps it in sync with Zustand state via
 * subscriptions. All actual rendering happens in galaxy-scene.ts.
 */
export interface SpiralGalaxyProps {
    onError?: (error: Error, phase: 'init' | 'render') => void
}

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error))
}

export function SpiralGalaxy({ onError }: SpiralGalaxyProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const sceneRef = useRef<GalaxySceneHandle | null>(null)
    const initRef = useRef<'pending' | 'ready' | 'failed'>('pending')
    const reportedErrorRef = useRef(false)

    const { visibleNodes, visibleEdges } = useVisibleGraph()
    const layoutNodes = useGraphStore(s => s.layoutNodes)
    const selectedNodeId = useAppStore(s => s.selectedNodeId)
    const hoveredNodeId = useAppStore(s => s.hoveredNodeId)
    const tracePath = useAppStore(s => s.tracePath)
    const [labelAnchors, setLabelAnchors] = useState<LabelAnchor[]>([])

    const labelDecisions = useMemo(() => getSmartLabelDecisions({
        nodes: visibleNodes,
        edges: visibleEdges,
        selectedId: selectedNodeId,
        hoveredId: hoveredNodeId,
    }), [visibleNodes, visibleEdges, selectedNodeId, hoveredNodeId])

    const nodeById = useMemo(() => new Map(visibleNodes.map((node) => [node.id, node])), [visibleNodes])

    // ── Scene lifecycle ────────────────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const canvas = document.createElement('canvas')
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.style.display = 'block'
        canvas.style.outline = 'none'
        container.appendChild(canvas)

        // Seed initial size from the container so the WebGPU renderer doesn't
        // boot at 1x1 (canvas.clientWidth is 0 until layout settles).
        const initialRect = container.getBoundingClientRect()

        let cancelled = false
        const reportError = (error: unknown, phase: 'init' | 'render') => {
            if (cancelled || reportedErrorRef.current) return
            reportedErrorRef.current = true
            initRef.current = 'failed'
            const normalized = toError(error)
            if (phase === 'render') {
                sceneRef.current?.dispose()
                sceneRef.current = null
            }
            onError?.(normalized, phase)
        }
        ;(async () => {
            try {
                const scene = await createGalaxyScene(
                    canvas,
                    {
                        onHoverChange: (id) => useAppStore.getState().setHoveredNodeId(id),
                        onSelect: (id) => useAppStore.getState().setSelectedNodeId(id),
                        onContextMenu: (id, x, y) => {
                            if (id) useAppStore.getState().setContextMenu({ nodeId: id, screenX: x, screenY: y })
                            else useAppStore.getState().setContextMenu(null)
                        },
                        onFatalError: (error) => reportError(error, 'render'),
                    },
                    { width: initialRect.width, height: initialRect.height },
                )
                if (cancelled) {
                    scene.dispose()
                    return
                }
                sceneRef.current = scene
                initRef.current = 'ready'

                // Push initial graph
                scene.setGraph(visibleNodes, visibleEdges, layoutNodes)
            } catch (err) {
                console.error('[SpiralGalaxy] init failed', err)
                reportError(err, 'init')
            }
        })()

        // Resize observer — let the WebGPU renderer own the canvas backing store
        const ro = new ResizeObserver(() => {
            const w = container.clientWidth
            const h = container.clientHeight
            if (w === 0 || h === 0) return
            sceneRef.current?.resize(w, h)
        })
        ro.observe(container)

        return () => {
            cancelled = true
            ro.disconnect()
            sceneRef.current?.dispose()
            sceneRef.current = null
            if (canvas.parentElement === container) container.removeChild(canvas)
        }
    }, [])

    // ── Push graph changes to the scene ────────────────────────────────
    useEffect(() => {
        const scene = sceneRef.current
        if (!scene || initRef.current !== 'ready') return
        scene.setGraph(visibleNodes, visibleEdges, layoutNodes)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleNodes, visibleEdges, layoutNodes])

    // ── Tick the d3-force sim and push positions every frame ──────────
    useEffect(() => {
        let raf = 0
        let labelFrame = 0
        const loop = () => {
            const scene = sceneRef.current
            if (scene && initRef.current === 'ready') {
                const updated = tickSim()
                if (updated.length > 0) {
                    const dict: Record<string, any> = {}
                    for (const n of updated) dict[n.id] = n
                    scene.updateLayout(dict)
                }
                // Push current frame state from React stores
                const app = useAppStore.getState()
                scene.setFrameState({
                    hoveredId: app.hoveredNodeId,
                    selectedId: app.selectedNodeId,
                    flashes: app.nodeFlashTimestamps,
                    heatmapMode: app.heatmapMode,
                    nodeHeatmap: app.nodeHeatmap,
                    tracePath: app.tracePath,
                    traceEdgeIds: app.traceEdgeIds,
                    flyToTarget: app.flyToTarget,
                    autoOrbit: app.cameraOrbitEnabled,
                    draggingNodeId: app.draggingNodeId,
                })
                labelFrame++
                if (labelFrame % 4 === 0) setLabelAnchors(scene.getLabelAnchors())
            }
            raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(raf)
    }, [])

    // ── Snapshot trigger ───────────────────────────────────────────────
    const snapshotTrigger = useAppStore(s => s.snapshotTrigger)
    useEffect(() => {
        if (snapshotTrigger === 0) return
        const scene = sceneRef.current
        if (!scene) return
        scene.captureSnapshot().then((url) => {
            if (!url) return
            const a = document.createElement('a')
            a.href = url
            a.download = `kosmos-galaxy-${Date.now()}.png`
            a.click()
        })
    }, [snapshotTrigger])

    // ── Live event pulses ──────────────────────────────────────────────
    const liveActivityTs = useAppStore(s => s.liveActivityTs)
    useEffect(() => {
        if (liveActivityTs === 0) return
        sceneRef.current?.pulseCore(1)
    }, [liveActivityTs])

    return (
        <div
            ref={containerRef}
            data-testid="constellation-renderer"
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                background: CONSTELLATION_BACKGROUND.css,
            }}
        >
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: 'radial-gradient(circle at 50% 54%, rgba(167,139,250,0.08), transparent 34%)',
                    mixBlendMode: 'screen',
                }}
            />
            <ConstellationLabels
                anchors={labelAnchors}
                nodeById={nodeById}
                decisions={labelDecisions}
                selectedNodeId={selectedNodeId}
                hoveredNodeId={hoveredNodeId}
                tracePath={tracePath}
            />
        </div>
    )
}

function ConstellationLabels({
    anchors,
    nodeById,
    decisions,
    selectedNodeId,
    hoveredNodeId,
    tracePath,
}: {
    anchors: LabelAnchor[]
    nodeById: Map<string, ReturnType<typeof useVisibleGraph>['visibleNodes'][number]>
    decisions: ReturnType<typeof getSmartLabelDecisions>
    selectedNodeId: string | null
    hoveredNodeId: string | null
    tracePath: string[]
}) {
    const traceSet = useMemo(() => new Set(tracePath), [tracePath])

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
            {anchors.map((anchor) => {
                const node = nodeById.get(anchor.id)
                if (!node) return null
                const decision = decisions.get(anchor.id)
                if (!anchor.visible || !decision?.visible) return null

                const focus = anchor.id === selectedNodeId || anchor.id === hoveredNodeId || traceSet.has(anchor.id)
                const distanceFade = anchor.depth <= LABEL_VISUALS.fullOpacityDistance
                    ? 1
                    : Math.max(0.2, 1 - (anchor.depth - LABEL_VISUALS.fullOpacityDistance) / (LABEL_VISUALS.minOpacityDistance - LABEL_VISUALS.fullOpacityDistance))
                const opacity = focus ? 1 : distanceFade * (decision.reason === 'primary' ? 0.72 : 0.9)
                const color = NODE_COLORS[node.type] ?? '#ffffff'
                const fileName = node.paths?.[0]?.split('/').pop()

                return (
                    <div
                        key={anchor.id}
                        style={{
                            position: 'absolute',
                            left: anchor.x,
                            top: anchor.y,
                            transform: 'translate(-50%, -118%)',
                            opacity,
                            transition: 'opacity 120ms ease',
                            textAlign: 'center',
                            color,
                            textShadow: '0 0 10px rgba(0,0,0,0.9), 0 0 12px currentColor',
                            fontFamily: 'Inter, system-ui, sans-serif',
                            maxWidth: 180,
                        }}
                    >
                        <div style={{
                            fontSize: focus ? 12 : 10,
                            lineHeight: 1.1,
                            fontWeight: focus ? 700 : 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                            {node.name}
                        </div>
                        {focus && fileName && (
                            <div style={{
                                marginTop: 2,
                                fontSize: 9,
                                lineHeight: 1,
                                color: 'rgba(226,232,240,0.68)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}>
                                {fileName}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
