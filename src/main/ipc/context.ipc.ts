import { IpcMain } from 'electron'
import { getDb } from '../storage/db'
import {
    buildContextHealthSummary,
    computeContextFindings,
    computeContextScore,
    parseEdge,
    parseFinding,
    parseNode,
    parseScan,
} from '../context/context-health'
import { ContextDriftSummary, ContextNodeDetail, KosmosFinding } from '../../shared/types'

function latestScanForWorkspace(workspaceId: string) {
    const db = getDb()
    const row = db.prepare(`
        SELECT * FROM workspace_scans
        WHERE workspace_id = ?
        ORDER BY completed_at DESC, started_at DESC
        LIMIT 1
    `).get(workspaceId) as Record<string, unknown> | undefined
    return row ? parseScan(row) : undefined
}

function scanById(scanId: string) {
    const db = getDb()
    const row = db.prepare('SELECT * FROM workspace_scans WHERE id = ?').get(scanId) as Record<string, unknown> | undefined
    return row ? parseScan(row) : undefined
}

function scanFiles(scanId: string): Map<string, { path: string; kind: string; contentHash?: string; mtimeMs?: number; size: number }> {
    const db = getDb()
    const rows = db.prepare(`
        SELECT path, kind, content_hash, mtime_ms, size
        FROM workspace_scan_files
        WHERE scan_id = ?
    `).all(scanId) as { path: string; kind: string; content_hash: string | null; mtime_ms: number | null; size: number }[]
    return new Map(rows.map(row => [row.path, {
        path: row.path,
        kind: row.kind,
        contentHash: row.content_hash ?? undefined,
        mtimeMs: row.mtime_ms ?? undefined,
        size: row.size,
    }]))
}

function scanFindings(scanId: string): KosmosFinding[] {
    const db = getDb()
    const rows = db.prepare(`
        SELECT *
        FROM workspace_scan_findings
        WHERE scan_id = ?
        ORDER BY severity, type, title
    `).all(scanId) as Record<string, unknown>[]
    return rows.map(parseFinding)
}

function sourceCoverageForScan(scanId: string): number {
    const db = getDb()
    const scan = scanById(scanId)
    const contextSystem = scan?.meta?.contextSystem as { sourceCoveragePct?: number } | undefined
    if (typeof contextSystem?.sourceCoveragePct === 'number') return contextSystem.sourceCoveragePct

    const row = db.prepare(`
        SELECT meta
        FROM workspace_scans
        WHERE id = ?
    `).get(scanId) as { meta: string } | undefined
    if (!row) return 0
    try {
        const meta = JSON.parse(row.meta)
        return typeof meta.sourceCoveragePct === 'number' ? meta.sourceCoveragePct : 0
    } catch {
        return 0
    }
}

