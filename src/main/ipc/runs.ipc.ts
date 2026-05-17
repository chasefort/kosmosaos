import { IpcMain } from 'electron'
import { getDb } from '../storage/db'
import { KosmosRun, KosmosEvent } from '../../shared/types'

function parseRun(row: Record<string, unknown>): KosmosRun {
    return {
        id: row.id as string,
        workspaceId: row.workspace_id as string,
        source: row.source as KosmosRun['source'],
        startedAt: row.started_at as number,
        endedAt: row.ended_at as number | undefined,
        eventCount: row.event_count as number,
        status: row.status as KosmosRun['status'],
        meta: JSON.parse(row.meta as string)
    }
}

function parseEvent(row: Record<string, unknown>): KosmosEvent {
    return {
        id: row.id as string,
        runId: row.run_id as string,
        type: row.type as KosmosEvent['type'],
        phase: row.phase as KosmosEvent['phase'],
        tsMs: row.ts_ms as number,
        agentId: row.agent_id as string | undefined,
        toolName: row.tool_name as string | undefined,
        nodeIds: JSON.parse(row.node_ids as string),
        input: row.input ? JSON.parse(row.input as string) : undefined,
        output: row.output ? JSON.parse(row.output as string) : undefined,
        error: row.error as string | undefined,
        durationMs: row.duration_ms as number | undefined
    }
}

export function registerRunsHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('runs:get-runs', (_e, workspaceId: string) => {
        const db = getDb()
        const rows = db.prepare('SELECT * FROM runs WHERE workspace_id = ? ORDER BY started_at DESC').all(workspaceId) as Record<string, unknown>[]
        return rows.map(parseRun)
    })

    ipcMain.handle('runs:get-events', (_e, runId: string) => {
        const db = getDb()
        const rows = db.prepare('SELECT * FROM events WHERE run_id = ? ORDER BY ts_ms ASC').all(runId) as Record<string, unknown>[]
        return rows.map(parseEvent)
    })
}
