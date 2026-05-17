/**
 * Integrations IPC
 *
 * Handles three live data sources:
 *  1. HTTP ingest server (port 41414) — SDK / webhook events
 *  2. Claude Code JSONL reader — tails ~/.claude/projects/[encoded-path]/*.jsonl
 *  3. OpenClaw WebSocket — auto-connects to ws://localhost:18789 when .openclaw/ present
 */

import { IpcMain } from 'electron'
import { broadcast } from './broadcast'
import * as http from 'http'
import * as fs from 'fs'
import { readdir, access } from 'fs/promises'
import { join, basename } from 'path'
import { homedir } from 'os'
import { WebSocket } from 'ws'
import { IntegrationStatus } from '../../shared/types'
import { generateWorkspaceId } from '../../shared/ids'
import { getDb } from '../storage/db'
import { persistLiveEvent, flushLivePersistence, clearLiveRuntimeState } from './live-persist'
import { importClaudeCodeSessions } from '../parser/claude-code-importer'

// ── State ─────────────────────────────────────────────────────────────────────

let ingestServer: http.Server | null = null
let openClawWs: WebSocket | null = null
let claudeCodeWatcher: fs.FSWatcher | null = null
let claudeCodePollInterval: ReturnType<typeof setInterval> | null = null
let activeWorkspaceId: string | null = null
let activeWorkspacePath: string | null = null

// Track how far we've read into each JSONL file (path → byte offset)
const jsonlOffsets = new Map<string, number>()

