import { KosmosNode } from '../../../../shared/types'
import { LayoutNode } from './force-layout'

// ─── Type ordering (determines cluster/ring positions) ───────────────────────
const TYPE_ORDER = [
    'agent', 'instruction_file', 'source_doc', 'wiki_page', 'output_artifact', 'index_file',
    'model', 'tool', 'prompt', 'memory_store', 'api', 'module', 'file', 'unresolved_link', 'permission_scope',
]

// ─── Type Clusters ────────────────────────────────────────────────────────────
// Each node type gets its own cluster arranged in a circle.
// Within each cluster nodes are arranged in a mini-ring.

export function typeClusterLayout(nodes: KosmosNode[]): Record<string, LayoutNode> {
    const byType = new Map<string, KosmosNode[]>()
    for (const n of nodes) {
        if (!byType.has(n.type)) byType.set(n.type, [])
        byType.get(n.type)!.push(n)
    }

    const types = TYPE_ORDER.filter(t => byType.has(t))
    const numTypes = types.length
    const CLUSTER_RING_RADIUS = Math.max(50, numTypes * 12)  // outer ring radius
    const result: Record<string, LayoutNode> = {}

    types.forEach((type, ti) => {
        const typeNodes = byType.get(type)!
        const angle = (ti / numTypes) * Math.PI * 2 - Math.PI / 2
        const cx = Math.cos(angle) * CLUSTER_RING_RADIUS
        const cy = Math.sin(angle) * CLUSTER_RING_RADIUS
        const cz = 0

        // Arrange nodes within cluster in a tight ring
        const innerR = Math.max(8, typeNodes.length * 2.5)
        typeNodes.forEach((node, ni) => {
            const a = (ni / typeNodes.length) * Math.PI * 2
            result[node.id] = {
                ...node,
                x: cx + Math.cos(a) * innerR,
                y: cy + Math.sin(a) * innerR,
                z: cz + (Math.random() - 0.5) * 5,
                vx: 0, vy: 0, vz: 0
            }
        })
    })

    return result
}

// ─── Radial (concentric rings by type) ────────────────────────────────────────
// Core types (agents, models) sit at center; supporting types fan outward.

const RADIAL_RING_ORDER = [
    ['agent'],
    ['instruction_file', 'model'],
    ['source_doc', 'wiki_page', 'output_artifact'],
    ['tool', 'prompt', 'index_file'],
    ['memory_store', 'api'],
    ['module', 'permission_scope', 'file', 'unresolved_link'],
]

export function radialLayout(nodes: KosmosNode[]): Record<string, LayoutNode> {
    const result: Record<string, LayoutNode> = {}
    const BASE_RADIUS = 20
    const RING_GAP    = 22

    RADIAL_RING_ORDER.forEach((ringTypes, ringIndex) => {
        const ringNodes = nodes.filter(n => ringTypes.includes(n.type))
        if (ringNodes.length === 0) return

        const r = BASE_RADIUS + ringIndex * RING_GAP
        ringNodes.forEach((node, ni) => {
            const a = (ni / ringNodes.length) * Math.PI * 2
            result[node.id] = {
                ...node,
                x: Math.cos(a) * r,
                y: Math.sin(a) * r,
                z: (Math.random() - 0.5) * 8,
                vx: 0, vy: 0, vz: 0
            }
        })
    })

    // Any node type not in the ring order goes in the last ring
    const covered = new Set(RADIAL_RING_ORDER.flat())
    const leftover = nodes.filter(n => !covered.has(n.type) && !result[n.id])
    const leftoverR = BASE_RADIUS + RADIAL_RING_ORDER.length * RING_GAP
    leftover.forEach((node, ni) => {
        const a = (ni / Math.max(leftover.length, 1)) * Math.PI * 2
        result[node.id] = {
            ...node,
            x: Math.cos(a) * leftoverR,
            y: Math.sin(a) * leftoverR,
            z: 0,
            vx: 0, vy: 0, vz: 0
        }
    })

    return result
}

// ─── Grid (sorted by type then name) ─────────────────────────────────────────
// Clean organized grid. Type separators add spacing between groups.

export function gridLayout(nodes: KosmosNode[]): Record<string, LayoutNode> {
    const sorted = [...nodes].sort((a, b) => {
        const ti = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
        if (ti !== 0) return ti
        return a.name.localeCompare(b.name)
    })

    const COLS      = Math.ceil(Math.sqrt(sorted.length * 1.6))
    const CELL_SIZE = 16
    const result: Record<string, LayoutNode> = {}

    let col = 0, row = 0, lastType = ''
    sorted.forEach(node => {
        // Add a gap row between type groups
        if (lastType && node.type !== lastType) {
            row += 1
            col = 0
        }
        lastType = node.type

        result[node.id] = {
            ...node,
            x: (col - COLS / 2) * CELL_SIZE,
            y: (-row) * CELL_SIZE,
            z: 0,
            vx: 0, vy: 0, vz: 0
        }

        col++
        if (col >= COLS) { col = 0; row++ }
    })

    return result
}
