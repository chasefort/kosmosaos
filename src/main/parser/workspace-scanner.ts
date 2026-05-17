/**
 * Kosmos Workspace Scanner
 *
 * Walks a workspace directory and infers the agent architecture using 6 detectors:
 *   A) Prompt files  (*.md, CLAUDE.md, system*.txt)
 *   B) Agent source  (Python + JS/TS patterns for class/function-based agents)
 *   C) Tool source   (tool definitions, MCP configs, function schemas)
 *   D) Model refs    (model name strings in source and config)
 *   E) API/env refs  (.env files, base URL strings, SDK imports)
 *   F) Memory stores (vector db libs, sqlite, redis, JSON memory)
 *
 * Falls back gracefully — if nothing is detected the caller keeps using mock data.
 */

import { readdir, stat, readFile } from 'fs/promises'
import { join, extname, relative, resolve, dirname, basename } from 'path'
import { createHash } from 'crypto'
import { KosmosNode, KosmosEdge, ScanFileSnapshot } from '../../shared/types'
import { generateEdgeId, generateFileNodeId, generateNodeId } from '../../shared/ids'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 128 * 1024  // 128 KB — skip larger files
const MAX_DEPTH     = 5

const SKIP_DIRS = new Set([
    'node_modules', '__pycache__', '.git', 'dist', 'build',
    '.next', '.venv', 'venv', '.mypy_cache', '.pytest_cache',
    'coverage', '.turbo', '.vercel', 'out', '.cache', '.yarn'
])

/** Dot-prefixed directories to explicitly include (not skip) */
const INCLUDE_DOT_DIRS = new Set([
    '.claude', '.agent', '.agents', '_agent', '_agents',
    '.cursor', '.github', '.vscode'
])

interface FileInfo {
    path: string
    rel:  string
    ext:  string
    name: string
    size: number
    mtimeMs: number
}

async function walkDir(dir: string, wsRoot?: string, depth = 0): Promise<FileInfo[]> {
    if (depth > MAX_DEPTH) return []
    const root = wsRoot ?? dir  // Always compute rel paths from the workspace root
    let entries: string[]
    try { entries = await readdir(dir) } catch { return [] }

    const results: FileInfo[] = []
    for (const name of entries) {
        // Skip hidden files/dirs UNLESS they are in the whitelist OR we are natively scanning a .claude folder
        if (name.startsWith('.') && name !== '.env' && !name.startsWith('.env') && !INCLUDE_DOT_DIRS.has(name) && !root.endsWith('.claude')) continue
        if (SKIP_DIRS.has(name) && !root.endsWith('.claude')) continue

        const full = join(dir, name)
        try {
            const s = await stat(full)
            if (s.isDirectory()) {
                const sub = await walkDir(full, root, depth + 1)
                results.push(...sub)
            } else if (s.size < MAX_FILE_SIZE) {
                results.push({ path: full, rel: relative(root, full), ext: extname(name).slice(1).toLowerCase(), name, size: s.size, mtimeMs: s.mtimeMs })
            }
        } catch { /* skip */ }
    }
    return results
}

async function readText(path: string): Promise<string> {
    try { return await readFile(path, 'utf-8') } catch { return '' }
}

function hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex')
}

function makeNode(wsId: string, type: KosmosNode['type'], name: string, opts: Partial<KosmosNode> = {}): KosmosNode {
    const now = Date.now()
    const primaryPath = Array.isArray(opts.paths) && typeof opts.paths[0] === 'string'
        ? opts.paths[0]
        : undefined
    const isPathBackedContextNode = type === 'file'
        || type === 'wiki_page'
        || type === 'source_doc'
        || type === 'output_artifact'
        || type === 'instruction_file'
        || type === 'index_file'
    return {
        id: isPathBackedContextNode && primaryPath
            ? generateFileNodeId(wsId, primaryPath, name)
            : generateNodeId(wsId, type, name),
        name,
        type,
        source: 'static',
        confidence: 0.75,
        tags: [],
        paths: [],
        workspaceId: wsId,
        createdAt: now,
        updatedAt: now,
        meta: {},
        ...opts
    }
}

function makeEdge(wsId: string, type: KosmosEdge['type'], from: KosmosNode, to: KosmosNode, evidence?: { reason: string; file?: string; rule?: string; snippet?: string }): KosmosEdge {
    return {
        id: generateEdgeId(from.id, to.id, type),
        type,
        fromId: from.id,
        toId: to.id,
        workspaceId: wsId,
        weight: 1,
        meta: evidence ? { reason: evidence.reason, file: evidence.file, rule: evidence.rule, snippet: evidence.snippet } : {}
    }
}

// ── Detection helpers ─────────────────────────────────────────────────────────

const MODEL_PATTERNS: [RegExp, string, string][] = [
    [/claude[-_]?opus[-_]?4/i, 'Claude Opus 4', 'claude-opus-4'],
    [/claude[-_]?sonnet[-_]?4/i, 'Claude Sonnet 4', 'claude-sonnet-4'],
    [/claude[-_]?haiku[-_]?4/i, 'Claude Haiku 4', 'claude-haiku-4'],
    [/claude[-_]opus[-_]?4?[-_]?5?|claude[-_]3[-_]opus/i, 'Claude Opus', 'claude-opus'],
    [/claude[-_]sonnet[-_]?4?[-_]?5?|claude[-_]3[-_][57][-_]sonnet/i, 'Claude Sonnet', 'claude-sonnet'],
    [/claude[-_]haiku[-_]?4?[-_]?5?|claude[-_]3[-_]haiku/i, 'Claude Haiku', 'claude-haiku'],
    [/gpt[-_]?4o/i, 'GPT-4o', 'gpt-4o'],
    [/gpt[-_]?4/i, 'GPT-4', 'gpt-4'],
    [/gpt[-_]?3\.5/i, 'GPT-3.5 Turbo', 'gpt-3.5'],
    [/gemini[-_]?1\.5[-_]?pro/i, 'Gemini 1.5 Pro', 'gemini-pro'],
    [/gemini[-_]?flash/i, 'Gemini Flash', 'gemini-flash'],
    [/llama[-_]?3/i, 'Llama 3', 'llama3'],
    [/mistral/i, 'Mistral', 'mistral'],
    [/deepseek/i, 'DeepSeek', 'deepseek'],
]

const API_PATTERNS: [RegExp, string, string][] = [
    [/anthropic/i, 'Anthropic API', 'https://api.anthropic.com'],
    [/openai/i, 'OpenAI API', 'https://api.openai.com'],
    [/googleapis|google\.generativeai/i, 'Google AI API', 'https://generativelanguage.googleapis.com'],
    [/GROQ_API_KEY|groq\.com/i, 'Groq API', 'https://api.groq.com'],
    [/GITHUB_TOKEN|api\.github\.com/i, 'GitHub API', 'https://api.github.com'],
    [/SLACK_|slack\.com\/api/i, 'Slack API', 'https://slack.com/api'],
    [/JIRA_|atlassian\.net/i, 'Jira API', 'https://atlassian.net'],
    [/STRIPE_|stripe\.com/i, 'Stripe API', 'https://api.stripe.com'],
]

const MEMORY_PATTERNS: [RegExp, string, string][] = [
    [/chromadb|chroma/i, 'ChromaDB', 'Vector store (ChromaDB)'],
    [/pinecone/i, 'Pinecone', 'Vector store (Pinecone)'],
    [/qdrant/i, 'Qdrant', 'Vector store (Qdrant)'],
    [/weaviate/i, 'Weaviate', 'Vector store (Weaviate)'],
    [/redis/i, 'Redis', 'Cache/memory (Redis)'],
    [/sqlite|better-sqlite/i, 'SQLite', 'Database (SQLite)'],
    [/mem0|memory-store/i, 'Mem0', 'Persistent memory (Mem0)'],
    [/zep\.ai|zep_python/i, 'Zep', 'Long-term memory (Zep)'],
]

