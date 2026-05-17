import { IpcMain } from 'electron'
import { getDb } from '../storage/db'

export function registerDashboardHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('dashboard:get-stats', (_e, workspaceId: string) => {
        const db = getDb()
        const now = Date.now()
        const dayAgo = now - 24 * 60 * 60 * 1000

        // Node counts by type
        const nodeCounts = db.prepare(`
            SELECT type, COUNT(*) as count FROM nodes
            WHERE workspace_id = ? GROUP BY type
        `).all(workspaceId) as { type: string; count: number }[]

        const agentCount = nodeCounts.find(r => r.type === 'agent')?.count ?? 0
        const toolCount = nodeCounts.find(r => r.type === 'tool')?.count ?? 0
        const nodeCount = nodeCounts.reduce((sum, r) => sum + r.count, 0)

        // Edge count
        const edgeRow = db.prepare(`
            SELECT COUNT(*) as count FROM edges WHERE workspace_id = ?
        `).get(workspaceId) as { count: number }
        const edgeCount = edgeRow.count

        const traceRow = db.prepare(`
            SELECT COUNT(*) as count FROM traces WHERE workspace_id = ?
        `).get(workspaceId) as { count: number }

        // Runs today
        const runsRow = db.prepare(`
            SELECT COUNT(*) as count FROM runs
            WHERE workspace_id = ? AND started_at > ?
        `).get(workspaceId, dayAgo) as { count: number }

        // Events today
        const eventsRow = db.prepare(`
            SELECT COUNT(*) as count FROM events e
            JOIN runs r ON e.run_id = r.id
            WHERE r.workspace_id = ? AND e.ts_ms > ?
        `).get(workspaceId, dayAgo) as { count: number }

        // Tool usage top 10 in last 24h
        const toolUsage = db.prepare(`
            SELECT tool_name as name, COUNT(*) as count FROM events e
            JOIN runs r ON e.run_id = r.id
            WHERE r.workspace_id = ? AND e.tool_name IS NOT NULL AND e.ts_ms > ?
            GROUP BY tool_name ORDER BY count DESC LIMIT 10
        `).all(workspaceId, dayAgo) as { name: string; count: number }[]

        // Hourly activity — 24 buckets (index 0 = 24h ago, index 23 = most recent)
        const hourlyActivity: number[] = new Array(24).fill(0)
        const hourlyRows = db.prepare(`
            SELECT ts_ms FROM events e
            JOIN runs r ON e.run_id = r.id
            WHERE r.workspace_id = ? AND e.ts_ms > ?
        `).all(workspaceId, dayAgo) as { ts_ms: number }[]

        for (const row of hourlyRows) {
            const hoursAgo = Math.floor((now - row.ts_ms) / (60 * 60 * 1000))
            if (hoursAgo >= 0 && hoursAgo < 24) {
                hourlyActivity[23 - hoursAgo]++
            }
        }

        // Recent runs (last 5)
        const recentRuns = db.prepare(`
            SELECT id, source, started_at, ended_at, event_count, status, meta
            FROM runs WHERE workspace_id = ?
            ORDER BY started_at DESC LIMIT 5
        `).all(workspaceId) as {
            id: string; source: string; started_at: number; ended_at: number | null
            event_count: number; status: string; meta: string
        }[]

        const feedbackRows = db.prepare(`
            SELECT value
            FROM feedback_scores
            WHERE workspace_id = ?
        `).all(workspaceId) as { value: number }[]

        const spanRows = db.prepare(`
            SELECT model_name, meta
            FROM spans
            WHERE workspace_id = ? AND started_at > ?
        `).all(workspaceId, dayAgo) as { model_name: string | null; meta: string | null }[]

        let totalTokens = 0
        let totalCostUsd = 0
        const modelUsage: Record<string, { tokens: number; costUsd: number }> = {}
        for (const row of spanRows) {
            const meta = row.meta ? JSON.parse(row.meta) as Record<string, unknown> : {}
            const usage = meta.usage && typeof meta.usage === 'object' ? meta.usage as Record<string, unknown> : {}
            const tokens = typeof usage.totalTokens === 'number'
                ? usage.totalTokens
                : ((typeof usage.inputTokens === 'number' ? usage.inputTokens : 0)
                    + (typeof usage.outputTokens === 'number' ? usage.outputTokens : 0)
                    + (typeof usage.cacheReadTokens === 'number' ? usage.cacheReadTokens : 0)
                    + (typeof usage.cacheWriteTokens === 'number' ? usage.cacheWriteTokens : 0))
            const costUsd = typeof meta.costUsd === 'number' ? meta.costUsd : 0
            totalTokens += tokens
            totalCostUsd += costUsd

            if (row.model_name) {
                const current = modelUsage[row.model_name] ?? { tokens: 0, costUsd: 0 }
                current.tokens += tokens
                current.costUsd += costUsd
                modelUsage[row.model_name] = current
            }
        }

        const feedbackAverage = feedbackRows.length > 0
            ? feedbackRows.reduce((sum, row) => sum + row.value, 0) / feedbackRows.length
            : null

        return {
            agentCount,
            toolCount,
            nodeCount,
            edgeCount,
            traceCount: traceRow.count,
            runsToday: runsRow.count,
            eventsToday: eventsRow.count,
            toolUsage,
            totalTokens,
            totalCostUsd,
            feedbackAverage,
            feedbackCount: feedbackRows.length,
            modelUsage: Object.entries(modelUsage)
                .map(([name, value]) => ({ name, tokens: value.tokens, costUsd: value.costUsd }))
                .sort((a, b) => b.tokens - a.tokens)
                .slice(0, 6),
            hourlyActivity,
            recentRuns: recentRuns.map(r => ({
                ...r,
                meta: r.meta ? JSON.parse(r.meta) : {},
            })),
            computedAt: now,
        }
    })
}
