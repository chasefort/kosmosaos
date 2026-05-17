import { IpcMain } from 'electron'
import { getDb } from '../storage/db'
import {
    DatasetSummary,
    KosmosSpan,
    KosmosThread,
    KosmosTrace,
    PromptFileInsights,
    PromptExperimentReport,
    TraceDetail,
    TraceFeedbackSummary,
    UsageMetrics,
} from '../../shared/types'
import {
    getPromptFileInsights,
    getTracePromptVersions,
    listDatasets,
    runPromptExperiment,
    saveTraceAsDatasetExample,
} from '../runtime/prompt-store'
import { generateStableId } from '../../shared/ids'

function safeParseObject(value: unknown): Record<string, unknown> {
    if (typeof value !== 'string' || value.trim().length === 0) return {}
    try {
        const parsed = JSON.parse(value)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : {}
    } catch {
        return {}
    }
}

function parseTrace(row: Record<string, unknown>): KosmosTrace {
    return {
        id: row.id as string,
        workspaceId: row.workspace_id as string,
        source: row.source as KosmosTrace['source'],
        threadId: row.thread_id as string,
        sessionId: row.session_id as string,
        rootAgentName: row.root_agent_name as string | undefined,
        startedAt: row.started_at as number,
        endedAt: row.ended_at as number | undefined,
        status: row.status as KosmosTrace['status'],
        eventCount: row.event_count as number,
        meta: safeParseObject(row.meta),
    }
}

function parseThread(row: Record<string, unknown> | undefined): KosmosThread | null {
    if (!row) return null
    return {
        id: row.id as string,
        workspaceId: row.workspace_id as string,
        source: row.source as KosmosThread['source'],
        title: row.title as string,
        startedAt: row.started_at as number,
        endedAt: row.ended_at as number | undefined,
        traceCount: row.trace_count as number,
        meta: safeParseObject(row.meta),
    }
}

function parseUsage(meta: Record<string, unknown>): { usage?: UsageMetrics; costUsd: number } {
    const usage = meta.usage && typeof meta.usage === 'object'
        ? meta.usage as UsageMetrics
        : undefined
    const costUsd = typeof meta.costUsd === 'number' ? meta.costUsd : 0
    return { usage, costUsd }
}

function parseSpan(row: Record<string, unknown>): KosmosSpan & { usage?: UsageMetrics; costUsd?: number } {
    const meta = safeParseObject(row.meta)
    const parsed = parseUsage(meta)
    return {
        id: row.id as string,
        traceId: row.trace_id as string,
        workspaceId: row.workspace_id as string,
        source: row.source as KosmosSpan['source'],
        operation: row.operation as KosmosSpan['operation'],
        name: row.name as string,
        status: row.status as KosmosSpan['status'],
        parentSpanId: row.parent_span_id as string | undefined,
        agentName: row.agent_name as string | undefined,
        toolName: row.tool_name as string | undefined,
        modelName: row.model_name as string | undefined,
        filePath: row.file_path as string | undefined,
        startedAt: row.started_at as number,
        endedAt: row.ended_at as number | undefined,
        durationMs: row.duration_ms as number | undefined,
        input: row.input ? JSON.parse(row.input as string) : undefined,
        output: row.output ? JSON.parse(row.output as string) : undefined,
        error: row.error as string | undefined,
        meta,
        usage: parsed.usage,
        costUsd: parsed.costUsd,
    }
}

function parseFeedback(row: Record<string, unknown>): TraceFeedbackSummary {
    return {
        id: row.id as string,
        workspaceId: row.workspace_id as string,
        traceId: row.trace_id as string,
        spanId: row.span_id as string | undefined,
        name: row.name as string,
        value: row.value as number,
        reason: row.reason as string | undefined,
        source: row.source as TraceFeedbackSummary['source'],
        createdAt: row.created_at as number,
        updatedAt: row.updated_at as number,
    }
}

