/**
 * Claude Code session importer.
 *
 * Historical Claude Code JSONL files now flow through the same runtime
 * normalizer + canonical persistence path as live events so we do not keep
 * two conflicting tracing pipelines alive.
 */

import { readdir, readFile, access } from 'fs/promises'
import { join, basename } from 'path'
import { homedir } from 'os'
import type { Database } from 'better-sqlite3'
import { flushLivePersistence, persistNormalizedEvents } from '../ipc/live-persist'
import { normalizeRuntimePayload } from '../ipc/runtime-normalizer'
import type { NormalizedRuntimeEvent } from '../../shared/types'

interface RawLine {
    type: string
    sessionId?: string
    uuid?: string
    timestamp?: string
    cwd?: string
    gitBranch?: string
    version?: string
    message?: {
        role?: string
        model?: string
        content?: string | unknown[]
        usage?: {
            input_tokens?: number
            output_tokens?: number
            cache_read_input_tokens?: number
            cache_creation_input_tokens?: number
        }
    }
}

function encodeClaudeCodePath(wsPath: string): string {
    return wsPath.replace(/\//g, '-')
}

async function findSessionsDir(wsPath: string): Promise<string | null> {
    const encoded = encodeClaudeCodePath(wsPath)
    const dir = join(homedir(), '.claude', 'projects', encoded)
    try { await access(dir); return dir } catch { return null }
}

/** Locate session directories for a workspace.
 *  - Normal workspace: returns the single encoded project dir, or empty if absent.
 *  - ~/.claude root: returns every project dir under ~/.claude/projects/ (opt-in only). */
async function findAllSessionsDirs(wsPath: string): Promise<string[]> {
    const single = await findSessionsDir(wsPath)
    if (single) return [single]

    const claudeRoot = join(homedir(), '.claude')
    if (wsPath !== claudeRoot) return []

    const projectsRoot = join(claudeRoot, 'projects')
    try {
        const entries = await readdir(projectsRoot)
        const dirs: string[] = []
        for (const entry of entries) {
            const full = join(projectsRoot, entry)
            try { await access(full); dirs.push(full) } catch { /* skip */ }
        }
        return dirs
    } catch {
        return []
    }
}

function isTerminalEvent(event: NormalizedRuntimeEvent): boolean {
    return event.legacyEventType === 'session_end'
        || (
            event.operation === 'agent'
            && !event.parentSpanId
            && (event.status === 'end' || event.status === 'error')
        )
}

export async function importClaudeCodeSessions(
    workspaceId: string,
    wsPath: string,
    db: Database,
): Promise<{ runs: number; events: number }> {
    const sessionsDirs = await findAllSessionsDirs(wsPath)
    if (sessionsDirs.length === 0) {
        console.log(`[kosmos] importClaudeCodeSessions: no sessions dirs found for path="${wsPath}"`)
        return { runs: 0, events: 0 }
    }
    console.log(`[kosmos] importClaudeCodeSessions: found ${sessionsDirs.length} sessions dir(s)`)

    const jsonlFiles: string[] = []
    for (const sessionsDir of sessionsDirs) {
        try {
            const files = await readdir(sessionsDir)
            for (const file of files) {
                if (file.endsWith('.jsonl')) jsonlFiles.push(join(sessionsDir, file))
            }
        } catch { /* skip inaccessible dir */ }
    }

    console.log(`[kosmos] importClaudeCodeSessions: found ${jsonlFiles.length} jsonl file(s)`)
    if (jsonlFiles.length === 0) return { runs: 0, events: 0 }

    // Clean up old-format runs (bare UUID without source:: prefix) created by earlier
    // versions of the importer so the UI doesn't show duplicate sessions.
    try {
        const oldRuns = db.prepare(
            "SELECT id FROM runs WHERE workspace_id = ? AND source = 'claude_code' AND id NOT LIKE '%::%'"
        ).all(workspaceId) as { id: string }[]
        if (oldRuns.length > 0) {
            const cleanup = db.transaction(() => {
                for (const { id } of oldRuns) {
                    db.prepare('DELETE FROM events WHERE run_id = ?').run(id)
                    db.prepare('DELETE FROM runs WHERE id = ?').run(id)
                }
            })
            cleanup()
            console.log(`[kosmos] importClaudeCodeSessions: cleaned up ${oldRuns.length} old-format run(s)`)
        }
    } catch (error) {
        console.warn('[kosmos] importClaudeCodeSessions: cleanup error (non-fatal):', error)
    }

    let totalRuns = 0
    let totalEvents = 0

    for (const filePath of jsonlFiles) {
        const sessionId = basename(filePath, '.jsonl')

        let rawContent: string
        try {
            rawContent = await readFile(filePath, 'utf-8')
        } catch {
            continue
        }

        const rawLines: RawLine[] = []
        for (const line of rawContent.split('\n')) {
            if (!line.trim()) continue
            try {
                rawLines.push(JSON.parse(line) as RawLine)
            } catch {
                /* skip malformed */
            }
        }

        const messages = rawLines.filter(line => line.type === 'user' || line.type === 'assistant')
        if (messages.length === 0) continue

        const context = { workspaceId, workspacePath: wsPath }
        const normalizedEvents: NormalizedRuntimeEvent[] = []
        let sawTerminal = false
        let lastEventAt = 0
        let fallbackSummary: string | undefined

        for (const message of messages) {
            const rawEvent = {
                source: 'claude_code',
                session: sessionId,
                sessionId,
                ...message,
            } as Record<string, unknown>

            const events = normalizeRuntimePayload(rawEvent, context)
            if (events.length === 0) continue

            normalizedEvents.push(...events)
            if (!fallbackSummary) {
                fallbackSummary = events.find(event => event.legacyEventType === 'user_prompt')?.summary
                    ?? events[0]?.summary
            }

            for (const event of events) {
                lastEventAt = Math.max(lastEventAt, event.tsMs)
                if (isTerminalEvent(event)) sawTerminal = true
            }
        }

        if (normalizedEvents.length === 0) continue

        if (!sawTerminal) {
            const syntheticEndTs = lastEventAt > 0 ? lastEventAt : Date.now()
            const syntheticTerminal = normalizeRuntimePayload({
                source: 'claude_code',
                session: sessionId,
                sessionId,
                type: 'session_end',
                timestamp: new Date(syntheticEndTs).toISOString(),
                summary: fallbackSummary ?? sessionId,
            }, context)
            normalizedEvents.push(...syntheticTerminal)
        }

        try {
            persistNormalizedEvents(db, normalizedEvents)
            flushLivePersistence()
            totalRuns += 1
            totalEvents += normalizedEvents.length
        } catch (error) {
            console.error('[kosmos] importClaudeCodeSessions: failed for session', sessionId, error)
        }
    }

    console.log(`[kosmos] Imported ${totalRuns} Claude Code session(s), ${totalEvents} event(s)`)
    return { runs: totalRuns, events: totalEvents }
}
