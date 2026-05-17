/**
 * live-persist.ts
 *
 * V2 live runtime pipeline:
 * - normalizes raw runtime payloads through runtime-specific adapters
 * - persists traces/spans/threads as the canonical model
 * - keeps runs/events as a compatibility projection for existing UI
 * - persists runtime graph nodes/edges so live activity survives rescans
 * - finalizes stale traces instead of leaving sessions dangling forever
 */

import type Database from 'better-sqlite3'
import { generateFileNodeId, generateNodeId, generateStableId } from '../../shared/ids'
import type { NormalizedRuntimeEvent, RuntimeSource } from '../../shared/types'
import { normalizeRuntimePayload, resetRuntimeNormalizerState } from './runtime-normalizer'
import { linkTraceToPromptVersions } from '../runtime/prompt-store'

interface LivePersistenceContext {
    workspaceId: string
    workspacePath?: string
}

interface ActiveTraceState {
    workspaceId: string
    source: RuntimeSource
    threadId: string
    lastSeenAt: number
    toolCallCount: number
    modelName?: string
    summary?: string
}

const pendingEvents: NormalizedRuntimeEvent[] = []
const activeTraceState = new Map<string, ActiveTraceState>()

let batchTimer: ReturnType<typeof setTimeout> | null = null
let lastDb: Database.Database | null = null
let lastSweepAt = 0

const BATCH_DELAY_MS = 400
const STALE_TRACE_TIMEOUT_MS = 5 * 60 * 1000
const STALE_TRACE_SWEEP_MS = 60 * 1000

function safeJson(value: unknown, fallback = '{}'): string {
    if (value === undefined || value === null) return fallback
    try {
        return JSON.stringify(value)
    } catch {
        return fallback
    }
}

function runtimeEdgeId(fromId: string, type: string, toId: string): string {
    return `runtime::${fromId}--${type}--${toId}`
}

