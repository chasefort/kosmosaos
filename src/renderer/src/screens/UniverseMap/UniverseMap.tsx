import { useMemo, useEffect, useCallback, Component, useState } from 'react'
import { SpiralGalaxy } from '../../universe/galaxy/SpiralGalaxy'
import { useWebGPUSupport } from '../../universe/galaxy/use-webgpu-support'
import { UniverseCanvas } from '../../universe/UniverseCanvas'
import { FilterPanel } from '../../components/FilterPanel'
import { InspectorPanel } from '../../components/InspectorPanel'
import { NodeTooltip } from '../../universe/scene/NodeTooltip'
import { NodeContextMenu } from '../../components/NodeContextMenu'
import { GraphToolbar } from '../../components/GraphToolbar'
import { LayoutPresetBar } from '../../components/LayoutPresetBar'
import { ReplayOverlay } from '../../components/ReplayOverlay'
import { ArchSummaryModal } from '../../components/ArchSummaryModal'
import { HelpOverlay } from '../../components/HelpOverlay'
import { LiveActivityRail } from '../../components/LiveActivityRail'
import { useVisibleGraph, useGraphStore } from '../../store/graph.store'
import { useAppStore } from '../../store/app.store'
import { edgeTypeColors } from '../../universe/scene/EdgeLayer'
import { CONSTELLATION_BACKGROUND, EDGE_COLORS } from '../../universe/graph-visuals'
import { typeClusterLayout, radialLayout, gridLayout } from '../../universe/layout/layout-presets'
import { runForceLayout } from '../../universe/layout/force-layout'
import { Orbit } from 'lucide-react'

type GalaxyFailurePhase = 'init' | 'render' | 'react'

const BROWSER_RENDERER_FALLBACK_KEY = '__KOSMOS_UNIVERSE_RENDER_FALLBACK__'

function getBrowserRendererFallback(): GalaxyFailurePhase | null {
    if (typeof window === 'undefined') return null
    const value = (window as typeof window & { [BROWSER_RENDERER_FALLBACK_KEY]?: GalaxyFailurePhase })[BROWSER_RENDERER_FALLBACK_KEY]
    return value ?? null
}

function setBrowserRendererFallback(value: GalaxyFailurePhase) {
    if (typeof window === 'undefined') return
    ;(window as typeof window & { [BROWSER_RENDERER_FALLBACK_KEY]?: GalaxyFailurePhase })[BROWSER_RENDERER_FALLBACK_KEY] = value
}

class CanvasErrorBoundary extends Component<{ children: React.ReactNode; onError?: (error: Error) => void }, { hasError: boolean }> {
    constructor(props: any) {
        super(props)
        this.state = { hasError: false }
    }
    static getDerivedStateFromError() { return { hasError: true } }
    componentDidCatch(error: Error) {
        console.error('[UniverseMap] 3D error:', error)
        this.props.onError?.(error)
    }
    render() {
        if (this.state.hasError) {
            return null
        }
        return this.props.children
    }
}

export function UniverseMap() {
    const { nodes, edges, layoutPreset, setLayoutNodes, clearPins } = useGraphStore()
    const { nodeFlashTimestamps } = useAppStore()
    const [recentFlashes, setRecentFlashes] = useState<{ name: string; ts: number }[]>([])
    const graphNodes = useGraphStore(s => s.nodes)

    // Track recently flashed nodes for the DOM overlay
    useEffect(() => {
        const now = Date.now()
        const fresh = Object.entries(nodeFlashTimestamps)
            .filter(([, ts]) => now - ts < 4000)
            .map(([id, ts]) => {
                const node = graphNodes.find(n => n.id === id)
                return { name: node?.name ?? id.split('::').pop() ?? id, ts }
            })
            .sort((a, b) => b.ts - a.ts)
            .slice(0, 5)
        setRecentFlashes(fresh)
    }, [nodeFlashTimestamps, graphNodes])
    const isEmpty = nodes.length === 0

    // Switch layout when preset changes
    useEffect(() => {
        if (nodes.length === 0) return

        if (layoutPreset === 'force') {
            clearPins()
            runForceLayout(nodes, edges, (layoutNodeArr) => {
                const dict: Record<string, any> = {}
                for (const ln of layoutNodeArr) dict[ln.id] = ln
                setLayoutNodes(dict)
            })
        } else {
            clearPins()
            let result: Record<string, any>
            if (layoutPreset === 'type-clusters') result = typeClusterLayout(nodes)
            else if (layoutPreset === 'radial') result = radialLayout(nodes)
            else result = gridLayout(nodes)
            setLayoutNodes(result)
        }
    }, [layoutPreset]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', background: CONSTELLATION_BACKGROUND.css }}>
            {/* 3D Scene */}
            <div style={{ position: 'absolute', inset: 0 }}>
                <GalaxyMount />
            </div>

            {/* Empty state overlay */}
            {isEmpty && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                }}>
                    <div style={{
                        textAlign: 'center', maxWidth: 420, padding: 40,
                        background: CONSTELLATION_BACKGROUND.panelStrong,
                        backdropFilter: 'blur(12px)',
                        border: `1px solid ${CONSTELLATION_BACKGROUND.border}`,
                        borderRadius: 12,
                        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                        pointerEvents: 'auto',
                    }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: 14, margin: '0 auto 18px',
                            background: 'rgba(96,165,250,0.1)',
                            border: '1px solid rgba(96,165,250,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Orbit size={26} color="#60a5fa" />
                        </div>
                        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--k-text-primary)' }}>
                            No Nodes Detected
                        </h2>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--k-text-dim)', lineHeight: 1.65 }}>
                            The workspace scanner didn't find any agents, tools, models, or prompts in this directory.
                            Try opening a project that uses AI agents (LangChain, CrewAI, Claude Code, etc.) or rescan from Settings.
                        </p>
                    </div>
                </div>
            )}

            {/* Live activity ticker — top right */}
            {recentFlashes.length > 0 && (
                <div style={{
                    position: 'absolute', top: 12, right: 12, zIndex: 20,
                    display: 'flex', flexDirection: 'column', gap: 4,
                    pointerEvents: 'none',
                }}>
                    {recentFlashes.map((f, i) => (
                        <div key={f.ts + f.name} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: 'rgba(10,10,18,0.85)',
                            border: '1px solid rgba(96,165,250,0.3)',
                            borderRadius: 6, padding: '3px 8px',
                            opacity: i === 0 ? 1 : 0.6 - i * 0.1,
                        }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399', flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: 'var(--k-text-secondary)', fontFamily: 'monospace' }}>{f.name}</span>
                        </div>
                    ))}
                </div>
            )}

            <LiveActivityRail />

            {/* Filter panel — top left */}
            {!isEmpty && <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
                <FilterPanel />
            </div>}

            {/* Layout preset bar — bottom center, above edge legend */}
            {!isEmpty && (
                <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                    <LayoutPresetBar />
                </div>
            )}

            {/* Feature toolbar — top right (Heatmap, Blast Radius, Snapshot, Summary) */}
            {!isEmpty && <GraphToolbar />}

            {/* Edge type legend — bottom left */}
            <EdgeLegend />

            {/* Feature 1: Replay overlay — bottom center */}
            <ReplayOverlay />

            {/* Hover tooltip */}
            <NodeTooltip />

            {/* Right-click context menu */}
            <NodeContextMenu />

            {/* Inspector panel — slides in from the right when a node is selected */}
            <InspectorPanel />

            {/* Feature 5: Architecture Summary modal */}
            <ArchSummaryModal />

            {/* Help Mode overlay — explains everything on hover */}
            <HelpOverlay />
        </div>
    )
}

