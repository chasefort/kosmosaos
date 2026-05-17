import { useAppStore } from '../../store/app.store'
import { useGraphStore } from '../../store/graph.store'

const typeColorMap: Record<string, string> = {
    agent: '#fbbf24',
    tool: '#a78bfa',
    prompt: '#f472b6',
    model: '#60a5fa',
    memory_store: '#34d399',
    api: '#f87171',
    module: '#64748b',
    file: '#94a3b8',
    permission_scope: '#ef4444',
    wiki_page: '#38bdf8',
    source_doc: '#22d3ee',
    output_artifact: '#f59e0b',
    instruction_file: '#c084fc',
    index_file: '#86efac',
    unresolved_link: '#fb7185',
}

const typeLabelMap: Record<string, string> = {
    agent: 'Agent',
    tool: 'Tool',
    prompt: 'Prompt',
    model: 'Model',
    memory_store: 'Memory',
    api: 'API',
    module: 'Module',
    file: 'File',
    permission_scope: 'Permission',
    wiki_page: 'Wiki Page',
    source_doc: 'Source',
    output_artifact: 'Output',
    instruction_file: 'Instruction',
    index_file: 'Index',
    unresolved_link: 'Broken Link',
}

/** HTML overlay tooltip that appears near the hovered node */
export function NodeTooltip() {
    const hoveredNodeId = useAppStore(s => s.hoveredNodeId)
    const tooltipScreenPos = useAppStore(s => s.tooltipScreenPos)
    const nodes = useGraphStore(s => s.nodes)
    const edges = useGraphStore(s => s.edges)

    if (!hoveredNodeId || !tooltipScreenPos) return null

    const node = nodes.find(n => n.id === hoveredNodeId)
    if (!node) return null

    const connectionCount = edges.filter(e => e.fromId === hoveredNodeId || e.toId === hoveredNodeId).length
    const description = node.description
        ? node.description.length > 80
            ? node.description.slice(0, 80) + '...'
            : node.description
        : null

    return (
        <div
            style={{
                position: 'absolute',
                left: tooltipScreenPos.x,
                top: tooltipScreenPos.y,
                transform: 'translate(-50%, -100%) translateY(-12px)',
                pointerEvents: 'none',
                zIndex: 100,
                background: 'rgba(15, 15, 20, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '10px 14px',
                maxWidth: 280,
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }}
        >
            {/* Name + type badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {node.name}
                </span>
                <span style={{
                    fontSize: 10,
                    fontWeight: 500,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: typeColorMap[node.type] + '25',
                    color: typeColorMap[node.type] || '#fff',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                }}>
                    {typeLabelMap[node.type] || node.type}
                </span>
            </div>

            {/* Description */}
            {description && (
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.4, marginBottom: 4 }}>
                    {description}
                </div>
            )}

            {/* Connection count */}
            <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.4)' }}>
                {connectionCount} connection{connectionCount !== 1 ? 's' : ''}
            </div>
        </div>
    )
}
