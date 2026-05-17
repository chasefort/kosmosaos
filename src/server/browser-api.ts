/**
 * browser-api.ts
 *
 * Browser-side shim that creates window.api with the same interface as the
 * Electron preload. Loaded only when running against the local Node.js server
 * (not in Electron, where the preload handles this).
 *
 * Request/response methods → POST /api/:channel
 * Event subscriptions      → WebSocket /ws/events { channel, payload }
 */

// ── Session token ──────────────────────────────────────────────────────────────
// Injected into the HTML by the server at startup. Required on all API calls.

const SESSION_TOKEN: string = (window as any).__KOSMOS_TOKEN__ ?? ''

// ── WebSocket event bus ────────────────────────────────────────────────────────

const wsUrl = `ws://${window.location.host}/ws/events?token=${SESSION_TOKEN}`
const ws = new WebSocket(wsUrl)

const listeners = new Map<string, Set<(...args: unknown[]) => void>>()

ws.addEventListener('message', (event) => {
    try {
        const { channel, payload } = JSON.parse(event.data as string)
        const cbs = listeners.get(channel)
        if (cbs) {
            for (const cb of cbs) cb(payload)
        }
    } catch { /* ignore malformed */ }
})

function onEvent(channel: string, cb: (...args: unknown[]) => void): () => void {
    if (!listeners.has(channel)) listeners.set(channel, new Set())
    listeners.get(channel)!.add(cb)
    return () => listeners.get(channel)?.delete(cb)
}

// ── HTTP invoke ────────────────────────────────────────────────────────────────

async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    const res = await fetch(`/api/${channel}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Kosmos-Token': SESSION_TOKEN,
        },
        body: JSON.stringify({ args }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
    return data.result
}

// ── window.api shim ────────────────────────────────────────────────────────────

window.api = {
    // Workspace
    openWorkspaceDialog: () => invoke('workspace:open-dialog') as Promise<string | null>,
    scanWorkspace: (path) => invoke('workspace:scan', path) as Promise<any>,
    getRecentWorkspaces: () => invoke('workspace:get-recent') as Promise<any[]>,

    // Graph
    getNodes: (workspaceId) => invoke('graph:get-nodes', workspaceId) as Promise<any[]>,
    getEdges: (workspaceId) => invoke('graph:get-edges', workspaceId) as Promise<any[]>,
    upsertNode: (node) => invoke('graph:upsert-node', node) as Promise<void>,
    upsertEdge: (edge) => invoke('graph:upsert-edge', edge) as Promise<void>,

    // Runs
    getRuns: (workspaceId) => invoke('runs:get-runs', workspaceId) as Promise<any[]>,
    getEvents: (runId) => invoke('runs:get-events', runId) as Promise<any[]>,
    getTraceDetail: (traceId) => invoke('runs:get-trace-detail', traceId) as Promise<any>,
    addFeedback: (payload) => invoke('runs:add-feedback', payload) as Promise<any>,

    // Prompt + dataset insights
    getPromptInsights: (workspaceId, sourcePath) => invoke('prompts:get-insights', workspaceId, sourcePath) as Promise<any>,
    getPromptVersionContent: (versionId) => invoke('prompts:get-version-content', versionId) as Promise<string | null>,
    runPromptExperiment: (workspaceId, sourcePath, datasetId) => invoke('prompts:run-experiment', workspaceId, sourcePath, datasetId) as Promise<any>,
    listDatasets: (workspaceId) => invoke('datasets:list', workspaceId) as Promise<any[]>,
    saveTraceExample: (workspaceId, traceId, datasetId) => invoke('datasets:save-trace-example', workspaceId, traceId, datasetId) as Promise<any>,

    // Integrations
    startIngestServer: () => invoke('integrations:start-ingest') as Promise<void>,
    stopIngestServer: () => invoke('integrations:stop-ingest') as Promise<void>,
    getIntegrationStatus: () => invoke('integrations:get-status') as Promise<any>,
    startOpenClawAdapter: (url) => invoke('integrations:start-openclaw', url) as Promise<void>,
    autoConnectIntegrations: (wsPath) => invoke('integrations:auto-connect', wsPath) as Promise<any>,
    readClaudeSessions: (wsPath) => invoke('integrations:read-claude-sessions', wsPath) as Promise<any[]>,
    detectAvailableIntegrations: () => invoke('integrations:detect-available') as Promise<any>,

    // Settings
    getSetting: (key) => invoke('settings:get', key) as Promise<string | null>,
    setSetting: (key, value) => invoke('settings:set', key, value) as Promise<void>,

    // File system
    listDir: (path) => invoke('files:list-dir', path) as Promise<any[]>,
    readFile: (path) => invoke('files:read-file', path) as Promise<string>,
    writeFile: (path, content) => invoke('files:write-file', path, content) as Promise<void>,

    // Terminal (output comes via WebSocket broadcast)
    spawnTerminal: (opts) => invoke('terminal:spawn', opts) as Promise<any>,
    writeTerminal: (id, data) => invoke('terminal:write', id, data) as Promise<any>,
    resizeTerminal: (id, cols, rows) => invoke('terminal:resize', id, cols, rows) as Promise<any>,
    killTerminal: (id) => invoke('terminal:kill', id) as Promise<any>,
    listTerminals: () => invoke('terminal:list') as Promise<any[]>,
    onTerminalOutput: (cb) => onEvent('terminal:output', cb as any),
    onTerminalExit: (cb) => onEvent('terminal:exit', cb as any),

    // Events from main → WebSocket
    onNavigate: (cb) => onEvent('navigate', cb as any),
    onTriggerOpenWorkspace: (cb) => onEvent('trigger-open-workspace', cb as any),
    onIngestEvent: (cb) => onEvent('ingest:event', cb as any),
    onIntegrationStatus: (cb) => onEvent('integration:status', cb as any),
    onSessionsImported: (cb) => onEvent('sessions:imported', cb as any),

    // Dashboard
    getDashboardStats: (workspaceId) => invoke('dashboard:get-stats', workspaceId) as Promise<any>,

    // Context graph
    getContextHealth: (workspaceId) => invoke('context:get-health', workspaceId) as Promise<any>,
    getContextScanHistory: (workspaceId) => invoke('context:get-scan-history', workspaceId) as Promise<any[]>,
    getContextDrift: (workspaceId, fromScanId, toScanId) => invoke('context:get-drift', workspaceId, fromScanId, toScanId) as Promise<any>,
    getContextNodeDetail: (workspaceId, nodeId) => invoke('context:get-node-detail', workspaceId, nodeId) as Promise<any>,
}
