import { useMemo } from 'react'
import { create } from 'zustand'
import { KosmosNode, KosmosEdge, EdgeType } from '../../../shared/types'
import { LayoutNode } from '../universe/layout/force-layout'

export type GraphTheme = 'default' | 'nebula' | 'cyberpunk'
export type LayoutPreset = 'force' | 'type-clusters' | 'radial' | 'grid'

interface GraphState {
    nodes: KosmosNode[]
    edges: KosmosEdge[]
    layoutNodes: Record<string, LayoutNode>
    liveVisibleNodesUntil: Record<string, number>

    setGraph: (nodes: KosmosNode[], edges: KosmosEdge[]) => void
    setLayoutNodes: (layoutNodes: Record<string, LayoutNode>) => void

    /** Insert a runtime-discovered node if it doesn't already exist */
    upsertRuntimeNode: (node: KosmosNode) => void
    /** Increment weight on an existing edge, or create a new runtime edge */
    incrementEdgeWeight: (fromId: string, toId: string, edgeType: EdgeType, workspaceId: string) => void
    touchLiveVisibleNodes: (ids: string[], ttlMs?: number) => void
    pruneLiveVisibleNodes: () => void

    // Filters
    filterTypes: Set<KosmosNode['type']>
    toggleFilterType: (type: KosmosNode['type']) => void

    searchQuery: string
    setSearchQuery: (query: string) => void

    // Edge visibility
    showEdges: boolean
    setShowEdges: (show: boolean) => void
    showEdgeLabels: boolean
    setShowEdgeLabels: (show: boolean) => void

    // Derived view (memoized by selectors usually, but computed here for simplicity)
    getVisibleNodes: () => KosmosNode[]
    getVisibleEdges: () => KosmosEdge[]

    // Visual Settings
    nodeSizeMulti: number
    setNodeSizeMulti: (v: number) => void
    edgeWidthMulti: number
    setEdgeWidthMulti: (v: number) => void
    particleSpeedMulti: number
    setParticleSpeedMulti: (v: number) => void
    particleCountMulti: number
    setParticleCountMulti: (v: number) => void
    
    theme: GraphTheme
    setTheme: (t: GraphTheme) => void

    // Layout preset
    layoutPreset: LayoutPreset
    setLayoutPreset: (p: LayoutPreset) => void

    // Pinned nodes (user-dragged nodes that are fixed in place)
    pinnedNodes: Set<string>
    pinNode: (id: string) => void
    unpinNode: (id: string) => void
    clearPins: () => void
}

export function useVisibleGraph() {
    const nodes = useGraphStore(s => s.nodes)
    const edges = useGraphStore(s => s.edges)
    const filterTypes = useGraphStore(s => s.filterTypes)
    const searchQuery = useGraphStore(s => s.searchQuery)
    const showEdges = useGraphStore(s => s.showEdges)
    const liveVisibleNodesUntil = useGraphStore(s => s.liveVisibleNodesUntil)

    return useMemo(() => {
        const now = Date.now()
        let visible = nodes.filter(n => {
            if (filterTypes.has(n.type)) return true
            const visibleUntil = liveVisibleNodesUntil[n.id] ?? 0
            return visibleUntil > now
        })
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            visible = visible.filter(n => n.name.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q))
        }

        const visibleNodesSet = new Set(visible.map(n => n.id))
        const visibleEdges = showEdges
            ? edges.filter(e => visibleNodesSet.has(e.fromId) && visibleNodesSet.has(e.toId))
            : []

        return { visibleNodes: visible, visibleEdges }
    }, [nodes, edges, filterTypes, searchQuery, showEdges, liveVisibleNodesUntil])
}

