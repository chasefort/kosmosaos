#!/usr/bin/env node
/**
 * src/server/index.ts
 *
 * `npx kosmos-aos [scan] [workspace-path] [--port 5588] [--no-open]`
 *
 * Starts a local HTTP + WebSocket server that reuses all existing IPC handlers
 * via a thin adapter, and serves the browser-built renderer as static files.
 */

import * as http from 'http'
import * as path from 'path'
import * as fs from 'fs'
import { homedir } from 'os'
import { randomBytes } from 'crypto'
import { WebSocketServer, WebSocket } from 'ws'
import { initDatabase } from '../main/storage/db'
import { setBroadcast } from '../main/ipc/broadcast'
import { registerWorkspaceHandlers } from '../main/ipc/workspace.ipc'
import { registerGraphHandlers } from '../main/ipc/graph.ipc'
import { registerRunsHandlers } from '../main/ipc/runs.ipc'
import { registerIntegrationHandlers } from '../main/ipc/integrations.ipc'
import { registerFileHandlers } from '../main/ipc/files.ipc'
import { registerTerminalHandlers } from '../main/ipc/terminal.ipc'
import { registerDashboardHandlers } from '../main/ipc/dashboard.ipc'
import { registerV2Handlers } from '../main/ipc/v2.ipc'
import { registerContextHandlers } from '../main/ipc/context.ipc'

// ── Session token ──────────────────────────────────────────────────────────────
// Generated once at startup. Injected into the served HTML so the browser client
// can include it on every API request. Any cross-origin page that did not load
// from this server cannot know the token, so they can't reach the API.

const SESSION_TOKEN = randomBytes(32).toString('hex')

// ── CLI args ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
let workspacePath: string | null = null
let port = 5588
let noOpen = false
let scanAlias = false
let preScannedWorkspace: unknown = null

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
        port = parseInt(args[++i], 10)
    } else if (args[i] === '--no-open') {
        noOpen = true
    } else if (args[i] === 'scan' && !workspacePath) {
        scanAlias = true
    } else if (!args[i].startsWith('--')) {
        workspacePath = path.resolve(args[i])
    }
}

if (scanAlias && !workspacePath) workspacePath = process.cwd()

// ── Database ───────────────────────────────────────────────────────────────────

const dbDir = path.join(homedir(), '.kosmos')
initDatabase(dbDir)

// ── WebSocket broadcast ────────────────────────────────────────────────────────

const eventClients = new Set<WebSocket>()

setBroadcast((channel, payload) => {
    const msg = JSON.stringify({ channel, payload })
    for (const ws of eventClients) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(msg)
        }
    }
})

// ── IPC adapter ────────────────────────────────────────────────────────────────
// Maps ipcMain.handle(channel, handler) to POST /api/:channel

type Handler = (_e: null, ...args: unknown[]) => Promise<unknown>
const handlers = new Map<string, Handler>()

const fakeIpcMain = {
    handle(channel: string, handler: Handler) {
        handlers.set(channel, handler)
    }
}

registerWorkspaceHandlers(fakeIpcMain as any)
registerGraphHandlers(fakeIpcMain as any)
registerRunsHandlers(fakeIpcMain as any)
registerIntegrationHandlers(fakeIpcMain as any)
registerFileHandlers(fakeIpcMain as any)

// Terminal: wrap in try/catch so node-pty failures are non-fatal
try {
    registerTerminalHandlers(fakeIpcMain as any)
} catch (e) {
    console.warn('[kosmos] node-pty unavailable — terminal disabled:', (e as Error).message)
    handlers.set('terminal:spawn', async () => ({ ok: false, error: 'Terminal requires node-pty. Run: npm install node-pty' }))
    handlers.set('terminal:write', async () => ({ ok: false }))
    handlers.set('terminal:resize', async () => ({ ok: false }))
    handlers.set('terminal:kill', async () => ({ ok: false }))
    handlers.set('terminal:list', async () => [])
}

registerDashboardHandlers(fakeIpcMain as any)
registerV2Handlers(fakeIpcMain as any)
registerContextHandlers(fakeIpcMain as any)

// In browser mode, the file dialog is replaced by a text input in the UI
handlers.set('workspace:open-dialog', async () => null)

// ── Server config endpoint ─────────────────────────────────────────────────────

function getServerConfig() {
    return { workspacePath, port, version: '0.2.0', preScannedWorkspace }
}

// ── Static file serving ────────────────────────────────────────────────────────

const browserOutDir = path.join(__dirname, '../../out/browser')

const MIME: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.json': 'application/json',
}

function injectToken(html: string): string {
    const tag = `<script>window.__KOSMOS_TOKEN__="${SESSION_TOKEN}"</script>`
    return html.includes('</head>') ? html.replace('</head>', `${tag}</head>`) : tag + html
}

