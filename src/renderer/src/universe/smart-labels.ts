import type { KosmosEdge, KosmosNode } from '../../../shared/types'
import { LABEL_VISUALS } from './graph-visuals'

export interface SmartLabelDecision {
    visible: boolean
    priority: number
    reason: 'selected' | 'hovered' | 'neighbor' | 'primary' | 'hidden'
}

export interface SmartLabelInput {
    nodes: KosmosNode[]
    edges: KosmosEdge[]
    selectedId: string | null
    hoveredId: string | null
    maxAutomaticLabels?: number
}

const PRIMARY_TYPES = new Set<KosmosNode['type']>([
    'agent', 'model', 'tool', 'prompt', 'memory_store', 'api',
    'instruction_file', 'source_doc', 'wiki_page', 'output_artifact', 'index_file', 'unresolved_link',
])

export function getSmartLabelDecisions({
    nodes,
    edges,
    selectedId,
    hoveredId,
    maxAutomaticLabels = LABEL_VISUALS.maxAutomaticLabels,
}: SmartLabelInput): Map<string, SmartLabelDecision> {
    const degree = new Map<string, number>()
    const neighbors = new Set<string>()

    for (const edge of edges) {
        degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1)
        degree.set(edge.toId, (degree.get(edge.toId) ?? 0) + 1)
        if (selectedId && edge.fromId === selectedId) neighbors.add(edge.toId)
        if (selectedId && edge.toId === selectedId) neighbors.add(edge.fromId)
    }

    const ranked = [...nodes]
        .filter((node) => PRIMARY_TYPES.has(node.type))
        .map((node) => ({
            id: node.id,
            priority: (degree.get(node.id) ?? 0) + (node.type === 'agent' ? 6 : 0) + (node.type === 'model' ? 3 : 0),
        }))
        .sort((a, b) => b.priority - a.priority)

    const automatic = new Set(ranked.slice(0, maxAutomaticLabels).map((item) => item.id))
    const decisions = new Map<string, SmartLabelDecision>()

    for (const node of nodes) {
        if (node.id === selectedId) {
            decisions.set(node.id, { visible: true, priority: 1000, reason: 'selected' })
        } else if (node.id === hoveredId) {
            decisions.set(node.id, { visible: true, priority: 900, reason: 'hovered' })
        } else if (neighbors.has(node.id)) {
            decisions.set(node.id, { visible: true, priority: 700 + (degree.get(node.id) ?? 0), reason: 'neighbor' })
        } else if (automatic.has(node.id)) {
            decisions.set(node.id, { visible: true, priority: degree.get(node.id) ?? 0, reason: 'primary' })
        } else {
            decisions.set(node.id, { visible: false, priority: degree.get(node.id) ?? 0, reason: 'hidden' })
        }
    }

    return decisions
}
