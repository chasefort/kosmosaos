/**
 * MarkdownEditor — semantic-aware file editor with live color coding.
 *
 * Color rules (aligned with Graph Explorer node/edge type colors):
 *   #eab308  agent yellow  — role instructions ("You are…", "Your role…")
 *   #94a3b8  tool slate    — tool names, commands, CamelCase identifiers
 *   #34d399  memory green  — "remember", "recall", "store", "always"
 *   #f472b6  prompt pink   — conditional instructions ("When the user…")
 *   #60a5fa  model/file blue — file paths, filenames, model names
 *   #a78bfa  reads violet  — read/load/fetch/parse actions
 *   #f87171  writes red    — write/save/store/update actions
 *   #34d399  calls green   — call/invoke/execute/run actions
 *   #38bdf8  imports cyan  — import/require/use
 *   #f1f5f9  heading white — section headers
 */

import { useState, useEffect, useRef, useCallback, useMemo, type KeyboardEvent } from 'react'
import { useAppStore } from '../store/app.store'
import { useGraphStore, type GraphTheme } from '../store/graph.store'
import {
    X, Eye, Edit3, Save, AlertTriangle, Columns2,
    FileCode, FileText, Hash, Layers, ChevronRight,
} from 'lucide-react'
import { typeColors } from '../universe/scene/NodeLayer'
import { PromptExperimentReport, PromptFileInsights } from '../../shared/types'

// ─── helpers ─────────────────────────────────────────────────────────────────
const fileBasename = (p: string) => p.split('/').pop() ?? p
const fileExt      = (p: string) => p.split('.').pop()?.toLowerCase() ?? ''
const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

const PROMPT_FILE_NAMES = ['claude.md','system.md','system_prompt.md','instructions.md','agents.md','prompt.md']
const SAVE_DEBOUNCE_MS  = 1500
const MARKDOWN_EXTS     = new Set(['md','mdx','markdown','txt','rst'])
const CODE_EXTS         = new Set(['ts','tsx','js','jsx','py','json','yaml','yml','toml','sh','bash','env','css','html','go','rs','c','cpp'])

const EXT_COLORS: Record<string,string> = {
    md:'#60a5fa', mdx:'#60a5fa', txt:'#94a3b8',
    ts:'#34d399', tsx:'#34d399',
    js:'#fbbf24', jsx:'#fbbf24',
    py:'#a78bfa',
    json:'#f97316', yaml:'#f97316', yml:'#f97316', toml:'#f97316',
    sh:'#10b981', bash:'#10b981', env:'#ef4444',
    css:'#38bdf8', html:'#f87171', go:'#00acd7', rs:'#f97316',
}

// ─── per-theme editor chrome ──────────────────────────────────────────────────
const EDITOR_THEMES: Record<GraphTheme,{
    accent:string; accentBg:string; accentBorder:string
    headerBg:string; topLine:string; caretColor:string
}> = {
    default:  { accent:'#60a5fa', accentBg:'rgba(96,165,250,0.12)',  accentBorder:'rgba(96,165,250,0.25)',  headerBg:'#0f0f18', topLine:'#60a5fa', caretColor:'#60a5fa' },
    nebula:   { accent:'#c084fc', accentBg:'rgba(192,132,252,0.11)', accentBorder:'rgba(192,132,252,0.25)', headerBg:'#0e0818', topLine:'#c084fc', caretColor:'#c084fc' },
    cyberpunk:{ accent:'#00f5d4', accentBg:'rgba(0,245,212,0.08)',   accentBorder:'rgba(0,245,212,0.2)',    headerBg:'#030308', topLine:'#00f5d4', caretColor:'#00f5d4' },
}

// ─── semantic color palette (graph-aligned) ────────────────────────────────────
const SEM = {
    agent:   '#eab308',
    tool:    '#94a3b8',
    memory:  '#34d399',
    prompt:  '#f472b6',
    file:    '#60a5fa',
    reads:   '#a78bfa',
    writes:  '#f87171',
    calls:   '#22d3ee',
    imports: '#38bdf8',
    heading: '#f1f5f9',
    code:    '#38bdf8',
    bold:    '#f8fafc',
    muted:   '#4b5563',
    link:    '#818cf8',
    meta:    '#374151',
}

// ─── semantic patterns ────────────────────────────────────────────────────────
// Action verb categories
const ACT_READS   = /\b(read|load|fetch|parse|get|retrieve|access|open|scan|inspect|view|check)\b/gi
const ACT_WRITES  = /\b(write|save|store|create|update|delete|remove|edit|modify|output|generate|produce)\b/gi
const ACT_CALLS   = /\b(call|invoke|execute|run|trigger|launch|start|dispatch|send|emit)\b/gi
const ACT_IMPORTS = /\b(import|require|use|include|load|enable)\b/gi

