import { useState } from 'react'
import { useAppStore } from '../store/app.store'
import { useGraphStore, useVisibleGraph } from '../store/graph.store'
import { X, FileEdit, FolderOpen, ArrowRight, ArrowLeft, Tag, Info, ChevronDown, ChevronRight as ChevronRightIcon, Copy, Check, Search, Shield, Orbit } from 'lucide-react'
import { edgeTypeColors } from '../universe/scene/EdgeLayer'
import { typeColors } from '../universe/scene/NodeLayer'
import { traceOutboundFlow } from '../universe/utils/graph-algorithms'

/** Human-readable labels for each edge type */
const edgeTypeLabels: Record<string, string> = {
    defines:    'Defines',
    uses:       'Uses',
    calls:      'Calls',
    reads:      'Reads',
    writes:     'Writes',
    imports:    'Imports',
    permits:    'Permits',
    denies:     'Denies',
    emits:      'Emits',
    correlates: 'Correlates',
    links_to:   'Links To',
    cites:      'Cites',
    derived_from: 'Derived From',
    indexes:    'Indexes',
    documents:  'Documents',
    mentions:   'Mentions',
}

const nodeTypeDescriptions: Record<string, string> = {
    agent:            'An autonomous agent that executes tasks and makes decisions.',
    tool:             'A callable function or utility available to agents.',
    prompt:           'A prompt template or system instruction file.',
    model:            'An LLM or AI model configuration.',
    memory_store:     'A persistent storage layer for agent memory.',
    api:              'An external API or service integration.',
    module:           'A code module or library.',
    file:             'A source file detected in the workspace.',
    permission_scope: 'A permission boundary or access scope.',
    wiki_page:        'A Markdown knowledge page in the local context graph.',
    source_doc:       'Raw source or provenance material used by wiki pages and outputs.',
    output_artifact:  'A generated or deliverable artifact derived from context.',
    instruction_file: 'An agent control surface such as AGENTS.md, CLAUDE.md, or rules files.',
    index_file:       'A navigation or collection index for a context folder.',
    unresolved_link:  'A local Markdown or wikilink target that could not be resolved.',
}

/** Resolve a node path (may be relative) to an absolute path */
function resolvePath(workspacePath: string, nodePath: string): string {
    if (nodePath.startsWith('/')) return nodePath
    return workspacePath.replace(/\/$/, '') + '/' + nodePath
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const,
            letterSpacing: '0.9px', color: 'var(--k-text-dim)', marginBottom: 8,
        }}>
            {children}
        </div>
    )
}

