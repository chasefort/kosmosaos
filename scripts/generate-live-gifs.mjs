import * as http from 'node:http'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import puppeteer from 'puppeteer-core'
import { WebSocketServer, WebSocket } from 'ws'
const require = createRequire(import.meta.url)

const { initDatabase } = require('../dist/main/storage/db.js')
const { setBroadcast } = require('../dist/main/ipc/broadcast.js')
const { registerWorkspaceHandlers } = require('../dist/main/ipc/workspace.ipc.js')
const { registerGraphHandlers } = require('../dist/main/ipc/graph.ipc.js')
const { registerRunsHandlers } = require('../dist/main/ipc/runs.ipc.js')
const { registerIntegrationHandlers } = require('../dist/main/ipc/integrations.ipc.js')
const { registerFileHandlers } = require('../dist/main/ipc/files.ipc.js')
const { registerDashboardHandlers } = require('../dist/main/ipc/dashboard.ipc.js')
const { registerV2Handlers } = require('../dist/main/ipc/v2.ipc.js')
const { generateWorkspaceId } = require('../dist/shared/ids.js')

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const screenshotsDir = join(root, 'docs', 'screenshots')
const browserOutDir = join(root, 'out', 'browser')

const chromeBinary =
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ].find(candidate => existsSync(candidate)) ?? null

if (!chromeBinary) {
  console.error('Google Chrome is required to generate live GIFs.')
  process.exit(1)
}

if (!existsSync(browserOutDir)) {
  console.error('Browser build is missing. Run `npm run build:npx` first.')
  process.exit(1)
}

mkdirSync(screenshotsDir, { recursive: true })

const viewport = { width: 1600, height: 980, deviceScaleFactor: 1 }
const port = 5591
const primarySessionId = 'release-demo'
const secondarySessionId = 'release-dashboard'
const workspaceRoot = mkdtempSync(join(tmpdir(), 'kosmos-live-demo-'))
const workspaceDir = join(workspaceRoot, 'workspace')
const dbDir = join(workspaceRoot, '.kosmos')
mkdirSync(workspaceDir, { recursive: true })
mkdirSync(dbDir, { recursive: true })
seedWorkspace(workspaceDir)

const workspaceId = generateWorkspaceId(workspaceDir)
const runId = `openclaw::${primarySessionId}`

const openClawServer = new WebSocketServer({ host: '127.0.0.1', port: 18789 })
const openClawClients = new Set()
openClawServer.on('connection', socket => {
  openClawClients.add(socket)
  socket.on('close', () => openClawClients.delete(socket))
  socket.on('error', () => openClawClients.delete(socket))
})

let browser
const captureServer = await startCaptureServer({ workspacePath: workspaceDir, dbDir, port })

