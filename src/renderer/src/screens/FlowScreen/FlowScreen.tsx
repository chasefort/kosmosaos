/**
 * FlowScreen — 2D interactive flowchart view of the workspace graph.
 *
 * Uses @xyflow/react (React Flow v12) for the canvas, dagre for
 * hierarchical auto-layout, and shares selection state with the 3D view.
 */

import { useCallback, useMemo, useState, memo } from 'react'
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Handle,
    Position,
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    useReactFlow,
    ReactFlowProvider,
    type Node,
    type Edge,
    type NodeProps,
    type EdgeProps,
    BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { useVisibleGraph, useGraphStore, type GraphTheme } from '../../store/graph.store'
import { useAppStore } from '../../store/app.store'
import { InspectorPanel } from '../../components/InspectorPanel'
import { KosmosNode, KosmosEdge } from '../../../../shared/types'
import { AlignLeft, AlignCenter, LayoutGrid } from 'lucide-react'

// ── Per-theme config ──────────────────────────────────────────────────────────

const FLOW_THEMES: Record<GraphTheme, {
    canvasBg: string; dotColor: string
    controlsBg: string; minimapBg: string
    nodeBg: string; chromeBorder: string
}> = {
    default: {
        canvasBg:     '#080810',
        dotColor:     'rgba(255,255,255,0.07)',
        controlsBg:   'rgba(15,15,22,0.92)',
        minimapBg:    'rgba(10,10,15,0.92)',
        nodeBg:       'rgba(15,15,22,0.92)',
        chromeBorder: 'rgba(255,255,255,0.08)',
    },
    nebula: {
        canvasBg:     '#0a0515',
        dotColor:     'rgba(180,100,255,0.1)',
        controlsBg:   'rgba(15,8,26,0.94)',
        minimapBg:    'rgba(10,5,20,0.94)',
        nodeBg:       'rgba(18,10,30,0.92)',
        chromeBorder: 'rgba(180,100,255,0.13)',
    },
    cyberpunk: {
        canvasBg:     '#000005',
        dotColor:     'rgba(0,245,180,0.07)',
        controlsBg:   'rgba(5,5,12,0.96)',
        minimapBg:    'rgba(0,0,8,0.96)',
        nodeBg:       'rgba(5,5,12,0.92)',
        chromeBorder: 'rgba(0,245,180,0.1)',
    },
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_W = 200
const NODE_H = 72

/** Node type → accent color */
const TYPE_COLORS: Record<string, string> = {
    agent:            '#fbbf24',
    tool:             '#a78bfa',
    prompt:           '#f472b6',
    model:            '#60a5fa',
    memory_store:     '#34d399',
    api:              '#f87171',
    module:           '#64748b',
    file:             '#94a3b8',
    permission_scope: '#ef4444',
}

/** Edge type → stroke color (matches EdgeLayer) */
const EDGE_COLORS: Record<string, string> = {
    defines:    '#60a5fa',
    uses:       '#fbbf24',
    calls:      '#34d399',
    reads:      '#a78bfa',
    writes:     '#f87171',
    imports:    '#94a3b8',
    permits:    '#10b981',
    denies:     '#ef4444',
    emits:      '#f472b6',
    correlates: '#64748b',
}

const TYPE_LABELS: Record<string, string> = {
    agent: 'Agent', tool: 'Tool', prompt: 'Prompt', model: 'Model',
    memory_store: 'Memory', api: 'API', module: 'Module',
    file: 'File', permission_scope: 'Permission'
}

// ── Dagre layout ──────────────────────────────────────────────────────────────

type Direction = 'LR' | 'TB' | 'radial'

function computeLayout(
    nodes: KosmosNode[],
    edges: KosmosEdge[],
    direction: Direction
): Record<string, { x: number; y: number }> {
    if (nodes.length === 0) return {}

    if (direction === 'radial') {
        // Simple radial: group by type, place type groups in a circle
        const groups: Record<string, KosmosNode[]> = {}
        for (const n of nodes) {
            if (!groups[n.type]) groups[n.type] = []
            groups[n.type].push(n)
        }
        const typeKeys = Object.keys(groups)
        const positions: Record<string, { x: number; y: number }> = {}
        const R_OUTER = 500

        typeKeys.forEach((type, gi) => {
            const angle = (gi / typeKeys.length) * 2 * Math.PI
            const cx = Math.cos(angle) * R_OUTER
            const cy = Math.sin(angle) * R_OUTER
            const groupNodes = groups[type]
            groupNodes.forEach((n, ni) => {
                const a2 = (ni / Math.max(groupNodes.length, 1)) * 2 * Math.PI
                const r2 = groupNodes.length > 1 ? 120 : 0
                positions[n.id] = {
                    x: cx + Math.cos(a2) * r2 - NODE_W / 2,
                    y: cy + Math.sin(a2) * r2 - NODE_H / 2
                }
            })
        })
        return positions
    }

    // dagre hierarchical layout (LR or TB)
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({
        rankdir: direction,
        nodesep: 50,
        ranksep: 100,
        edgesep: 20,
        marginx: 40,
        marginy: 40,
    })

    nodes.forEach(n => g.setNode(n.id, { width: NODE_W + 20, height: NODE_H + 16 }))
    edges.forEach(e => {
        if (nodes.find(n => n.id === e.fromId) && nodes.find(n => n.id === e.toId)) {
            g.setEdge(e.fromId, e.toId)
        }
    })

    dagre.layout(g)

    const positions: Record<string, { x: number; y: number }> = {}
    nodes.forEach(n => {
        const pos = g.node(n.id)
        if (pos) {
            positions[n.id] = { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 }
        }
    })
    return positions
}

// ── Custom node component ─────────────────────────────────────────────────────

type FlowNodeData = {
    kosmosNode: KosmosNode
    connectionCount: number
    isSelected: boolean
    isNeighbor: boolean
    isDimmed: boolean
    isTraced: boolean
    traceOrder: number
}

const FlowNode = memo(function FlowNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
    const { kosmosNode: n, connectionCount, isDimmed, isNeighbor, isTraced, traceOrder } = data
    const color    = TYPE_COLORS[n.type] || '#94a3b8'
    const isActive = selected || data.isSelected
    const graphTheme = useGraphStore(s => s.theme)
    const ft = FLOW_THEMES[graphTheme] ?? FLOW_THEMES.default
    const traceGlow = 'rgba(103, 232, 249, 0.75)'

    return (
        <>
            <Handle type="target" position={Position.Left}   style={{ background: color, border: 'none', width: 7, height: 7, opacity: isDimmed ? 0 : 1 }} />
            <Handle type="target" position={Position.Top}    style={{ background: color, border: 'none', width: 7, height: 7, opacity: isDimmed ? 0 : 1 }} />
            <Handle type="source" position={Position.Right}  style={{ background: color, border: 'none', width: 7, height: 7, opacity: isDimmed ? 0 : 1 }} />
            <Handle type="source" position={Position.Bottom} style={{ background: color, border: 'none', width: 7, height: 7, opacity: isDimmed ? 0 : 1 }} />

            <div style={{
                width: NODE_W,
                background: isActive
                    ? `linear-gradient(135deg, ${color}28, ${color}14)`
                    : isTraced
                        ? 'linear-gradient(135deg, rgba(34,211,238,0.24), rgba(56,189,248,0.1))'
                    : isNeighbor
                        ? `rgba(255,255,255,0.04)`
                        : ft.nodeBg,
                border: `1.5px solid ${
                    isActive   ? color :
                    isTraced   ? '#67e8f9' :
                    isNeighbor ? color + '70' :
                                 color + '50'
                }`,
                borderRadius: 8,
                padding: '10px 12px',
                backdropFilter: 'blur(8px)',
                boxShadow: isActive
                    ? `0 0 0 3px ${color}50, 0 0 20px ${color}30, 0 8px 24px rgba(0,0,0,0.5)`
                    : isTraced
                        ? `0 0 0 2px rgba(103,232,249,0.24), 0 0 24px ${traceGlow}, 0 8px 24px rgba(0,0,0,0.46)`
                    : isNeighbor
                        ? `0 0 10px ${color}20, 0 4px 16px rgba(0,0,0,0.4)`
                        : '0 4px 16px rgba(0,0,0,0.4)',
                transition: 'opacity 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease',
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                opacity: isDimmed ? 0.12 : 1,
                filter: isDimmed ? 'saturate(0.15) brightness(0.6)' : undefined,
            }}>
                {/* Type badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center',
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: 0.8, padding: '2px 6px', borderRadius: 3,
                        background: isTraced ? 'rgba(103,232,249,0.15)' : color + '22',
                        color: isTraced ? '#67e8f9' : color,
                    }}>
                        {TYPE_LABELS[n.type] || n.type}
                    </div>
                    {isTraced && (
                        <div style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: '#67e8f9',
                            background: 'rgba(103,232,249,0.12)',
                            border: '1px solid rgba(103,232,249,0.22)',
                            borderRadius: 999,
                            padding: '2px 6px',
                            flexShrink: 0,
                        }}>
                            Trace {traceOrder + 1}
                        </div>
                    )}
                </div>

                {/* Name */}
                <div style={{
                    fontSize: 12, fontWeight: 600, color: '#f1f5f9',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', marginBottom: 4, lineHeight: 1.3
                }}>
                    {n.name}
                </div>

                {/* Description + connection count */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{
                        fontSize: 10, color: '#64748b',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, marginRight: 6
                    }}>
                        {n.description ? n.description.slice(0, 40) + (n.description.length > 40 ? '…' : '') : ''}
                    </div>
                    {connectionCount > 0 && (
                        <div style={{
                            fontSize: 9, color: color,
                            background: color + '15',
                            padding: '1px 5px', borderRadius: 3,
                            fontWeight: 600, flexShrink: 0
                        }}>
                            {connectionCount}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
})

// ── Custom edge component ─────────────────────────────────────────────────────

type FlowEdgeData = { edgeType: string; isDimmed: boolean; isTraced: boolean; traceOrder: number }

function FlowEdge({
    id, sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition, data, selected
}: EdgeProps<Edge<FlowEdgeData>>) {
    const edgeType = data?.edgeType ?? 'correlates'
    const isDimmed = data?.isDimmed ?? false
    const isTraced = data?.isTraced ?? false
    const color    = EDGE_COLORS[edgeType] || '#64748b'

    // Dimmed = nearly invisible; connected = full bright; default = gentle
    const opacity = isDimmed ? 0.05 : isTraced ? 0.98 : selected ? 1 : 0.45

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX, sourceY, sourcePosition,
        targetX, targetY, targetPosition,
        curvature: 0.25
    })

    return (
        <>
            {/* Outer glow for selected/connected edges */}
            {(selected || isTraced) && !isDimmed && (
                <BaseEdge
                    id={id + '-glow'}
                    path={edgePath}
                    style={{ stroke: isTraced ? '#67e8f9' : color, strokeWidth: isTraced ? 10 : 8, opacity: isTraced ? 0.22 : 0.18 }}
                />
            )}
            <BaseEdge
                id={id}
                path={edgePath}
                style={{
                    stroke: isTraced ? '#7dd3fc' : color,
                    strokeWidth: isTraced ? 2.8 : selected ? 2 : 1.2,
                    opacity,
                    strokeDasharray: isTraced ? '7 6' : undefined,
                }}
                markerEnd={`url(#arrow-${isTraced ? `trace-${edgeType}` : edgeType})`}
            />
            {/* Edge type label — only show when connected/selected */}
            {!isDimmed && (selected || isTraced) && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            fontSize: 9,
                            fontWeight: 600,
                            color: isTraced ? '#67e8f9' : color,
                            background: 'rgba(10,10,15,0.85)',
                            padding: '1px 5px',
                            borderRadius: 3,
                            border: `1px solid ${isTraced ? '#67e8f955' : color + '30'}`,
                            pointerEvents: 'none',
                            opacity: isTraced ? 1 : selected ? 1 : 0.5,
                            whiteSpace: 'nowrap'
                        }}
                        className="nodrag nopan"
                    >
                        {isTraced ? `${edgeType} • Trace ${((data?.traceOrder ?? 0) + 1)}` : edgeType}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    )
}

