import * as d3Force from 'd3-force-3d'
import { KosmosNode, KosmosEdge } from '../../../../shared/types'

export interface LayoutNode extends KosmosNode {
    x: number
    y: number
    z: number
    vx: number
    vy: number
    vz: number
    fz?: number
    fx?: number
    fy?: number
}

export interface LayoutEdge extends KosmosEdge {
    source: LayoutNode
    target: LayoutNode
}

// ─── Module-level live simulation state ──────────────────────────────────────
// Kept alive after initial layout so drag + reheat works without re-running 350 ticks

let _sim: ReturnType<typeof d3Force.forceSimulation> | null = null
let _lNodes: LayoutNode[] = []
const _nodeById = new Map<string, LayoutNode>()

/** Returns current alpha of the live simulation (0 = fully cooled) */
export function getSimAlpha(): number {
    return _sim?.alpha() ?? 0
}

/** Run one simulation tick and return updated node positions */
export function tickSim(): LayoutNode[] {
    if (_sim) _sim.tick()
    return _lNodes
}

/** Reheat the simulation so neighbors react after a drag */
export function reheatSim(alpha = 0.25) {
    if (_sim) _sim.alpha(alpha).restart()
}

/** Pin a node at a specific position (prevents simulation from moving it) */
export function pinNode(id: string, x: number, y: number, z: number) {
    const node = _nodeById.get(id)
    if (node) {
        node.x = x; node.y = y; node.z = z
        node.fx = x; node.fy = y; node.fz = z
    }
}

/** Unpin a node so the simulation can move it again */
export function unpinNode(id: string) {
    const node = _nodeById.get(id)
    if (node) {
        delete node.fx; delete node.fy; delete node.fz
    }
}

/** Get the current position of a node from the live simulation */
export function getNodePos(id: string): { x: number; y: number; z: number } | null {
    const n = _nodeById.get(id)
    return n ? { x: n.x, y: n.y, z: n.z } : null
}

/** Check if a node is currently pinned */
export function isNodePinned(id: string): boolean {
    const n = _nodeById.get(id)
    return n ? n.fx !== undefined : false
}

// ─── Main layout runner ───────────────────────────────────────────────────────

export function runForceLayout(
    nodes: KosmosNode[],
    edges: KosmosEdge[],
    onTick: (nodes: LayoutNode[], edges: LayoutEdge[]) => void
): () => void {
    // Prep nodes (initialize positions close to center)
    const lNodes: LayoutNode[] = nodes.map(n => ({
        ...n,
        x: (Math.random() - 0.5) * 60,
        y: (Math.random() - 0.5) * 60,
        z: (Math.random() - 0.5) * 60,
        vx: 0, vy: 0, vz: 0
    }))

    const lEdges: LayoutEdge[] = edges.map(e => ({
        ...e,
        source: lNodes.find(n => n.id === e.fromId) as LayoutNode,
        target: lNodes.find(n => n.id === e.toId) as LayoutNode
    })).filter(e => e.source && e.target)

    const simulation = d3Force.forceSimulation(lNodes as any, 3)
        .force('link', d3Force.forceLink(lEdges as any).id((d: any) => d.id).distance(28).strength(1))
        .force('charge', d3Force.forceManyBody().strength(-40))
        .force('x', d3Force.forceX().strength(0.04))
        .force('y', d3Force.forceY().strength(0.04))
        .force('z', d3Force.forceZ().strength(0.04))
        .alphaDecay(0.02)
        .stop()

    // Run deterministic initial ticks
    const TICKS = 350
    for (let i = 0; i < TICKS; i++) simulation.tick()

    // Store in module-level state for live drag/reheat
    _sim = simulation
    _lNodes = lNodes
    _nodeById.clear()
    for (const n of lNodes) _nodeById.set(n.id, n)

    // Let simulation cool slowly from here (alpha ~0.001 after init ticks)
    // It will reheat when nodes are dragged

    // Deliver stable initial layout
    onTick(lNodes, lEdges)

    return () => {
        simulation.stop()
        if (_sim === simulation) {
            _sim = null
            _lNodes = []
            _nodeById.clear()
        }
    }
}