try {
  browser = await puppeteer.launch({
    executablePath: chromeBinary,
    headless: 'new',
    defaultViewport: viewport,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-angle=swiftshader',
      '--disable-dev-shm-usage',
    ],
  })

  const page = await browser.newPage()
  console.log('browser ready')
  await page.goto(`http://127.0.0.1:${port}/?capture=1#/dashboard`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => document.body.innerText.includes('System overview'), { timeout: 30_000 })
  await wait(1500)
  console.log('dashboard loaded')
  await saveScreenshot(page, 'overview.png')

  await page.evaluate(async (wsPath) => {
    await window.api.writeFile(`${wsPath}/CLAUDE.md`, '# Kosmos Prompt\n\nVersion two instructions.\n\nUse write_file carefully.\n')
    await window.api.writeFile(`${wsPath}/CLAUDE.md`, '# Kosmos Prompt\n\nVersion three instructions.\n\nExplain changed files and costs.\n')
  }, workspaceDir)
  console.log('prompt versions seeded')

  await page.evaluate(async ({ workspaceId }) => {
    await window.api.runPromptExperiment(workspaceId, 'CLAUDE.md')
  }, { workspaceId })
  await wait(1400)
  const promptInsights = await page.evaluate(async ({ workspaceId }) => {
    return window.api.getPromptInsights(workspaceId, 'CLAUDE.md')
  }, { workspaceId })
  console.log('prompt insights', JSON.stringify(promptInsights))
  await page.evaluate((absolutePath) => {
    if (!window.__KOSMOS_CAPTURE__) throw new Error('Capture helpers unavailable')
    window.__KOSMOS_CAPTURE__.openFile(absolutePath)
  }, join(workspaceDir, 'CLAUDE.md'))
  await wait(2600)
  await saveScreenshot(page, 'prompt-versioning.png')
  console.log('captured prompt editor')
  await page.evaluate(() => {
    if (!window.__KOSMOS_CAPTURE__) throw new Error('Capture helpers unavailable')
    window.__KOSMOS_CAPTURE__.closeFile()
  })
  await wait(700)
  await saveScreenshot(page, 'dashboard.png')

  await setHash(page, '/universe')
  await wait(1600)
  for (const event of buildPrimaryEvents()) {
    broadcastOpenClaw(event)
    await wait(700)
  }
  await saveScreenshot(page, 'universe-map.png')
  console.log('captured universe')

  await setHash(page, '/runs')
  await wait(1800)
  broadcastOpenClaw({
    sessionId: primarySessionId,
    type: 'agent_end',
    timestamp: at(8),
    agentName: 'OpenClaw',
    summary: 'Completed release demo session',
  })
  await wait(2200)
  await page.evaluate(async ({ workspaceId, runId }) => {
    await window.api.addFeedback({
      workspaceId,
      traceId: runId,
      name: 'quality',
      value: 4,
    })
    await window.api.saveTraceExample(workspaceId, runId)
  }, { workspaceId, runId })
  await wait(1200)
  await clickText(page, 'write_file')
  await wait(600)
  await saveScreenshot(page, 'trace-inspector.png')
  console.log('captured runs')

  await setHash(page, '/dashboard')
  for (const event of buildSecondaryEvents()) {
    broadcastOpenClaw(event)
    await wait(420)
  }
  await page.waitForFunction(() => document.body.innerText.includes('System overview'), { timeout: 15_000 })
  await wait(2200)
  console.log('captured dashboard and overview')
  console.log('Generated live app screenshots in docs/screenshots')
} finally {
  try {
    await browser?.close()
  } catch {}
  try {
    await captureServer.close()
  } catch {}
  try {
    openClawServer.close()
  } catch {}
  rmSync(workspaceRoot, { recursive: true, force: true })
}

