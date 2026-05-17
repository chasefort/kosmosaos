/**
 * Global type declarations for the preload API exposed to the renderer.
 * This removes the need for @ts-ignore on every window.api call.
 */

import {
    DatasetSummary,
    KosmosEdge,
    KosmosEvent,
    KosmosNode,
    KosmosRun,
    KosmosWorkspace,
    PromptExperimentReport,
    PromptFileInsights,
    TraceDetail,
    TraceFeedbackSummary,
    ContextDriftSummary,
    ContextHealthSummary,
    ContextNodeDetail,
    WorkspaceScanSummary,
} from '../../shared/types'

interface IntegrationStatus {
    claudeCode: { connected: boolean; lastEvent?: number }
    openClaw: { connected: boolean; url?: string }
    ingestServer: { running: boolean; port: number }
}

interface DetectedIntegrations {
    claudeCode: { detected: boolean; workspacePath: string | null }
}

interface KosmosApi {
    // Workspace
    openWorkspaceDialog(): Promise<string | null>
    scanWorkspace(path: string): Promise<{ id: string; name: string; path: string; nodeCount: number; edgeCount: number; scanId?: string; findingCount?: number }>
    getRecentWorkspaces(): Promise<KosmosWorkspace[]>

    // Graph
    getNodes(workspaceId: string): Promise<KosmosNode[]>
    getEdges(workspaceId: string): Promise<KosmosEdge[]>
    upsertNode(node: unknown): Promise<void>
    upsertEdge(edge: unknown): Promise<void>

    // Runs
    getRuns(workspaceId: string): Promise<KosmosRun[]>
    getEvents(runId: string): Promise<KosmosEvent[]>
    getTraceDetail(traceId: string): Promise<TraceDetail | null>
    addFeedback(payload: { workspaceId: string; traceId: string; spanId?: string; name: string; value: number; reason?: string }): Promise<TraceFeedbackSummary>

    // Prompt + dataset insights
    getPromptInsights(workspaceId: string, sourcePath: string): Promise<PromptFileInsights>
    getPromptVersionContent(versionId: string): Promise<string | null>
    runPromptExperiment(workspaceId: string, sourcePath: string, datasetId?: string): Promise<PromptExperimentReport | null>
    listDatasets(workspaceId: string): Promise<DatasetSummary[]>
    saveTraceExample(workspaceId: string, traceId: string, datasetId?: string): Promise<{ dataset: DatasetSummary; exampleId: string }>

    // Integrations
    startIngestServer(): Promise<void>
    stopIngestServer(): Promise<void>
    getIntegrationStatus(): Promise<IntegrationStatus>
    startOpenClawAdapter(url: string): Promise<void>
    autoConnectIntegrations(wsPath: string): Promise<IntegrationStatus>
    readClaudeSessions(wsPath: string): Promise<unknown[]>
    detectAvailableIntegrations(): Promise<DetectedIntegrations>

    // Settings
    getSetting(key: string): Promise<string | null>
    setSetting(key: string, value: unknown): Promise<void>

    // File system
    listDir(path: string): Promise<{ name: string; path: string; isDirectory: boolean; ext: string; size: number; mtime: number }[]>
    readFile(path: string): Promise<string>
    writeFile(path: string, content: string): Promise<void>

    // Events from main
    onNavigate(cb: (path: string) => void): () => void
    onTriggerOpenWorkspace(cb: () => void): () => void
    onIngestEvent(cb: (event: unknown) => void): () => void
    onIntegrationStatus(cb: (status: IntegrationStatus) => void): () => void

    // Context graph
    getContextHealth(workspaceId: string): Promise<ContextHealthSummary>
    getContextScanHistory(workspaceId: string): Promise<WorkspaceScanSummary[]>
    getContextDrift(workspaceId: string, fromScanId?: string, toScanId?: string): Promise<ContextDriftSummary | null>
    getContextNodeDetail(workspaceId: string, nodeId: string): Promise<ContextNodeDetail | null>
}

declare global {
    interface Window {
        api: KosmosApi
    }
}

export {}
