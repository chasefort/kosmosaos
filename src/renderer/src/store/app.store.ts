import { create } from 'zustand'
import { IntegrationStatus, KosmosWorkspace, KosmosEvent, LiveActivityItem } from '../../shared/types'

interface AppState {
    version: string
    activeWorkspace: KosmosWorkspace | null
    setActiveWorkspace: (ws: KosmosWorkspace | null) => void

    integrationStatus: IntegrationStatus
    setIntegrationStatus: (status: IntegrationStatus) => void

    selectedNodeId: string | null
    setSelectedNodeId: (id: string | null) => void

    hoveredNodeId: string | null
    setHoveredNodeId: (id: string | null) => void

    commandPaletteOpen: boolean
    setCommandPaletteOpen: (open: boolean) => void

    /** Tooltip screen position (projected from 3D) */
    tooltipScreenPos: { x: number; y: number } | null
    setTooltipScreenPos: (pos: { x: number; y: number } | null) => void

    /** Fly-to target for camera animation */
    flyToTarget: { x: number; y: number; z: number } | null
    setFlyToTarget: (target: { x: number; y: number; z: number } | null) => void
    cameraOrbitEnabled: boolean
    setCameraOrbitEnabled: (enabled: boolean) => void

    /** Right-click context menu */
    contextMenu: { nodeId: string; screenX: number; screenY: number } | null
    setContextMenu: (menu: { nodeId: string; screenX: number; screenY: number } | null) => void

    /** File explorer sidebar */
    fileExplorerOpen: boolean
    setFileExplorerOpen: (open: boolean) => void

    /** Help mode — when on, hovering any data-help element shows an explanation card */
    helpMode: boolean
    setHelpMode: (on: boolean) => void

    /** Currently open file in markdown editor */
    openFilePath: string | null
    setOpenFilePath: (path: string | null) => void

    // ── Feature 1: Live Session Replay ─────────────────────────────────────
    /** Whether a session replay is running on the 3D graph */
    replayActive: boolean
    replayEvents: KosmosEvent[]
    replayPlayhead: number
    replaySpeed: number   // 1 = 1 event/sec, 2 = 2/sec, 0.5 = 1 per 2sec
    setReplayEvents: (events: KosmosEvent[]) => void
    setReplayActive: (active: boolean) => void
    setReplayPlayhead: (n: number) => void
    setReplaySpeed: (speed: number) => void

    // ── Feature 2: Heatmap Mode ─────────────────────────────────────────────
    heatmapMode: boolean
    /** nodeId → normalized hit frequency 0..1 */
    nodeHeatmap: Record<string, number>
    setHeatmapMode: (on: boolean) => void
    setNodeHeatmap: (map: Record<string, number>) => void

    // ── Feature 3: Blast Radius Rings ───────────────────────────────────────
    blastRadiusMode: boolean
    setBlastRadiusMode: (on: boolean) => void

    // ── Feature 4: Snapshot export ──────────────────────────────────────────
    /** Increment this to trigger a canvas PNG capture */
    snapshotTrigger: number
    triggerSnapshot: () => void

    // ── Feature 5: Architecture Summary modal ───────────────────────────────
    summaryOpen: boolean
    setSummaryOpen: (open: boolean) => void

    // ── Feature 6: Command Flow Tracer ──────────────────────────────────────
    /** Ordered list of nodeIds forming the traced flow */
    tracePath: string[]
    /** EdgeIds that form the trace path */
    traceEdgeIds: string[]
    setTrace: (nodeIds: string[], edgeIds: string[]) => void
    clearTrace: () => void

    // ── Node dragging ───────────────────────────────────────────────────────
    /** ID of the node currently being dragged (null when not dragging) */
    draggingNodeId: string | null
    setDraggingNodeId: (id: string | null) => void

    // ── Rescan trigger ──────────────────────────────────────────────────────
    /** Incremented when workspace is rescanned so effects re-trigger */
    scanVersion: number
    incrementScanVersion: () => void

    // ── Live flash (from ingest events) ─────────────────────────────────────
    /** nodeId → Date.now() when last flashed */
    nodeFlashTimestamps: Record<string, number>
    flashNodes: (ids: string[]) => void
    /** Timestamp of last live event (triggers Runs refresh) */
    liveActivityTs: number
    setLiveActivityTs: (ts: number) => void

    // ── Terminal panel ───────────────────────────────────────────────────────
    terminalOpen: boolean
    toggleTerminal: () => void
    setTerminalOpen: (open: boolean) => void
    terminalPosition: 'bottom' | 'right'
    setTerminalPosition: (pos: 'bottom' | 'right') => void