async function startCaptureServer({ workspacePath, dbDir, port }) {
  initDatabase(dbDir)
  console.log('capture server booting')

  const SESSION_TOKEN = randomBytes(32).toString('hex')
  const eventClients = new Set()
  setBroadcast((channel, payload) => {
    const msg = JSON.stringify({ channel, payload })
    for (const ws of eventClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg)
    }
  })

  const handlers = new Map()
  const fakeIpcMain = {
    handle(channel, handler) {
      handlers.set(channel, handler)
    }
  }

  registerWorkspaceHandlers(fakeIpcMain)
  registerGraphHandlers(fakeIpcMain)
  registerRunsHandlers(fakeIpcMain)
  registerIntegrationHandlers(fakeIpcMain)
  registerFileHandlers(fakeIpcMain)
  registerDashboardHandlers(fakeIpcMain)
  registerV2Handlers(fakeIpcMain)
  handlers.set('workspace:open-dialog', async () => null)

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)

    if (req.method === 'GET' && url.pathname === '/api/server-config') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ workspacePath, port, version: '0.3.0' }))
      return
    }

    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      if (req.headers['x-kosmos-token'] !== SESSION_TOKEN) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }

      const channel = url.pathname.slice(5)
      const handler = handlers.get(channel)
      if (!handler) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Unknown channel: ${channel}` }))
        return
      }

      let body = ''
      for await (const chunk of req) body += chunk
      let invokeArgs = []
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
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error?.message ?? String(error) }))
      }
      return
    }

    if (!serveStatic(SESSION_TOKEN, url.pathname, res)) {
      res.writeHead(404)
      res.end('Not found')
    }
  })

  const wss = new WebSocketServer({ server })
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    if (url.pathname !== '/ws/events') return
    if (url.searchParams.get('token') !== SESSION_TOKEN) {
      ws.close(4001, 'Unauthorized')
      return
    }
    eventClients.add(ws)
    ws.on('close', () => eventClients.delete(ws))
    ws.on('error', () => eventClients.delete(ws))
  })

  await new Promise((resolvePromise, rejectPromise) => {
    server.listen(port, '127.0.0.1', resolvePromise)
    server.on('error', rejectPromise)
  })
  console.log(`capture server ready on ${port}`)

  return {
    close() {
      return new Promise(resolvePromise => {
        for (const ws of eventClients) {
          try { ws.close() } catch {}
        }
        wss.close(() => {
          server.close(() => resolvePromise())
        })
      })
    }
  }
}

function serveStatic(token, pathname, res) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return false
  }

  const relativePath = (decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')) || 'index.html'
  const resolved = path.resolve(browserOutDir, relativePath)
  const base = browserOutDir.endsWith(path.sep) ? browserOutDir : browserOutDir + path.sep

  if (!resolved.startsWith(base)) {
    res.writeHead(403)
    res.end('Forbidden')
    return true
  }

  const mime = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
  }

  try {
    const content = fs.readFileSync(resolved)
    if (path.extname(resolved) === '.html') {
      const html = injectToken(content.toString('utf8'), token)
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
    } else {
      res.writeHead(200, { 'Content-Type': mime[path.extname(resolved)] ?? 'application/octet-stream' })
      res.end(content)
    }
    return true
  } catch {
    try {
      const html = fs.readFileSync(path.join(browserOutDir, 'index.html'), 'utf8')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(injectToken(html, token))
      return true
    } catch {
      return false
    }
  }
}

function injectToken(html, token) {
  const tag = `<script>window.__KOSMOS_TOKEN__="${token}"</script>`
  return html.includes('</head>') ? html.replace('</head>', `${tag}</head>`) : `${tag}${html}`
}

function seedWorkspace(workspacePath) {
  mkdirSync(join(workspacePath, '.openclaw'), { recursive: true })
  mkdirSync(join(workspacePath, 'src'), { recursive: true })
  mkdirSync(join(workspacePath, 'prompts'), { recursive: true })
  writeFileSync(join(workspacePath, 'README.md'), [
    '# Kosmos Demo Workspace',
    '',
    'This workspace exists to demo live tracing, prompt versioning, and runtime graphing.',
  ].join('\n'))
  writeFileSync(join(workspacePath, 'CLAUDE.md'), [
    '# Kosmos Prompt',
    '',
    'Version one instructions.',
    '',
    '- Explore the repo before editing.',
    '- Show changed files and explain why they changed.',
  ].join('\n'))
  writeFileSync(join(workspacePath, 'prompts', 'system.md'), [
    '# System Prompt',
    '',
    'Prefer safe refactors and visible runtime signals.',
  ].join('\n'))
  writeFileSync(join(workspacePath, 'src', 'agent.ts'), [
    'export function runAgentTask(task: string) {',
    '  return `handled: ${task}`',
    '}',
  ].join('\n'))
  writeFileSync(join(workspacePath, 'src', 'index.ts'), [
    'import { runAgentTask } from "./agent"',
    '',
    'console.log(runAgentTask("demo"))',
  ].join('\n'))
}

function buildPrimaryEvents() {
  return [
    {
      sessionId: primarySessionId,
      type: 'llm_input',
      timestamp: at(1),
      agentName: 'OpenClaw',
      modelName: 'claude-sonnet-4',
      callId: 'model-1',
      input: { prompt: 'Review the repo and update the entrypoint.' },
    },
    {
      sessionId: primarySessionId,
      type: 'llm_output',
      timestamp: at(2),
      agentName: 'OpenClaw',
      modelName: 'claude-sonnet-4',
      callId: 'model-1',
      output: { text: 'I found the change site and will update src/index.ts next.' },
      usage: { inputTokens: 812, outputTokens: 224, totalTokens: 1036 },
      costUsd: 0.014,
    },
    {
      sessionId: primarySessionId,
      type: 'before_tool_call',
      timestamp: at(3),
      agentName: 'OpenClaw',
      toolName: 'read_file',
      callId: 'tool-1',
      input: { path: 'src/agent.ts' },
    },
    {
      sessionId: primarySessionId,
      type: 'after_tool_call',
      timestamp: at(4),
      agentName: 'OpenClaw',
      toolName: 'read_file',
      callId: 'tool-1',
      output: { ok: true, lines: 3, summary: 'Loaded src/agent.ts' },
    },
    {
      sessionId: primarySessionId,
      type: 'before_tool_call',
      timestamp: at(5),
      agentName: 'OpenClaw',
      toolName: 'write_file',
      callId: 'tool-2',
      input: {
        path: 'src/index.ts',
        content: 'import { runAgentTask } from "./agent"\n\nconsole.log(runAgentTask("release-demo"))\n',
      },
    },
    {
      sessionId: primarySessionId,
      type: 'subagent_spawned',
      timestamp: at(6),
      subagentId: 'sub-1',
      subagentName: 'Editor',
    },
    {
      sessionId: primarySessionId,
      type: 'after_tool_call',
      timestamp: at(7),
      agentName: 'OpenClaw',
      toolName: 'write_file',
      callId: 'tool-2',
      output: { ok: true, bytesWritten: 82, summary: 'Updated src/index.ts' },
    },
  ]
}

function buildSecondaryEvents() {
  return [
    {
      sessionId: secondarySessionId,
      type: 'llm_input',
      timestamp: at(21),
      agentName: 'OpenClaw',
      modelName: 'claude-sonnet-4',
      callId: 'model-2',
      input: { prompt: 'Summarize the latest workspace changes.' },
    },
    {
      sessionId: secondarySessionId,
      type: 'llm_output',
      timestamp: at(22),
      agentName: 'OpenClaw',
      modelName: 'claude-sonnet-4',
      callId: 'model-2',
      output: { text: 'Kosmos now shows live file writes and prompt version history.' },
      usage: { inputTokens: 422, outputTokens: 130, totalTokens: 552 },
      costUsd: 0.008,
    },
    {
      sessionId: secondarySessionId,
      type: 'before_tool_call',
      timestamp: at(23),
      agentName: 'OpenClaw',
      toolName: 'read_file',
      callId: 'tool-3',
      input: { path: 'README.md' },
    },
    {
      sessionId: secondarySessionId,
      type: 'after_tool_call',
      timestamp: at(24),
      agentName: 'OpenClaw',
      toolName: 'read_file',
      callId: 'tool-3',
      output: { ok: true, summary: 'Loaded README.md' },
    },
    {
      sessionId: secondarySessionId,
      type: 'agent_end',
      timestamp: at(25),
      agentName: 'OpenClaw',
      summary: 'Dashboard demo trace completed',
    },
  ]
}

function broadcastOpenClaw(payload) {
  const message = JSON.stringify(payload)
  for (const socket of openClawClients) {
    if (socket.readyState === 1) socket.send(message)
  }
}

function at(second) {
  return new Date(Date.UTC(2026, 3, 6, 12, 0, second)).toISOString()
}

async function clickSelector(page, selector) {
  await page.waitForSelector(selector, { timeout: 15_000 })
  await page.click(selector)
}

async function clickText(page, text) {
  await page.waitForFunction(
    target => [...document.querySelectorAll('*')].some(node => node.textContent?.trim() === target),
    { timeout: 15_000 },
    text,
  )
  await page.evaluate(target => {
    const nodes = [...document.querySelectorAll('*')]
    const el = nodes.find(node => node.textContent?.trim() === target)
    if (!el) throw new Error(`Could not find text: ${target}`)
    const clickable = el.closest('.file-row') ?? el.closest('button') ?? el
    clickable.scrollIntoView({ block: 'center' })
    clickable.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, text)
}

async function clickButtonStartsWith(page, prefix) {
  await page.waitForFunction(
    target => [...document.querySelectorAll('button')].some(node => node.textContent?.trim().startsWith(target)),
    { timeout: 15_000 },
    prefix,
  )
  await page.evaluate(target => {
    const button = [...document.querySelectorAll('button')].find(node => node.textContent?.trim().startsWith(target))
    if (!button) throw new Error(`Could not find button starting with ${target}`)
    button.scrollIntoView({ block: 'center' })
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, prefix)
}

async function setHash(page, route) {
  await page.evaluate(nextRoute => {
    window.location.hash = nextRoute
  }, route)
  await wait(500)
}

async function screenshot(page) {
  return page.screenshot({ type: 'png' })
}

async function saveScreenshot(page, fileName) {
  const targetPath = join(screenshotsDir, fileName)
  await page.screenshot({ path: targetPath, type: 'png' })
}

function wait(ms) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, ms))
}