// ── SVG defs for arrowheads ───────────────────────────────────────────────────

function ArrowDefs() {
    return (
        <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
            <defs>
                {Object.entries(EDGE_COLORS).map(([type, color]) => (
                    <>
                        <marker
                            key={type}
                            id={`arrow-${type}`}
                            markerWidth="10"
                            markerHeight="7"
                            refX="9"
                            refY="3.5"
                            orient="auto"
                        >
                            <polygon points="0 0, 10 3.5, 0 7" fill={color} opacity="0.7" />
                        </marker>
                        <marker
                            key={`${type}-trace`}
                            id={`arrow-trace-${type}`}
                            markerWidth="11"
                            markerHeight="8"
                            refX="10"
                            refY="4"
                            orient="auto"
                        >
                            <polygon points="0 0, 11 4, 0 8" fill="#7dd3fc" opacity="0.95" />
                        </marker>
                    </>
                ))}
            </defs>
        </svg>
    )
}

// ── Layout toolbar ────────────────────────────────────────────────────────────

function LayoutToolbar({ direction, setDirection }: {
    direction: Direction
    setDirection: (d: Direction) => void
}) {
    const { fitView } = useReactFlow()

    const btns: { d: Direction; icon: React.ReactNode; label: string }[] = [
        { d: 'LR', icon: <AlignLeft size={13} />, label: 'Left → Right' },
        { d: 'TB', icon: <AlignCenter size={13} />, label: 'Top → Bottom' },
        { d: 'radial', icon: <LayoutGrid size={13} />, label: 'Radial / Type groups' },
    ]

    return (
        <div style={{
            position: 'absolute', top: 16, left: 16, zIndex: 10,
            display: 'flex', gap: 4, background: 'rgba(15,15,22,0.9)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: 4,
            backdropFilter: 'blur(8px)'
        }}>
            {btns.map(({ d, icon, label }) => (
                <button
                    key={d}
                    title={label}
                    onClick={() => { setDirection(d); setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 60) }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 5, fontSize: 11,
                        cursor: 'pointer',
                        background: direction === d ? 'rgba(96,165,250,0.15)' : 'transparent',
                        color: direction === d ? '#60a5fa' : '#64748b',
                        border: direction === d ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        transition: 'all 0.15s'
                    }}
                >
                    {icon} {label}
                </button>
            ))}

            {/* Node/edge count */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', fontSize: 11, color: '#475569',
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                marginLeft: 2
            }}>
                <span id="flow-node-count" />
            </div>
        </div>
    )
}

