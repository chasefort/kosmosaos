// All shared types for Kosmos
// Used by both main process and renderer

export type NodeType =
    | 'agent'
    | 'tool'
    | 'prompt'
    | 'model'
    | 'memory_store'
    | 'api'
    | 'file'
    | 'module'
    | 'permission_scope'
    | 'wiki_page'
    | 'source_doc'
    | 'output_artifact'
    | 'instruction_file'
    | 'index_file'
    | 'unresolved_link'

export type EdgeType =
    | 'defines'
    | 'uses'
    | 'calls'
    | 'reads'
    | 'writes'
    | 'imports'
    | 'permits'
    | 'denies'
    | 'emits'
    | 'correlates'
    | 'links_to'
    | 'cites'
    | 'derived_from'
    | 'indexes'
    | 'documents'
    | 'mentions'

export type SourceType = 'static' | 'runtime' | 'merged' | 'mock'

export interface KosmosNode {
    id: string
    name: string
    type: NodeType
    source: SourceType
    confidence: number
    description?: string
    tags: string[]
    paths: string[]
    workspaceId: string
    createdAt: number
    updatedAt: number
    // type-specific
    meta?: Record<string, unknown>
}

export interface KosmosEdge {
    id: string
    type: EdgeType
    fromId: string
    toId: string
    workspaceId: string
    weight?: number
    meta?: Record<string, unknown>
}

export interface KosmosWorkspace {
    id: string
    name: string
    path: string
    openedAt: number
    nodeCount?: number
    edgeCount?: number
}

export type EventPhase = 'start' | 'end' | 'error'

export type TraceEventType =
    | 'session_start'
    | 'session_end'
    | 'agent_activity'
    | 'user_prompt'
    | 'assistant_response'
    | 'tool_call'
    | 'model_call'
    | 'memory_read'
    | 'memory_write'
    | 'permission_decision'
    | 'error'

export interface KosmosEvent {
    id: string
    runId: string
    type: TraceEventType
    phase?: EventPhase
    tsMs: number
    agentId?: string
    toolName?: string
    nodeIds: string[]
    input?: Record<string, unknown>
    output?: Record<string, unknown>
    error?: string
    durationMs?: number
}

export interface KosmosRun {
    id: string
    workspaceId: string
    source: 'claude_code' | 'openclaw' | 'sdk' | 'mock'
    startedAt: number
    endedAt?: number
    eventCount: number
    status: 'running' | 'completed' | 'error'
    meta?: Record<string, unknown>
}

export interface FindingSeverity {
    level: 'info' | 'warning' | 'error'
}

export interface KosmosFinding {
    id: string
    type:
    | 'unused_node'
    | 'redundant_node'
    | 'broad_permission'
    | 'god_agent'
    | 'circular_dep'
    | 'low_confidence'
    | 'instruction_bloat'
    | 'instruction_unstructured'
    | 'instruction_stale'
    | 'broken_link'
    | 'orphan_page'
    | 'missing_source'
    | 'unused_source'
    | 'thin_page'
    | 'missing_index'
    | 'instruction_missing_navigation'
    | 'instruction_path_missing'
    | 'instruction_too_long'
    | 'instruction_duplicate'
    | 'raw_wiki_output_gap'
    | 'weak_cross_links'
    | 'stale_page'
    | 'output_without_provenance'
    | 'runtime_used_weak_context'
    severity: 'info' | 'warning' | 'error'
    title: string
    description: string
    nodeIds: string[]
    suggestion?: string
}

export interface ContextSystemSummary {
    isMarkdownVault: boolean
    isObsidianVault: boolean
    hasRawWikiOutputs: boolean
    instructionFiles: string[]
    detectedConventions: string[]
}

export interface ContextHealthSummary {
    score: number
    findings: KosmosFinding[]
    metrics: {
        nodeCount: number
        edgeCount: number
        wikiPages: number
        sourceDocs: number
        outputArtifacts: number
        instructionFiles: number
        indexFiles: number
        brokenLinks: number
        missingSourcePages: number
        outputsWithoutProvenance: number
        unusedSources: number
        orphanPages: number
        sourceCoveragePct: number
        sessionsToday: number
        activeTraces: number
    }
    contextSystem?: ContextSystemSummary
    latestScan?: WorkspaceScanSummary
}

export interface WorkspaceScanSummary {
    id: string
    workspaceId: string
    startedAt: number
    completedAt?: number
    nodeCount: number
    edgeCount: number
    findingCount: number
    meta?: Record<string, unknown>
}

export interface ContextDriftSummary {
    fromScanId?: string
    toScanId: string
    newFiles: string[]
    deletedFiles: string[]
    changedFiles: string[]
    newFindings: KosmosFinding[]
    resolvedFindings: KosmosFinding[]
    sourceCoverageDelta: number
    brokenLinkDelta: number
    instructionFilesChanged: string[]
}

export interface ContextNodeDetail {
    node: KosmosNode
    inbound: Array<{ edge: KosmosEdge; node: KosmosNode }>
    outbound: Array<{ edge: KosmosEdge; node: KosmosNode }>
    sources: KosmosNode[]
    dependents: KosmosNode[]
    sessions: Array<{ traceId: string; source: RuntimeSource; startedAt: number; endedAt?: number; status: string; filePath?: string }>
    lastReadAt?: number
    lastWrittenAt?: number
    findings: KosmosFinding[]
}

export interface ScanFileSnapshot {
    path: string
    kind: string
    contentHash?: string
    mtimeMs?: number
    size: number
    meta?: Record<string, unknown>
}

