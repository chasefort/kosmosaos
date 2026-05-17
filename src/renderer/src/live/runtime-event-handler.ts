import { generateFileNodeId } from '../../../shared/ids'
import { KosmosNode, LiveActivityItem, NormalizedRuntimeEvent } from '../../../shared/types'

const CONTEXT_FILE_TYPES = new Set<KosmosNode['type']>([
    'file',
    'wiki_page',
    'source_doc',
    'output_artifact',
    'instruction_file',
    'index_file',
])

function inferRuntimeFileType(path: string | undefined): KosmosNode['type'] {
    if (!path) return 'file'
    const normalized = path.replace(/\\/g, '/').replace(/^\.\/+/, '')
    const lower = normalized.toLowerCase()
    const first = lower.split('/')[0]
    const name = lower.split('/').pop() ?? lower
    if (/^(agents?|claude)\.(md|txt)$/.test(name) || lower.startsWith('.cursor/rules/') || lower.startsWith('.claude/') || /(^|\/)skill\.md$/.test(lower)) return 'instruction_file'
    if (name === 'index.md' || name === '_index.md' || (name === 'readme.md' && normalized.includes('/'))) return 'index_file'
    if (['raw', 'source', 'sources', 'clips', 'transcripts', 'inbox'].includes(first)) return 'source_doc'
    if (['wiki', 'notes', 'concepts', 'entities', 'decisions', 'projects'].includes(first)) return 'wiki_page'
    if (['outputs', 'deliverables', 'reports', 'drafts'].includes(first)) return 'output_artifact'
    return 'file'
}

export interface LiveRuntimeEventContext {
    workspaceId: string
    workspacePath?: string
    graphNodes: KosmosNode[]
    flashNodes(ids: string[]): void
    markFileTouched(path: string): void
    upsertRuntimeNode(node: KosmosNode): void
    incrementEdgeWeight(fromId: string, toId: string, edgeType: 'calls' | 'uses' | 'reads' | 'writes', workspaceId: string): void
    touchLiveVisibleNodes(ids: string[], ttlMs?: number): void
    pushLiveActivity(item: LiveActivityItem): void
    setLiveActivityTs(ts: number): void
}

function resolveNodeId(
    graphNodes: KosmosNode[],
    workspaceId: string,
    name: string,
    type: KosmosNode['type'],
    preferredId?: string,
    path?: string,
): string {
    if (type === 'file' && path) {
        const byPath = graphNodes.find(node => CONTEXT_FILE_TYPES.has(node.type) && (node.paths ?? []).includes(path))
        if (byPath) return byPath.id

        const canonicalId = generateFileNodeId(workspaceId, path, name)
        const byCanonicalId = graphNodes.find(node => node.id === canonicalId)
        if (byCanonicalId) return byCanonicalId.id

        if (preferredId) {
            const byPreferredId = graphNodes.find(node => node.id === preferredId)
            if (byPreferredId) return byPreferredId.id
            return preferredId
        }
        return canonicalId
    }

    const byId = preferredId ? graphNodes.find(node => node.id === preferredId) : undefined
    if (byId) return byId.id

    const existing = graphNodes.find(node => node.name === name && node.type === type)
    return existing?.id ?? preferredId ?? `${workspaceId}::${type}::${name}`
}