function serveStatic(pathname: string, res: http.ServerResponse): boolean {
    // Decode percent-encoding; reject malformed URIs
    let decoded: string
    try { decoded = decodeURIComponent(pathname) } catch { return false }

    // Resolve to an absolute path and enforce it stays inside browserOutDir
    const relative = (decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')) || 'index.html'
    const resolved = path.resolve(browserOutDir, relative)
    const base = browserOutDir.endsWith(path.sep) ? browserOutDir : browserOutDir + path.sep

    if (!resolved.startsWith(base)) {
        // Path traversal attempt — reject outright, do not fall back to index
        res.writeHead(403)
        res.end('Forbidden')
        return true
    }

    const ext = path.extname(resolved)

    try {
        const content = fs.readFileSync(resolved)
        if (ext === '.html') {
            const injected = injectToken(content.toString('utf-8'))
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(injected)
        } else {
            res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' })
            res.end(content)
        }
        return true
    } catch {
        // File not found — SPA fallback (React router handles client-side routes)
        try {
            const html = fs.readFileSync(path.join(browserOutDir, 'index.html'))
            const injected = injectToken(html.toString('utf-8'))
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(injected)
            return true
        } catch {
            return false
        }
    }
}

// ── HTTP server ────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)

    // CORS: only allow requests that originate from this server itself.
    // This blocks cross-origin pages (including DNS-rebinding attacks) from
    // reading API responses while still letting the served React app work.
    const origin = req.headers['origin']
    const allowedOrigins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Vary', 'Origin')
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Kosmos-Token')

    if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
    }

    // GET /api/server-config — lets the UI know CLI workspace path.
    // No token required: this is read before the HTML (and token) has loaded.
    if (req.method === 'GET' && url.pathname === '/api/server-config') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(getServerConfig()))
        return
    }

    // POST /api/:channel — IPC adapter
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
        // Require the session token that was injected into the served HTML.
        // Any page that did not load from this server cannot know this value.
        if (req.headers['x-kosmos-token'] !== SESSION_TOKEN) {
            res.writeHead(401, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Unauthorized' }))
            return
        }

        const channel = url.pathname.slice(5) // strip '/api/'
        const handler = handlers.get(channel)

        if (!handler) {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: `Unknown channel: ${channel}` }))
            return
        }

        // Read body
        let body = ''
        for await (const chunk of req) body += chunk

        let invokeArgs: unknown[] = []
        try {
            const parsed = JSON.parse(body || '{}')
            invokeArgs = Array.isArray(parsed.args) ? parsed.args : []
        } catch {
            invokeArgs = []
        }

        try {
            const result = await handler(null, ...invokeArgs)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ result }))
        } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: e?.message ?? String(e) }))
        }
        return
    }

    // Static file fallback
    if (!serveStatic(url.pathname, res)) {
        res.writeHead(404)
        res.end('Not found')
    }
})

// ── WebSocket server ───────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    if (url.pathname === '/ws/events') {
        if (url.searchParams.get('token') !== SESSION_TOKEN) {
            ws.close(4001, 'Unauthorized')
            return
        }
        eventClients.add(ws)
        ws.on('close', () => eventClients.delete(ws))
        ws.on('error', () => eventClients.delete(ws))
    }
})

// ── Start ──────────────────────────────────────────────────────────────────────

server.listen(port, '127.0.0.1', async () => {
    const url = `http://localhost:${port}`
    console.log(`\n  Kosmos running at ${url}\n`)
    if (workspacePath) {
        try {
            const scanResult = await handlers.get('workspace:scan')?.(null, workspacePath)
            preScannedWorkspace = scanResult
            console.log(`  Kosmos scanned ${workspacePath}\n`)
            const result = scanResult as { id?: string; nodeCount?: number; edgeCount?: number; findingCount?: number }
            if (result?.id) {
                const health = await handlers.get('context:get-health')?.(null, result.id) as any
                console.log('  Context graph')
                console.log(`  - ${health?.metrics?.wikiPages ?? 0} wiki pages`)
                console.log(`  - ${health?.metrics?.sourceDocs ?? 0} source docs`)
                console.log(`  - ${health?.metrics?.outputArtifacts ?? 0} outputs`)
                console.log(`  - ${health?.metrics?.instructionFiles ?? 0} instruction files`)
                console.log(`  - ${result.edgeCount ?? health?.metrics?.edgeCount ?? 0} links/edges\n`)
                console.log('  Health')
                console.log(`  - ${health?.metrics?.brokenLinks ?? 0} broken links`)
                console.log(`  - ${health?.metrics?.missingSourcePages ?? 0} pages missing sources`)
                console.log(`  - ${health?.metrics?.orphanPages ?? 0} orphan pages`)
                console.log(`  - ${health?.metrics?.outputsWithoutProvenance ?? 0} outputs without provenance\n`)
            }
        } catch (error) {
            console.warn(`[kosmos] Initial scan failed for ${workspacePath}:`, (error as Error).message)
            console.log(`  Workspace: ${workspacePath}\n`)
        }
    }
    if (!noOpen) {
        openBrowser(url)
    }
})

server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`[kosmos] Port ${port} is already in use. Try: npx kosmos-aos --port 5589`)
    } else {
        console.error('[kosmos] Server error:', e)
    }
    process.exit(1)
})

function openBrowser(url: string) {
    const { exec } = require('child_process')
    if (process.platform === 'darwin') exec(`open "${url}"`)
    else if (process.platform === 'win32') exec(`start "" "${url}"`)
    else exec(`xdg-open "${url}"`)
}