export function registerContextHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('context:get-health', (_e, workspaceId: string) => {
        return buildContextHealthSummary(getDb(), workspaceId, latestScanForWorkspace(workspaceId))
    })

    ipcMain.handle('context:get-scan-history', (_e, workspaceId: string) => {
        const db = getDb()
        const rows = db.prepare(`
            SELECT * FROM workspace_scans
            WHERE workspace_id = ?
            ORDER BY completed_at DESC, started_at DESC
            LIMIT 25
        `).all(workspaceId) as Record<string, unknown>[]
        return rows.map(parseScan)
    })

    ipcMain.handle('context:get-drift', (_e, workspaceId: string, fromScanId?: string, toScanId?: string): ContextDriftSummary | null => {
        const db = getDb()
        const scans = (db.prepare(`
            SELECT * FROM workspace_scans
            WHERE workspace_id = ?
            ORDER BY completed_at DESC, started_at DESC
            LIMIT 2
        `).all(workspaceId) as Record<string, unknown>[]).map(parseScan)
        const toScan = toScanId ? scanById(toScanId) : scans[0]
        const fromScan = fromScanId ? scanById(fromScanId) : scans.find(scan => scan.id !== toScan?.id)
        if (!toScan) return null

        const fromFiles = fromScan ? scanFiles(fromScan.id) : new Map()
        const toFiles = scanFiles(toScan.id)
        const newFiles: string[] = []
        const deletedFiles: string[] = []
        const changedFiles: string[] = []

        for (const [path, file] of toFiles) {
            const previous = fromFiles.get(path)
            if (!previous) newFiles.push(path)
            else if ((previous.contentHash && file.contentHash && previous.contentHash !== file.contentHash)
                || previous.size !== file.size
                || previous.mtimeMs !== file.mtimeMs) {
                changedFiles.push(path)
            }
        }
        for (const path of fromFiles.keys()) {
            if (!toFiles.has(path)) deletedFiles.push(path)
        }

        const fromFindings = fromScan ? scanFindings(fromScan.id) : []
        const toFindings = scanFindings(toScan.id)
        const findingKey = (finding: KosmosFinding) => `${finding.type}:${finding.title}:${finding.nodeIds.join(',')}`
        const fromKeys = new Set(fromFindings.map(findingKey))
        const toKeys = new Set(toFindings.map(findingKey))

        return {
            fromScanId: fromScan?.id,
            toScanId: toScan.id,
            newFiles,
            deletedFiles,
            changedFiles,
            newFindings: toFindings.filter(f => !fromKeys.has(findingKey(f))),
            resolvedFindings: fromFindings.filter(f => !toKeys.has(findingKey(f))),
            sourceCoverageDelta: sourceCoverageForScan(toScan.id) - (fromScan ? sourceCoverageForScan(fromScan.id) : 0),
            brokenLinkDelta: toFindings.filter(f => f.type === 'broken_link').length - fromFindings.filter(f => f.type === 'broken_link').length,
            instructionFilesChanged: changedFiles.filter(path => /(^|\/)(AGENTS|CLAUDE)\.(md|txt)$/i.test(path) || path.startsWith('.cursor/rules/') || path.startsWith('.claude/')),
        }
    })

    ipcMain.handle('context:get-node-detail', (_e, workspaceId: string, nodeId: string): ContextNodeDetail | null => {
        const db = getDb()
        const nodeRow = db.prepare('SELECT * FROM nodes WHERE workspace_id = ? AND id = ?').get(workspaceId, nodeId) as Record<string, unknown> | undefined
        if (!nodeRow) return null
        const node = parseNode(nodeRow)
        const edgeRows = db.prepare('SELECT * FROM edges WHERE workspace_id = ? AND (from_id = ? OR to_id = ?)').all(workspaceId, nodeId, nodeId) as Record<string, unknown>[]
        const edges = edgeRows.map(parseEdge)
        const neighborRows = db.prepare(`SELECT * FROM nodes WHERE workspace_id = ?`).all(workspaceId) as Record<string, unknown>[]
        const nodeMap = new Map(neighborRows.map(row => {
            const parsed = parseNode(row)
            return [parsed.id, parsed]
        }))
        const inbound = edges.filter(edge => edge.toId === nodeId).map(edge => ({ edge, node: nodeMap.get(edge.fromId)! })).filter(item => item.node)
        const outbound = edges.filter(edge => edge.fromId === nodeId).map(edge => ({ edge, node: nodeMap.get(edge.toId)! })).filter(item => item.node)
        const allFindings = computeContextFindings(Array.from(nodeMap.values()), (db.prepare('SELECT * FROM edges WHERE workspace_id = ?').all(workspaceId) as Record<string, unknown>[]).map(parseEdge))
        const nodeFindings = allFindings.filter(finding => finding.nodeIds.includes(nodeId))
        const filePath = node.paths[0]
        const sessions = filePath
            ? db.prepare(`
                SELECT trace_id, source, started_at, ended_at, status, file_path
                FROM spans
                WHERE workspace_id = ? AND file_path = ?
                ORDER BY started_at DESC
                LIMIT 20
            `).all(workspaceId, filePath) as Array<{ trace_id: string; source: any; started_at: number; ended_at: number | null; status: string; file_path: string }>
            : []
        const readRows = filePath ? db.prepare(`
            SELECT started_at FROM spans
            WHERE workspace_id = ? AND file_path = ? AND operation = 'file_read'
            ORDER BY started_at DESC LIMIT 1
        `).get(workspaceId, filePath) as { started_at: number } | undefined : undefined
        const writeRows = filePath ? db.prepare(`
            SELECT started_at FROM spans
            WHERE workspace_id = ? AND file_path = ? AND operation = 'file_write'
            ORDER BY started_at DESC LIMIT 1
        `).get(workspaceId, filePath) as { started_at: number } | undefined : undefined

        return {
            node,
            inbound,
            outbound,
            sources: outbound.filter(item => item.edge.type === 'cites' || item.edge.type === 'derived_from').map(item => item.node),
            dependents: inbound.filter(item => item.edge.type === 'derived_from' || item.edge.type === 'links_to').map(item => item.node),
            sessions: sessions.map(session => ({
                traceId: session.trace_id,
                source: session.source,
                startedAt: session.started_at,
                endedAt: session.ended_at ?? undefined,
                status: session.status,
                filePath: session.file_path,
            })),
            lastReadAt: readRows?.started_at,
            lastWrittenAt: writeRows?.started_at,
            findings: nodeFindings,
        }
    })
}