export function applyLiveRuntimeEvent(context: LiveRuntimeEventContext, event: NormalizedRuntimeEvent): void {
    const wsId = context.workspaceId
    if (event.workspaceId !== wsId) return

    const toolName = event.toolName
    const agentName = event.agentName
    const modelName = event.modelName
    const filePath = event.filePath
    const fileName = event.fileName ?? (filePath ? filePath.split('/').pop() : undefined)
    const eventNodeIds = Array.isArray(event.nodeIds) ? event.nodeIds : []

    const fileNodeId = fileName
        ? resolveNodeId(context.graphNodes, wsId, fileName, 'file', eventNodeIds.find(id => context.graphNodes.some(node => node.id === id && CONTEXT_FILE_TYPES.has(node.type))), filePath)
        : undefined
    const toolNodeId = toolName
        ? resolveNodeId(context.graphNodes, wsId, toolName, 'tool', eventNodeIds.find(id => context.graphNodes.some(node => node.id === id && node.type === 'tool')))
        : undefined
    const agentNodeId = agentName
        ? resolveNodeId(context.graphNodes, wsId, agentName, 'agent', eventNodeIds.find(id => context.graphNodes.some(node => node.id === id && node.type === 'agent')))
        : undefined
    const modelNodeId = modelName
        ? resolveNodeId(context.graphNodes, wsId, modelName, 'model', eventNodeIds.find(id => context.graphNodes.some(node => node.id === id && node.type === 'model')))
        : undefined

    const nodesToFlash = Array.from(new Set([
        ...eventNodeIds,
        agentNodeId,
        toolNodeId,
        modelNodeId,
        fileNodeId,
    ].filter((value): value is string => Boolean(value))))

    if (nodesToFlash.length > 0) context.flashNodes(nodesToFlash)

    if (filePath && context.workspacePath) {
        const rel = filePath.startsWith(context.workspacePath)
            ? filePath.slice(context.workspacePath.length).replace(/^\//, '')
            : filePath
        context.markFileTouched(rel)
    }

    const now = Date.now()
    const upsertIfMissing = (node: KosmosNode) => {
        if (!context.graphNodes.find(existing => existing.id === node.id)) {
            context.upsertRuntimeNode(node)
        }
    }

    if (agentNodeId && agentName) {
        upsertIfMissing({
            id: agentNodeId,
            name: agentName,
            type: 'agent',
            source: 'runtime',
            confidence: 1.0,
            tags: ['live'],
            paths: [],
            workspaceId: wsId,
            createdAt: now,
            updatedAt: now,
            description: `Live runtime agent from ${event.source}`,
        })
    }

    if (toolNodeId && toolName) {
        upsertIfMissing({
            id: toolNodeId,
            name: toolName,
            type: 'tool',
            source: 'runtime',
            confidence: 1.0,
            tags: ['live'],
            paths: [],
            workspaceId: wsId,
            createdAt: now,
            updatedAt: now,
            description: `Live runtime tool from ${event.source}`,
        })
    }

    if (modelNodeId && modelName) {
        upsertIfMissing({
            id: modelNodeId,
            name: modelName,
            type: 'model',
            source: 'runtime',
            confidence: 1.0,
            tags: ['live'],
            paths: [],
            workspaceId: wsId,
            createdAt: now,
            updatedAt: now,
            description: `Live runtime model from ${event.source}`,
        })
    }

    if (fileNodeId && fileName) {
        const existingFileNode = context.graphNodes.find(node => node.id === fileNodeId)
        const runtimeFileType = existingFileNode?.type ?? inferRuntimeFileType(filePath)
        upsertIfMissing({
            id: fileNodeId,
            name: fileName,
            type: runtimeFileType,
            source: 'runtime',
            confidence: 1.0,
            tags: ['live', 'file-activity', runtimeFileType],
            paths: filePath ? [filePath] : [],
            workspaceId: wsId,
            createdAt: now,
            updatedAt: now,
            description: filePath ? `Live ${runtimeFileType.replace(/_/g, ' ')} activity: ${filePath}` : `Live file activity: ${fileName}`,
        })
        context.touchLiveVisibleNodes([fileNodeId], 20_000)
    }

    if (agentNodeId && toolNodeId) {
        context.incrementEdgeWeight(agentNodeId, toolNodeId, 'calls', wsId)
    }

    if (agentNodeId && modelNodeId) {
        context.incrementEdgeWeight(agentNodeId, modelNodeId, 'uses', wsId)
    }

    if (fileNodeId) {
        const ownerNodeId = toolNodeId ?? agentNodeId
        const fileEdgeType = event.fileInteraction
            ?? (event.operation === 'file_write' ? 'writes' : event.operation === 'file_read' ? 'reads' : undefined)
        if (ownerNodeId && fileEdgeType) {
            context.incrementEdgeWeight(ownerNodeId, fileNodeId, fileEdgeType, wsId)
        }
    }

    context.pushLiveActivity({
        id: event.id,
        tsMs: event.tsMs,
        source: event.source,
        operation: event.operation,
        status: event.status,
        agentName,
        toolName,
        filePath,
        summary: event.summary ?? event.title,
    })

    context.setLiveActivityTs(Date.now())
}