const TOOL_PATTERNS: [RegExp, string][] = [
    [/computer_use|computer_tool/i, 'ComputerUse'],
    [/web_search|browser_use|BrowserUseTool/i, 'WebSearch'],
    [/read_file|ReadFileTool|read_file_tool/i, 'ReadFile'],
    [/write_file|WriteFileTool/i, 'WriteFile'],
    [/bash_tool|BashTool|run_bash/i, 'Bash'],
    [/code_interpreter|PythonREPL/i, 'CodeInterpreter'],
    [/send_email|EmailTool/i, 'Email'],
    [/calendar_tool|CalendarTool/i, 'Calendar'],
    [/search_tool|SearchTool|DuckDuckGo/i, 'Search'],
    [/github_tool|GitHubTool/i, 'GitHub'],
]

const PROMPT_NAME_PATTERNS = [
    /^CLAUDE\.(md|txt)$/i,
    /^SYSTEM\.(md|txt)$/i,
    /^system_prompt\.(md|txt)$/i,
    /^instructions?\.(md|txt)$/i,
    /^README\.md$/i,
    /^AGENTS?\.(md|txt)$/i,
]

const PROMPT_DIR_PATTERNS = [
    /^prompts?$/i,
    /^instructions?$/i,
    /^system$/i,
    /^context$/i,
    /^\.claude$/i,
]

/** Directories that contain workflow/skill definitions */
const WORKFLOW_DIR_PATTERNS = [
    /^workflows?$/i,
    /^skills?$/i,
    /^tasks?$/i,
    /^routines?$/i,
]

/** Important config file names */
const CONFIG_FILE_NAMES = new Set([
    'package.json', 'tsconfig.json', 'tsconfig.node.json', 'tsconfig.web.json',
    'pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg',
    'electron.vite.config.ts', 'vite.config.ts', 'vite.config.js',
    'next.config.js', 'next.config.ts', 'next.config.mjs',
    'webpack.config.js', 'rollup.config.js',
    'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    'Makefile', '.prettierrc', '.eslintrc.json', '.eslintrc.js',
    'jest.config.ts', 'jest.config.js', 'vitest.config.ts',
])

const KNOWLEDGE_EXTENSIONS = new Set(['md', 'mdx', 'markdown', 'txt', 'rst'])
const SOURCE_ROLE_DIRS = new Set(['raw', 'source', 'sources', 'clips', 'transcripts', 'inbox'])
const WIKI_ROLE_DIRS = new Set(['wiki', 'notes', 'concepts', 'entities', 'decisions', 'projects'])
const OUTPUT_ROLE_DIRS = new Set(['outputs', 'deliverables', 'reports', 'drafts'])
const INDEX_FILE_NAMES = new Set(['index.md', '_index.md'])

interface ParsedFrontmatter {
    title?: string
    tags: string[]
    aliases: string[]
    sources: string[]
    created?: string
    updated?: string
    status?: string
}

interface KnowledgeFile {
    file: FileInfo
    content: string
    frontmatter: ParsedFrontmatter
    type: KosmosNode['type']
    node: KosmosNode
}

function normalizeRelPath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+/g, '/')
}

function pathParts(rel: string): string[] {
    return normalizeRelPath(rel).split('/').filter(Boolean)
}

function stripKnowledgeExtension(path: string): string {
    return normalizeRelPath(path).replace(/\.(md|mdx|markdown|txt|rst)$/i, '')
}

function titleFromFile(file: FileInfo, frontmatter?: ParsedFrontmatter): string {
    if (frontmatter?.title) return frontmatter.title
    return file.name
        .replace(/\.(md|mdx|markdown|txt|rst)$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
}

function isInstructionFile(file: FileInfo): boolean {
    const rel = normalizeRelPath(file.rel)
    const lower = rel.toLowerCase()
    return /^agents?\.(md|txt)$/i.test(file.name)
        || /^claude\.(md|txt)$/i.test(file.name)
        || lower.startsWith('.cursor/rules/')
        || lower.startsWith('.claude/')
        || /(^|\/)skill\.md$/i.test(rel)
}

function classifyKnowledgeFile(file: FileInfo, isMarkdownVault: boolean): KosmosNode['type'] {
    const rel = normalizeRelPath(file.rel)
    const parts = pathParts(rel)
    const first = parts[0]?.toLowerCase()
    const lowerName = file.name.toLowerCase()

    if (INDEX_FILE_NAMES.has(lowerName) || (lowerName === 'readme.md' && parts.length > 1)) return 'index_file'
    if (isInstructionFile(file)) return 'instruction_file'
    if (first && SOURCE_ROLE_DIRS.has(first)) return 'source_doc'
    if (first && WIKI_ROLE_DIRS.has(first)) return 'wiki_page'
    if (first && OUTPUT_ROLE_DIRS.has(first)) return 'output_artifact'
    if (isMarkdownVault && KNOWLEDGE_EXTENSIONS.has(file.ext)) return 'wiki_page'
    return 'file'
}

function parseScalar(value: string): string {
    return value.trim().replace(/^['"]|['"]$/g, '')
}

function parseListValue(value: string): string[] {
    const trimmed = value.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return trimmed.slice(1, -1).split(',').map(parseScalar).filter(Boolean)
    }
    return [parseScalar(trimmed)].filter(Boolean)
}

function parseFrontmatter(content: string): ParsedFrontmatter {
    const empty: ParsedFrontmatter = { tags: [], aliases: [], sources: [] }
    if (!content.startsWith('---\n')) return empty
    const end = content.indexOf('\n---', 4)
    if (end < 0) return empty

    const lines = content.slice(4, end).split('\n')
    const parsed: ParsedFrontmatter = { tags: [], aliases: [], sources: [] }
    let activeList: 'tags' | 'aliases' | 'sources' | undefined

    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const listItem = line.match(/^-\s+(.+)$/)
        if (listItem && activeList) {
            parsed[activeList].push(parseScalar(listItem[1]))
            continue
        }

        const match = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/)
        if (!match) continue
        const key = match[1].toLowerCase()
        const value = match[2] ?? ''
        activeList = undefined

        if (key === 'title') parsed.title = parseScalar(value)
        else if (key === 'tag' || key === 'tags') {
            parsed.tags.push(...parseListValue(value))
            if (!value.trim()) activeList = 'tags'
        } else if (key === 'alias' || key === 'aliases') {
            parsed.aliases.push(...parseListValue(value))
            if (!value.trim()) activeList = 'aliases'
        } else if (key === 'source' || key === 'sources') {
            parsed.sources.push(...parseListValue(value))
            if (!value.trim()) activeList = 'sources'
        } else if (key === 'created') parsed.created = parseScalar(value)
        else if (key === 'updated') parsed.updated = parseScalar(value)
        else if (key === 'status') parsed.status = parseScalar(value)
    }

    parsed.tags = Array.from(new Set(parsed.tags.filter(Boolean)))
    parsed.aliases = Array.from(new Set(parsed.aliases.filter(Boolean)))
    parsed.sources = Array.from(new Set(parsed.sources.filter(Boolean)))
    return parsed
}

interface ParsedLink {
    target: string
    label?: string
    heading?: string
    embed?: boolean
    external?: boolean
    raw: string
}

function splitTargetAndHeading(target: string): { target: string; heading?: string } {
    const [path, ...headingParts] = target.split('#')
    return { target: path.trim(), heading: headingParts.length > 0 ? headingParts.join('#').trim() : undefined }
}