function aggregateUsage(spans: Array<{ usage?: UsageMetrics; costUsd?: number }>): UsageMetrics & { costUsd: number } {
    return spans.reduce<UsageMetrics & { costUsd: number }>((acc, span) => {
        const usage = span.usage ?? {}
        acc.inputTokens = (acc.inputTokens ?? 0) + (usage.inputTokens ?? 0)
        acc.outputTokens = (acc.outputTokens ?? 0) + (usage.outputTokens ?? 0)
        acc.cacheReadTokens = (acc.cacheReadTokens ?? 0) + (usage.cacheReadTokens ?? 0)
        acc.cacheWriteTokens = (acc.cacheWriteTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
        acc.totalTokens = (acc.totalTokens ?? 0) + (usage.totalTokens ?? 0)
        acc.costUsd += span.costUsd ?? 0
        return acc
    }, { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, costUsd: 0 })
}

export function registerV2Handlers(ipcMain: IpcMain): void {
    ipcMain.handle('runs:get-trace-detail', (_e, traceId: string): TraceDetail | null => {
        const db = getDb()
        const traceRow = db.prepare('SELECT * FROM traces WHERE id = ?').get(traceId) as Record<string, unknown> | undefined
        if (!traceRow) return null

        const trace = parseTrace(traceRow)
        const threadRow = db.prepare('SELECT * FROM threads WHERE id = ?').get(trace.threadId) as Record<string, unknown> | undefined
        const spanRows = db.prepare('SELECT * FROM spans WHERE trace_id = ? ORDER BY started_at ASC, ended_at ASC').all(traceId) as Record<string, unknown>[]
        const feedbackRows = db.prepare('SELECT * FROM feedback_scores WHERE trace_id = ? ORDER BY updated_at DESC').all(traceId) as Record<string, unknown>[]
        const datasetRows = db.prepare(`
            SELECT de.id, d.id AS dataset_id, d.name AS dataset_name, de.created_at
            FROM dataset_examples de
            JOIN datasets d ON d.id = de.dataset_id
            WHERE de.trace_id = ?
            ORDER BY de.created_at DESC
        `).all(traceId) as Array<{ id: string; dataset_id: string; dataset_name: string; created_at: number }>

        const spans = spanRows.map(parseSpan)
        return {
            trace,
            thread: parseThread(threadRow),
            spans,
            feedback: feedbackRows.map(parseFeedback),
            promptVersions: getTracePromptVersions(db, traceId),
            usage: aggregateUsage(spans),
            datasetExamples: datasetRows.map(row => ({
                id: row.id,
                datasetId: row.dataset_id,
                datasetName: row.dataset_name,
                createdAt: row.created_at,
            })),
        }
    })

    ipcMain.handle('runs:add-feedback', (_e, payload: {
        workspaceId: string
        traceId: string
        spanId?: string
        name: string
        value: number
        reason?: string
    }): TraceFeedbackSummary => {
        const db = getDb()
        const now = Date.now()
        const id = generateStableId('feedback_manual', payload.traceId, payload.spanId ?? 'trace', payload.name)

        db.prepare(`
            INSERT INTO feedback_scores (id, workspace_id, trace_id, span_id, name, value, reason, source, created_at, updated_at, meta)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'ui', ?, ?, '{}')
            ON CONFLICT(id) DO UPDATE SET
                value = excluded.value,
                reason = excluded.reason,
                updated_at = excluded.updated_at
        `).run(
            id,
            payload.workspaceId,
            payload.traceId,
            payload.spanId ?? null,
            payload.name,
            payload.value,
            payload.reason ?? null,
            now,
            now,
        )

        const row = db.prepare('SELECT * FROM feedback_scores WHERE id = ?').get(id) as Record<string, unknown>
        return parseFeedback(row)
    })

    ipcMain.handle('datasets:list', (_e, workspaceId: string): DatasetSummary[] => {
        const db = getDb()
        return listDatasets(db, workspaceId)
    })

    ipcMain.handle('datasets:save-trace-example', (_e, workspaceId: string, traceId: string, datasetId?: string) => {
        const db = getDb()
        return saveTraceAsDatasetExample(db, workspaceId, traceId, datasetId)
    })

    ipcMain.handle('prompts:get-insights', (_e, workspaceId: string, sourcePath: string): PromptFileInsights => {
        const db = getDb()
        return getPromptFileInsights(db, workspaceId, sourcePath)
    })

    ipcMain.handle('prompts:get-version-content', (_e, versionId: string): string | null => {
        const db = getDb()
        const row = db.prepare('SELECT content FROM prompt_versions WHERE id = ?').get(versionId) as { content: string } | undefined
        return row?.content ?? null
    })

    ipcMain.handle('prompts:run-experiment', (_e, workspaceId: string, sourcePath: string, datasetId?: string): PromptExperimentReport | null => {
        const db = getDb()
        return runPromptExperiment(db, workspaceId, sourcePath, datasetId, true)
    })
}