export function InspectorPanel() {
    const { selectedNodeId, setSelectedNodeId, activeWorkspace, openFilePath, setOpenFilePath, setFileExplorerOpen, setTrace, clearTrace, tracePath } = useAppStore()
    const nodes  = useGraphStore(s => s.nodes)
    const edges  = useGraphStore(s => s.edges)
    const { visibleEdges } = useVisibleGraph()
    const [expandedEdge, setExpandedEdge] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const node = nodes.find(n => n.id === selectedNodeId)
    if (!node) return null

    // Partition edges
    const outEdges = edges.filter(e => e.fromId === node.id)
    const inEdges  = edges.filter(e => e.toId   === node.id)

    // Build flat connection list with full edge data
    interface Connection {
        direction: 'out' | 'in'
        edgeType: string
        neighborName: string
        neighborType: string
        neighborId: string
        edgeId: string
        meta?: Record<string, unknown>
    }
    const connections: Connection[] = []
    for (const e of outEdges) {
        const neighbor = nodes.find(n => n.id === e.toId)
        if (neighbor) connections.push({ direction: 'out', edgeType: e.type, neighborName: neighbor.name, neighborType: neighbor.type, neighborId: neighbor.id, edgeId: e.id, meta: e.meta })
    }
    for (const e of inEdges) {
        const neighbor = nodes.find(n => n.id === e.fromId)
        if (neighbor) connections.push({ direction: 'in', edgeType: e.type, neighborName: neighbor.name, neighborType: neighbor.type, neighborId: neighbor.id, edgeId: e.id, meta: e.meta })
    }

    const nodeColor = typeColors[node.type] || '#ffffff'
    const firstPath    = node.paths.length > 0 ? (activeWorkspace ? resolvePath(activeWorkspace.path, node.paths[0]) : node.paths[0]) : null
    const isFileOpen   = firstPath !== null && openFilePath === firstPath
    const fileName     = node.paths[0]?.split('/').pop() ?? ''
    const isTracedNode = tracePath.includes(node.id)

    const handleCopyName = () => {
        navigator.clipboard.writeText(node.name)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    const handleTraceFlow = () => {
        const { nodeIds, edgeIds } = traceOutboundFlow(node.id, visibleEdges)
        setTrace(nodeIds, edgeIds)
    }

    return (
        <div style={{
            width: 340,
            background: 'var(--k-bg-panel)',
            borderLeft: '1px solid var(--k-border-subtle)',
            display: 'flex', flexDirection: 'column',
            position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 50,
            boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
        }}>
            {/* ── Header ── */}
            <div style={{
                padding: '14px 14px 0',
                borderBottom: '1px solid var(--k-border-subtle)',
                background: 'rgba(0,0,0,0.15)',
            }}>
                {/* Type badge + close */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: nodeColor, flexShrink: 0, boxShadow: `0 0 6px ${nodeColor}` }} />
                        <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px',
                            color: nodeColor,
                            background: nodeColor + '18', padding: '2px 8px', borderRadius: 4,
                        }}>
                            {node.type.replace(/_/g, ' ')}
                        </span>
                        {node.confidence < 1 && (
                            <span style={{
                                fontSize: 10, color: 'var(--k-text-dim)',
                                background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4,
                                border: '1px solid rgba(255,255,255,0.07)',
                            }}>
                                {Math.round(node.confidence * 100)}%
                            </span>
                        )}
                    </div>
                    <button onClick={() => setSelectedNodeId(null)}
                        style={{ color: 'var(--k-text-dim)', padding: 4, cursor: 'pointer', borderRadius: 4, display: 'flex' }}>
                        <X size={15} />
                    </button>
                </div>

                {/* Node name + path */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--k-text-primary)', lineHeight: 1.2 }}>
                            {node.name}
                        </div>
                        {fileName && (
                            <div style={{ fontSize: 11, color: 'var(--k-text-dim)', marginTop: 3, fontFamily: 'monospace' }}>
                                {node.paths[0]}
                            </div>
                        )}
                    </div>
                    <button onClick={handleCopyName} title="Copy name"
                        style={{ color: 'var(--k-text-dim)', padding: 5, cursor: 'pointer', borderRadius: 4, display: 'flex', flexShrink: 0, marginTop: 2 }}>
                        {copied ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                    </button>
                </div>

                {/* ── Action Buttons — ALWAYS visible ── */}
                <div style={{ display: 'flex', gap: 6, paddingBottom: 12 }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            if (firstPath) {
                                    setOpenFilePath(isFileOpen ? null : firstPath)
                            }
                        }}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '9px 10px', borderRadius: 7,
                            cursor: firstPath ? 'pointer' : 'not-allowed',
                            background: isFileOpen ? 'rgba(96,165,250,0.15)' : 'rgba(96,165,250,0.08)',
                            border: `1px solid ${isFileOpen ? 'rgba(96,165,250,0.4)' : 'rgba(96,165,250,0.2)'}`,
                            color: isFileOpen ? '#93c5fd' : '#60a5fa',
                            fontSize: 12, fontWeight: 600,
                            opacity: firstPath ? 1 : 0.35,
                            transition: 'all 0.12s',
                            pointerEvents: 'auto',
                        }}
                    >
                        <FileEdit size={14} />
                        {isFileOpen ? 'Close Editor' : 'Edit File'}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            setFileExplorerOpen(true)
                            if (firstPath) setOpenFilePath(firstPath)
                        }}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '9px 10px', borderRadius: 7, cursor: 'pointer',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--k-border-subtle)',
                            color: 'var(--k-text-secondary)',
                            fontSize: 12, fontWeight: 500,
                            transition: 'all 0.12s',
                            pointerEvents: 'auto',
                        }}
                    >
                        <FolderOpen size={14} />
                        See in Files
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 6, paddingBottom: 12 }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            handleTraceFlow()
                        }}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '9px 10px', borderRadius: 7, cursor: 'pointer',
                            background: isTracedNode ? 'rgba(103,232,249,0.16)' : 'rgba(103,232,249,0.08)',
                            border: `1px solid ${isTracedNode ? 'rgba(103,232,249,0.42)' : 'rgba(103,232,249,0.22)'}`,
                            color: '#67e8f9',
                            fontSize: 12, fontWeight: 600,
                            transition: 'all 0.12s',
                        }}
                    >
                        <Orbit size={14} />
                        Trace Flow
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            clearTrace()
                        }}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '9px 10px', borderRadius: 7, cursor: tracePath.length > 0 ? 'pointer' : 'not-allowed',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--k-border-subtle)',
                            color: 'var(--k-text-secondary)',
                            fontSize: 12, fontWeight: 500,
                            transition: 'all 0.12s',
                            opacity: tracePath.length > 0 ? 1 : 0.4,
                        }}
                    >
                        Clear Trace
                    </button>
                </div>
            </div>

            {/* ── Body ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Description */}
                {(node.description || nodeTypeDescriptions[node.type]) && (
                    <div>
                        <SectionLabel>About</SectionLabel>
                        <div style={{
                            fontSize: 12, color: 'var(--k-text-secondary)', lineHeight: 1.65,
                            padding: '10px 12px', borderRadius: 8,
                            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--k-border-subtle)',
                        }}>
                            {node.description || nodeTypeDescriptions[node.type]}
                        </div>
                    </div>
                )}

                {/* Tags */}
                {node.tags && node.tags.length > 0 && (
                    <div>
                        <SectionLabel>Tags</SectionLabel>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {node.tags.map(tag => (
                                <span key={tag} style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    fontSize: 11, padding: '3px 8px', borderRadius: 5,
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                                    color: 'var(--k-text-secondary)',
                                }}>
                                    <Tag size={9} />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                        { label: 'Out', value: outEdges.length },
                        { label: 'In', value: inEdges.length },
                        { label: 'Files', value: node.paths.length },
                    ].map(({ label, value }) => (
                        <div key={label} style={{
                            textAlign: 'center', padding: '8px 6px', borderRadius: 8,
                            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--k-border-subtle)',
                        }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--k-text-primary)' }}>{value}</div>
                            <div style={{ fontSize: 10, color: 'var(--k-text-dim)', marginTop: 1 }}>{label}</div>
                        </div>
                    ))}
                </div>

                {/* ── Connections with evidence ── */}
                {connections.length > 0 && (
                    <div>
                        <SectionLabel>Connections · {connections.length}</SectionLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {connections.map((c) => {
                                const edgeColor = edgeTypeColors[c.edgeType] || '#94a3b8'
                                const isExpanded = expandedEdge === c.edgeId
                                const meta = c.meta || {}
                                const reason = meta.reason as string | undefined
                                const rule = meta.rule as string | undefined
                                const evidenceFile = meta.file as string | undefined

                                return (
                                    <div key={c.edgeId} style={{
                                        borderRadius: 8, overflow: 'hidden',
                                        border: `1px solid ${isExpanded ? edgeColor + '40' : 'rgba(255,255,255,0.06)'}`,
                                        background: isExpanded ? edgeColor + '08' : 'rgba(0,0,0,0.12)',
                                        transition: 'all 0.15s',
                                    }}>
                                        {/* Connection row */}
                                        <div
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                padding: '8px 10px', cursor: 'pointer',
                                                fontSize: 12,
                                            }}
                                            onClick={() => setExpandedEdge(isExpanded ? null : c.edgeId)}
                                        >
                                            {/* Direction arrow */}
                                            {c.direction === 'out'
                                                ? <ArrowRight size={10} style={{ color: edgeColor, flexShrink: 0 }} />
                                                : <ArrowLeft  size={10} style={{ color: edgeColor, flexShrink: 0 }} />
                                            }
                                            {/* Edge type pill */}
                                            <span style={{
                                                fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const,
                                                color: edgeColor, background: edgeColor + '18',
                                                padding: '1px 5px', borderRadius: 3, letterSpacing: '0.3px',
                                                flexShrink: 0,
                                            }}>
                                                {edgeTypeLabels[c.edgeType] || c.edgeType}
                                            </span>
                                            {/* Neighbor name */}
                                            <span
                                                style={{
                                                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    color: 'var(--k-text-primary)', fontWeight: 500,
                                                    cursor: 'pointer',
                                                }}
                                                onClick={(e) => { e.stopPropagation(); setSelectedNodeId(c.neighborId) }}
                                            >
                                                {c.neighborName}
                                            </span>
                                            {/* Neighbor type badge */}
                                            <span style={{
                                                fontSize: 9, flexShrink: 0,
                                                color: typeColors[c.neighborType] || 'var(--k-text-dim)',
                                                background: (typeColors[c.neighborType] || '#ffffff') + '18',
                                                padding: '1px 5px', borderRadius: 3,
                                            }}>
                                                {c.neighborType.replace(/_/g, ' ')}
                                            </span>
                                            {/* Expand indicator */}
                                            <div style={{ flexShrink: 0, color: 'var(--k-text-dim)', display: 'flex' }}>
                                                {isExpanded ? <ChevronDown size={11} /> : <ChevronRightIcon size={11} />}
                                            </div>
                                        </div>

                                        {/* ── Evidence panel (expanded) ── */}
                                        {isExpanded && (
                                            <div style={{
                                                padding: '8px 12px 10px',
                                                borderTop: `1px solid ${edgeColor}20`,
                                                display: 'flex', flexDirection: 'column', gap: 8,
                                            }}>
                                                {/* Why this connection exists */}
                                                {reason && (
                                                    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                                                        <Info size={12} style={{ color: edgeColor, flexShrink: 0, marginTop: 1 }} />
                                                        <div style={{ fontSize: 11, color: 'var(--k-text-secondary)', lineHeight: 1.55 }}>
                                                            {reason}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Detection rule */}
                                                {rule && (
                                                    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                                                        <Shield size={11} style={{ color: 'var(--k-text-dim)', flexShrink: 0, marginTop: 1 }} />
                                                        <div style={{
                                                            fontSize: 10, color: 'var(--k-text-dim)', lineHeight: 1.5,
                                                            fontFamily: 'monospace',
                                                            padding: '3px 7px', borderRadius: 4,
                                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                                                            flex: 1,
                                                        }}>
                                                            {rule}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Source file link */}
                                                {evidenceFile && (
                                                    <button
                                                        onClick={() => {
                                                            if (activeWorkspace) {
                                                                const fullPath = resolvePath(activeWorkspace.path, evidenceFile)
                                                                setOpenFilePath(fullPath)
                                                            }
                                                        }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 6,
                                                            fontSize: 11, color: '#60a5fa', cursor: 'pointer',
                                                            background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
                                                            padding: '5px 8px', borderRadius: 5, width: '100%', textAlign: 'left',
                                                        }}
                                                    >
                                                        <Search size={10} />
                                                        <span style={{ fontFamily: 'monospace', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {evidenceFile}
                                                        </span>
                                                    </button>
                                                )}
                                                {/* If no evidence metadata exists */}
                                                {!reason && !rule && !evidenceFile && (
                                                    <div style={{ fontSize: 11, color: 'var(--k-text-dim)', fontStyle: 'italic' }}>
                                                        No evidence metadata available — this connection was created before evidence tracking.
                                                    </div>
                                                )}
                                                {/* Navigate to neighbor */}
                                                <button
                                                    onClick={() => setSelectedNodeId(c.neighborId)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                                        fontSize: 11, fontWeight: 500,
                                                        color: typeColors[c.neighborType] || 'var(--k-text-secondary)',
                                                        background: (typeColors[c.neighborType] || '#ffffff') + '10',
                                                        border: `1px solid ${(typeColors[c.neighborType] || '#ffffff') + '25'}`,
                                                        padding: '5px 8px', borderRadius: 5, cursor: 'pointer',
                                                        width: '100%',
                                                    }}
                                                >
                                                    Go to {c.neighborName}
                                                    <ArrowRight size={10} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Source Files */}
                {node.paths && node.paths.length > 0 && (
                    <div>
                        <SectionLabel>Source Files</SectionLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {node.paths.map(relPath => {
                                const fullPath = activeWorkspace ? resolvePath(activeWorkspace.path, relPath) : relPath
                                const isOpen   = openFilePath === fullPath
                                const fName = relPath.split('/').pop() ?? relPath
                                return (
                                    <button
                                        key={relPath}
                                        onClick={() => setOpenFilePath(isOpen ? null : fullPath)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                                            background: isOpen ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.03)',
                                            border: isOpen ? '1px solid rgba(96,165,250,0.3)' : '1px solid var(--k-border-subtle)',
                                            textAlign: 'left', width: '100%',
                                            transition: 'all 0.12s',
                                        }}
                                    >
                                        <FileEdit size={12} style={{ flexShrink: 0, color: isOpen ? '#60a5fa' : 'var(--k-text-dim)' }} />
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: isOpen ? '#60a5fa' : 'var(--k-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {fName}
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--k-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', marginTop: 1 }}>
                                                {relPath}
                                            </div>
                                        </div>
                                        {isOpen && <span style={{ fontSize: 10, color: '#60a5fa', flexShrink: 0 }}>editing</span>}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Scanner info */}
                {node.source && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--k-text-dim)' }}>
                        <Info size={11} />
                        Detected by <strong style={{ color: 'var(--k-text-secondary)' }}>{node.source}</strong> scanner
                    </div>
                )}

                <div style={{ flex: 1, minHeight: 16 }} />
            </div>
        </div>
    )
}
