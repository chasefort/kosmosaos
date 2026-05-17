/**
 * Graph algorithm utilities for Kosmos features:
 *   - Blast radius BFS
 *   - Outbound flow tracing
 *   - Heatmap color mapping
 */

import { KosmosEdge, EdgeType } from '../../../../shared/types'

// ── Blast Radius ───────────────────────────────────────────────────────────────

/**
 * BFS from a root node. Returns a map of nodeId → depth (1, 2, 3).
 * Treats edges as undirected — anything connected within maxDepth hops is included.
 */
export function computeBlastRadius(
    nodeId: string,
    edges: KosmosEdge[],
    maxDepth = 3
): Map<string, number> {
    const result = new Map<string, number>()
    const queue: { id: string; depth: number }[] = [{ id: nodeId, depth: 0 }]
    const visited = new Set<string>([nodeId])

    while (queue.length > 0) {
        const item = queue.shift()!
        if (item.depth >= maxDepth) continue

        for (const edge of edges) {
            const neighbor =
                edge.fromId === item.id ? edge.toId :
                edge.toId   === item.id ? edge.fromId : null
            if (!neighbor || visited.has(neighbor)) continue
            visited.add(neighbor)
            result.set(neighbor, item.depth + 1)
            queue.push({ id: neighbor, depth: item.depth + 1 })
        }
    }

    return result
}

// ── Flow Tracer ────────────────────────────────────────────────────────────────

const DEFAULT_FLOW_TYPES: EdgeType[] = ['calls', 'uses', 'imports', 'defines', 'reads']

/**
 * Follow directed edges outward from a start node.
 * Returns every reachable nodeId and edgeId within maxDepth hops.
 */
export function traceOutboundFlow(
    startId: string,
    edges: KosmosEdge[],
    followTypes: EdgeType[] = DEFAULT_FLOW_TYPES,
    maxDepth = 10
): { nodeIds: string[]; edgeIds: string[] } {
    const nodeIds: string[] = [startId]
    const edgeIds: string[] = []
    const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }]
    const visitedNodes = new Set<string>([startId])
    const visitedEdges = new Set<string>()

    while (queue.length > 0) {
        const { id, depth } = queue.shift()!
        if (depth >= maxDepth) continue

        for (const edge of edges) {
            if (edge.fromId !== id) continue
            if (!followTypes.includes(edge.type)) continue
            if (visitedEdges.has(edge.id)) continue

            visitedEdges.add(edge.id)
            edgeIds.push(edge.id)

            if (!visitedNodes.has(edge.toId)) {
                visitedNodes.add(edge.toId)
                nodeIds.push(edge.toId)
                queue.push({ id: edge.toId, depth: depth + 1 })
            }
        }
    }

    return { nodeIds, edgeIds }
}

// ── Heatmap Color ──────────────────────────────────────────────────────────────

/** Map a heat value [0..1] to a THREE.js-compatible hex integer.
 *  0 = cold deep blue, 0.5 = warm orange/yellow, 1 = hot red  */
export function heatToHex(heat: number): number {
    const h = Math.max(0, Math.min(1, heat))
    // color stops: 0 → #1d4ed8 (blue), 0.5 → #f59e0b (amber), 1 → #ef4444 (red)
    let r: number, g: number, b: number
    if (h <= 0.5) {
        const t = h * 2
        r = Math.round(29  + t * (245 - 29))
        g = Math.round(78  + t * (158 - 78))
        b = Math.round(216 + t * (11  - 216))
    } else {
        const t = (h - 0.5) * 2
        r = Math.round(245 + t * (239 - 245))
        g = Math.round(158 + t * (68  - 158))
        b = Math.round(11  + t * (68  - 11))
    }
    return (r << 16) | (g << 8) | b
}

/** Map heat [0..1] to a CSS hex string (for HTML elements) */
export function heatToCss(heat: number): string {
    const hex = heatToHex(heat).toString(16).padStart(6, '0')
    return `#${hex}`
}