function extractKnowledgeLinks(content: string): ParsedLink[] {
    const links: ParsedLink[] = []
    const wikilinkRe = /(!)?\[\[([^\]]+)\]\]/g
    let match: RegExpExecArray | null
    while ((match = wikilinkRe.exec(content)) !== null) {
        const [targetWithMaybeAlias, alias] = match[2].split('|')
        const targetInfo = splitTargetAndHeading(targetWithMaybeAlias)
        if (!targetInfo.target) continue
        links.push({
            target: targetInfo.target,
            label: alias?.trim(),
            heading: targetInfo.heading,
            embed: match[1] === '!',
            raw: match[0],
        })
    }

    const mdLinkRe = /!?\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g
    while ((match = mdLinkRe.exec(content)) !== null) {
        const target = match[2].trim()
        if (!target || /^(https?:|mailto:|tel:)/i.test(target)) {
            links.push({ target, label: match[1], external: true, raw: match[0] })
            continue
        }
        const targetInfo = splitTargetAndHeading(decodeURIComponent(target))
        if (!targetInfo.target) continue
        links.push({
            target: targetInfo.target,
            label: match[1],
            heading: targetInfo.heading,
            embed: match[0].startsWith('!'),
            raw: match[0],
        })
    }

    return links
}

function extractInstructionPathRefs(content: string): string[] {
    const refs = new Set<string>()
    const pathLike = /(?:^|[\s(["'`])((?:\.{1,2}\/|\/)?(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+(?:\.[A-Za-z0-9]+)?|(?:AGENTS|CLAUDE|README)\.(?:md|txt)|\.cursor\/rules\/[A-Za-z0-9_./-]+|\.claude\/[A-Za-z0-9_./-]+)/g
    let match: RegExpExecArray | null
    while ((match = pathLike.exec(content)) !== null) {
        const value = match[1]?.trim().replace(/[),.;:'"`\]]+$/g, '')
        if (!value || value.startsWith('http')) continue
        refs.add(value)
    }
    return Array.from(refs)
}

function looksLikeMarkdownVault(files: FileInfo[], hasObsidianDir: boolean): {
    isMarkdownVault: boolean
    isObsidianVault: boolean
    hasRawWikiOutputs: boolean
    detectedConventions: string[]
} {
    const rels = new Set(files.map(f => normalizeRelPath(f.rel)))
    const dirs = new Set(files.flatMap(f => pathParts(f.rel).slice(0, -1)))
    const markdownCount = files.filter(f => KNOWLEDGE_EXTENSIONS.has(f.ext)).length
    const fileRatio = files.length > 0 ? markdownCount / files.length : 0
    const isObsidianVault = hasObsidianDir || dirs.has('.obsidian')
    const hasRawWikiOutputs = ['raw', 'wiki', 'outputs'].every(dir => dirs.has(dir) || rels.has(`${dir}/index.md`))
    const hasInstructionFile = files.some(isInstructionFile)
    const detectedConventions: string[] = []
    if (isObsidianVault) detectedConventions.push('obsidian')
    if (hasRawWikiOutputs) detectedConventions.push('raw-wiki-outputs')
    if (fileRatio >= 0.35 && markdownCount >= 4) detectedConventions.push('markdown-heavy')
    if (hasInstructionFile) detectedConventions.push('agent-instructions')

    return {
        isMarkdownVault: isObsidianVault || hasRawWikiOutputs || fileRatio >= 0.35 || (hasInstructionFile && markdownCount >= 3),
        isObsidianVault,
        hasRawWikiOutputs,
        detectedConventions,
    }
}

function resolveLocalLink(args: {
    fromRel: string
    target: string
    pathIndex: Map<string, KosmosNode>
    aliasIndex: Map<string, KosmosNode>
}): KosmosNode | undefined {
    const rawTarget = args.target.trim().replace(/^\.\/+/, '')
    if (!rawTarget || rawTarget.startsWith('#')) return undefined
    const cleanTarget = rawTarget.replace(/\\/g, '/')
    const candidates: string[] = []

    if (cleanTarget.startsWith('/')) {
        candidates.push(cleanTarget.replace(/^\/+/, ''))
    } else if (cleanTarget.startsWith('../') || cleanTarget.startsWith('./')) {
        candidates.push(normalizeRelPath(join(dirname(args.fromRel), cleanTarget)))
    } else if (cleanTarget.includes('/')) {
        candidates.push(normalizeRelPath(cleanTarget))
        candidates.push(normalizeRelPath(join(dirname(args.fromRel), cleanTarget)))
    } else {
        const byAlias = args.aliasIndex.get(cleanTarget.toLowerCase())
        if (byAlias) return byAlias
        candidates.push(normalizeRelPath(join(dirname(args.fromRel), cleanTarget)))
        candidates.push(cleanTarget)
    }

    const expanded = candidates.flatMap(candidate => {
        const withoutExt = stripKnowledgeExtension(candidate)
        return [
            candidate,
            `${withoutExt}.md`,
            `${withoutExt}.mdx`,
            `${withoutExt}.markdown`,
            `${withoutExt}.txt`,
            `${withoutExt}.rst`,
        ]
    })

    for (const candidate of expanded) {
        const node = args.pathIndex.get(normalizeRelPath(candidate).toLowerCase())
        if (node) return node
    }

    return undefined
}

// ── Import extractor ──────────────────────────────────────────────────────────

/**
 * Extract all import specifiers from a source file.
 * Returns raw specifiers — e.g. './utils', 'anthropic', 'langchain/agents'.
 */
function extractImports(filePath: string, content: string): string[] {
    const specs: string[] = []

    if (filePath.endsWith('.py')) {
        // "from X import Y" → X  |  "import X" → X
        const re = /^(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm
        let m: RegExpExecArray | null
        while ((m = re.exec(content)) !== null) {
            const spec = m[1] || m[2]
            if (!spec) continue
            if (spec.startsWith('.')) {
                // Relative import: convert Python dot notation to a path-like spec
                // ".utils" → "./utils",  "..common" → "../common"
                const leadingDots = spec.match(/^(\.+)/)?.[1] ?? '.'
                const rest = spec.slice(leadingDots.length).replace(/\./g, '/')
                const prefix = leadingDots.length === 1 ? './' : '../'.repeat(leadingDots.length - 1)
                if (rest) specs.push(prefix + rest)
            } else {
                const raw = spec.split('.')[0]  // top-level package only
                if (raw) specs.push(raw)
            }
        }
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath)) {
        // import ... from 'Y'  |  require('Y')  |  import('Y')
        const re = /(?:from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*\(\s*['"]([^'"]+)['"]\s*\))/g
        let m: RegExpExecArray | null
        while ((m = re.exec(content)) !== null) {
            const spec = m[1] || m[2] || m[3]
            if (spec) specs.push(spec)
        }
    }

    return specs
}

// ── Main Scanner ──────────────────────────────────────────────────────────────

export async function scanWorkspace(
    workspaceId: string,
    wsPath:      string
): Promise<{ nodes: KosmosNode[]; edges: KosmosEdge[]; files: ScanFileSnapshot[]; meta: Record<string, unknown> }> {
    const files = await walkDir(wsPath)

    const nodeMap = new Map<string, KosmosNode>()
    const edgeSet  = new Set<string>()
    const edges:   KosmosEdge[] = []
    const scanFileSnapshots = new Map<string, ScanFileSnapshot>()

    const addNode = (n: KosmosNode) => {
        const existing = nodeMap.get(n.id)
        if (!existing) {
            nodeMap.set(n.id, n)
            return
        }
        nodeMap.set(n.id, {
            ...existing,
            ...n,
            confidence: Math.max(existing.confidence, n.confidence),
            tags: Array.from(new Set([...(existing.tags ?? []), ...(n.tags ?? [])])),
            paths: Array.from(new Set([...(existing.paths ?? []), ...(n.paths ?? [])])),
            description: existing.description ?? n.description,
            createdAt: Math.min(existing.createdAt, n.createdAt),
            updatedAt: Math.max(existing.updatedAt, n.updatedAt),
            meta: { ...(existing.meta ?? {}), ...(n.meta ?? {}) },
        })
    }
    const addEdge = (e: KosmosEdge) => {
        if (!edgeSet.has(e.id)) { edgeSet.add(e.id); edges.push(e) }
    }

    // ── Collect directory names for module nodes ──────────────────────────────
    const topLevelDirs = new Set<string>()
    for (const f of files) {
        const parts = f.rel.split('/')
        if (parts.length >= 2) topLevelDirs.add(parts[0])
    }

    // ── Detector A: Prompt files ──────────────────────────────────────────────
    const promptNodes: KosmosNode[] = []
    for (const f of files) {
        if (!['md', 'txt', 'rst'].includes(f.ext)) continue

        const isNameMatch  = PROMPT_NAME_PATTERNS.some(p => p.test(f.name))
        const isInPromptDir = PROMPT_DIR_PATTERNS.some(p => p.test(f.rel.split('/')[0]))
        if (!isNameMatch && !isInPromptDir) continue

        const content = await readText(f.path)
        const label   = f.name.replace(/\.(md|txt|rst)$/i, '')
        const snippet = content.slice(0, 200).replace(/\n+/g, ' ').trim()

        // Instruction file analysis
        const charCount = content.length
        const estimatedTokens = Math.ceil(charCount / 4)
        const lineCount = content.split('\n').length
        const sectionCount = (content.match(/^#{1,3}\s/gm) || []).length
        const antiPatterns: string[] = []
        if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(content)) antiPatterns.push('stale_markers')
        if ((content.match(/^(\s*#|\/\/)\s/gm) || []).length > lineCount * 0.15) antiPatterns.push('excessive_comments')
        if (sectionCount === 0 && lineCount > 50) antiPatterns.push('no_structure')
        if (content.split('\n').some(line => line.length > 500)) antiPatterns.push('wall_of_text')
        if (estimatedTokens > 6000) antiPatterns.push('very_long')
        else if (estimatedTokens > 3000) antiPatterns.push('long')
        if (!/\b(index|map|where to save|where to look|folder|directory|raw\/|wiki\/|outputs\/)\b/i.test(content)) antiPatterns.push('missing_navigation')
        const paragraphs = content.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 50)
        const seen = new Set<string>()
        for (const p of paragraphs) {
            if (seen.has(p)) { antiPatterns.push('duplicate_content'); break }
            seen.add(p)
        }
        const referencedPaths = isInstructionFile(f) ? extractInstructionPathRefs(content) : []

        const nodeType: KosmosNode['type'] = isInstructionFile(f) ? 'instruction_file' : 'prompt'
        const n = makeNode(workspaceId, nodeType, label, {
            description: snippet || `Prompt file: ${f.rel}`,
            paths: [f.rel],
            confidence: isNameMatch ? 0.92 : 0.72,
            meta: {
                path: f.rel, size: f.size, chars: content.length,
                instructionAnalysis: { charCount, estimatedTokens, lineCount, sectionCount, antiPatterns, referencedPaths }
            }
        })
        addNode(n)
        promptNodes.push(n)
    }

    // ── Detector A.2: Local context / Markdown vault files ───────────────────
    const hasObsidianDir = await stat(join(wsPath, '.obsidian')).then(s => s.isDirectory()).catch(() => false)
    const vaultInfo = looksLikeMarkdownVault(files, hasObsidianDir)
    const knowledgeFiles = files.filter(f => KNOWLEDGE_EXTENSIONS.has(f.ext))
    const knowledgeByRel = new Map<string, KnowledgeFile>()
    const pathIndex = new Map<string, KosmosNode>()
    const aliasIndex = new Map<string, KosmosNode>()

    for (const f of knowledgeFiles) {
        const content = await readText(f.path)
        const frontmatter = parseFrontmatter(content)
        const nodeType = classifyKnowledgeFile(f, vaultInfo.isMarkdownVault)
        scanFileSnapshots.set(normalizeRelPath(f.rel), {
            path: normalizeRelPath(f.rel),
            kind: nodeType,
            contentHash: hashContent(content),
            mtimeMs: f.mtimeMs,
            size: f.size,
            meta: { ext: f.ext, frontmatter },
        })
        if (nodeType === 'file' && !vaultInfo.isMarkdownVault && !isInstructionFile(f)) continue

        const title = titleFromFile(f, frontmatter)
        const rel = normalizeRelPath(f.rel)
        const tags = Array.from(new Set([
            ...frontmatter.tags,
            nodeType === 'source_doc' ? 'source' : '',
            nodeType === 'wiki_page' ? 'wiki' : '',
            nodeType === 'output_artifact' ? 'output' : '',
            nodeType === 'instruction_file' ? 'instruction' : '',
            nodeType === 'index_file' ? 'index' : '',
        ].filter(Boolean)))

        const n = makeNode(workspaceId, nodeType, title, {
            paths: [rel],
            confidence: nodeType === 'file' ? 0.55 : 0.88,
            description: `${nodeType.replace(/_/g, ' ')}: ${rel}`,
            tags,
            createdAt: f.mtimeMs,
            updatedAt: f.mtimeMs,
            meta: {
                path: rel,
                size: f.size,
                role: nodeType,
                frontmatter,
                contextSystem: vaultInfo,
            }
        })
        addNode(n)

        const entry: KnowledgeFile = { file: f, content, frontmatter, type: nodeType, node: n }
        knowledgeByRel.set(rel, entry)

        pathIndex.set(rel.toLowerCase(), n)
        pathIndex.set(stripKnowledgeExtension(rel).toLowerCase(), n)
        aliasIndex.set(title.toLowerCase(), n)
        aliasIndex.set(stripKnowledgeExtension(basename(rel)).toLowerCase(), n)
        for (const alias of frontmatter.aliases) aliasIndex.set(alias.toLowerCase(), n)
    }

    const unresolvedNodes = new Map<string, KosmosNode>()
    const getUnresolvedNode = (target: string): KosmosNode => {
        const key = target.toLowerCase()
        const existing = unresolvedNodes.get(key)
        if (existing) return existing
        const n = makeNode(workspaceId, 'unresolved_link', target, {
            confidence: 1,
            description: `Unresolved local link: ${target}`,
            tags: ['broken-link'],
            meta: { target, healthFinding: 'broken_link' },
        })
        unresolvedNodes.set(key, n)
        addNode(n)
        return n
    }

    const chooseContextEdgeType = (from: KosmosNode, to: KosmosNode): KosmosEdge['type'] => {
        if (from.type === 'output_artifact' && (to.type === 'wiki_page' || to.type === 'source_doc')) return 'derived_from'
        if (to.type === 'source_doc') return 'cites'
        if (from.type === 'index_file') return 'indexes'
        if (from.type === 'instruction_file') return 'documents'
        return 'links_to'
    }

    for (const entry of knowledgeByRel.values()) {
        const frontmatterSources = entry.frontmatter.sources
        for (const sourcePath of frontmatterSources) {
            const target = resolveLocalLink({
                fromRel: entry.file.rel,
                target: sourcePath,
                pathIndex,
                aliasIndex,
            }) ?? getUnresolvedNode(sourcePath)
            const edgeType: KosmosEdge['type'] = target.type === 'unresolved_link'
                ? 'links_to'
                : entry.type === 'output_artifact'
                    ? 'derived_from'
                    : 'cites'
            addEdge(makeEdge(workspaceId, edgeType, entry.node, target, {
                reason: `Frontmatter source reference from ${entry.file.rel}`,
                file: entry.file.rel,
                rule: 'frontmatter source/sources',
            }))
        }

        for (const link of extractKnowledgeLinks(entry.content)) {
            if (link.external) continue
            const target = resolveLocalLink({
                fromRel: entry.file.rel,
                target: link.target,
                pathIndex,
                aliasIndex,
            }) ?? getUnresolvedNode(link.target)
            addEdge(makeEdge(workspaceId, chooseContextEdgeType(entry.node, target), entry.node, target, {
                reason: target.type === 'unresolved_link'
                    ? `Broken local link from ${entry.file.rel}`
                    : `Local context link from ${entry.file.rel}`,
                file: entry.file.rel,
                rule: link.raw.startsWith('[[') || link.raw.startsWith('![[') ? 'wikilink' : 'markdown-link',
                snippet: link.raw,
            }))
            const edge = edges[edges.length - 1]
            if (edge?.fromId === entry.node.id && edge.toId === target.id) {
                edge.meta = {
                    ...edge.meta,
                    heading: link.heading,
                    alias: link.label,
                    embed: link.embed === true,
                    unresolved: target.type === 'unresolved_link',
                }
            }
        }
    }

    // ── Detector B+C: Agent + Tool detection from source files ────────────────
    const foundModels   = new Map<string, KosmosNode>()
    const foundAPIs     = new Map<string, KosmosNode>()
    const foundMemory   = new Map<string, KosmosNode>()
    const foundTools    = new Map<string, KosmosNode>()
    const agentNodes:    KosmosNode[] = []
    // Cache file contents so we don't re-read files during edge building
    const contentCache  = new Map<string, string>()  // rel path → content

    const sourceFiles = files.filter(f => ['py', 'ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml', 'toml'].includes(f.ext))

    for (const f of sourceFiles) {
        const content = await readText(f.path)
        const rel = normalizeRelPath(f.rel)
        if (!scanFileSnapshots.has(rel)) {
            scanFileSnapshots.set(rel, {
                path: rel,
                kind: CONFIG_FILE_NAMES.has(f.name) ? 'config' : 'source',
                contentHash: hashContent(content),
                mtimeMs: f.mtimeMs,
                size: f.size,
                meta: { ext: f.ext },
            })
        }
        contentCache.set(f.rel, content)  // cache for later import tracing
        const lower   = content.toLowerCase()

        // -- Agent detection (Python) -----------------------------------------
        if (f.ext === 'py') {
            // class FooAgent(Agent): or class FooAgent(BaseAgent):
            const agentClassMatches = Array.from(content.matchAll(/class\s+(\w*[Aa]gent\w*)\s*\(/g))
            for (const m of agentClassMatches) {
                const name = m[1]
                const n = makeNode(workspaceId, 'agent', name, {
                    paths: [f.rel],
                    confidence: 0.82,
                    description: `Agent class defined in ${f.rel}`,
                    meta: { path: f.rel, language: 'python' }
                })
                addNode(n)
                agentNodes.push(n)
            }

            // @agent decorator from crewai/autogen
            const agentDecMatches = Array.from(content.matchAll(/@agent\s*\ndef\s+(\w+)/g))
            for (const m of agentDecMatches) {
                const name = m[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                const n = makeNode(workspaceId, 'agent', name, {
                    paths: [f.rel], confidence: 0.85,
                    description: `Agent function in ${f.rel}`, meta: { path: f.rel, language: 'python' }
                })
                addNode(n); agentNodes.push(n)
            }

            // role="..." in Agent(...) call (crewai style)
            const roleMatches = Array.from(content.matchAll(/Agent\s*\([^)]*role\s*=\s*["']([^"']{3,60})["']/g))
            for (const m of roleMatches) {
                const name = m[1]
                const n = makeNode(workspaceId, 'agent', name, {
                    paths: [f.rel], confidence: 0.88,
                    description: `CrewAI agent: ${name}`, meta: { path: f.rel, language: 'python', framework: 'crewai' }
                })
                addNode(n); agentNodes.push(n)
            }
        }

        // -- Agent detection (JS/TS) ------------------------------------------
        if (['ts', 'tsx', 'js', 'jsx'].includes(f.ext)) {
            const agentClassTs = Array.from(content.matchAll(/class\s+(\w*[Aa]gent\w*)\s*(?:extends\s+\w+\s*)?\{/g))
            for (const m of agentClassTs) {
                const name = m[1]
                const n = makeNode(workspaceId, 'agent', name, {
                    paths: [f.rel], confidence: 0.80,
                    description: `Agent class in ${f.rel}`, meta: { path: f.rel, language: 'typescript' }
                })
                addNode(n); agentNodes.push(n)
            }

            // const myAgent = new Agent(...) or createAgent(...)
            const agentVarTs = Array.from(content.matchAll(/(?:const|let)\s+(\w+Agent\w*)\s*=/g))
            for (const m of agentVarTs) {
                const name = m[1].replace(/([A-Z])/g, ' $1').trim()
                const n = makeNode(workspaceId, 'agent', name, {
                    paths: [f.rel], confidence: 0.65,
                    description: `Agent variable in ${f.rel}`, meta: { path: f.rel, language: 'typescript' }
                })
                addNode(n); agentNodes.push(n)
            }
        }

        // -- Tool detection ---------------------------------------------------
        for (const [pattern, toolName] of TOOL_PATTERNS) {
            if (!pattern.test(content)) continue
            if (!foundTools.has(toolName)) {
                const n = makeNode(workspaceId, 'tool', toolName, {
                    paths: [f.rel], confidence: 0.70,
                    description: `Tool referenced in ${f.rel}`, meta: { foundIn: [f.rel] }
                })
                foundTools.set(toolName, n); addNode(n)
            } else {
                // Add this path to meta
                const existing = foundTools.get(toolName)!
                const meta = existing.meta as Record<string, unknown>
                const fi = (meta.foundIn as string[]) || []
                if (!fi.includes(f.rel)) fi.push(f.rel)
            }
        }

        // -- Model detection --------------------------------------------------
        for (const [pattern, displayName, key] of MODEL_PATTERNS) {
            if (!pattern.test(content)) continue
            if (!foundModels.has(key)) {
                const provider = key.startsWith('claude') ? 'Anthropic' :
                                 key.startsWith('gpt') ? 'OpenAI' :
                                 key.startsWith('gemini') ? 'Google' : 'Other'
                const n = makeNode(workspaceId, 'model', displayName, {
                    confidence: 0.85,
                    description: `${provider} model referenced in workspace`,
                    meta: { provider, foundIn: f.rel }
                })
                foundModels.set(key, n); addNode(n)
            }
        }

        // -- API detection ----------------------------------------------------
        for (const [pattern, apiName, baseUrl] of API_PATTERNS) {
            if (!pattern.test(content)) continue
            if (!foundAPIs.has(apiName)) {
                const n = makeNode(workspaceId, 'api', apiName, {
                    confidence: 0.80,
                    description: `API referenced in workspace`,
                    meta: { baseUrl, foundIn: f.rel }
                })
                foundAPIs.set(apiName, n); addNode(n)
            }
        }

        // -- Memory/store detection -------------------------------------------
        for (const [pattern, storeName, desc] of MEMORY_PATTERNS) {
            if (!pattern.test(lower)) continue
            if (!foundMemory.has(storeName)) {
                const n = makeNode(workspaceId, 'memory_store', storeName, {
                    confidence: 0.72,
                    description: desc,
                    meta: { foundIn: f.rel }
                })
                foundMemory.set(storeName, n); addNode(n)
            }
        }
    }

    // ── Detector D: package.json / pyproject.toml (dependency analysis) ────────
    const depFiles = files.filter(f =>
        f.name === 'package.json' || f.name === 'pyproject.toml' || f.name === 'requirements.txt'
    )
    for (const f of depFiles) {
        const content = await readText(f.path)
        // Re-run model + API + memory detectors on deps file
        for (const [pattern, displayName, key] of MODEL_PATTERNS) {
            if (pattern.test(content) && !foundModels.has(key)) {
                const n = makeNode(workspaceId, 'model', displayName, {
                    confidence: 0.70,
                    description: `Model dependency in ${f.name}`,
                    meta: { foundIn: f.rel }
                })
                foundModels.set(key, n); addNode(n)
            }
        }
        for (const [pattern, apiName, baseUrl] of API_PATTERNS) {
            if (pattern.test(content) && !foundAPIs.has(apiName)) {
                const n = makeNode(workspaceId, 'api', apiName, {
                    confidence: 0.70, description: `API dependency in ${f.name}`,
                    meta: { baseUrl, foundIn: f.rel }
                })
                foundAPIs.set(apiName, n); addNode(n)
            }
        }
        for (const [pattern, storeName, desc] of MEMORY_PATTERNS) {
            if (pattern.test(content.toLowerCase()) && !foundMemory.has(storeName)) {
                const n = makeNode(workspaceId, 'memory_store', storeName, {
                    confidence: 0.72, description: desc, meta: { foundIn: f.rel }
                })
                foundMemory.set(storeName, n); addNode(n)
            }
        }
    }

    // ── Detector E: .env / .env.example files ─────────────────────────────────
    const envFiles = files.filter(f => f.name.startsWith('.env') || f.name === 'env.example')
    for (const f of envFiles) {
        const content = await readText(f.path)
        for (const line of content.split('\n')) {
            const key = line.split('=')[0].trim()
            for (const [pattern, apiName, baseUrl] of API_PATTERNS) {
                if (pattern.test(key) && !foundAPIs.has(apiName)) {
                    const n = makeNode(workspaceId, 'api', apiName, {
                        confidence: 0.88,  // env var = high confidence
                        description: `API configured via ${key} environment variable`,
                        meta: { baseUrl, envKey: key, foundIn: f.rel }
                    })
                    foundAPIs.set(apiName, n); addNode(n)
                }
            }
        }
    }

    // ── Detector F: Module nodes (top-level source directories) ───────────────
    const moduleNodes: KosmosNode[] = []
    const interestingDirs = [
        'src', 'agents', 'tools', 'prompts', 'lib', 'core', 'workflows', 'tasks',
        'scripts', 'utils', 'services', 'components', 'api',
        '.claude', '.agent', '.agents', '.github', 'skills'
    ]
    for (const dir of Array.from(topLevelDirs)) {
        if (!interestingDirs.includes(dir.toLowerCase())) continue
        const n = makeNode(workspaceId, 'module', dir + '/', {
            paths: [dir],
            confidence: 0.90,
            description: `Source module directory: ${dir}/`,
            meta: { dirName: dir }
        })
        addNode(n); moduleNodes.push(n)
    }

    // ── Detector G: Workflow / Skill files ────────────────────────────────────
    for (const f of files) {
        const parts = f.rel.split('/')
        if (parts.length < 2) continue
        const parentDir = parts[parts.length - 2]
        const isWorkflowDir = WORKFLOW_DIR_PATTERNS.some(p => p.test(parentDir))
        if (!isWorkflowDir) continue

        const content = await readText(f.path)
        const label = f.name.replace(/\.(md|txt|yaml|yml|json)$/i, '')
        const snippet = content.slice(0, 200).replace(/\n+/g, ' ').trim()

        const n = makeNode(workspaceId, 'tool', label, {
            paths: [f.rel],
            confidence: 0.78,
            description: snippet || `Workflow/skill: ${f.rel}`,
            tags: ['workflow'],
            meta: { path: f.rel, size: f.size, parentDir }
        })
        addNode(n)
    }

    // ── Detector H: Config files ─────────────────────────────────────────────
    for (const f of files) {
        if (!CONFIG_FILE_NAMES.has(f.name)) continue
        const content = await readText(f.path)
        const snippet = content.slice(0, 150).replace(/\n+/g, ' ').trim()

        const n = makeNode(workspaceId, 'file', f.name, {
            paths: [f.rel],
            confidence: 0.95,
            description: `Configuration file: ${f.rel}`,
            tags: ['config'],
            meta: { path: f.rel, size: f.size, preview: snippet }
        })
        addNode(n)
    }

    // ── Detector I: IPC / API handlers (Electron-style) ──────────────────────
    for (const f of sourceFiles) {
        const content = contentCache.get(f.rel) ?? await readText(f.path)
        // Detect ipcMain.handle('channel:name', ...) patterns
        const handleMatches = Array.from(content.matchAll(/ipcMain\.handle\s*\(\s*['"]([\w:.-]+)['"]/g))
        for (const m of handleMatches) {
            const channel = m[1]
            const handlerName = channel.replace(/:/g, ' → ')
            const n = makeNode(workspaceId, 'tool', handlerName, {
                paths: [f.rel],
                confidence: 0.92,
                description: `IPC handler: ${channel} (defined in ${f.rel})`,
                tags: ['ipc', 'handler'],
                meta: { channel, path: f.rel, language: f.ext }
            })
            addNode(n)
        }

        // Detect Express/Fastify route handlers
        const routeMatches = Array.from(content.matchAll(/\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi))
        for (const m of routeMatches) {
            const method = m[1].toUpperCase()
            const route = m[2]
            const n = makeNode(workspaceId, 'api', `${method} ${route}`, {
                paths: [f.rel],
                confidence: 0.75,
                description: `HTTP endpoint: ${method} ${route} (in ${f.rel})`,
                tags: ['endpoint', 'http'],
                meta: { method, route, path: f.rel }
            })
            addNode(n)
        }
    }

    // ── Detector E.2: Claude Code Special Case ───────────────────────────────
    let claudeAgentNode: KosmosNode | undefined
    if (wsPath.endsWith('.claude')) {
        claudeAgentNode = makeNode(workspaceId, 'agent', 'Claude Code', {
            paths: ['.'],
            confidence: 1.0,
            description: 'Anthropic Claude Code CLI Agent Engine',
            tags: ['cli', 'anthropic'],
            meta: { language: 'typescript' }
        })
        addNode(claudeAgentNode)
        agentNodes.push(claudeAgentNode)
        
        // Add default models that Claude Code uses
        const models = ['Claude Sonnet 4', 'Claude Opus 4', 'Claude Haiku 4']
        let apiNode = foundAPIs.get('Anthropic API')
        if (!apiNode) {
            apiNode = makeNode(workspaceId, 'api', 'Anthropic API', { paths: [], confidence: 1.0, description: 'Anthropic API', meta: {} })
            foundAPIs.set('Anthropic API', apiNode); addNode(apiNode)
        }
        for (const m of models) {
            if (!foundModels.has(m)) {
                const mn = makeNode(workspaceId, 'model', m, { paths: [], confidence: 1.0, description: `Anthropic Model: ${m}`, meta: { provider: 'anthropic' } })
                foundModels.set(m, mn); addNode(mn)
            }
        }
    }

    // ── Detector E.3: OpenHands Special Case ─────────────────────────────────
    let openhandsAgentNode: KosmosNode | undefined
    if (wsPath.toLowerCase().includes('openhands') || wsPath.endsWith('.openhands')) {
        openhandsAgentNode = makeNode(workspaceId, 'agent', 'OpenHands Agent', {
            paths: ['.'],
            confidence: 1.0,
            description: 'OpenHands (formerly OpenDevin) Core Autonomous Agent',
            tags: ['agent', 'openhands'],
            meta: { language: 'python' }
        })
        addNode(openhandsAgentNode)
        agentNodes.push(openhandsAgentNode)
    }

    // ── Detector E.4: Claude Agent Subsession Logs ───────────────────────────
    if (wsPath.endsWith('.claude')) {
        const jsonlFiles = files.filter(f => f.name.endsWith('.jsonl') && f.name.startsWith('agent-'))
        for (const f of jsonlFiles) {
            const content = await readText(f.path)
            const lines = content.split('\n')
            if (lines.length === 0) continue

            const agentName = f.name.replace('.jsonl', '')
            const agentNode = makeNode(workspaceId, 'agent', agentName, {
                paths: [f.rel],
                confidence: 1.0,
                description: `Claude Code Agent Subsession: ${agentName}`,
                tags: ['session', 'claude-code'],
                meta: { size: f.size }
            })
            addNode(agentNode)
            agentNodes.push(agentNode)
            
            const touchedModels = new Set<string>()
            const touchedTools = new Set<string>()
            const touchedFiles = new Set<string>()
            
            for (const line of lines) {
                if (!line.trim()) continue
                try {
                    const data = JSON.parse(line)
                    if (data.message?.model) touchedModels.add(data.message.model)
                    if (data.message?.content) {
                        for (const block of data.message.content) {
                            if (block.type === 'tool_use') {
                                touchedTools.add(block.name)
                                if (block.input?.file_path) touchedFiles.add(block.input.file_path)
                            }
                        }
                    }
                } catch (e) {}
            }
            
            for (const m of touchedModels) {
                let modelNode = foundModels.get(m)
                if (!modelNode) {
                    modelNode = makeNode(workspaceId, 'model', m, { paths: [], confidence: 1.0, description: `Anthropic Model: ${m}`, meta: { provider: 'anthropic' } })
                    foundModels.set(m, modelNode)
                    addNode(modelNode)
                }
                addEdge(makeEdge(workspaceId, 'uses', agentNode, modelNode, { reason: `Session utilized ${m}` }))
            }
            
            for (const t of touchedTools) {
                let toolNode = foundTools.get(t)
                if (!toolNode) {
                    toolNode = makeNode(workspaceId, 'tool', t, { paths: [], confidence: 1.0, description: `Claude Tool: ${t}` })
                    foundTools.set(t, toolNode)
                    addNode(toolNode)
                }
                addEdge(makeEdge(workspaceId, 'calls', agentNode, toolNode, { reason: `Session called ${t}` }))
            }
            
            for (const tFile of touchedFiles) {
                 const fileName = tFile.split('/').pop() || tFile
                 const fileNode = makeNode(workspaceId, 'file', fileName, { paths: [tFile], confidence: 0.9, description: `File accessed by Claude: ${tFile}` })
                 addNode(fileNode)
                 addEdge(makeEdge(workspaceId, 'writes', agentNode, fileNode, { reason: `Claude Tool accessed ${tFile}` }))
            }
        }
    }

    // ── Detector J: Generic Source Files ─────────────────────────────────────
    // To create a dense AST graph, we inject all source files that weren't mapped above
    const mappedPaths = new Set<string>()
    for (const n of Array.from(nodeMap.values())) {
        if (n.paths && n.paths.length > 0) mappedPaths.add(n.paths[0])
    }
    if (wsPath.endsWith('.claude')) {
        files.filter(f => f.name.endsWith('.meta.json')).forEach(f => mappedPaths.add(f.rel))
    }
    
    for (const f of sourceFiles) {
        if (!mappedPaths.has(f.rel)) {
            const n = makeNode(workspaceId, 'file', f.name, {
                paths: [f.rel],
                confidence: 0.3, // Lower confidence for generic files
                description: `Source code file: ${f.rel}`,
                tags: ['source'],
                meta: { path: f.rel, language: f.ext, size: f.size }
            })
            addNode(n)
        }
    }

    // ── Build AST/Dependency graph from findings ──────────────────────────────
    
    const allNodes = Array.from(nodeMap.values())

    // Agent → uses tools (if tool was found in same file as agent, OR if it's Claude Code using a skill)
    for (const agent of agentNodes) {
        const agentPath = (agent.meta as any)?.path as string | undefined
        
        // Specially link CLI Agents to all workflow/skill tools
        if (agent.name === 'Claude Code' || agent.name === 'OpenHands Agent') {
            const workflowTools = allNodes.filter(n => n.type === 'tool' && Array.isArray(n.tags) && n.tags.includes('workflow'))
            for (const tool of workflowTools) {
                addEdge(makeEdge(workspaceId, 'uses', agent, tool, {
                    reason: `${agent.name} acts on skill/workflow "${tool.name}"`,
                    file: (tool.meta as any)?.path,
                    rule: `${agent.name} loads all skills from the workspace directory`,
                }))
            }
        }

        // Normal co-location linking using foundTools map
        for (const [, tool] of Array.from(foundTools)) {
            const toolPaths = (tool.meta as any)?.foundIn as string[] | undefined
            const toolPath = Array.isArray(toolPaths) ? toolPaths[0] : (tool.meta as any)?.foundIn as string | undefined
            
            // Normal co-location linking
            if (agentPath && toolPath && agentPath === toolPath) {
                addEdge(makeEdge(workspaceId, 'uses', agent, tool, {
                    reason: `Tool "${tool.name}" is referenced in the same file as agent "${agent.name}"`,
                    file: agentPath,
                    rule: 'Co-location: tool pattern found in agent source file',
                }))
            }
        }
    }

    // Agent → uses model (only if model keyword appears in that agent's specific file)
    for (const agent of agentNodes) {
        const agentContent = contentCache.get((agent.meta as any)?.path as string ?? '') ?? ''
        for (const [key, model] of Array.from(foundModels)) {
            const keyword = key.replace(/-/g, '[-_]?')
            if (new RegExp(keyword, 'i').test(agentContent)) {
                addEdge(makeEdge(workspaceId, 'uses', agent, model, {
                    reason: `Model "${model.name}" keyword found in agent "${agent.name}" source code`,
                    file: (agent.meta as any)?.path,
                    rule: `Regex match: /${keyword}/i found in agent source`,
                }))
            }
        }
    }

    // Agent → uses prompt (if same path)
    for (const agent of agentNodes) {
        const agentPath = (agent.meta as any)?.path as string | undefined
        for (const prompt of promptNodes) {
            const promptPath = ((prompt.meta as any)?.path as string | undefined)
            if (agentPath && promptPath && agentPath === promptPath) {
                addEdge(makeEdge(workspaceId, 'uses', agent, prompt, {
                    reason: `Prompt "${prompt.name}" is co-located with agent "${agent.name}"`,
                    file: agentPath,
                    rule: 'Co-location: prompt and agent share the same source file',
                }))
            }
        }
    }

    // Agent → reads memory (only if memory package name appears in agent's specific file)
    for (const agent of agentNodes) {
        const agentContent = contentCache.get((agent.meta as any)?.path as string ?? '') ?? ''
        for (const [key, mem] of Array.from(foundMemory)) {
            if (agentContent.toLowerCase().includes(key.toLowerCase())) {
                addEdge(makeEdge(workspaceId, 'reads', agent, mem, {
                    reason: `Memory store "${mem.name}" is referenced in agent "${agent.name}" source code`,
                    file: (agent.meta as any)?.path,
                    rule: `Keyword match: "${key.toLowerCase()}" found in agent source`,
                }))
            }
        }
    }

    // Model → calls API (Anthropic/OpenAI API tied to model)
    for (const [key, model] of Array.from(foundModels)) {
        if (key.startsWith('claude') && foundAPIs.has('Anthropic API')) {
            addEdge(makeEdge(workspaceId, 'calls', model, foundAPIs.get('Anthropic API')!, {
                reason: `Claude model routes through Anthropic API`,
                rule: 'Known vendor mapping: Claude models → Anthropic API',
            }))
        }
        if ((key.startsWith('gpt') || key.startsWith('o1')) && foundAPIs.has('OpenAI API')) {
            addEdge(makeEdge(workspaceId, 'calls', model, foundAPIs.get('OpenAI API')!, {
                reason: `GPT model routes through OpenAI API`,
                rule: 'Known vendor mapping: GPT/O1 models → OpenAI API',
            }))
        }
        if (key.startsWith('gemini') && foundAPIs.has('Google AI API')) {
            addEdge(makeEdge(workspaceId, 'calls', model, foundAPIs.get('Google AI API')!, {
                reason: `Gemini model routes through Google AI API`,
                rule: 'Known vendor mapping: Gemini models → Google AI API',
            }))
        }
    }

    // Module → defines agent (agents found in that directory)
    for (const mod of moduleNodes) {
        const modDir = (mod.meta as any)?.dirName as string
        for (const agent of agentNodes) {
            const agentPath = (agent.meta as any)?.path as string | undefined
            if (agentPath?.startsWith(modDir + '/')) {
                addEdge(makeEdge(workspaceId, 'defines', mod, agent, {
                    reason: `Agent "${agent.name}" source file is inside the ${modDir}/ directory`,
                    file: agentPath,
                    rule: 'Directory containment: node source is within module directory',
                }))
            }
        }
        for (const prompt of promptNodes) {
            const promptPath = (prompt.meta as any)?.path as string | undefined
            if (promptPath?.startsWith(modDir + '/')) {
                addEdge(makeEdge(workspaceId, 'defines', mod, prompt, {
                    reason: `Prompt "${prompt.name}" is inside the ${modDir}/ directory`,
                    file: promptPath,
                    rule: 'Directory containment: prompt file is within module directory',
                }))
            }
        }
    }

    // ── Wiring: Config files → owning module / agent ──────────────────────────
    // Config file nodes (package.json, tsconfig.json, etc.) have no import
    // statements so the tracing pass below won't produce any edges for them.
    // Connect each config file to the nearest module (by directory prefix) or,
    // as a fallback, to an agent/tool whose source lives in the same folder.
    const configFileNodes = allNodes.filter(
        n => n.type === 'file' && Array.isArray(n.tags) && n.tags.includes('config')
    )
    for (const cfgNode of configFileNodes) {
        const cfgPath = cfgNode.paths[0] ?? ''
        const cfgDir  = cfgPath.includes('/') ? cfgPath.split('/').slice(0, -1).join('/') : '.'

        let owner: KosmosNode | undefined
        // 1. Module whose dirName is a prefix of cfgDir (catches root configs too)
        for (const mod of moduleNodes) {
            const mDir = (mod.meta as any)?.dirName as string | undefined
            if (!mDir) continue
            if (cfgDir === mDir || cfgDir.startsWith(mDir + '/') || cfgDir === '.') {
                owner = mod; break
            }
        }
        // 2. Agent or tool in the same directory
        if (!owner) {
            for (const n of allNodes) {
                if (n.type !== 'agent' && n.type !== 'tool') continue
                const p   = n.paths[0] ?? ''
                const dir = p.includes('/') ? p.split('/').slice(0, -1).join('/') : '.'
                if (dir === cfgDir) { owner = n; break }
            }
        }
        if (owner) {
            addEdge(makeEdge(workspaceId, 'uses', owner, cfgNode, {
                reason: `"${owner.name}" is configured by "${cfgNode.name}"`,
                file: cfgPath,
            }))
        }
    }

    // ── Import-tracing pass: create real `imports` edges ─────────────────────
    //
    // Build an absolute-path → nodeId lookup so we can resolve relative imports.
    const pathToNodeId = new Map<string, string>()
    for (const node of allNodes) {
        for (const p of node.paths) {
            pathToNodeId.set(resolve(wsPath, p), node.id)
            // Also index without extension (for bare imports like './utils')
            const noExt = resolve(wsPath, p).replace(/\.(ts|tsx|js|jsx|py|mjs)$/, '')
            pathToNodeId.set(noExt, node.id)
        }
    }

    // Build a package-name → nodeId keyword map from discovered nodes
    const packageToNodeId: [RegExp, string][] = []
    for (const [key, node] of Array.from(foundModels)) {
        packageToNodeId.push([new RegExp('^' + key.replace(/-/g, '[-_]?'), 'i'), node.id])
    }
    for (const [key, node] of Array.from(foundAPIs)) {
        // key is like 'Anthropic API' → match 'anthropic' package name
        const pkgName = key.replace(/\s+API$/i, '').toLowerCase()
        packageToNodeId.push([new RegExp('^' + pkgName, 'i'), node.id])
    }
    for (const [key, node] of Array.from(foundMemory)) {
        packageToNodeId.push([new RegExp('^' + key.replace(/\s+/g, '[-_]?'), 'i'), node.id])
    }

    // For each node that has a source file, trace its imports
    for (const node of allNodes) {
        const nodePath = (node.meta as any)?.path as string | undefined
        if (!nodePath) continue
        const content = contentCache.get(nodePath)
        if (!content) continue

        const specs = extractImports(nodePath, content)
        for (const spec of specs) {
            let resolveBase: string | undefined
            
            // Handle TypeScript/Vite path aliases
            if (spec.startsWith('@renderer/')) {
                resolveBase = resolve(wsPath, 'src/renderer/src', spec.slice(10))
            } else if (spec.startsWith('@shared/')) {
                resolveBase = resolve(wsPath, 'src/shared', spec.slice(8))
            } else if (spec.startsWith('@main/')) {
                resolveBase = resolve(wsPath, 'src/main', spec.slice(6))
            } else if (spec.startsWith('@preload/')) {
                resolveBase = resolve(wsPath, 'src/preload', spec.slice(9))
            } else if (spec.startsWith('@/') || spec.startsWith('~/')) {
                resolveBase = resolve(wsPath, 'src', spec.slice(2))
            } else if (spec.startsWith('.')) {
                // Relative import
                const absDir = dirname(resolve(wsPath, nodePath))
                resolveBase = resolve(absDir, spec)
            }

            if (resolveBase) {
                // ── Path-based import: resolve to absolute path ──────────────
                // Try the path directly, then with common extensions, then /index
                const candidates = [
                    resolveBase,
                    resolveBase + '.ts', resolveBase + '.tsx', resolveBase + '.js', resolveBase + '.jsx', resolveBase + '.py',
                    resolveBase + '/index.ts', resolveBase + '/index.js',
                ]
                for (const candidate of candidates) {
                    const targetId = pathToNodeId.get(candidate)
                    if (targetId && targetId !== node.id) {
                        const targetNode = nodeMap.get(targetId)
                        if (targetNode) addEdge(makeEdge(workspaceId, 'imports', node, targetNode, {
                            reason: `"${node.name}" imports from "${targetNode.name}" via path import`,
                            file: nodePath,
                            rule: `Import statement: ${spec}`,
                        }))
                        break
                    }
                }
            } else {
                // ── Package import: keyword-match against known nodes ──────
                const pkgRoot = spec.split('/')[0]  // 'langchain/agents' → 'langchain'
                for (const [pattern, targetId] of packageToNodeId) {
                    if (pattern.test(pkgRoot) && targetId !== node.id) {
                        const targetNode = nodeMap.get(targetId)
                        if (targetNode) addEdge(makeEdge(workspaceId, 'imports', node, targetNode, {
                            reason: `"${node.name}" imports package "${spec}" which maps to "${targetNode.name}"`,
                            file: nodePath,
                            rule: `Package import: ${spec}`,
                        }))
                        break
                    }
                }
            }
        }
    }

    for (const f of files) {
        const rel = normalizeRelPath(f.rel)
        if (scanFileSnapshots.has(rel)) continue
        scanFileSnapshots.set(rel, {
            path: rel,
            kind: CONFIG_FILE_NAMES.has(f.name) ? 'config' : 'file',
            mtimeMs: f.mtimeMs,
            size: f.size,
            meta: { ext: f.ext },
        })
    }

    return {
        nodes: allNodes,
        edges,
        files: Array.from(scanFileSnapshots.values()),
        meta: {
            contextSystem: {
                ...vaultInfo,
                instructionFiles: Array.from(knowledgeByRel.values())
                    .filter(entry => entry.type === 'instruction_file')
                    .map(entry => normalizeRelPath(entry.file.rel)),
            },
        },
    }
}

export type { KosmosNode, KosmosEdge }