const status: IntegrationStatus = {
    ingestServer: { running: false, port: 41414 },
    claudeCode: { connected: false },
    openClaw: { connected: false }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Claude Code encodes the workspace path by replacing all "/" with "-"
 * e.g.  /Users/alice/myproject  →  -Users-alice-myproject
 */
function encodeClaudeCodePath(wsPath: string): string {
    return wsPath.replace(/\//g, '-')
}

/**
 * Claude Code JSONL lines have tool info nested inside message.content[].
 * Hoist toolName and toolInput to the top level so the renderer can use them directly.
 */
function normalizeClaudeCodeEvent(ev: Record<string, unknown>, sessionId: string): Record<string, unknown> {
    const message = ev.message as any
    const content: any[] = Array.isArray(message?.content) ? message.content : []

    // assistant tool_use block → extract first tool call
    const toolUseBlock = content.find((b: any) => b.type === 'tool_use')
    // user tool_result block → extract result
    const toolResultBlock = content.find((b: any) => b.type === 'tool_result')

    return {
        ...ev,
        agentId: sessionId,
        toolName: toolUseBlock?.name ?? null,
        toolInput: toolUseBlock?.input ?? null,
        toolResult: toolResultBlock?.content ?? null,
        isToolError: toolResultBlock?.is_error ?? false,
    }
}

async function getClaudeCodeSessionsDir(wsPath: string): Promise<string | null> {
    const encoded = encodeClaudeCodePath(wsPath)
    const dir = join(homedir(), '.claude', 'projects', encoded)
    try {
        await access(dir)
        return dir
    } catch {
        return null
    }
}

/** Returns the Claude Code session directory for this workspace, or empty array if none. */
async function getAllClaudeCodeSessionsDirs(wsPath: string): Promise<string[]> {
    const single = await getClaudeCodeSessionsDir(wsPath)
    return single ? [single] : []
}

/** Tail new lines appended to a JSONL file since last read */
async function tailJsonlFile(filePath: string): Promise<unknown[]> {
    let buf: Buffer
    try { buf = await fs.promises.readFile(filePath) } catch { return [] }

    const offset = jsonlOffsets.get(filePath) ?? 0
    if (buf.length <= offset) return []

    const newContent = buf.slice(offset).toString('utf-8')
    jsonlOffsets.set(filePath, buf.length)

    const lines = newContent.split('\n').filter(l => l.trim())
    const events: unknown[] = []
    for (const line of lines) {
        try { events.push(JSON.parse(line)) } catch { /* skip malformed */ }
    }
    return events
}

/** Initialise offsets to end of current files (don't replay old history) */
async function initJsonlOffsets(sessionsDir: string) {
    try {
        const files = await readdir(sessionsDir)
        for (const name of files) {
            if (!name.endsWith('.jsonl')) continue
            const p = join(sessionsDir, name)
            try {
                const s = fs.statSync(p)
                jsonlOffsets.set(p, s.size)
            } catch { /* skip */ }
        }
    } catch { /* dir not accessible */ }
}

/** Poll a sessions directory for new JSONL lines */
async function pollSessionsDir(sessionsDir: string) {
    try {
        const files = await readdir(sessionsDir)
        for (const name of files) {
            if (!name.endsWith('.jsonl')) continue
            const p = join(sessionsDir, name)
            const events = await tailJsonlFile(p)
            for (const ev of events) {
                status.claudeCode.lastEvent = Date.now()
                const sessionId = basename(name, '.jsonl')
                const enriched = normalizeClaudeCodeEvent(
                    { source: 'claude_code', session: sessionId, ...ev as object },
                    sessionId
                )
                if (activeWorkspaceId) {
                    try {
                        const events = persistLiveEvent(getDb(), {
                            workspaceId: activeWorkspaceId,
                            workspacePath: activeWorkspacePath ?? undefined,
                        }, enriched)
                        events.forEach(event => broadcast('ingest:event', event))
                    } catch { /* ignore */ }
                }
            }
        }
    } catch { /* sessions dir disappeared */ }
}

// ── Exported handler registrar ────────────────────────────────────────────────

export function registerIntegrationHandlers(ipcMain: IpcMain): void {

    // ── HTTP ingest server ─────────────────────────────────────────────────────
    ipcMain.handle('integrations:start-ingest', () => {
        if (ingestServer) return status

        const MAX_BODY = 1024 * 1024 // 1 MB

        ingestServer = http.createServer((req, res) => {
            res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:41414')
            res.setHeader('Content-Type', 'application/json')

            if (req.method === 'POST' && req.url?.startsWith('/ingest/')) {
                let body = ''
                let tooLarge = false
                req.on('data', (chunk) => {
                    body += chunk
                    if (body.length > MAX_BODY) {
                        tooLarge = true
                        res.writeHead(413)
                        res.end(JSON.stringify({ error: 'Payload too large' }))
                        req.destroy()
                    }
                })
                req.on('end', () => {
                    if (tooLarge) return
                    try {
                        const event = JSON.parse(body)
                        status.claudeCode.lastEvent = Date.now()
                        if (activeWorkspaceId) {
                            try {
                                const events = persistLiveEvent(getDb(), {
                                    workspaceId: activeWorkspaceId,
                                    workspacePath: activeWorkspacePath ?? undefined,
                                }, event)
                                events.forEach(normalized => broadcast('ingest:event', normalized))
                            } catch { /* ignore */ }
                        }
                        res.writeHead(200)
                        res.end(JSON.stringify({ ok: true }))
                    } catch {
                        res.writeHead(400)
                        res.end(JSON.stringify({ error: 'Invalid JSON' }))
                    }
                })
            } else {
                res.writeHead(404)
                res.end(JSON.stringify({ error: 'Not found' }))
            }
        })

        ingestServer.on('error', (e: any) => {
            if (e.code === 'EADDRINUSE') {
                console.warn('[kosmos] Port 41414 is already in use. Ingest server might already be running elsewhere.')
            } else {
                console.error('[kosmos] Ingest server error:', e)
            }
        })

        ingestServer.listen(41414, '127.0.0.1', () => {
            status.ingestServer.running = true
        })

        return status
    })

    ipcMain.handle('integrations:stop-ingest', () => {
        ingestServer?.close()
        ingestServer = null
        status.ingestServer.running = false
        return status
    })

    // ── Auto-connect when a workspace is opened ────────────────────────────────
    ipcMain.handle('integrations:auto-connect', async (_e, wsPath: string) => {
        // Tear down ALL live connections before updating activeWorkspaceId.
        // This guarantees that no in-flight events from the previous workspace
        // can be persisted under the new workspace ID.

        flushLivePersistence()

        // Stop Claude Code polling
        claudeCodeWatcher?.close()
        claudeCodeWatcher = null
        if (claudeCodePollInterval) {
            clearInterval(claudeCodePollInterval)
            claudeCodePollInterval = null
        }
        jsonlOffsets.clear()

        // Stop OpenClaw — must happen before activeWorkspaceId is updated so any
        // trailing messages from the old connection are dropped, not mislabelled.
        if (openClawWs) {
            openClawWs.close()
            openClawWs = null
            status.openClaw.connected = false
        }

        // Now safe to switch the active workspace
        activeWorkspaceId = generateWorkspaceId(wsPath)
        activeWorkspacePath = wsPath
        clearLiveRuntimeState()

        // ── 1. Claude Code ───────────────────────────────────────────────────
        const sessionsDirs = await getAllClaudeCodeSessionsDirs(wsPath)
        if (sessionsDirs.length > 0) {
            // Background-import all historical sessions so the UI is populated immediately
            // without requiring the user to click Refresh.
            const db = getDb()
            importClaudeCodeSessions(activeWorkspaceId, wsPath, db)
                .then(result => broadcast('sessions:imported', result))
                .catch(() => { /* import failed — non-fatal */ })

            // Init offsets to current end-of-file so we only capture NEW live events
            // (history is covered by the importer above)
            for (const dir of sessionsDirs) {
                await initJsonlOffsets(dir)
            }

            // Poll every 2 seconds for new live events across all project dirs
            claudeCodePollInterval = setInterval(
                () => Promise.all(sessionsDirs.map(d => pollSessionsDir(d))),
                2000
            )

            status.claudeCode.connected = true
            broadcast('integration:status', status)
        } else {
            status.claudeCode.connected = false
            broadcast('integration:status', status)
        }

        // ── 2. OpenClaw ──────────────────────────────────────────────────────
        const openClawDir = join(wsPath, '.openclaw')
        try {
            await access(openClawDir)
            // .openclaw/ exists — auto-connect to local gateway
            connectToOpenClaw('ws://localhost:18789')
        } catch { /* no .openclaw dir — skip */ }

        return status
    })

    // ── OpenClaw WebSocket ─────────────────────────────────────────────────────
    ipcMain.handle('integrations:start-openclaw', (_e, url: string) => {
        connectToOpenClaw(url)
        return status
    })

    function connectToOpenClaw(url: string) {
        if (openClawWs) { openClawWs.close(); openClawWs = null }

        try {
            openClawWs = new WebSocket(url)

            openClawWs.on('open', () => {
                status.openClaw.connected = true
                status.openClaw.url = url
                status.openClaw.lastEvent = Date.now()
                broadcast('integration:status', status)

                // Subscribe as operator
                openClawWs?.send(JSON.stringify({ type: 'subscribe', role: 'operator' }))
            })

            openClawWs.on('message', (data) => {
                try {
                    const event = JSON.parse(data.toString())
                    status.openClaw.lastEvent = Date.now()
                    const enriched = { source: 'openclaw', ...event }
                    if (activeWorkspaceId) {
                        try {
                            const events = persistLiveEvent(getDb(), {
                                workspaceId: activeWorkspaceId,
                                workspacePath: activeWorkspacePath ?? undefined,
                            }, enriched)
                            events.forEach(normalized => broadcast('ingest:event', normalized))
                        } catch { /* ignore */ }
                    }
                } catch { /* ignore malformed */ }
            })

            openClawWs.on('close', () => {
                status.openClaw.connected = false
                broadcast('integration:status', status)
            })

            openClawWs.on('error', () => {
                status.openClaw.connected = false
            })
        } catch (e) {
            console.error('[kosmos] OpenClaw WS error:', e)
        }
    }

    // ── Status ─────────────────────────────────────────────────────────────────
    ipcMain.handle('integrations:get-status', () => status)

    // ── Proactive detection at app start (before workspace is opened) ──────────
    // Scans well-known paths so the onboarding screen can surface "Open" CTAs
    ipcMain.handle('integrations:detect-available', async () => {
        const claudeProjectsDir = join(homedir(), '.claude', 'projects')
        let claudeDetected = false
        let claudeWorkspacePath: string | null = null

        try {
            const entries = await readdir(claudeProjectsDir)
            if (entries.length > 0) {
                claudeDetected = true
                // Open the ~/.claude root — it contains all project sessions
                claudeWorkspacePath = join(homedir(), '.claude')
            }
        } catch { /* ~/.claude/projects doesn't exist */ }

        // OpenClaw: no filesystem path to probe at startup; its status comes
        // through the live WebSocket connection (integrationStatus.openClaw.connected)
        return {
            claudeCode: { detected: claudeDetected, workspacePath: claudeWorkspacePath },
        }
    })

    // ── Manual Claude Code path override (for UI) ─────────────────────────────
    ipcMain.handle('integrations:read-claude-sessions', async (_e, wsPath: string) => {
        const dir = await getClaudeCodeSessionsDir(wsPath)
        if (!dir) return []

        try {
            const files = await readdir(dir)
            const sessions: { sessionId: string; events: unknown[] }[] = []
            for (const name of files.filter(f => f.endsWith('.jsonl'))) {
                const p = join(dir, name)
                const content = await fs.promises.readFile(p, 'utf-8')
                const lines = content.split('\n').filter((l: string) => l.trim()).slice(-100) // last 100 entries
                const events = lines.flatMap((l: string) => { try { return [JSON.parse(l)] } catch { return [] } })
                sessions.push({ sessionId: basename(name, '.jsonl'), events })
            }
            return sessions
        } catch { return [] }
    })
}