export interface IntegrationStatus {
    ingestServer: { running: boolean; port: number }
    claudeCode: { connected: boolean; lastEvent?: number }
    openClaw: { connected: boolean; url?: string; lastEvent?: number }
}

export type RuntimeSource = KosmosRun['source'] | 'generic'

export type RuntimeSpanOperation =
    | 'agent'
    | 'tool'
    | 'model'
    | 'file_read'
    | 'file_write'
    | 'api'
    | 'memory'

export type RuntimeEventStatus = 'start' | 'update' | 'end' | 'error'

export interface KosmosTrace {
    id: string
    workspaceId: string
    source: RuntimeSource
    threadId: string
    sessionId: string
    rootAgentName?: string
    startedAt: number
    endedAt?: number
    status: 'running' | 'completed' | 'error'
    eventCount: number
    meta?: Record<string, unknown>
}

export interface KosmosSpan {
    id: string
    traceId: string
    workspaceId: string
    source: RuntimeSource
    operation: RuntimeSpanOperation
    name: string
    status: RuntimeEventStatus
    parentSpanId?: string
    agentName?: string
    toolName?: string
    modelName?: string
    filePath?: string
    startedAt: number
    endedAt?: number
    durationMs?: number
    input?: Record<string, unknown>
    output?: Record<string, unknown>
    error?: string
    meta?: Record<string, unknown>
}

export interface KosmosThread {
    id: string
    workspaceId: string
    source: RuntimeSource
    title: string
    startedAt: number
    endedAt?: number
    traceCount: number
    meta?: Record<string, unknown>
}

export interface KosmosFeedbackScore {
    id: string
    workspaceId: string
    traceId: string
    spanId?: string
    name: string
    value: number
    reason?: string
    source: 'ui' | 'rule' | 'import'
    createdAt: number
    updatedAt: number
    meta?: Record<string, unknown>
}

export interface KosmosPromptTemplate {
    id: string
    workspaceId: string
    name: string
    description?: string
    createdAt: number
    updatedAt: number
    meta?: Record<string, unknown>
}

export interface KosmosPromptVersion {
    id: string
    templateId: string
    workspaceId: string
    version: number
    content: string
    createdAt: number
    sourcePath?: string
    meta?: Record<string, unknown>
}

export interface UsageMetrics {
    inputTokens?: number
    outputTokens?: number
    cacheReadTokens?: number
    cacheWriteTokens?: number
    totalTokens?: number
}

export interface LiveActivityItem {
    id: string
    tsMs: number
    source: RuntimeSource
    operation: RuntimeSpanOperation
    status: RuntimeEventStatus
    agentName?: string
    toolName?: string
    filePath?: string
    summary: string
}

export interface NormalizedRuntimeEvent {
    id: string
    workspaceId: string
    source: RuntimeSource
    sessionId: string
    traceId: string
    threadId: string
    spanId: string
    parentSpanId?: string
    operation: RuntimeSpanOperation
    status: RuntimeEventStatus
    legacyEventType: TraceEventType
    tsMs: number
    durationMs?: number
    phase?: EventPhase
    agentName?: string
    toolName?: string
    modelName?: string
    filePath?: string
    fileName?: string
    fileInteraction?: 'reads' | 'writes'
    title: string
    summary?: string
    usage?: UsageMetrics
    costUsd?: number
    input?: Record<string, unknown>
    output?: Record<string, unknown>
    error?: string
    nodeIds: string[]
    meta?: Record<string, unknown>
}

export interface TracePromptVersionLink {
    traceId: string
    templateId: string
    templateName: string
    versionId: string
    version: number
    sourcePath: string
    createdAt: number
}

export interface TraceFeedbackSummary {
    id: string
    workspaceId: string
    traceId: string
    spanId?: string
    name: string
    value: number
    reason?: string
    source: 'ui' | 'rule' | 'import'
    createdAt: number
    updatedAt: number
}

export interface TraceDetailSpan extends KosmosSpan {
    usage?: UsageMetrics
    costUsd?: number
}

export interface TraceDetail {
    trace: KosmosTrace
    thread: KosmosThread | null
    spans: TraceDetailSpan[]
    feedback: TraceFeedbackSummary[]
    promptVersions: TracePromptVersionLink[]
    usage: UsageMetrics & { costUsd: number }
    datasetExamples: {
        id: string
        datasetId: string
        datasetName: string
        createdAt: number
    }[]
}

export interface PromptVersionInsight {
    versionId: string
    version: number
    createdAt: number
    content: string
    traceCount: number
    avgFeedback: number | null
    feedbackCount: number
    tokens: number
    costUsd: number
}

export interface PromptFileInsights {
    template: {
        id: string
        workspaceId: string
        name: string
        sourcePath: string
    } | null
    versions: PromptVersionInsight[]
    activeTraceCount: number
    datasetCount: number
    latestVersionId?: string
    experiment?: PromptExperimentReport | null
}

export interface DatasetSummary {
    id: string
    workspaceId: string
    name: string
    exampleCount: number
    createdAt: number
    updatedAt: number
}

export interface PromptExperimentVersionStat {
    versionId: string
    version: number
    exampleCount: number
    avgFeedback: number | null
    feedbackCount: number
    totalTokens: number
    totalCostUsd: number
}

export interface PromptExperimentReport {
    experimentId: string
    datasetId?: string
    datasetName?: string
    templateId: string
    sourcePath: string
    generatedAt: number
    baselineVersionId?: string
    candidateVersionId?: string
    versionStats: PromptExperimentVersionStat[]
}

export interface RuntimeAdapter {
    source: RuntimeSource
    normalize: (rawEvent: Record<string, unknown>, context: {
        workspaceId: string
        workspacePath?: string
    }) => NormalizedRuntimeEvent[]
}