export const useGraphStore = create<GraphState>((set, get) => ({
    nodes: [],
    edges: [],
    layoutNodes: {},
    liveVisibleNodesUntil: {},

    setGraph: (nodes, edges) => set({ nodes, edges, liveVisibleNodesUntil: {} }),
    setLayoutNodes: (layoutNodes) => set({ layoutNodes }),

    upsertRuntimeNode: (node) => set((s) => {
        if (s.nodes.some(n => n.id === node.id)) return s
        // Place new runtime nodes at a random position near graph center
        const jitter = () => (Math.random() - 0.5) * 60
        const newLayoutNode: LayoutNode = {
            ...node,
            x: jitter(), y: jitter(), z: jitter(),
            vx: 0, vy: 0, vz: 0,
        }
        return {
            nodes: [...s.nodes, node],
            layoutNodes: { ...s.layoutNodes, [node.id]: newLayoutNode },
        }
    }),

    incrementEdgeWeight: (fromId, toId, edgeType, workspaceId) => set((s) => {
        const idx = s.edges.findIndex(e => e.fromId === fromId && e.toId === toId && e.type === edgeType)
        if (idx >= 0) {
            const updated = [...s.edges]
            updated[idx] = { ...updated[idx], weight: (updated[idx].weight ?? 1) + 1 }
            return { edges: updated }
        }
        const newEdge: KosmosEdge = {
            id: `runtime::${fromId}--${edgeType}--${toId}`,
            type: edgeType,
            fromId,
            toId,
            workspaceId,
            weight: 1,
        }
        return { edges: [...s.edges, newEdge] }
    }),

    touchLiveVisibleNodes: (ids, ttlMs = 15_000) => set((s) => {
        const now = Date.now()
        const next = { ...s.liveVisibleNodesUntil }
        for (const id of ids) next[id] = now + ttlMs
        return { liveVisibleNodesUntil: next }
    }),

    pruneLiveVisibleNodes: () => set((s) => {
        const now = Date.now()
        const next: Record<string, number> = {}
        let changed = false
        for (const [id, visibleUntil] of Object.entries(s.liveVisibleNodesUntil)) {
            if (visibleUntil > now) next[id] = visibleUntil
            else changed = true
        }
        return changed ? { liveVisibleNodesUntil: next } : s
    }),

    filterTypes: new Set([
        'agent', 'tool', 'model', 'memory_store', 'prompt', 'api', 'module',
        'wiki_page', 'source_doc', 'output_artifact', 'instruction_file', 'index_file', 'unresolved_link',
    ]), // generic 'file' hidden by default — too noisy
    toggleFilterType: (type) => set((state) => {
        const next = new Set(state.filterTypes)
        if (next.has(type)) next.delete(type)
        else next.add(type)
        return { filterTypes: next }
    }),

    searchQuery: '',
    setSearchQuery: (searchQuery) => set({ searchQuery }),

    showEdges: true,
    setShowEdges: (showEdges) => set({ showEdges }),
    showEdgeLabels: true,
    setShowEdgeLabels: (showEdgeLabels) => set({ showEdgeLabels }),

    getVisibleNodes: () => {
        const { nodes, filterTypes, searchQuery, liveVisibleNodesUntil } = get()
        const now = Date.now()
        let visible = nodes.filter(n => {
            if (filterTypes.has(n.type)) return true
            const visibleUntil = liveVisibleNodesUntil[n.id] ?? 0
            return visibleUntil > now
        })
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            visible = visible.filter(n => n.name.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q))
        }
        return visible
    },

    getVisibleEdges: () => {
        const { edges } = get()
        const visibleNodes = new Set(get().getVisibleNodes().map(n => n.id))
        return edges.filter(e => visibleNodes.has(e.fromId) && visibleNodes.has(e.toId))
    },

    nodeSizeMulti: 1.0,
    setNodeSizeMulti: (nodeSizeMulti) => set({ nodeSizeMulti }),

    edgeWidthMulti: 1.0,
    setEdgeWidthMulti: (edgeWidthMulti) => set({ edgeWidthMulti }),

    particleSpeedMulti: 1.0,
    setParticleSpeedMulti: (particleSpeedMulti) => set({ particleSpeedMulti }),

    particleCountMulti: 1.0,
    setParticleCountMulti: (particleCountMulti) => set({ particleCountMulti }),

    theme: 'default',
    setTheme: (theme) => set({ theme }),

    layoutPreset: 'force',
    setLayoutPreset: (layoutPreset) => set({ layoutPreset }),

    pinnedNodes: new Set<string>(),
    pinNode: (id) => set(s => ({ pinnedNodes: new Set([...s.pinnedNodes, id]) })),
    unpinNode: (id) => set(s => {
        const next = new Set(s.pinnedNodes); next.delete(id); return { pinnedNodes: next }
    }),
    clearPins: () => set({ pinnedNodes: new Set<string>() }),
}))
