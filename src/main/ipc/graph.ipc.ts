import { IpcMain } from 'electron'
import { getDb } from '../storage/db'
import { KosmosNode, KosmosEdge } from '../../shared/types'

function parseNode(row: Record<string, unknown>): KosmosNode {
    return {
        id: row.id as string,
        name: row.name as string,
        type: row.type as KosmosNode['type'],
        source: row.source as KosmosNode['source'],
        confidence: row.confidence as number,
        description: row.description as string | undefined,
        tags: JSON.parse(row.tags as string),
        paths: JSON.parse(row.paths as string),
        workspaceId: row.workspace_id as string,
        createdAt: row.created_at as number,
        updatedAt: row.updated_at as number,
        meta: JSON.parse(row.meta as string)
    }
}

function parseEdge(row: Record<string, unknown>): KosmosEdge {
    return {
        id: row.id as string,
        type: row.type as KosmosEdge['type'],
        fromId: row.from_id as string,
        toId: row.to_id as string,
        workspaceId: row.workspace_id as string,
        weight: row.weight as number,
        meta: JSON.parse(row.meta as string)
    }
}

export function registerGraphHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('graph:get-nodes', (_e, workspaceId: string) => {
        const db = getDb()
        const rows = db.prepare('SELECT * FROM nodes WHERE workspace_id = ? ORDER BY type, name').all(workspaceId) as Record<string, unknown>[]
        return rows.map(parseNode)
    })

    ipcMain.handle('graph:get-edges', (_e, workspaceId: string) => {
        const db = getDb()
        const rows = db.prepare('SELECT * FROM edges WHERE workspace_id = ?').all(workspaceId) as Record<string, unknown>[]
        return rows.map(parseEdge)
    })

    ipcMain.handle('graph:upsert-node', (_e, node: KosmosNode) => {
        const db = getDb()
        db.prepare(`
      INSERT OR REPLACE INTO nodes (id, workspace_id, name, type, source, confidence, description, tags, paths, meta, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(node.id, node.workspaceId, node.name, node.type, node.source, node.confidence, node.description ?? null, JSON.stringify(node.tags), JSON.stringify(node.paths), JSON.stringify(node.meta ?? {}), node.createdAt, node.updatedAt)
        return true
    })

    ipcMain.handle('graph:upsert-edge', (_e, edge: KosmosEdge) => {
        const db = getDb()
        db.prepare(`
      INSERT OR REPLACE INTO edges (id, workspace_id, type, from_id, to_id, weight, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(edge.id, edge.workspaceId, edge.type, edge.fromId, edge.toId, edge.weight ?? 1, JSON.stringify(edge.meta ?? {}))
        return true
    })
}