// Line-level semantic detection
const LINE_AGENT   = /^(you are|you will|your role|act as|you should|you must|you're a|as an? |you can |you have )/i
const LINE_PROMPT  = /^(when (the )?user|if (the )?user|if asked|when asked|upon (a )?request|when a user|if a user|in response to|for (a )?user)/i
const LINE_MEMORY  = /\b(remember|recall|always remember|store.*memory|in memory|memory store|retain|keep track)\b/i
const LINE_NEVER   = /^(never |do not |don't |avoid |refrain |prohibit)/i
const LINE_ALWAYS  = /^(always |ensure |make sure |guarantee |must |required? )/i

// Tool/node name patterns (CamelCase identifiers, common tool names)
const TOOL_NAME  = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+(?:Tool|Agent|API|SDK|Client|Service|Handler|Manager|Runner)?|(?:Bash|ReadFile|WriteFile|Search|WebSearch|GitHub|Slack|Memory(?:Read|Write)?|TodoWrite?|Edit|Glob|Grep))\b/g

// File path patterns
const FILE_PATH  = /\b((?:\.\.?\/|~\/|\/)?(?:[\w-]+\/)*[\w-]+\.(?:md|py|ts|tsx|js|jsx|json|yaml|yml|toml|sh|txt|env|go|rs|css|html|csv))\b/g

// Model names
const MODEL_NAME = /\b(claude(?:-[\w-]+)?|gpt-[\w-]+|gemini(?:-[\w-]+)?|llama[\w-]*|mistral[\w-]*|qwen[\w-]*)\b/gi

// ─── inline highlighter ───────────────────────────────────────────────────────
function applyInline(text: string, nodeMap: Map<string,string>): string {
    // Process in segments to avoid double-processing
    // Order: code spans → bold+italic → links → file paths → model names → node names → action verbs

    // Split on backtick code spans first
    const segments: Array<{raw:string; isCode:boolean}> = []
    const codeRe = /`([^`]+)`/g
    let last = 0, m: RegExpExecArray | null
    // eslint-disable-next-line no-cond-assign
    while ((m = codeRe.exec(text)) !== null) {
        if (m.index > last) segments.push({raw: text.slice(last, m.index), isCode:false})
        segments.push({raw: m[1], isCode:true})
        last = m.index + m[0].length
    }
    if (last < text.length) segments.push({raw: text.slice(last), isCode:false})

    return segments.map(seg => {
        if (seg.isCode) {
            return `<span style="color:${SEM.code};background:rgba(56,189,248,0.1);padding:0.1em 0.45em;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:0.88em;border:1px solid rgba(56,189,248,0.2)">${esc(seg.raw)}</span>`
        }
        return applyNonCodeInline(seg.raw, nodeMap)
    }).join('')
}

function applyNonCodeInline(text: string, nodeMap: Map<string,string>): string {
    let out = esc(text)

    // Bold+italic ***...***
    out = out.replace(/\*\*\*(.+?)\*\*\*/g, `<strong><em style="color:${SEM.bold}">$1</em></strong>`)
    // Bold **...**
    out = out.replace(/\*\*(.+?)\*\*/g, `<strong style="color:${SEM.bold}">$1</strong>`)
    // Italic *...* or _..._
    out = out.replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, `<em style="color:#c4b5fd">$1</em>`)
    out = out.replace(/_([^_]+)_/g, `<em style="color:#c4b5fd">$1</em>`)

    // Markdown links [text](url)
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        `<span style="color:${SEM.link};border-bottom:1px solid ${SEM.link}55;cursor:pointer" title="$2">$1</span>`)

    // File paths
    out = out.replace(FILE_PATH, (match) =>
        `<span class="hl-entity" data-entity="file" data-path="${match}" style="color:${SEM.file};text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;cursor:pointer" title="Click to open file">${match}</span>`)

    // Model names
    out = out.replace(MODEL_NAME, (match) =>
        `<span style="color:${SEM.file};font-weight:600">${match}</span>`)

    // Node/graph entity names
    for (const [name, color] of nodeMap) {
        const safeRe = new RegExp(`\\b(${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})\\b`, 'g')
        out = out.replace(safeRe,
            `<span class="hl-entity" data-entity="node" data-name="${name}" style="color:${color};font-weight:600;cursor:pointer;border-bottom:1px solid ${color}55;text-underline-offset:3px" title="Jump to ${name} in graph">$1</span>`)
    }

    // Action verbs (applied AFTER entity detection so we don't recolor names)
    out = out.replace(ACT_READS,   `<span style="color:${SEM.reads};font-style:italic">$&</span>`)
    out = out.replace(ACT_WRITES,  `<span style="color:${SEM.writes};font-style:italic">$&</span>`)
    out = out.replace(ACT_CALLS,   `<span style="color:${SEM.calls};font-style:italic">$&</span>`)
    out = out.replace(ACT_IMPORTS, `<span style="color:${SEM.imports};font-style:italic">$&</span>`)

    // Tool/CamelCase names
    out = out.replace(TOOL_NAME, (match) =>
        `<span style="color:${SEM.tool};font-weight:600">${match}</span>`)

    return out
}

// ─── line highlighter ─────────────────────────────────────────────────────────
function highlightLine(line: string, nodeMap: Map<string,string>, inCodeBlock: boolean): {html: string; nowInCode: boolean} {
    // Code block fence
    if (/^```/.test(line)) {
        const lang = line.slice(3).trim()
        return {
            html: `<span style="color:${SEM.muted}">\`\`\`</span><span style="color:${SEM.imports};font-size:0.85em">${esc(lang)}</span>`,
            nowInCode: !inCodeBlock,
        }
    }

    if (inCodeBlock) {
        return {
            html: `<span style="font-family:'JetBrains Mono',monospace;font-size:0.88em;color:#9ca3af">${esc(line)}</span>`,
            nowInCode: true,
        }
    }

    // Empty
    if (!line.trim()) return { html: '', nowInCode: false }

    // HR
    if (/^-{3,}$/.test(line.trim())) {
        return { html: `<span style="color:${SEM.muted}">${esc(line)}</span>`, nowInCode: false }
    }

    // Heading
    const hMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (hMatch) {
        const level = hMatch[1].length
        const sizes  = ['1.85em','1.5em','1.2em','1.05em','1em','0.95em']
        const weights= [700,600,600,600,500,500]
        const indent = level > 1 ? `padding-left:${(level-1)*8}px` : ''
        return {
            html: `<span style="color:${SEM.muted}">${esc(hMatch[1])} </span>`
                + `<span style="color:${SEM.heading};font-size:${sizes[level-1]};font-weight:${weights[level-1]};${indent}">`
                + applyInline(hMatch[2], nodeMap)
                + `</span>`,
            nowInCode: false,
        }
    }

    // Blockquote
    if (line.startsWith('>')) {
        return {
            html: `<span style="color:${SEM.muted}">&gt; </span>`
               + `<span style="color:#94a3b8;font-style:italic">${applyInline(line.slice(1).trim(), nodeMap)}</span>`,
            nowInCode: false,
        }
    }

    // List item
    const listMatch = line.match(/^(\s*)([-*•]|\d+\.)\s+(.*)$/)
    if (listMatch) {
        const indent  = esc(listMatch[1])
        const bullet  = listMatch[2]
        const content = listMatch[3]
        const isNum   = /\d/.test(bullet)
        return {
            html: `${indent}<span style="color:${isNum ? SEM.calls : SEM.muted}">${esc(bullet)} </span>${applyInline(content, nodeMap)}`,
            nowInCode: false,
        }
    }

    // Determine semantic line category for background tinting
    const lower = line.trim().toLowerCase()
    let wrapOpen = ''
    let wrapClose = ''
    let lineIcon = ''

    if (LINE_AGENT.test(lower)) {
        wrapOpen  = `<span class="sem-line" style="background:rgba(234,179,8,0.07);border-left:2px solid ${SEM.agent}55;padding:2px 6px 2px 10px;border-radius:0 3px 3px 0;display:block">`
        lineIcon  = `<span style="color:${SEM.agent};font-size:0.7em;margin-right:6px;opacity:0.8" title="Agent instruction">⬡</span>`
        wrapClose = '</span>'
    } else if (LINE_PROMPT.test(lower)) {
        wrapOpen  = `<span class="sem-line" style="background:rgba(244,114,182,0.07);border-left:2px solid ${SEM.prompt}55;padding:2px 6px 2px 10px;border-radius:0 3px 3px 0;display:block">`
        lineIcon  = `<span style="color:${SEM.prompt};font-size:0.7em;margin-right:6px;opacity:0.8" title="Conditional instruction">◈</span>`
        wrapClose = '</span>'
    } else if (LINE_MEMORY.test(lower)) {
        wrapOpen  = `<span class="sem-line" style="background:rgba(52,211,153,0.06);border-left:2px solid ${SEM.memory}44;padding:2px 6px 2px 10px;border-radius:0 3px 3px 0;display:block">`
        lineIcon  = `<span style="color:${SEM.memory};font-size:0.7em;margin-right:6px;opacity:0.8" title="Memory operation">◎</span>`
        wrapClose = '</span>'
    } else if (LINE_NEVER.test(lower)) {
        wrapOpen  = `<span class="sem-line" style="background:rgba(248,113,113,0.06);border-left:2px solid ${SEM.writes}44;padding:2px 6px 2px 10px;border-radius:0 3px 3px 0;display:block">`
        lineIcon  = `<span style="color:${SEM.writes};font-size:0.7em;margin-right:6px;opacity:0.8" title="Prohibition">✕</span>`
        wrapClose = '</span>'
    } else if (LINE_ALWAYS.test(lower)) {
        wrapOpen  = `<span class="sem-line" style="background:rgba(34,211,238,0.05);border-left:2px solid ${SEM.calls}44;padding:2px 6px 2px 10px;border-radius:0 3px 3px 0;display:block">`
        lineIcon  = `<span style="color:${SEM.calls};font-size:0.7em;margin-right:6px;opacity:0.8" title="Always/Must">⟳</span>`
        wrapClose = '</span>'
    }

    return {
        html: wrapOpen + lineIcon + applyInline(line, nodeMap) + wrapClose,
        nowInCode: false,
    }
}

