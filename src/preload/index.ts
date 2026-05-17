import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
    // Workspace
    openWorkspaceDialog: () => ipcRenderer.invoke('workspace:open-dialog'),
    scanWorkspace: (path: string) => ipcRenderer.invoke('workspace:scan', path),
    getRecentWorkspaces: () => ipcRenderer.invoke('workspace:get-recent'),

    // Graph
    getNodes: (workspaceId: string) => ipcRenderer.invoke('graph:get-nodes', workspaceId),
    getEdges: (workspaceId: string) => ipcRenderer.invoke('graph:get-edges', workspaceId),
    upsertNode: (node: unknown) => ipcRenderer.invoke('graph:upsert-node', node),
    upsertEdge: (edge: unknown) => ipcRenderer.invoke('graph:upsert-edge', edge),

    // Runs
    getRuns: (workspaceId: string) => ipcRenderer.invoke('runs:get-runs', workspaceId),
    getEvents: (runId: string) => ipcRenderer.invoke('runs:get-events', runId),
    getTraceDetail: (traceId: string) => ipcRenderer.invoke('runs:get-trace-detail', traceId),
    addFeedback: (payload: unknown) => ipcRenderer.invoke('runs:add-feedback', payload),

    // Prompt + dataset insights
    getPromptInsights: (workspaceId: string, sourcePath: string) => ipcRenderer.invoke('prompts:get-insights', workspaceId, sourcePath),
    getPromptVersionContent: (versionId: string) => ipcRenderer.invoke('prompts:get-version-content', versionId),
    runPromptExperiment: (workspaceId: string, sourcePath: string, datasetId?: string) => ipcRenderer.invoke('prompts:run-experiment', workspaceId, sourcePath, datasetId),
    listDatasets: (workspaceId: string) => ipcRenderer.invoke('datasets:list', workspaceId),
    saveTraceExample: (workspaceId: string, traceId: string, datasetId?: string) => ipcRenderer.invoke('datasets:save-trace-example', workspaceId, traceId, datasetId),

    // Integrations
    startIngestServer: () => ipcRenderer.invoke('integrations:start-ingest'),
    stopIngestServer: () => ipcRenderer.invoke('integrations:stop-ingest'),
    getIntegrationStatus: () => ipcRenderer.invoke('integrations:get-status'),
    startOpenClawAdapter: (url: string) =>
        ipcRenderer.invoke('integrations:start-openclaw', url),
    autoConnectIntegrations: (wsPath: string) =>
        ipcRenderer.invoke('integrations:auto-connect', wsPath),
    readClaudeSessions: (wsPath: string) =>
        ipcRenderer.invoke('integrations:read-claude-sessions', wsPath),
    detectAvailableIntegrations: () =>
        ipcRenderer.invoke('integrations:detect-available'),

    // Settings
    getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
    setSetting: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),

    // File system
    listDir: (path: string) => ipcRenderer.invoke('files:list-dir', path),
    readFile: (path: string) => ipcRenderer.invoke('files:read-file', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('files:write-file', path, content),

    // Terminal
    spawnTerminal: (opts: { id: string; cwd?: string }) => ipcRenderer.invoke('terminal:spawn', opts),
    writeTerminal: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    resizeTerminal: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    killTerminal: (id: string) => ipcRenderer.invoke('terminal:kill', id),
    listTerminals: () => ipcRenderer.invoke('terminal:list'),
    onTerminalOutput: (cb: (data: { id: string; data: string }) => void) => {
        const handler = (_e: any, d: any) => cb(d)
        ipcRenderer.on('terminal:output', handler)
        return () => ipcRenderer.removeListener('terminal:output', handler)
    },
    onTerminalExit: (cb: (data: { id: string; exitCode: number }) => void) => {
        const handler = (_e: any, d: any) => cb(d)
        ipcRenderer.on('terminal:exit', handler)
        return () => ipcRenderer.removeListener('terminal:exit', handler)
    },

    // Events from main
    onNavigate: (cb: (path: string) => void) => {
        ipcRenderer.on('navigate', (_e, path) => cb(path))
        return () => ipcRenderer.removeAllListeners('navigate')
    },
    onTriggerOpenWorkspace: (cb: () => void) => {
        ipcRenderer.on('trigger-open-workspace', () => cb())
        return () => ipcRenderer.removeAllListeners('trigger-open-workspace')
    },
    onIngestEvent: (cb: (event: unknown) => void) => {
        ipcRenderer.on('ingest:event', (_e, event) => cb(event))
        return () => ipcRenderer.removeAllListeners('ingest:event')
    },
    onIntegrationStatus: (cb: (status: unknown) => void) => {
        ipcRenderer.on('integration:status', (_e, status) => cb(status))
        return () => ipcRenderer.removeAllListeners('integration:status')
    },
    onSessionsImported: (cb: (result: { runs: number; events: number }) => void) => {
        const handler = (_e: any, result: any) => cb(result)
        ipcRenderer.on('sessions:imported', handler)
        return () => ipcRenderer.removeListener('sessions:imported', handler)
    },

    // Dashboard
    getDashboardStats: (workspaceId: string) => ipcRenderer.invoke('dashboard:get-stats', workspaceId),

    // Context graph
    getContextHealth: (workspaceId: string) => ipcRenderer.invoke('context:get-health', workspaceId),
    getContextScanHistory: (workspaceId: string) => ipcRenderer.invoke('context:get-scan-history', workspaceId),
    getContextDrift: (workspaceId: string, fromScanId?: string, toScanId?: string) => ipcRenderer.invoke('context:get-drift', workspaceId, fromScanId, toScanId),
    getContextNodeDetail: (workspaceId: string, nodeId: string) => ipcRenderer.invoke('context:get-node-detail', workspaceId, nodeId),
}

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore
    window.electron = electronAPI
    // @ts-ignore
    window.api = api
}