    // ── Recently touched files (from live events) ────────────────────────────
    /** relativePath → timestamp when last touched */
    recentlyTouchedFiles: Record<string, number>
    markFileTouched: (path: string) => void

    // ── Recent live activity rail ────────────────────────────────────────────
    liveActivity: LiveActivityItem[]
    pushLiveActivity: (item: LiveActivityItem) => void
}

export const useAppStore = create<AppState>((set) => ({
    version: '0.2.0',
    activeWorkspace: null,
    setActiveWorkspace: (ws) => set({ activeWorkspace: ws }),

    integrationStatus: {
        ingestServer: { running: false, port: 41414 },
        claudeCode: { connected: false },
        openClaw: { connected: false }
    },
    setIntegrationStatus: (status) => set({ integrationStatus: status }),

    selectedNodeId: null,
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),

    hoveredNodeId: null,
    setHoveredNodeId: (id) => set({ hoveredNodeId: id }),

    commandPaletteOpen: false,
    setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

    tooltipScreenPos: null,
    setTooltipScreenPos: (pos) => set({ tooltipScreenPos: pos }),

    flyToTarget: null,
    setFlyToTarget: (target) => set({ flyToTarget: target }),
    cameraOrbitEnabled: false,
    setCameraOrbitEnabled: (enabled) => set({ cameraOrbitEnabled: enabled }),

    contextMenu: null,
    setContextMenu: (menu) => set({ contextMenu: menu }),

    fileExplorerOpen: false,
    setFileExplorerOpen: (open) => set({ fileExplorerOpen: open }),

    helpMode: false,
    setHelpMode: (on) => set({ helpMode: on }),

    openFilePath: null,
    setOpenFilePath: (path) => set({ openFilePath: path }),

    // Replay
    replayActive: false,
    replayEvents: [],
    replayPlayhead: 0,
    replaySpeed: 1,
    setReplayEvents: (events) => set({ replayEvents: events, replayPlayhead: 0 }),
    setReplayActive: (active) => set({ replayActive: active }),
    setReplayPlayhead: (n) => set({ replayPlayhead: n }),
    setReplaySpeed: (speed) => set({ replaySpeed: speed }),

    // Heatmap
    heatmapMode: false,
    nodeHeatmap: {},
    setHeatmapMode: (on) => set({ heatmapMode: on }),
    setNodeHeatmap: (map) => set({ nodeHeatmap: map }),

    // Blast Radius
    blastRadiusMode: false,
    setBlastRadiusMode: (on) => set({ blastRadiusMode: on }),

    // Snapshot
    snapshotTrigger: 0,
    triggerSnapshot: () => set((s) => ({ snapshotTrigger: s.snapshotTrigger + 1 })),

    // Summary
    summaryOpen: false,
    setSummaryOpen: (open) => set({ summaryOpen: open }),

    // Trace
    tracePath: [],
    traceEdgeIds: [],
    setTrace: (nodeIds, edgeIds) => set({ tracePath: nodeIds, traceEdgeIds: edgeIds }),
    clearTrace: () => set({ tracePath: [], traceEdgeIds: [] }),

    // Drag
    draggingNodeId: null,
    setDraggingNodeId: (id) => set({ draggingNodeId: id }),

    // Rescan
    scanVersion: 0,
    incrementScanVersion: () => set((s) => ({ scanVersion: s.scanVersion + 1 })),

    // Live flash
    nodeFlashTimestamps: {},
    flashNodes: (ids) => set((s) => {
        const now = Date.now()
        const next = { ...s.nodeFlashTimestamps }
        for (const id of ids) next[id] = now
        return { nodeFlashTimestamps: next }
    }),
    liveActivityTs: 0,
    setLiveActivityTs: (ts) => set({ liveActivityTs: ts }),

    // Terminal
    terminalOpen: false,
    toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
    setTerminalOpen: (open) => set({ terminalOpen: open }),
    terminalPosition: 'bottom',
    setTerminalPosition: (pos) => set({ terminalPosition: pos }),

    // Recently touched files
    recentlyTouchedFiles: {},
    markFileTouched: (path) => set((s) => ({
        recentlyTouchedFiles: { ...s.recentlyTouchedFiles, [path]: Date.now() }
    })),

    // Live activity
    liveActivity: [],
    pushLiveActivity: (item) => set((s) => ({
        liveActivity: [item, ...s.liveActivity.filter(existing => existing.id !== item.id)].slice(0, 8)
    })),
}))