function inferRuntimeFileNodeType(path: string | undefined): string {
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

function quarantineEvent(
    db: Database.Database,
    source: RuntimeSource,
    reason: string,
    rawEvent: Record<string, unknown>,
    workspaceId?: string,
): void {
    const now = Date.now()
    db.prepare(`
        INSERT OR IGNORE INTO rejected_runtime_events (id, workspace_id, source, reason, raw_event, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        generateStableId('rejected_runtime_event', source, reason, safeJson(rawEvent), now),
        workspaceId ?? null,
        source,
        reason,
        safeJson(rawEvent),
        now,
    )
}

function normalizeIncomingEvent(
    db: Database.Database,
    context: LivePersistenceContext,
    rawEvent: Record<string, unknown>,
): NormalizedRuntimeEvent[] {
    const source = (typeof rawEvent.source === 'string' ? rawEvent.source : 'generic') as RuntimeSource

    try {
        const normalized = normalizeRuntimePayload(rawEvent, context)
        if (normalized.length > 0) return normalized
        quarantineEvent(db, source, 'Normalization returned no events', rawEvent, context.workspaceId)
    } catch (error) {
        quarantineEvent(
            db,
            source,
            error instanceof Error ? error.message : 'Unknown normalization error',
            rawEvent,
            context.workspaceId,
        )
    }

    return []
}

function isTerminalRunEvent(event: NormalizedRuntimeEvent): boolean {
    return event.legacyEventType === 'session_end'
        || (
            event.operation === 'agent'
            && !event.parentSpanId
            && (event.status === 'end' || event.status === 'error')
        )
}

function nextTraceState(previous: ActiveTraceState | undefined, event: NormalizedRuntimeEvent): ActiveTraceState {
    const receivedAt = Date.now()
    const toolCallCount = (previous?.toolCallCount ?? 0)
        + (event.legacyEventType === 'tool_call' && event.phase === 'start' ? 1 : 0)

    const summary = (isTerminalRunEvent(event) && event.summary)
        ? event.summary
        : previous?.summary
        ?? (event.legacyEventType === 'user_prompt' ? event.summary : undefined)
        ?? event.summary
        ?? event.title

    return {
        workspaceId: event.workspaceId,
        source: event.source,
        threadId: event.threadId,
        lastSeenAt: receivedAt,
        toolCallCount,
        modelName: event.modelName ?? previous?.modelName,
        summary,
    }
}

function buildRootMeta(event: NormalizedRuntimeEvent, state: ActiveTraceState): Record<string, unknown> {
    return {
        threadId: event.threadId,
        sessionId: event.sessionId,
        latestOperation: event.operation,
        latestStatus: event.status,
        latestFilePath: event.filePath,
        latestToolName: event.toolName,
        latestModelName: event.modelName,
        summary: state.summary ?? event.summary ?? event.title,
        model: state.modelName,
        toolCallCount: state.toolCallCount,
        lastEventAt: event.tsMs,
        usage: event.usage,
        costUsd: event.costUsd,
    }
}

function queueNormalizedEvents(db: Database.Database, normalizedEvents: NormalizedRuntimeEvent[]): void {
    if (normalizedEvents.length === 0) return

    lastDb = db
    pendingEvents.push(...normalizedEvents)

    if (!batchTimer) {
        batchTimer = setTimeout(() => {
            if (lastDb) flushBatch(lastDb)
        }, BATCH_DELAY_MS)
    }
}

function flushBatch(db: Database.Database): void {
    if (pendingEvents.length === 0) {
        batchTimer = null
        return
    }

    const batch = pendingEvents.splice(0, pendingEvents.length).sort((a, b) => a.tsMs - b.tsMs)

    const ensureThread = db.prepare(`
        INSERT OR IGNORE INTO threads (id, workspace_id, source, title, started_at, trace_count, meta)
        VALUES (?, ?, ?, ?, ?, 0, '{}')
    `)
    const incrementThreadTraceCount = db.prepare(`
        UPDATE threads SET
            trace_count = trace_count + 1,
            ended_at = NULL
        WHERE id = ?
    `)
    const finalizeThread = db.prepare(`
        UPDATE threads SET
            ended_at = CASE
                WHEN ended_at IS NULL OR ? > ended_at THEN ?
                ELSE ended_at
            END,
            meta = ?
        WHERE id = ?
    `)

    const ensureTrace = db.prepare(`
        INSERT OR IGNORE INTO traces (id, workspace_id, source, thread_id, session_id, root_agent_name, started_at, status, event_count, meta)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'running', 0, '{}')
    `)
    const updateTrace = db.prepare(`
        UPDATE traces SET
            root_agent_name = COALESCE(root_agent_name, ?),
            started_at = CASE WHEN ? < started_at THEN ? ELSE started_at END,
            meta = ?
        WHERE id = ?
    `)
    const incrementTraceEventCount = db.prepare(`
        UPDATE traces SET
            event_count = event_count + 1,
            meta = ?
        WHERE id = ?
    `)
    const finalizeTrace = db.prepare(`
        UPDATE traces SET
            ended_at = CASE
                WHEN ended_at IS NULL OR ? > ended_at THEN ?
                ELSE ended_at
            END,
            status = CASE WHEN status = 'error' THEN 'error' ELSE ? END,
            meta = ?
        WHERE id = ?
    `)

    const ensureRun = db.prepare(`
        INSERT OR IGNORE INTO runs (id, workspace_id, source, started_at, event_count, status, meta)
        VALUES (?, ?, ?, ?, 0, 'running', '{}')
    `)
    const updateRun = db.prepare(`
        UPDATE runs SET
            started_at = CASE WHEN ? < started_at THEN ? ELSE started_at END,
            meta = ?
        WHERE id = ?
    `)
    const incrementRunEventCount = db.prepare(`
        UPDATE runs SET
            event_count = event_count + 1,
            meta = ?
        WHERE id = ?
    `)
    const finalizeRun = db.prepare(`
        UPDATE runs SET
            ended_at = CASE
                WHEN ended_at IS NULL OR ? > ended_at THEN ?
                ELSE ended_at
            END,
            status = CASE WHEN status = 'error' THEN 'error' ELSE ? END,
            meta = ?
        WHERE id = ?
    `)

    const upsertSpan = db.prepare(`
        INSERT INTO spans (
            id, trace_id, workspace_id, source, operation, name, status, parent_span_id,
            agent_name, tool_name, model_name, file_path, started_at, ended_at, duration_ms,
            input, output, error, meta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            status = CASE
                WHEN excluded.status = 'error' THEN 'error'
                WHEN excluded.status = 'end' AND spans.status != 'error' THEN 'end'
                WHEN excluded.status = 'update' AND spans.status NOT IN ('error', 'end') THEN 'update'
                ELSE spans.status
            END,
            parent_span_id = COALESCE(spans.parent_span_id, excluded.parent_span_id),
            agent_name = COALESCE(spans.agent_name, excluded.agent_name),
            tool_name = COALESCE(spans.tool_name, excluded.tool_name),
            model_name = COALESCE(spans.model_name, excluded.model_name),
            file_path = COALESCE(spans.file_path, excluded.file_path),
            started_at = CASE WHEN excluded.started_at < spans.started_at THEN excluded.started_at ELSE spans.started_at END,
            ended_at = COALESCE(excluded.ended_at, spans.ended_at),
            duration_ms = COALESCE(excluded.duration_ms, spans.duration_ms),
            input = COALESCE(excluded.input, spans.input),
            output = COALESCE(excluded.output, spans.output),
            error = COALESCE(excluded.error, spans.error),
            meta = CASE
                WHEN excluded.meta IS NOT NULL AND excluded.meta != '{}' THEN excluded.meta
                ELSE spans.meta
            END
    `)

    const insertEvent = db.prepare(`
        INSERT OR IGNORE INTO events (
            id, run_id, type, phase, ts_ms, agent_id, tool_name, node_ids, input, output, error, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertRuntimeNode = db.prepare(`
        INSERT OR IGNORE INTO nodes (
            id, workspace_id, name, type, source, confidence, description, tags, paths, meta, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'runtime', ?, ?, ?, ?, ?, ?, ?)
    `)

    const upsertRuntimeEdge = db.prepare(`
        INSERT INTO edges (id, workspace_id, type, from_id, to_id, weight, meta)
        VALUES (?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(id) DO UPDATE SET
            weight = edges.weight + 1,
            meta = excluded.meta
    `)

    const writeBatch = db.transaction(() => {
        for (const event of batch) {
            const traceAgentName = event.parentSpanId && event.operation === 'agent'
                ? null
                : event.agentName ?? null

            ensureThread.run(
                event.threadId,
                event.workspaceId,
                event.source,
                event.agentName ?? event.title,
                event.tsMs,
            )

            const insertedTrace = ensureTrace.run(
                event.traceId,
                event.workspaceId,
                event.source,
                event.threadId,
                event.sessionId,
                traceAgentName,
                event.tsMs,
            )

            if (insertedTrace.changes > 0) {
                incrementThreadTraceCount.run(event.threadId)
            }

            ensureRun.run(
                event.traceId,
                event.workspaceId,
                event.source === 'generic' ? 'sdk' : event.source,
                event.tsMs,
            )

            if (event.parentSpanId && event.agentName && event.operation !== 'agent') {
                upsertSpan.run(
                    event.parentSpanId,
                    event.traceId,
                    event.workspaceId,
                    event.source,
                    'agent',
                    event.agentName,
                    'start',
                    null,
                    event.agentName,
                    null,
                    null,
                    null,
                    event.tsMs,
                    null,
                    null,
                    null,
                    null,
                    null,
                    safeJson({ synthetic: true }),
                )
            }

            upsertSpan.run(
                event.spanId,
                event.traceId,
                event.workspaceId,
                event.source,
                event.operation,
                event.title,
                event.status,
                event.parentSpanId ?? null,
                event.agentName ?? null,
                event.toolName ?? null,
                event.modelName ?? null,
                event.filePath ?? null,
                event.tsMs,
                event.status === 'end' || event.status === 'error' ? event.tsMs : null,
                event.durationMs ?? null,
                event.input ? safeJson(event.input, 'null') : null,
                event.output ? safeJson(event.output, 'null') : null,
                event.error ?? null,
                safeJson({
                    ...(event.meta ?? {}),
                    ...(event.usage ? { usage: event.usage } : {}),
                    ...(typeof event.costUsd === 'number' ? { costUsd: event.costUsd } : {}),
                }),
            )

            const insertResult = insertEvent.run(
                event.id,
                event.traceId,
                event.legacyEventType,
                event.phase ?? null,
                event.tsMs,
                event.agentName ?? null,
                event.toolName ?? null,
                safeJson(event.nodeIds, '[]'),
                event.input ? safeJson(event.input, 'null') : null,
                event.output ? safeJson(event.output, 'null') : null,
                event.error ?? null,
                event.durationMs ?? null,
            )

            if (insertResult.changes === 0) continue

            const state = nextTraceState(activeTraceState.get(event.traceId), event)
            const rootMeta = buildRootMeta(event, state)

            updateTrace.run(
                traceAgentName,
                event.tsMs,
                event.tsMs,
                safeJson(rootMeta),
                event.traceId,
            )

            updateRun.run(
                event.tsMs,
                event.tsMs,
                safeJson(rootMeta),
                event.traceId,
            )

            incrementTraceEventCount.run(safeJson(rootMeta), event.traceId)
            incrementRunEventCount.run(safeJson(rootMeta), event.traceId)
            persistRuntimeGraphEvent(event, insertRuntimeNode, upsertRuntimeEdge)

            if (isTerminalRunEvent(event)) {
                const finalStatus = event.status === 'error' ? 'error' : 'completed'
                finalizeTrace.run(event.tsMs, event.tsMs, finalStatus, safeJson(rootMeta), event.traceId)
                finalizeRun.run(event.tsMs, event.tsMs, finalStatus, safeJson(rootMeta), event.traceId)
                finalizeThread.run(event.tsMs, event.tsMs, safeJson(rootMeta), event.threadId)
                linkTraceToPromptVersions(db, event.traceId, event.workspaceId, event.tsMs)
                activeTraceState.delete(event.traceId)
            } else {
                activeTraceState.set(event.traceId, state)
            }
        }

        const now = Date.now()
        if (now - lastSweepAt >= STALE_TRACE_SWEEP_MS) {
            sweepStaleTraces(now, finalizeTrace, finalizeRun, finalizeThread)
            lastSweepAt = now
        }
    })

    writeBatch()
    batchTimer = null
}

function persistRuntimeGraphEvent(
    event: NormalizedRuntimeEvent,
    insertRuntimeNode: Database.Statement,
    upsertRuntimeEdge: Database.Statement,
): void {
    const now = event.tsMs
    const tags = safeJson(['live'])

    const agentNodeId = event.agentName
        ? generateNodeId(event.workspaceId, 'agent', event.agentName)
        : undefined
    const toolNodeId = event.toolName
        ? generateNodeId(event.workspaceId, 'tool', event.toolName)
        : undefined
    const modelNodeId = event.modelName
        ? generateNodeId(event.workspaceId, 'model', event.modelName)
        : undefined
    const fileNodeId = event.filePath
        ? generateFileNodeId(event.workspaceId, event.filePath, event.fileName)
        : undefined
    const fileLabel = event.fileName ?? event.filePath?.split('/').pop()

    if (agentNodeId && event.agentName) {
        insertRuntimeNode.run(
            agentNodeId,
            event.workspaceId,
            event.agentName,
            'agent',
            1,
            `Runtime agent observed from ${event.source}`,
            tags,
            safeJson([]),
            safeJson({ source: event.source, runtime: true }),
            now,
            now,
        )
    }

    if (toolNodeId && event.toolName) {
        insertRuntimeNode.run(
            toolNodeId,
            event.workspaceId,
            event.toolName,
            'tool',
            1,
            `Runtime tool observed from ${event.source}`,
            tags,
            safeJson([]),
            safeJson({ source: event.source, runtime: true }),
            now,
            now,
        )
    }

    if (modelNodeId && event.modelName) {
        insertRuntimeNode.run(
            modelNodeId,
            event.workspaceId,
            event.modelName,
            'model',
            1,
            `Runtime model observed from ${event.source}`,
            tags,
            safeJson([]),
            safeJson({ source: event.source, runtime: true }),
            now,
            now,
        )
    }

    if (fileNodeId && fileLabel) {
        insertRuntimeNode.run(
            fileNodeId,
            event.workspaceId,
            fileLabel,
            inferRuntimeFileNodeType(event.filePath),
            1,
            event.filePath ? `Live file activity: ${event.filePath}` : `Live file activity: ${fileLabel}`,
            safeJson(['live', 'file-activity', inferRuntimeFileNodeType(event.filePath)]),
            safeJson(event.filePath ? [event.filePath] : []),
            safeJson({ source: event.source, runtime: true, filePath: event.filePath }),
            now,
            now,
        )
    }

    if (agentNodeId && toolNodeId) {
        upsertRuntimeEdge.run(
            runtimeEdgeId(agentNodeId, 'calls', toolNodeId),
            event.workspaceId,
            'calls',
            agentNodeId,
            toolNodeId,
            safeJson({ source: event.source, lastSeenAt: now, operation: event.operation }),
        )
    }

    if (agentNodeId && modelNodeId) {
        upsertRuntimeEdge.run(
            runtimeEdgeId(agentNodeId, 'uses', modelNodeId),
            event.workspaceId,
            'uses',
            agentNodeId,
            modelNodeId,
            safeJson({ source: event.source, lastSeenAt: now, operation: event.operation }),
        )
    }

    if (fileNodeId) {
        const ownerNodeId = toolNodeId ?? agentNodeId
        const edgeType = event.fileInteraction
            ?? (event.operation === 'file_write' ? 'writes' : 'reads')

        if (ownerNodeId) {
            upsertRuntimeEdge.run(
                runtimeEdgeId(ownerNodeId, edgeType, fileNodeId),
                event.workspaceId,
                edgeType,
                ownerNodeId,
                fileNodeId,
                safeJson({ source: event.source, lastSeenAt: now, filePath: event.filePath }),
            )
        }
    }
}

function sweepStaleTraces(
    now: number,
    finalizeTrace: Database.Statement,
    finalizeRun: Database.Statement,
    finalizeThread: Database.Statement,
): void {
    for (const [traceId, state] of activeTraceState.entries()) {
        if (now - state.lastSeenAt < STALE_TRACE_TIMEOUT_MS) continue

        const meta = safeJson({
            status: 'completed',
            staleClosed: true,
            summary: state.summary,
            model: state.modelName,
            toolCallCount: state.toolCallCount,
            lastEventAt: state.lastSeenAt,
        })

        finalizeTrace.run(state.lastSeenAt, state.lastSeenAt, 'completed', meta, traceId)
        finalizeRun.run(state.lastSeenAt, state.lastSeenAt, 'completed', meta, traceId)
        finalizeThread.run(state.lastSeenAt, state.lastSeenAt, meta, state.threadId)
        activeTraceState.delete(traceId)
    }
}

export function persistNormalizedEvents(
    db: Database.Database,
    normalizedEvents: NormalizedRuntimeEvent[],
): NormalizedRuntimeEvent[] {
    queueNormalizedEvents(db, normalizedEvents)
    return normalizedEvents
}

export function persistLiveEvent(
    db: Database.Database,
    context: LivePersistenceContext,
    rawEvent: Record<string, unknown>,
): NormalizedRuntimeEvent[] {
    const normalized = normalizeIncomingEvent(db, context, rawEvent)
    queueNormalizedEvents(db, normalized)
    return normalized
}

export function flushLivePersistence(): void {
    if (!lastDb) return
    if (batchTimer) clearTimeout(batchTimer)
    flushBatch(lastDb)
}

export function clearLiveRuntimeState(): void {
    if (batchTimer) clearTimeout(batchTimer)
    batchTimer = null
    pendingEvents.length = 0
    activeTraceState.clear()
    resetRuntimeNormalizerState()
}
