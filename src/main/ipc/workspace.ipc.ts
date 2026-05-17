import { IpcMain } from 'electron'
import { getDb } from '../storage/db'
import { generateWorkspaceId } from '../../shared/ids'
import { scanWorkspace } from '../parser/workspace-scanner'
import { importClaudeCodeSessions } from '../parser/claude-code-importer'
import { basename } from 'path'
import { backfillTracePromptVersions, syncWorkspacePromptVersions } from '../runtime/prompt-store'
import { computeContextFindings } from '../context/context-health'
import { generateStableId } from '../../shared/ids'

function safeJson(value: unknown, fallback = '{}'): string {
    try {
        return JSON.stringify(value ?? JSON.parse(fallback))
    } catch {
        return fallback
    }
}

export function registerWorkspaceHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('workspace:open-dialog', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { dialog } = require('electron')
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Open Workspace'
        })
        if (result.canceled || !result.filePaths[0]) return null
        return result.filePaths[0]
    })

    ipcMain.handle('workspace:scan', async (_event, path: string) => {
        const db = getDb()
        const id = generateWorkspaceId(path)
        const name = basename(path)
        const now = Date.now()

        // Upsert workspace
        db.prepare(`
      INSERT INTO workspaces (id, name, path, opened_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET opened_at = ?, name = ?
    `).run(id, name, path, now, now, name)

        // Re-scan: clear only statically-detected nodes/edges, preserve runtime-discovered ones
        // so live events that upserted new nodes/edges aren't wiped on every rescan.
        const clearStaticOnly = db.transaction(() => {
            db.prepare("DELETE FROM edges WHERE workspace_id = ? AND id NOT LIKE 'runtime::%'").run(id)
            db.prepare("DELETE FROM nodes WHERE workspace_id = ? AND source != 'runtime'").run(id)
        })
        clearStaticOnly()

        const scanStartedAt = Date.now()
        const scanResult = await scanWorkspace(id, path)
        const { nodes, edges } = scanResult
        const contextFindings = computeContextFindings(nodes, edges)
        const sourceBackedIds = new Set(edges.filter(e => e.type === 'cites' || e.type === 'derived_from').map(e => e.fromId))
        const coverageCandidates = nodes.filter(n => n.type === 'wiki_page' || n.type === 'output_artifact')
        const sourceCoveragePct = coverageCandidates.length === 0
            ? 100
            : Math.round((coverageCandidates.filter(n => sourceBackedIds.has(n.id)).length / coverageCandidates.length) * 100)
        const scanMeta = { ...scanResult.meta, sourceCoveragePct }
        const scanId = generateStableId('scan', id, scanStartedAt, nodes.length, edges.length)

        if (nodes.length > 0 || edges.length > 0) {
            const insertNode = db.prepare(`
        INSERT OR REPLACE INTO nodes (id, workspace_id, name, type, source, confidence, description, tags, paths, meta, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
            const insertEdge = db.prepare(`
        INSERT OR REPLACE INTO edges (id, workspace_id, type, from_id, to_id, weight, meta)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
            const insertMany = db.transaction(() => {
                for (const n of nodes) {
                    insertNode.run(n.id, n.workspaceId, n.name, n.type, n.source, n.confidence, n.description ?? null, JSON.stringify(n.tags), JSON.stringify(n.paths), JSON.stringify(n.meta ?? {}), n.createdAt, n.updatedAt)
                }
                for (const e of edges) {
                    insertEdge.run(e.id, e.workspaceId, e.type, e.fromId, e.toId, e.weight ?? 1, JSON.stringify(e.meta ?? {}))
                }
            })
            insertMany()
        }

        const insertScanSnapshot = db.transaction(() => {
            db.prepare(`
                INSERT OR REPLACE INTO workspace_scans (id, workspace_id, started_at, completed_at, node_count, edge_count, finding_count, meta)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(scanId, id, scanStartedAt, Date.now(), nodes.length, edges.length, contextFindings.length, safeJson(scanMeta))

            const insertFile = db.prepare(`
                INSERT OR REPLACE INTO workspace_scan_files (scan_id, workspace_id, path, kind, content_hash, mtime_ms, size, meta)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `)
            for (const file of scanResult.files) {
                insertFile.run(
                    scanId,
                    id,
                    file.path,
                    file.kind,
                    file.contentHash ?? null,
                    file.mtimeMs ?? null,
                    file.size,
                    safeJson(file.meta),
                )
            }

            const insertFinding = db.prepare(`
                INSERT OR REPLACE INTO workspace_scan_findings (id, scan_id, workspace_id, type, severity, title, node_ids, meta)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `)
            for (const finding of contextFindings) {
                insertFinding.run(
                    generateStableId('scan_finding', scanId, finding.id),
                    scanId,
                    id,
                    finding.type,
                    finding.severity,
                    finding.title,
                    safeJson(finding.nodeIds, '[]'),
                    safeJson({ description: finding.description, suggestion: finding.suggestion, stableFindingId: finding.id }),
                )
            }
        })
        insertScanSnapshot()

        // Re-import real Claude Code sessions from ~/.claude/projects/[encoded-path]/*.jsonl.
        // Imported history now flows through the same canonical runtime persistence path as live
        // ingest, so rescans stay idempotent without reviving the old parallel importer model.
        await importClaudeCodeSessions(id, path, db)
        await syncWorkspacePromptVersions(db, id, path)
        backfillTracePromptVersions(db, id)

        // Get final counts for the UI
        const nodeCount = (db.prepare('SELECT COUNT(*) as cnt FROM nodes WHERE workspace_id = ?').get(id) as { cnt: number }).cnt
        const edgeCount = (db.prepare('SELECT COUNT(*) as cnt FROM edges WHERE workspace_id = ?').get(id) as { cnt: number }).cnt

        return { id, name, path, nodeCount, edgeCount, scanId, findingCount: contextFindings.length }
    })

    ipcMain.handle('workspace:get-recent', () => {
        const db = getDb()
        return db.prepare('SELECT id, name, path, opened_at FROM workspaces ORDER BY opened_at DESC LIMIT 10').all()
    })

    ipcMain.handle('settings:get', (_e, key: string) => {
        const db = getDb()
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
        return row ? JSON.parse(row.value) : null
    })

    ipcMain.handle('settings:set', (_e, key: string, value: unknown) => {
        const db = getDb()
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
        return true
    })
}