// ─── main semantic renderer ───────────────────────────────────────────────────
function renderSemantic(text: string, nodeMap: Map<string,string>): string {
    const lines = text.split('\n')
    let inCode = false
    const out: string[] = []
    for (const line of lines) {
        const { html, nowInCode } = highlightLine(line, nodeMap, inCode)
        inCode = nowInCode
        out.push(html)
    }
    return out.join('\n')
}

// ─── plain markdown preview (for split/preview pane) ─────────────────────────
function renderMarkdownPlain(md: string): string {
    return md
        .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
        .replace(/^##### (.+)$/gm,  '<h5>$1</h5>')
        .replace(/^#### (.+)$/gm,   '<h4>$1</h4>')
        .replace(/^### (.+)$/gm,    '<h3>$1</h3>')
        .replace(/^## (.+)$/gm,     '<h2>$1</h2>')
        .replace(/^# (.+)$/gm,      '<h1>$1</h1>')
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,         '<em>$1</em>')
        .replace(/_(.+?)_/g,           '<em>$1</em>')
        .replace(/`([^`]+)`/g,         '<code>$1</code>')
        .replace(/^> (.+)$/gm,         '<blockquote>$1</blockquote>')
        .replace(/^[-*] (.+)$/gm,      '<li>$1</li>')
        .replace(/^\d+\. (.+)$/gm,     '<li>$1</li>')
        .replace(/^---$/gm,            '<hr/>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/\n\n+/g, '</p><p>')
}

// ─── doc structure sidebar ────────────────────────────────────────────────────
interface DocSection { level: number; title: string; line: number }
function extractSections(text: string): DocSection[] {
    const sections: DocSection[] = []
    text.split('\n').forEach((line, i) => {
        const m = line.match(/^(#{1,4})\s+(.+)$/)
        if (m) sections.push({ level: m[1].length, title: m[2], line: i })
    })
    return sections
}

// ─── component ────────────────────────────────────────────────────────────────
export function MarkdownEditor() {
    const { activeWorkspace, openFilePath, setOpenFilePath, setSelectedNodeId, setFlyToTarget } = useAppStore()
    const graphTheme   = useGraphStore(s => s.theme)
    const nodes        = useGraphStore(s => s.nodes)
    const layoutNodes  = useGraphStore(s => s.layoutNodes)
    const et = EDITOR_THEMES[graphTheme] ?? EDITOR_THEMES.default

    const [content, setContent]         = useState<string | null>(null)
    const [isDirty, setIsDirty]         = useState(false)
    const [isSaving, setIsSaving]       = useState(false)
    const [mode, setMode]               = useState<'edit'|'semantic'|'split'|'preview'>('edit')
    const [showOutline, setShowOutline] = useState(false)
    const [promptInsights, setPromptInsights] = useState<PromptFileInsights | null>(null)
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
    const [selectedVersionContent, setSelectedVersionContent] = useState<string | null>(null)
    const [experimentReport, setExperimentReport] = useState<PromptExperimentReport | null>(null)
    const [runningExperiment, setRunningExperiment] = useState(false)
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const fileName     = openFilePath ? fileBasename(openFilePath) : ''
    const ext          = openFilePath ? fileExt(openFilePath) : ''
    const isMarkdown   = MARKDOWN_EXTS.has(ext)
    const isCode       = CODE_EXTS.has(ext)
    const extColor     = EXT_COLORS[ext] || '#94a3b8'
    const isPromptFile = PROMPT_FILE_NAMES.includes(fileName.toLowerCase())

    const sourcePath = useMemo(() => {
        if (!openFilePath || !activeWorkspace?.path) return null
        const root = activeWorkspace.path.replace(/\/$/, '')
        return openFilePath.startsWith(root)
            ? openFilePath.slice(root.length).replace(/^\//, '')
            : openFilePath
    }, [activeWorkspace, openFilePath])

    // Build a map: node name → type color (for clickable mentions)
    const nodeMap = useMemo(() => {
        const map = new Map<string,string>()
        for (const n of nodes) {
            if (n.name && n.name.length > 3) {
                map.set(n.name, typeColors[n.type] || '#94a3b8')
            }
        }
        return map
    }, [nodes])

    // Load file
    useEffect(() => {
        if (!openFilePath) { setContent(null); return }
        setContent(null); setIsDirty(false)
        setMode('edit')
        window.api.readFile(openFilePath).then((text: string | null) => {
            setContent(text ?? '')
        })
    }, [openFilePath])

    useEffect(() => {
        if (content === null || mode !== 'edit') return
        const id = window.requestAnimationFrame(() => textareaRef.current?.focus())
        return () => window.cancelAnimationFrame(id)
    }, [content, mode, openFilePath])

    const loadPromptInsights = useCallback(async () => {
        if (!activeWorkspace || !sourcePath || !isPromptFile) {
            setPromptInsights(null)
            setExperimentReport(null)
            return
        }
        const insights = await window.api.getPromptInsights(activeWorkspace.id, sourcePath)
        setPromptInsights(insights)
        setExperimentReport(insights.experiment ?? null)
        if (!selectedVersionId && insights.versions[1]) {
            setSelectedVersionId(insights.versions[1].versionId)
        }
    }, [activeWorkspace, isPromptFile, selectedVersionId, sourcePath])

    useEffect(() => {
        loadPromptInsights()
    }, [loadPromptInsights])

    useEffect(() => {
        if (!selectedVersionId) {
            setSelectedVersionContent(null)
            return
        }
        window.api.getPromptVersionContent(selectedVersionId).then(setSelectedVersionContent)
    }, [selectedVersionId])

    const saveFile = useCallback(async (text: string) => {
        if (!openFilePath) return
        setIsSaving(true)
        await window.api.writeFile(openFilePath, text)
        setIsSaving(false); setIsDirty(false)
        await loadPromptInsights()
    }, [loadPromptInsights, openFilePath])

    const handleChange = useCallback((text: string) => {
        setContent(text); setIsDirty(true)
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => saveFile(text), SAVE_DEBOUNCE_MS)
    }, [saveFile])

    // Jump to entity from any click handler in the overlay/preview
    const handleEntityClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        const closest = target.closest('[data-entity]') as HTMLElement | null
        if (!closest) return
        const kind = closest.dataset.entity
        if (kind === 'node') {
            const name = closest.dataset.name
            if (!name) return
            const node = nodes.find(n => n.name === name)
            if (!node) return
            setSelectedNodeId(node.id)
            const pos = layoutNodes[node.id]
            if (pos) setFlyToTarget({ x: pos.x, y: pos.y, z: pos.z })
            e.preventDefault()
        } else if (kind === 'file') {
            const filePath = closest.dataset.path
            if (!filePath || !openFilePath) return
            // Resolve relative to current file's directory
            const dir = openFilePath.split('/').slice(0, -1).join('/')
            const abs = filePath.startsWith('/') ? filePath : `${dir}/${filePath}`
            setOpenFilePath(abs)
            e.preventDefault()
        }
    }, [nodes, layoutNodes, openFilePath, setSelectedNodeId, setFlyToTarget, setOpenFilePath])

    // useMemo must be called unconditionally (before any early return)
    const semanticHtml = useMemo(
        () => (content && isMarkdown) ? renderSemantic(content, nodeMap) : '',
        [content, isMarkdown, nodeMap]
    )
    const previewHtml  = useMemo(
        () => content ? renderMarkdownPlain(content) : '',
        [content]
    )

    const runExperiment = useCallback(async () => {
        if (!activeWorkspace || !sourcePath) return
        setRunningExperiment(true)
        try {
            const report = await window.api.runPromptExperiment(activeWorkspace.id, sourcePath)
            setExperimentReport(report)
        } finally {
            setRunningExperiment(false)
        }
    }, [activeWorkspace, sourcePath])

    const handleEditorKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
            e.preventDefault()
            if (saveTimer.current) clearTimeout(saveTimer.current)
            saveFile(e.currentTarget.value)
            return
        }

        if (e.key === 'Tab') {
            e.preventDefault()
            const target = e.currentTarget
            const start = target.selectionStart
            const end = target.selectionEnd
            const indent = '  '
            const next = `${content.slice(0, start)}${indent}${content.slice(end)}`
            handleChange(next)
            window.requestAnimationFrame(() => {
                target.selectionStart = target.selectionEnd = start + indent.length
            })
        }
    }, [content, handleChange, saveFile])

    if (!openFilePath || content === null) return null

    const showEditor   = mode === 'edit' || mode === 'split' || mode === 'semantic'
    const showPreview  = mode === 'preview' || mode === 'split'
    const showSemantic = mode === 'semantic' && isMarkdown
    const sections     = isMarkdown ? extractSections(content) : []

    const MODES: { id: typeof mode; icon: React.ReactNode; label: string; title: string }[] = isMarkdown ? [
        { id:'edit',     icon:<Edit3    size={11}/>, label:'Edit',     title:'Plain text editor' },
        { id:'semantic', icon:<Layers   size={11}/>, label:'Semantic', title:'Color-coded semantic view' },
        { id:'split',    icon:<Columns2 size={11}/>, label:'Split',    title:'Editor + rendered preview' },
        { id:'preview',  icon:<Eye      size={11}/>, label:'Preview',  title:'Rendered markdown' },
    ] : [
        { id:'edit', icon:<Edit3 size={11}/>, label:'Edit', title:'Edit file' },
    ]

    // Detect word count / line count
    const lineCount  = content.split('\n').length
    const wordCount  = content.trim() ? content.trim().split(/\s+/).length : 0
    const latestVersion = promptInsights?.versions[0]

    return (
        <div style={{
            width: 680, flexShrink: 0,
            background: 'var(--k-bg-base)',
            borderLeft: '1px solid var(--k-border-subtle)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            transition: 'border-color 0.3s ease',
        }}>
            {/* ── Accent line at top ── */}
            <div style={{
                height: 2, flexShrink: 0,
                background: `linear-gradient(90deg, ${extColor}cc, ${et.topLine}77, transparent 70%)`,
                transition: 'background 0.4s ease',
            }} />

            {/* ── Header ── */}
            <div style={{
                height: 44, flexShrink: 0,
                borderBottom: '1px solid var(--k-border-subtle)',
                display: 'flex', alignItems: 'center',
                padding: '0 10px 0 14px', gap: 8,
                background: et.headerBg,
                transition: 'background 0.4s ease',
            }}>
                {/* File icon + type badge + name */}
                <div style={{ display:'flex', alignItems:'center', gap:6, flex:1, overflow:'hidden', minWidth:0 }}>
                    {isCode
                        ? <FileCode size={13} style={{ color: extColor, flexShrink:0 }} />
                        : <FileText size={13} style={{ color: extColor, flexShrink:0 }} />
                    }
                    <span style={{
                        fontSize:9, fontWeight:800, letterSpacing:0.5, padding:'1px 5px', borderRadius:3, flexShrink:0,
                        background: extColor+'22', color: extColor, border:`1px solid ${extColor}44`,
                    }}>
                        {ext.toUpperCase() || 'FILE'}
                    </span>
                    <span style={{
                        fontSize:12, fontWeight:600, color:'var(--k-text-primary)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }}>
                        {fileName}
                    </span>
                    {isDirty  && <span style={{ color:'#fbbf24', fontSize:10, flexShrink:0 }}>●</span>}
                    {isSaving && <span style={{ color:'var(--k-text-dim)', fontSize:10, flexShrink:0 }}>saving…</span>}
                </div>

                {/* Prompt badge */}
                {isPromptFile && (
                    <div style={{
                        display:'flex', alignItems:'center', gap:4, fontSize:10, color:'#f472b6',
                        background:'#f472b612', border:'1px solid #f472b630',
                        padding:'2px 6px', borderRadius:4, flexShrink:0,
                    }}>
                        <AlertTriangle size={9}/> Prompt
                    </div>
                )}

                {/* Outline toggle for markdown */}
                {isMarkdown && sections.length > 0 && (
                    <button
                        onClick={() => setShowOutline(v => !v)}
                        title="Toggle document outline"
                        style={{
                            padding:'3px 6px', borderRadius:4, cursor:'pointer', flexShrink:0,
                            background: showOutline ? et.accentBg : 'transparent',
                            color: showOutline ? et.accent : 'var(--k-text-dim)',
                            border: showOutline ? `1px solid ${et.accentBorder}` : '1px solid transparent',
                        }}
                    >
                        <Hash size={11}/>
                    </button>
                )}

                {/* Mode pills */}
                <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                    {MODES.map(({ id, icon, label, title }) => (
                        <button key={id} onClick={() => setMode(id)} title={title} style={{
                            display:'flex', alignItems:'center', gap:4,
                            padding:'3px 7px', borderRadius:4, fontSize:10, cursor:'pointer',
                            background: mode===id ? et.accentBg : 'transparent',
                            color:      mode===id ? et.accent   : 'var(--k-text-dim)',
                            border:     mode===id ? `1px solid ${et.accentBorder}` : '1px solid transparent',
                            transition: 'all 0.15s',
                        }}>
                            {icon}
                            <span>{label}</span>
                        </button>
                    ))}
                </div>

                {/* Stats */}
                <span style={{ fontSize:10, color:'var(--k-text-dim)', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>
                    {lineCount}L · {wordCount}W
                </span>

                <button
                    onClick={() => { if (saveTimer.current) clearTimeout(saveTimer.current); saveFile(content) }}
                    title="Save (⌘S)"
                    style={{ color: isDirty ? et.accent : 'var(--k-text-dim)', cursor:'pointer', padding:4, flexShrink:0, transition:'color 0.3s' }}
                >
                    <Save size={14}/>
                </button>
                <button onClick={() => setOpenFilePath(null)} title="Close"
                    style={{ color:'var(--k-text-dim)', cursor:'pointer', padding:4, flexShrink:0 }}>
                    <X size={14}/>
                </button>
            </div>

            {/* ── Prompt file banner ── */}
            {isPromptFile && (
                <div style={{
                    padding:'7px 14px', flexShrink:0,
                    background:'#f472b60a', borderBottom:'1px solid #f472b620',
                    fontSize:11, color:'#f472b6', lineHeight:1.5,
                    display:'flex', alignItems:'center', gap:6,
                }}>
                    <AlertTriangle size={11}/>
                    <span><strong>Prompt file</strong> — edits here directly affect agent behavior.</span>
                </div>
            )}

            {isPromptFile && promptInsights?.template && (
                <div style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--k-border-subtle)',
                    background: 'rgba(244,114,182,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--k-text-dim)' }}>
                            <span>{promptInsights.versions.length} versions</span>
                            <span>{promptInsights.activeTraceCount} linked traces</span>
                            <span>{promptInsights.datasetCount} dataset examples</span>
                            {latestVersion && <span>latest v{latestVersion.version}</span>}
                        </div>
                        <button
                            onClick={runExperiment}
                            style={{
                                padding: '5px 10px',
                                borderRadius: 8,
                                border: '1px solid rgba(96,165,250,0.25)',
                                background: 'rgba(96,165,250,0.12)',
                                color: '#60a5fa',
                                fontSize: 11,
                                cursor: 'pointer',
                            }}
                        >
                            {runningExperiment ? 'Running…' : 'Run Experiment'}
                        </button>
                    </div>

                    {promptInsights.versions.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {promptInsights.versions.map(version => (
                                <button
                                    key={version.versionId}
                                    onClick={() => setSelectedVersionId(version.versionId)}
                                    style={{
                                        padding: '5px 8px',
                                        borderRadius: 8,
                                        border: `1px solid ${selectedVersionId === version.versionId ? 'rgba(244,114,182,0.35)' : 'rgba(255,255,255,0.08)'}`,
                                        background: selectedVersionId === version.versionId ? 'rgba(244,114,182,0.12)' : 'rgba(255,255,255,0.03)',
                                        color: selectedVersionId === version.versionId ? '#f472b6' : 'var(--k-text-dim)',
                                        fontSize: 10,
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    <div>v{version.version}</div>
                                    <div style={{ marginTop: 2 }}>{version.traceCount} traces · {version.feedbackCount} scores</div>
                                </button>
                            ))}
                        </div>
                    )}

                    {selectedVersionContent && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                                <div style={{ padding: '6px 8px', fontSize: 10, color: 'var(--k-text-dim)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    Selected Version
                                </div>
                                <pre style={{ margin: 0, padding: 10, fontSize: 10, lineHeight: 1.5, maxHeight: 140, overflow: 'auto', color: 'var(--k-text-secondary)', whiteSpace: 'pre-wrap' }}>
                                    {selectedVersionContent}
                                </pre>
                            </div>
                            <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                                <div style={{ padding: '6px 8px', fontSize: 10, color: 'var(--k-text-dim)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    Current Buffer
                                </div>
                                <pre style={{ margin: 0, padding: 10, fontSize: 10, lineHeight: 1.5, maxHeight: 140, overflow: 'auto', color: 'var(--k-text-secondary)', whiteSpace: 'pre-wrap' }}>
                                    {content}
                                </pre>
                            </div>
                        </div>
                    )}

                    {experimentReport && (
                        <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 10 }}>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--k-text-dim)', marginBottom: 8 }}>
                                Historical Experiment
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {experimentReport.versionStats.map(stat => (
                                    <div key={stat.versionId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11 }}>
                                        <span style={{ color: 'var(--k-text-secondary)' }}>
                                            v{stat.version} · {stat.exampleCount} examples
                                        </span>
                                        <span style={{ color: 'var(--k-text-dim)' }}>
                                            {stat.avgFeedback != null ? `${stat.avgFeedback.toFixed(1)} / 5` : '—'} · {stat.totalTokens.toLocaleString()} tokens
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Color legend (semantic mode only) ── */}
            {mode === 'semantic' && isMarkdown && (
                <div style={{
                    display:'flex', flexWrap:'wrap', gap:'2px 12px',
                    padding:'5px 14px', flexShrink:0,
                    background:'rgba(255,255,255,0.02)',
                    borderBottom:'1px solid var(--k-border-subtle)',
                    fontSize:9, fontWeight:600, letterSpacing:0.3,
                }}>
                    {[
                        { color: SEM.agent,   label: 'Role instruction' },
                        { color: SEM.prompt,  label: 'Conditional' },
                        { color: SEM.memory,  label: 'Memory' },
                        { color: SEM.writes,  label: 'Prohibition' },
                        { color: SEM.reads,   label: 'Read action' },
                        { color: SEM.writes,  label: 'Write action' },
                        { color: SEM.file,    label: 'File / Model' },
                        { color: SEM.tool,    label: 'Tool / Node' },
                    ].map(({ color, label }) => (
                        <span key={label} style={{ display:'flex', alignItems:'center', gap:4, color:'var(--k-text-dim)' }}>
                            <span style={{ width:8, height:8, borderRadius:2, background:color, flexShrink:0 }}/>
                            {label}
                        </span>
                    ))}
                </div>
            )}

            {/* ── Main content row ── */}
            <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

                {/* Outline sidebar */}
                {showOutline && sections.length > 0 && (
                    <div style={{
                        width:180, flexShrink:0, overflowY:'auto', padding:'12px 0',
                        borderRight:'1px solid var(--k-border-subtle)',
                        background:'rgba(255,255,255,0.015)',
                    }}>
                        <div style={{ padding:'0 10px 6px', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, color:'var(--k-text-dim)' }}>
                            Outline
                        </div>
                        {sections.map((s, i) => (
                            <div
                                key={i}
                                onClick={() => {
                                    // Scroll textarea to that line
                                    const ta = textareaRef.current
                                    if (!ta) return
                                    const lines = content.split('\n').slice(0, s.line)
                                    const charPos = lines.join('\n').length
                                    ta.focus()
                                    ta.setSelectionRange(charPos, charPos)
                                    ta.scrollTop = (s.line / lineCount) * ta.scrollHeight
                                }}
                                style={{
                                    padding:`3px 10px 3px ${8 + (s.level-1)*10}px`,
                                    fontSize:11, color:'var(--k-text-secondary)',
                                    cursor:'pointer', display:'flex', alignItems:'center', gap:4,
                                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.04)')}
                                onMouseLeave={e => (e.currentTarget.style.background='transparent')}
                            >
                                <ChevronRight size={8} style={{ color:'var(--k-text-dim)', flexShrink:0 }}/>
                                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Editor pane ── */}
                {(showEditor || showSemantic) && (
                    <div style={{
                        flex:1, display:'flex', flexDirection:'column',
                        borderRight: showPreview ? '1px solid var(--k-border-subtle)' : 'none',
                        overflow:'hidden', position:'relative',
                        background: isCode ? `${extColor}06` : 'transparent',
                    }}>
                        {/* Left accent stripe for code files */}
                        {isCode && (
                            <div style={{
                                position:'absolute', left:0, top:0, bottom:0, width:2,
                                background:`linear-gradient(180deg, ${extColor}60, transparent 60%)`,
                                pointerEvents:'none', zIndex:2,
                            }}/>
                        )}

                        {showSemantic ? (
                            /* ── Semantic read/edit mode ── */
                            <div
                                className="semantic-editor-container"
                                style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}
                            >
                                {/* Scrollable semantic view */}
                                <div
                                    onClick={handleEntityClick}
                                    style={{
                                        flex:1, overflowY:'auto', padding:'32px 36px 48px',
                                        fontFamily:"'Inter', system-ui, sans-serif",
                                        fontSize:14, lineHeight:1.8,
                                        color:'#cbd5e1',
                                        whiteSpace:'pre-wrap', wordBreak:'break-word',
                                    }}
                                    dangerouslySetInnerHTML={{ __html: semanticHtml }}
                                />
                                {/* Floating edit button */}
                                <div style={{
                                    position:'absolute', bottom:16, right:16,
                                    display:'flex', gap:6,
                                }}>
                                    <button
                                        onClick={() => setMode('edit')}
                                        style={{
                                            display:'flex', alignItems:'center', gap:5,
                                            padding:'6px 12px', borderRadius:6,
                                            background: et.accentBg, border:`1px solid ${et.accentBorder}`,
                                            color: et.accent, fontSize:11, fontWeight:600, cursor:'pointer',
                                            boxShadow:`0 2px 12px ${et.accent}22`,
                                        }}
                                    >
                                        <Edit3 size={11}/> Edit
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ── Plain textarea ── */
                            <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
                                <textarea
                                    ref={textareaRef}
                                    className={isCode ? 'kosmos-code-textarea' : 'obsidian-textarea'}
                                    value={content}
                                    onChange={e => handleChange(e.target.value)}
                                    onKeyDown={handleEditorKeyDown}
                                    spellCheck={false}
                                    placeholder={isCode ? `// ${fileName}` : 'Start writing…'}
                                    style={{
                                        position:'absolute', inset:0,
                                        background:'transparent',
                                        caretColor: et.caretColor,
                                        resize:'none',
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* ── Preview pane ── */}
                {showPreview && (
                    <div
                        onClick={handleEntityClick}
                        style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', overflowY:'auto' }}
                    >
                        <div className="obsidian-preview-container">
                            {!content.trim() && <p style={{ color:'var(--k-text-dim)', fontStyle:'italic', marginTop:'2em' }}>Empty file</p>}
                            <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: previewHtml }}/>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
