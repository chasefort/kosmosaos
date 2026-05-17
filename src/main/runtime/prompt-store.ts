import { readFile } from 'fs/promises'
import { basename, relative, resolve } from 'path'
import type Database from 'better-sqlite3'
import {
    DatasetSummary,
    PromptExperimentReport,
    PromptFileInsights,
    PromptVersionInsight,
    TracePromptVersionLink,
} from '../../shared/types'
import { generateStableId } from '../../shared/ids'

const PROMPT_FILE_NAMES = new Set([
    'claude.md',
    'system.md',
    'system_prompt.md',
    'instructions.md',
    'agents.md',
    'prompt.md',
])

function safeJson(value: unknown, fallback = '{}'): string {
    if (value === undefined || value === null) return fallback
    try {
        return JSON.stringify(value)
    } catch {
        return fallback
    }
}

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

function normalizeSourcePath(workspacePath: string, filePath: string): string {
    const absoluteWorkspace = resolve(workspacePath)
    const absoluteFile = resolve(filePath)
    if (absoluteFile === absoluteWorkspace || absoluteFile.startsWith(`${absoluteWorkspace}/`)) {
        return relative(absoluteWorkspace, absoluteFile).replace(/\\/g, '/')
    }
    return filePath.replace(/\\/g, '/')
}

export function isPromptLikePath(filePath: string): boolean {
    const name = basename(filePath).toLowerCase()
    if (PROMPT_FILE_NAMES.has(name)) return true
    return name.endsWith('.md') && (name.includes('prompt') || name.includes('instruction') || name.includes('claude'))
}

function ensurePromptTemplate(
    db: Database.Database,
    workspaceId: string,
    sourcePath: string,
): { id: string; workspaceId: string; name: string; sourcePath: string } {
    const templateId = generateStableId('prompt_template', workspaceId, sourcePath)
    const name = basename(sourcePath)
    const now = Date.now()

    db.prepare(`
        INSERT INTO prompt_templates (id, workspace_id, name, description, created_at, updated_at, meta)
        VALUES (?, ?, ?, NULL, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            updated_at = excluded.updated_at,
            meta = excluded.meta
    `).run(
        templateId,
        workspaceId,
        name,
        now,
        now,
        safeJson({ sourcePath }),
    )

    return { id: templateId, workspaceId, name, sourcePath }
}

