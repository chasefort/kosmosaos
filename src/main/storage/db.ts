import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { generateEdgeId, generateFileNodeId, normalizeNodePath } from '../../shared/ids'

let db: Database.Database
const DB_SCHEMA_VERSION = 5

function safeParseArray(value: unknown): string[] {
    if (typeof value !== 'string' || value.trim().length === 0) return []
    try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
    } catch {
        return []
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

function runBaseSchema(database: Database.Database): void {
    database.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      opened_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      description TEXT,
      tags TEXT DEFAULT '[]',
      paths TEXT DEFAULT '[]',
      meta TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_workspace ON nodes(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      type TEXT NOT NULL,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      weight REAL DEFAULT 1.0,
      meta TEXT DEFAULT '{}',
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_edges_workspace ON edges(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);
    CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_id);

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      source TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      event_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running',
      meta TEXT DEFAULT '{}',
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_runs_workspace ON runs(workspace_id);

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      phase TEXT,
      ts_ms INTEGER NOT NULL,
      agent_id TEXT,
      tool_name TEXT,
      node_ids TEXT DEFAULT '[]',
      input TEXT,
      output TEXT,
      error TEXT,
      duration_ms INTEGER,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id);
    CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts_ms);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

function runRuntimeSchema(database: Database.Database): void {
    database.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      trace_count INTEGER DEFAULT 0,
      meta TEXT DEFAULT '{}',
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_threads_workspace ON threads(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_threads_source ON threads(source);

    CREATE TABLE IF NOT EXISTS traces (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      source TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      root_agent_name TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      status TEXT DEFAULT 'running',
      event_count INTEGER DEFAULT 0,
      meta TEXT DEFAULT '{}',
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (thread_id) REFERENCES threads(id)
    );

    CREATE INDEX IF NOT EXISTS idx_traces_workspace ON traces(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_traces_thread ON traces(thread_id);
    CREATE INDEX IF NOT EXISTS idx_traces_source_session ON traces(source, session_id);

    CREATE TABLE IF NOT EXISTS spans (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      source TEXT NOT NULL,
      operation TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      parent_span_id TEXT,
      agent_name TEXT,
      tool_name TEXT,
      model_name TEXT,
      file_path TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      duration_ms INTEGER,
      input TEXT,
      output TEXT,
      error TEXT,
      meta TEXT DEFAULT '{}',
      FOREIGN KEY (trace_id) REFERENCES traces(id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans(trace_id);
    CREATE INDEX IF NOT EXISTS idx_spans_workspace ON spans(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_spans_parent ON spans(parent_span_id);
    CREATE INDEX IF NOT EXISTS idx_spans_operation ON spans(operation);

    CREATE TABLE IF NOT EXISTS feedback_scores (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      trace_id TEXT NOT NULL,
      span_id TEXT,
      name TEXT NOT NULL,
      value REAL NOT NULL,
      reason TEXT,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      meta TEXT DEFAULT '{}',
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (trace_id) REFERENCES traces(id),
      FOREIGN KEY (span_id) REFERENCES spans(id)
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_trace ON feedback_scores(trace_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_workspace ON feedback_scores(workspace_id);

    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      meta TEXT DEFAULT '{}',
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_templates_workspace ON prompt_templates(workspace_id);

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      source_path TEXT,
      meta TEXT DEFAULT '{}',
      FOREIGN KEY (template_id) REFERENCES prompt_templates(id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_versions_template ON prompt_versions(template_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_versions_template_version ON prompt_versions(template_id, version);

    CREATE TABLE IF NOT EXISTS trace_prompt_versions (
      trace_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      source_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (trace_id, version_id),
      FOREIGN KEY (trace_id) REFERENCES traces(id),
      FOREIGN KEY (template_id) REFERENCES prompt_templates(id),
      FOREIGN KEY (version_id) REFERENCES prompt_versions(id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_trace_prompt_versions_trace ON trace_prompt_versions(trace_id);
    CREATE INDEX IF NOT EXISTS idx_trace_prompt_versions_template ON trace_prompt_versions(template_id);

    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      meta TEXT DEFAULT '{}',
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_datasets_workspace ON datasets(workspace_id);

    CREATE TABLE IF NOT EXISTS dataset_examples (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      trace_id TEXT,
      label TEXT NOT NULL,
      input TEXT,
      output TEXT,
      feedback_value REAL,
      meta TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (dataset_id) REFERENCES datasets(id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (trace_id) REFERENCES traces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_dataset_examples_dataset ON dataset_examples(dataset_id);
    CREATE INDEX IF NOT EXISTS idx_dataset_examples_trace ON dataset_examples(trace_id);

    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      dataset_id TEXT,
      template_id TEXT NOT NULL,
      baseline_version_id TEXT,
      candidate_version_id TEXT,
      status TEXT NOT NULL,
      summary TEXT,
      meta TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (dataset_id) REFERENCES datasets(id),
      FOREIGN KEY (template_id) REFERENCES prompt_templates(id),
      FOREIGN KEY (baseline_version_id) REFERENCES prompt_versions(id),
      FOREIGN KEY (candidate_version_id) REFERENCES prompt_versions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_experiments_workspace ON experiments(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_experiments_template ON experiments(template_id);

    CREATE TABLE IF NOT EXISTS rejected_runtime_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      source TEXT NOT NULL,
      reason TEXT NOT NULL,
      raw_event TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rejected_runtime_events_created ON rejected_runtime_events(created_at);
  `)
}

function runContextScanSchema(database: Database.Database): void {
    database.exec(`
    CREATE TABLE IF NOT EXISTS workspace_scans (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      node_count INTEGER DEFAULT 0,
      edge_count INTEGER DEFAULT 0,
      finding_count INTEGER DEFAULT 0,
      meta TEXT DEFAULT '{}',
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_workspace_scans_workspace ON workspace_scans(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_scans_completed ON workspace_scans(completed_at);

    CREATE TABLE IF NOT EXISTS workspace_scan_files (
      scan_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      path TEXT NOT NULL,
      kind TEXT NOT NULL,
      content_hash TEXT,
      mtime_ms INTEGER,
      size INTEGER,
      meta TEXT DEFAULT '{}',
      PRIMARY KEY (scan_id, path),
      FOREIGN KEY (scan_id) REFERENCES workspace_scans(id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_workspace_scan_files_workspace ON workspace_scan_files(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_scan_files_path ON workspace_scan_files(path);

    CREATE TABLE IF NOT EXISTS workspace_scan_findings (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      node_ids TEXT DEFAULT '[]',
      meta TEXT DEFAULT '{}',
      FOREIGN KEY (scan_id) REFERENCES workspace_scans(id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_workspace_scan_findings_scan ON workspace_scan_findings(scan_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_scan_findings_workspace ON workspace_scan_findings(workspace_id);
  `)
}

function migrateFileNodeIds(database: Database.Database): void {
    type NodeRow = {
        id: string
        workspace_id: string
        name: string
        type: string
        source: string
        confidence: number
        description: string | null
        tags: string
        paths: string
        meta: string
        created_at: number
        updated_at: number
    }

    type EdgeRow = {
        id: string
        workspace_id: string
        type: string
        from_id: string
        to_id: string
        weight: number
        meta: string
    }

    type EventRow = {
        id: string
        node_ids: string
    }

    const fileNodes = database.prepare(`
        SELECT id, workspace_id, name, type, source, confidence, description, tags, paths, meta, created_at, updated_at
        FROM nodes
        WHERE type IN ('file', 'wiki_page', 'source_doc', 'output_artifact', 'instruction_file', 'index_file')
    `).all() as NodeRow[]

    const replacements = new Map<string, string>()
    const migratedNodes = new Map<string, NodeRow>()

    for (const row of fileNodes) {
        const paths = safeParseArray(row.paths)
        const primaryPath = paths.find(path => normalizeNodePath(path).length > 0)
        if (!primaryPath) continue

        const newId = generateFileNodeId(row.workspace_id, primaryPath, row.name)
        if (newId === row.id) continue

        replacements.set(row.id, newId)
        migratedNodes.set(row.id, row)
    }

    if (replacements.size === 0) return

    const selectNodeById = database.prepare(`
        SELECT id, workspace_id, name, type, source, confidence, description, tags, paths, meta, created_at, updated_at
        FROM nodes
        WHERE id = ?
    `)
    const upsertNode = database.prepare(`
        INSERT OR REPLACE INTO nodes (id, workspace_id, name, type, source, confidence, description, tags, paths, meta, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const deleteNode = database.prepare(`DELETE FROM nodes WHERE id = ?`)
    const insertOrReplaceEdge = database.prepare(`
        INSERT OR REPLACE INTO edges (id, workspace_id, type, from_id, to_id, weight, meta)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const deleteEdge = database.prepare(`DELETE FROM edges WHERE id = ?`)
    const updateEventNodeIds = database.prepare(`UPDATE events SET node_ids = ? WHERE id = ?`)

    const rowsToMerge = Array.from(replacements.entries()).map(([oldId, newId]) => ({
        oldId,
        newId,
        row: migratedNodes.get(oldId)!,
    }))

    const migrate = database.transaction(() => {
        for (const { oldId, newId, row } of rowsToMerge) {
            const existing = selectNodeById.get(newId) as NodeRow | undefined
            const oldPaths = safeParseArray(row.paths).map(normalizeNodePath)
            const existingPaths = safeParseArray(existing?.paths).map(normalizeNodePath)
            const mergedPaths = Array.from(new Set([...existingPaths, ...oldPaths])).filter(Boolean)
            const mergedTags = Array.from(new Set([
                ...safeParseArray(existing?.tags),
                ...safeParseArray(row.tags),
            ])).filter(Boolean)
            const mergedMeta = {
                ...safeParseObject(row.meta),
                ...safeParseObject(existing?.meta),
            }
            const mergedSource = existing?.source === 'runtime' || row.source === 'runtime'
                ? 'runtime'
                : (existing?.source ?? row.source)
            const mergedName = existing?.name ?? row.name
            const mergedDescription = existing?.description ?? row.description
            const mergedConfidence = Math.max(existing?.confidence ?? 0, row.confidence)
            const mergedCreatedAt = Math.min(existing?.created_at ?? row.created_at, row.created_at)
            const mergedUpdatedAt = Math.max(existing?.updated_at ?? row.updated_at, row.updated_at)

            upsertNode.run(
                newId,
                row.workspace_id,
                mergedName,
                (existing as any)?.type ?? (row as any).type ?? 'file',
                mergedSource,
                mergedConfidence,
                mergedDescription,
                safeJson(mergedTags, '[]'),
                safeJson(mergedPaths, '[]'),
                safeJson(mergedMeta),
                mergedCreatedAt,
                mergedUpdatedAt,
            )

            if (oldId !== newId) deleteNode.run(oldId)
        }

        const edges = database.prepare(`
            SELECT id, workspace_id, type, from_id, to_id, weight, meta
            FROM edges
        `).all() as EdgeRow[]

        for (const edge of edges) {
            const nextFromId = replacements.get(edge.from_id) ?? edge.from_id
            const nextToId = replacements.get(edge.to_id) ?? edge.to_id
            if (nextFromId === edge.from_id && nextToId === edge.to_id) continue

            const nextId = edge.id.startsWith('runtime::')
                ? runtimeEdgeId(nextFromId, edge.type, nextToId)
                : generateEdgeId(nextFromId, nextToId, edge.type)

            insertOrReplaceEdge.run(
                nextId,
                edge.workspace_id,
                edge.type,
                nextFromId,
                nextToId,
                edge.weight ?? 1,
                edge.meta ?? '{}',
            )

            if (nextId !== edge.id) deleteEdge.run(edge.id)
        }

        const events = database.prepare(`
            SELECT id, node_ids
            FROM events
        `).all() as EventRow[]

        for (const event of events) {
            const nodeIds = safeParseArray(event.node_ids)
            const nextNodeIds = nodeIds.map(nodeId => replacements.get(nodeId) ?? nodeId)
            const changed = nextNodeIds.some((nodeId, index) => nodeId !== nodeIds[index])
            if (!changed) continue
            updateEventNodeIds.run(safeJson(nextNodeIds, '[]'), event.id)
        }
    })

    migrate()
}

function migrateDatabase(database: Database.Database): void {
    runBaseSchema(database)
    runRuntimeSchema(database)
    runContextScanSchema(database)

    const row = database.pragma('user_version', { simple: true }) as number
    const currentVersion = Number.isFinite(row) ? row : 0

    if (currentVersion < 1) {
        database.pragma('user_version = 1')
    }

    if (currentVersion < 2) {
        database.pragma('user_version = 2')
    }

    if (currentVersion < 3) {
        migrateFileNodeIds(database)
        database.pragma('user_version = 3')
    }

    if (currentVersion < 4) {
        database.pragma(`user_version = ${DB_SCHEMA_VERSION}`)
    }

    if (currentVersion < 5) {
        database.pragma(`user_version = ${DB_SCHEMA_VERSION}`)
    }
}

export function getDb(): Database.Database {
    if (!db) throw new Error('Database not initialized')
    return db
}

export function initDatabase(dbDir?: string): void {
    let resolvedDir: string
    if (dbDir) {
        resolvedDir = dbDir
    } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { app } = require('electron')
        resolvedDir = join(app.getPath('userData'), 'kosmos-data')
    }
    mkdirSync(resolvedDir, { recursive: true })

    db = new Database(join(resolvedDir, 'kosmos.db'))
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    db.pragma('foreign_keys = ON')

    migrateDatabase(db)

    console.log('Database initialized at', resolvedDir)
}