// ── FlowCanvas (needs ReactFlowProvider context) ──────────────────────────────

const nodeTypes = { kosmosNode: FlowNode }
const edgeTypes = { kosmosEdge: FlowEdge }

function FlowCanvas() {
    const { visibleNodes, visibleEdges } = useVisibleGraph()
    const { selectedNodeId, setSelectedNodeId, tracePath, traceEdgeIds } = useAppStore()
    const graphTheme = useGraphStore(s => s.theme)
    const ft = FLOW_THEMES[graphTheme] ?? FLOW_THEMES.default

    const [direction, setDirection] = useState<Direction>('LR')
    const { fitView } = useReactFlow()
    const traceNodeOrder = useMemo(() => {
        const map = new Map<string, number>()
        tracePath.forEach((id, idx) => map.set(id, idx))
        return map
    }, [tracePath])
    const traceEdgeOrder = useMemo(() => {
        const map = new Map<string, number>()
        traceEdgeIds.forEach((id, idx) => map.set(id, idx))
        return map
    }, [traceEdgeIds])
    const hasTrace = tracePath.length > 0 || traceEdgeIds.length > 0

    // Pre-compute connection counts
    const connectionCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const e of visibleEdges) {
            counts[e.fromId] = (counts[e.fromId] ?? 0) + 1
            counts[e.toId]   = (counts[e.toId]   ?? 0) + 1
        }
        return counts
    }, [visibleEdges])

    // Set of IDs directly connected to the selected node
    const neighborSet = useMemo(() => {
        if (!selectedNodeId) return new Set<string>()
        const set = new Set<string>()
        for (const e of visibleEdges) {
            if (e.fromId === selectedNodeId) set.add(e.toId)
            if (e.toId   === selectedNodeId) set.add(e.fromId)
        }
        return set
    }, [visibleEdges, selectedNodeId])

    const hasSelection = !!selectedNodeId

    // Compute layout positions with dagre
    const positions = useMemo(
        () => computeLayout(visibleNodes, visibleEdges, direction),
        [visibleNodes, visibleEdges, direction]
    )

    // Build ReactFlow nodes
    const rfNodes: Node<FlowNodeData>[] = useMemo(() =>
        visibleNodes.map(n => {
            const isSelected = n.id === selectedNodeId
            const isNeighbor = neighborSet.has(n.id)
            const isTraced = traceNodeOrder.has(n.id)
            const isDimmed   = hasTrace
                ? !isTraced
                : hasSelection && !isSelected && !isNeighbor
            return {
                id: n.id,
                type: 'kosmosNode',
                position: positions[n.id] ?? { x: 0, y: 0 },
                data: {
                    kosmosNode: n,
                    connectionCount: connectionCounts[n.id] ?? 0,
                    isSelected,
                    isNeighbor,
                    isDimmed,
                    isTraced,
                    traceOrder: traceNodeOrder.get(n.id) ?? -1,
                },
                selected: isSelected,
            }
        }),
        [visibleNodes, positions, connectionCounts, selectedNodeId, neighborSet, hasSelection, hasTrace, traceNodeOrder]
    )

    // Build ReactFlow edges
    const rfEdges: Edge<FlowEdgeData>[] = useMemo(() =>
        visibleEdges.map(e => {
            const isConnected = e.fromId === selectedNodeId || e.toId === selectedNodeId
            const isTraced = traceEdgeOrder.has(e.id)
            const isDimmed = hasTrace
                ? !isTraced
                : hasSelection && !isConnected
            return {
                id: e.id,
                source: e.fromId,
                target: e.toId,
                type: 'kosmosEdge',
                data: { edgeType: e.type, isDimmed, isTraced, traceOrder: traceEdgeOrder.get(e.id) ?? -1 },
                animated: isTraced || isConnected,
                selected: isTraced || isConnected,
            }
        }),
        [visibleEdges, selectedNodeId, hasSelection, hasTrace, traceEdgeOrder]
    )

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id)
    }, [setSelectedNodeId])

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null)
    }, [setSelectedNodeId])

    // Fit view when layout changes
    const onInit = useCallback(() => {
        setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100)
    }, [fitView])

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', background: ft.canvasBg, transition: 'background 0.4s ease' }}>
            <ArrowDefs />

            <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onInit={onInit}
                minZoom={0.05}
                maxZoom={2.5}
                defaultEdgeOptions={{ type: 'kosmosEdge' }}
                proOptions={{ hideAttribution: true }}
                style={{ background: 'transparent' }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={24}
                    size={1}
                    color={ft.dotColor}
                />
                <Controls
                    style={{
                        background: ft.controlsBg,
                        border: `1px solid ${ft.chromeBorder}`,
                        borderRadius: 8,
                        backdropFilter: 'blur(8px)',
                    }}
                />
                <MiniMap
                    nodeColor={(node) => TYPE_COLORS[(node.data as FlowNodeData).kosmosNode?.type] || '#64748b'}
                    maskColor="rgba(0,0,0,0.6)"
                    style={{
                        background: ft.minimapBg,
                        border: `1px solid ${ft.chromeBorder}`,
                        borderRadius: 8,
                    }}
                />
            </ReactFlow>

            <LayoutToolbar direction={direction} setDirection={setDirection} />

            {/* Inspector slides in over the right edge */}
            <InspectorPanel />
        </div>
    )
}

// ── Public export (wraps with ReactFlowProvider) ──────────────────────────────

export function FlowScreen() {
    const graphTheme = useGraphStore(s => s.theme)
    const ft = FLOW_THEMES[graphTheme] ?? FLOW_THEMES.default
    return (
        <div style={{ width: '100%', height: '100%', background: ft.canvasBg, transition: 'background 0.4s ease' }}>
            <ReactFlowProvider>
                <FlowCanvas />
            </ReactFlowProvider>
        </div>
    )
}