export function syncPromptVersion(
    db: Database.Database,
    args: {
        workspaceId: string
        workspacePath: string
        filePath: string
        content: string
        createdAt?: number
        source?: 'scanner' | 'editor'
    },
): { templateId: string; versionId: string; version: number; sourcePath: string } | null {
    if (!isPromptLikePath(args.filePath)) return null

    const sourcePath = normalizeSourcePath(args.workspacePath, args.filePath)
    const template = ensurePromptTemplate(db, args.workspaceId, sourcePath)

    const latest = db.prepare(`
        SELECT id, version, content
        FROM prompt_versions
        WHERE template_id = ?
        ORDER BY version DESC
        LIMIT 1
    `).get(template.id) as { id: string; version: number; content: string } | undefined

    if (latest?.content === args.content) {
        return { templateId: template.id, versionId: latest.id, version: latest.version, sourcePath }
    }

    const version = (latest?.version ?? 0) + 1
    const createdAt = args.createdAt ?? Date.now()
    const versionId = generateStableId('prompt_version', template.id, version, createdAt)

    db.prepare(`
        INSERT INTO prompt_versions (id, template_id, workspace_id, version, content, created_at, source_path, meta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        versionId,
        template.id,
        args.workspaceId,
        version,
        args.content,
        createdAt,
        sourcePath,
        safeJson({ source: args.source ?? 'editor' }),
    )

    return { templateId: template.id, versionId, version, sourcePath }
}

export async function syncWorkspacePromptVersions(
    db: Database.Database,
    workspaceId: string,
    workspacePath: string,
): Promise<void> {
    const promptNodes = db.prepare(`
        SELECT meta
        FROM nodes
        WHERE workspace_id = ? AND type = 'prompt'
    `).all(workspaceId) as { meta: string }[]

    for (const row of promptNodes) {
        const meta = safeParseObject(row.meta)
        const sourcePath = typeof meta.path === 'string' ? meta.path : undefined
        if (!sourcePath) continue

        const fullPath = resolve(workspacePath, sourcePath)
        try {
            const content = await readFile(fullPath, 'utf-8')
            syncPromptVersion(db, {
                workspaceId,
                workspacePath,
                filePath: fullPath,
                content,
                source: 'scanner',
            })
        } catch {
            // ignore unreadable prompt files
        }
    }
}

export function linkTraceToPromptVersions(
    db: Database.Database,
    traceId: string,
    workspaceId: string,
    atMs: number,
): void {
    const templates = db.prepare(`
        SELECT id, name, meta
        FROM prompt_templates
        WHERE workspace_id = ?
    `).all(workspaceId) as { id: string; name: string; meta: string }[]

    const deleteExisting = db.prepare('DELETE FROM trace_prompt_versions WHERE trace_id = ?')
    const insertLink = db.prepare(`
        INSERT OR REPLACE INTO trace_prompt_versions (trace_id, template_id, version_id, workspace_id, source_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `)
    const latestVersion = db.prepare(`
        SELECT id, version, source_path, created_at
        FROM prompt_versions
        WHERE template_id = ? AND created_at <= ?
        ORDER BY version DESC, created_at DESC
        LIMIT 1
    `)

    deleteExisting.run(traceId)

    for (const template of templates) {
        const version = latestVersion.get(template.id, atMs) as {
            id: string
            version: number
            source_path: string
            created_at: number
        } | undefined
        if (!version) continue

        insertLink.run(
            traceId,
            template.id,
            version.id,
            workspaceId,
            version.source_path,
            version.created_at,
        )
    }
}

export function backfillTracePromptVersions(db: Database.Database, workspaceId: string): void {
    const traces = db.prepare(`
        SELECT id, started_at
        FROM traces
        WHERE workspace_id = ?
          AND id NOT IN (SELECT trace_id FROM trace_prompt_versions)
    `).all(workspaceId) as { id: string; started_at: number }[]

    for (const trace of traces) {
        linkTraceToPromptVersions(db, trace.id, workspaceId, trace.started_at)
    }
}

export function listDatasets(db: Database.Database, workspaceId: string): DatasetSummary[] {
    return db.prepare(`
        SELECT d.id, d.workspace_id, d.name, d.created_at, d.updated_at, COUNT(e.id) AS example_count
        FROM datasets d
        LEFT JOIN dataset_examples e ON e.dataset_id = d.id
        WHERE d.workspace_id = ?
        GROUP BY d.id
        ORDER BY d.updated_at DESC
    `).all(workspaceId) as DatasetSummary[]
}

export function ensureDefaultDataset(db: Database.Database, workspaceId: string): DatasetSummary {
    const datasetId = generateStableId('dataset', workspaceId, 'workspace-examples')
    const now = Date.now()
    db.prepare(`
        INSERT INTO datasets (id, workspace_id, name, created_at, updated_at, meta)
        VALUES (?, ?, ?, ?, ?, '{}')
        ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at
    `).run(datasetId, workspaceId, 'Workspace Examples', now, now)

    const dataset = db.prepare(`
        SELECT d.id, d.workspace_id, d.name, d.created_at, d.updated_at, COUNT(e.id) AS example_count
        FROM datasets d
        LEFT JOIN dataset_examples e ON e.dataset_id = d.id
        WHERE d.id = ?
        GROUP BY d.id
    `).get(datasetId) as DatasetSummary

    return dataset
}

export function saveTraceAsDatasetExample(
    db: Database.Database,
    workspaceId: string,
    traceId: string,
    datasetId?: string,
): { dataset: DatasetSummary; exampleId: string } {
    const dataset = datasetId
        ? (db.prepare(`
            SELECT d.id, d.workspace_id, d.name, d.created_at, d.updated_at, COUNT(e.id) AS example_count
            FROM datasets d
            LEFT JOIN dataset_examples e ON e.dataset_id = d.id
            WHERE d.id = ?
            GROUP BY d.id
        `).get(datasetId) as DatasetSummary)
        : ensureDefaultDataset(db, workspaceId)

    const trace = db.prepare(`
        SELECT id, meta
        FROM traces
        WHERE id = ? AND workspace_id = ?
    `).get(traceId, workspaceId) as { id: string; meta: string } | undefined

    if (!trace) throw new Error('Trace not found')

    const meta = safeParseObject(trace.meta)
    const exampleId = generateStableId('dataset_example', dataset.id, traceId)

    db.prepare(`
        INSERT OR REPLACE INTO dataset_examples (
            id, dataset_id, workspace_id, trace_id, label, input, output, feedback_value, meta, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        exampleId,
        dataset.id,
        workspaceId,
        traceId,
        typeof meta.summary === 'string' ? meta.summary : traceId,
        safeJson({ summary: meta.summary }),
        safeJson({ latestOperation: meta.latestOperation, latestStatus: meta.latestStatus }),
        null,
        safeJson({ traceMeta: meta }),
        Date.now(),
    )

    db.prepare('UPDATE datasets SET updated_at = ? WHERE id = ?').run(Date.now(), dataset.id)

    return {
        dataset: listDatasets(db, workspaceId).find(item => item.id === dataset.id) ?? dataset,
        exampleId,
    }
}

export function getTracePromptVersions(db: Database.Database, traceId: string): TracePromptVersionLink[] {
    return db.prepare(`
        SELECT tpv.trace_id, tpv.template_id, pt.name AS template_name, tpv.version_id, pv.version, tpv.source_path, pv.created_at
        FROM trace_prompt_versions tpv
        JOIN prompt_templates pt ON pt.id = tpv.template_id
        JOIN prompt_versions pv ON pv.id = tpv.version_id
        WHERE tpv.trace_id = ?
        ORDER BY pv.created_at DESC
    `).all(traceId) as TracePromptVersionLink[]
}

export function getPromptFileInsights(
    db: Database.Database,
    workspaceId: string,
    sourcePath: string,
): PromptFileInsights {
    const templateId = generateStableId('prompt_template', workspaceId, sourcePath)
    const templateRow = db.prepare(`
        SELECT id, workspace_id, name, meta
        FROM prompt_templates
        WHERE id = ?
    `).get(templateId) as { id: string; workspace_id: string; name: string; meta: string } | undefined

    if (!templateRow) {
        return {
            template: null,
            versions: [],
            activeTraceCount: 0,
            datasetCount: 0,
            experiment: null,
        }
    }

    const versionRows = db.prepare(`
        SELECT pv.id, pv.version, pv.created_at, pv.content,
               COUNT(DISTINCT tpv.trace_id) AS trace_count,
               AVG(fs.value) AS avg_feedback,
               COUNT(fs.id) AS feedback_count
        FROM prompt_versions pv
        LEFT JOIN trace_prompt_versions tpv ON tpv.version_id = pv.id
        LEFT JOIN feedback_scores fs ON fs.trace_id = tpv.trace_id AND fs.span_id IS NULL
        WHERE pv.template_id = ?
        GROUP BY pv.id
        ORDER BY pv.version DESC
    `).all(templateId) as Array<{
        id: string
        version: number
        created_at: number
        content: string
        trace_count: number
        avg_feedback: number | null
        feedback_count: number
    }>

    const usageByVersion = db.prepare(`
        SELECT tpv.version_id AS version_id, s.meta
        FROM trace_prompt_versions tpv
        JOIN spans s ON s.trace_id = tpv.trace_id
        WHERE tpv.template_id = ?
    `).all(templateId) as { version_id: string; meta: string }[]

    const usageMap = new Map<string, { tokens: number; costUsd: number }>()
    for (const row of usageByVersion) {
        const meta = safeParseObject(row.meta)
        const usage = safeParseObject(typeof meta.usage === 'object' ? JSON.stringify(meta.usage) : undefined)
        const costUsd = typeof meta.costUsd === 'number' ? meta.costUsd : 0
        const tokens = typeof usage.totalTokens === 'number'
            ? usage.totalTokens
            : ((typeof usage.inputTokens === 'number' ? usage.inputTokens : 0)
                + (typeof usage.outputTokens === 'number' ? usage.outputTokens : 0)
                + (typeof usage.cacheReadTokens === 'number' ? usage.cacheReadTokens : 0)
                + (typeof usage.cacheWriteTokens === 'number' ? usage.cacheWriteTokens : 0))
        const current = usageMap.get(row.version_id) ?? { tokens: 0, costUsd: 0 }
        usageMap.set(row.version_id, {
            tokens: current.tokens + tokens,
            costUsd: current.costUsd + costUsd,
        })
    }

    const versions: PromptVersionInsight[] = versionRows.map(row => ({
        versionId: row.id,
        version: row.version,
        createdAt: row.created_at,
        content: row.content,
        traceCount: row.trace_count,
        avgFeedback: row.avg_feedback,
        feedbackCount: row.feedback_count,
        tokens: usageMap.get(row.id)?.tokens ?? 0,
        costUsd: usageMap.get(row.id)?.costUsd ?? 0,
    }))

    const activeTraceCount = db.prepare(`
        SELECT COUNT(DISTINCT trace_id) AS count
        FROM trace_prompt_versions
        WHERE template_id = ?
    `).get(templateId) as { count: number }

    const datasetCount = db.prepare(`
        SELECT COUNT(DISTINCT de.id) AS count
        FROM dataset_examples de
        JOIN trace_prompt_versions tpv ON tpv.trace_id = de.trace_id
        WHERE tpv.template_id = ?
    `).get(templateId) as { count: number }

    const experiment = runPromptExperiment(db, workspaceId, sourcePath, undefined, false)

    return {
        template: {
            id: templateRow.id,
            workspaceId: templateRow.workspace_id,
            name: templateRow.name,
            sourcePath,
        },
        versions,
        activeTraceCount: activeTraceCount.count,
        datasetCount: datasetCount.count,
        latestVersionId: versions[0]?.versionId,
        experiment,
    }
}

export function runPromptExperiment(
    db: Database.Database,
    workspaceId: string,
    sourcePath: string,
    datasetId?: string,
    persist = true,
): PromptExperimentReport | null {
    const templateId = generateStableId('prompt_template', workspaceId, sourcePath)
    const template = db.prepare('SELECT id FROM prompt_templates WHERE id = ?').get(templateId) as { id: string } | undefined
    if (!template) return null

    const dataset = datasetId
        ? (db.prepare('SELECT id, name FROM datasets WHERE id = ? AND workspace_id = ?').get(datasetId, workspaceId) as { id: string; name: string } | undefined)
        : undefined

    const rows = db.prepare(`
        SELECT pv.id AS version_id, pv.version, de.id AS example_id, fs.value AS feedback_value, s.meta
        FROM prompt_versions pv
        LEFT JOIN trace_prompt_versions tpv ON tpv.version_id = pv.id
        LEFT JOIN dataset_examples de ON de.trace_id = tpv.trace_id
        LEFT JOIN feedback_scores fs ON fs.trace_id = tpv.trace_id AND fs.span_id IS NULL
        LEFT JOIN spans s ON s.trace_id = tpv.trace_id
        WHERE pv.template_id = ?
          AND (? IS NULL OR de.dataset_id = ?)
    `).all(templateId, dataset?.id ?? null, dataset?.id ?? null) as Array<{
        version_id: string
        version: number
        example_id: string | null
        feedback_value: number | null
        meta: string | null
    }>

    if (rows.length === 0) return null

    const statsMap = new Map<string, {
        versionId: string
        version: number
        exampleIds: Set<string>
        feedbackTotal: number
        feedbackCount: number
        totalTokens: number
        totalCostUsd: number
    }>()

    for (const row of rows) {
        const current = statsMap.get(row.version_id) ?? {
            versionId: row.version_id,
            version: row.version,
            exampleIds: new Set<string>(),
            feedbackTotal: 0,
            feedbackCount: 0,
            totalTokens: 0,
            totalCostUsd: 0,
        }
        if (row.example_id) current.exampleIds.add(row.example_id)
        if (typeof row.feedback_value === 'number') {
            current.feedbackTotal += row.feedback_value
            current.feedbackCount += 1
        }
        const meta = safeParseObject(row.meta ?? '{}')
        const usage = meta.usage && typeof meta.usage === 'object' ? meta.usage as Record<string, unknown> : {}
        current.totalTokens += (typeof usage.totalTokens === 'number' ? usage.totalTokens : 0)
        current.totalCostUsd += typeof meta.costUsd === 'number' ? meta.costUsd : 0
        statsMap.set(row.version_id, current)
    }

    const versionStats = Array.from(statsMap.values())
        .sort((a, b) => a.version - b.version)
        .map(item => ({
            versionId: item.versionId,
            version: item.version,
            exampleCount: item.exampleIds.size,
            avgFeedback: item.feedbackCount > 0 ? item.feedbackTotal / item.feedbackCount : null,
            feedbackCount: item.feedbackCount,
            totalTokens: item.totalTokens,
            totalCostUsd: item.totalCostUsd,
        }))

    const baseline = versionStats[0]
    const candidate = versionStats[versionStats.length - 1]
    const generatedAt = Date.now()
    const experimentId = generateStableId('experiment', workspaceId, templateId, dataset?.id ?? 'all', generatedAt)

    const report: PromptExperimentReport = {
        experimentId,
        datasetId: dataset?.id,
        datasetName: dataset?.name,
        templateId,
        sourcePath,
        generatedAt,
        baselineVersionId: baseline?.versionId,
        candidateVersionId: candidate?.versionId,
        versionStats,
    }

    if (persist) {
        db.prepare(`
            INSERT INTO experiments (id, workspace_id, dataset_id, template_id, baseline_version_id, candidate_version_id, status, summary, meta, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
        `).run(
            experimentId,
            workspaceId,
            dataset?.id ?? null,
            templateId,
            baseline?.versionId ?? null,
            candidate?.versionId ?? null,
            `${basename(sourcePath)} version comparison`,
            safeJson(report),
            generatedAt,
            generatedAt,
        )
    }

    return report
}