/** Gates the WebGPU constellation renderer and falls back to a matched classic canvas. */
function GalaxyMount() {
    const supported = useWebGPUSupport()
    const [fallbackPhase, setFallbackPhase] = useState<GalaxyFailurePhase | null>(() => getBrowserRendererFallback())

    const handleGalaxyFailure = useCallback((error: Error, phase: GalaxyFailurePhase) => {
        console.error(`[UniverseMap] Falling back to classic renderer after ${phase} failure`, error)
        setBrowserRendererFallback(phase)
        setFallbackPhase((current) => current ?? phase)
    }, [])

    if (supported === false) {
        return (
            <>
                <UniverseCanvas />
                <RendererFallbackNotice reason="unsupported" />
            </>
        )
    }
    if (fallbackPhase) {
        return (
            <>
                <UniverseCanvas />
                <RendererFallbackNotice reason={fallbackPhase} />
            </>
        )
    }
    if (supported === null) return null
    return (
        <CanvasErrorBoundary onError={(error) => handleGalaxyFailure(error, 'react')}>
            <SpiralGalaxy onError={(error, phase) => handleGalaxyFailure(error, phase)} />
        </CanvasErrorBoundary>
    )
}

function RendererFallbackNotice({ reason }: { reason: GalaxyFailurePhase | 'unsupported' }) {
    const copy = reason === 'unsupported'
        ? 'WebGPU is unavailable here, so Kosmos is using the matched classic constellation renderer.'
        : 'The WebGPU constellation renderer hit an issue, so Kosmos switched to the matched classic renderer.'

    return (
        <div
            data-testid="renderer-fallback-notice"
            style={{
                position: 'absolute',
                top: 14,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 12,
                padding: '8px 12px',
                borderRadius: 999,
                background: CONSTELLATION_BACKGROUND.panel,
                border: `1px solid ${CONSTELLATION_BACKGROUND.border}`,
                backdropFilter: 'blur(10px)',
                color: 'rgba(226, 232, 240, 0.88)',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.01em',
                pointerEvents: 'none',
                boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
                whiteSpace: 'nowrap',
            }}
        >
            {copy}
        </div>
    )
}

/** Shows a color swatch per edge type that actually exists in the current graph */
function EdgeLegend() {
    const { visibleEdges } = useVisibleGraph()

    const activeTypes = useMemo(
        () => [...new Set(visibleEdges.map(e => e.type))].sort(),
        [visibleEdges]
    )

    if (activeTypes.length === 0) return null

    return (
        <div
            data-help="edge-legend"
            style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            zIndex: 10,
            background: CONSTELLATION_BACKGROUND.panel,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${CONSTELLATION_BACKGROUND.borderSoft}`,
            borderRadius: 8,
            padding: '8px 12px',
            pointerEvents: 'none',
        }}>
            <div style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                marginBottom: 7,
            }}>
                Edge Types
            </div>
            {activeTypes.map(type => (
                <div key={type} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 5,
                }}>
                    {/* Color swatch */}
                    <div style={{
                        width: 22,
                        height: 2,
                        background: EDGE_COLORS[type] ?? edgeTypeColors[type] ?? '#ffffff',
                        borderRadius: 1,
                        flexShrink: 0,
                    }} />
                    {/* Arrow tip */}
                    <div style={{
                        width: 0,
                        height: 0,
                        borderLeft: `5px solid ${EDGE_COLORS[type] ?? edgeTypeColors[type] ?? '#ffffff'}`,
                        borderTop: '3px solid transparent',
                        borderBottom: '3px solid transparent',
                        flexShrink: 0,
                        marginLeft: -6,
                    }} />
                    <span style={{
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.5)',
                        fontFamily: 'var(--k-font-mono, monospace)',
                    }}>
                        {type}
                    </span>
                </div>
            ))}
        </div>
    )
}
