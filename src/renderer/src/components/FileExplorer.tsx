import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '../store/app.store'
import { useGraphStore, type GraphTheme } from '../store/graph.store'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Search, X, Crosshair } from 'lucide-react'
import { typeColors } from '../universe/scene/NodeLayer'
import { getFileEntryDecorations } from './file-explorer.decorations'

// ── Per-theme explorer accent colors ─────────────────────────────────────────
const EXPLORER_THEMES: Record<GraphTheme, {
    accent: string; activeItemBg: string; activeBorder: string
    jumpBg: string; jumpBorder: string; connectedColor: string
}> = {
    default: {
        accent:        '#60a5fa',
        activeItemBg:  'rgba(96,165,250,0.12)',
        activeBorder:  '#60a5fa',
        jumpBg:        'rgba(96,165,250,0.08)',
        jumpBorder:    'rgba(96,165,250,0.18)',
        connectedColor:'#34d399',
    },
    nebula: {
        accent:        '#c084fc',
        activeItemBg:  'rgba(192,132,252,0.11)',
        activeBorder:  '#c084fc',
        jumpBg:        'rgba(192,132,252,0.08)',
        jumpBorder:    'rgba(192,132,252,0.2)',
        connectedColor:'#e879f9',
    },
    cyberpunk: {
        accent:        '#00f5d4',
        activeItemBg:  'rgba(0,245,212,0.08)',
        activeBorder:  '#00f5d4',
        jumpBg:        'rgba(0,245,212,0.06)',
        jumpBorder:    'rgba(0,245,212,0.15)',
        connectedColor:'#00f5a0',
    },
}

interface FileEntry {
    name: string
    path: string
    isDirectory: boolean
    ext: string
    size: number
    mtime: number
}

/** Extension → accent color */
const EXT_COLORS: Record<string, string> = {
    md:   '#60a5fa', mdx:  '#60a5fa',
    ts:   '#34d399', tsx:  '#34d399',
    js:   '#fbbf24', jsx:  '#fbbf24',
    py:   '#a78bfa',
    json: '#f97316', yaml: '#f97316', yml: '#f97316', toml: '#f97316',
    txt:  '#94a3b8',
    sh:   '#10b981', bash: '#10b981',
    env:  '#ef4444',
}

function ExtBadge({ ext }: { ext: string }) {
    const color = EXT_COLORS[ext] || '#64748b'
    return (
        <div style={{
            width: 16, height: 16, borderRadius: 2, flexShrink: 0,
            background: color + '22', border: `1px solid ${color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 6, fontWeight: 800, color, letterSpacing: -0.5
        }}>
            {ext.slice(0, 2).toUpperCase() || '?'}
        </div>
    )
}

/** One row in the tree */
function TreeRow({ entry, depth, expanded, loaded, children, onToggle, onSelect, openFilePath, dirContents, expandedDirs, resolveEntryDecorations, accent, activeItemBg }: {
    entry: FileEntry
    depth: number
    expanded: boolean
    loaded: boolean
    children: FileEntry[]
    onToggle: (path: string) => void
    onSelect: (path: string) => void
    openFilePath: string | null
    dirContents: Map<string, FileEntry[]>
    expandedDirs: Set<string>
    resolveEntryDecorations: (entry: FileEntry) => { nodeTypeDot?: string; recentlyTouched?: boolean }
    accent: string
    activeItemBg: string
}) {
    const isActive = entry.path === openFilePath
    const pl = 10 + depth * 14
    const { nodeTypeDot, recentlyTouched } = resolveEntryDecorations(entry)

    return (
        <>
            <div
                onClick={() => entry.isDirectory ? onToggle(entry.path) : onSelect(entry.path)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: `3px 10px 3px ${pl}px`,
                    cursor: 'pointer',
                    background: isActive ? activeItemBg : 'transparent',
                    color: isActive ? accent : 'var(--k-text-secondary)',
                    fontSize: 12, userSelect: 'none',
                    borderLeft: isActive ? `2px solid ${accent}` : '2px solid transparent',
                    transition: 'background 0.15s, color 0.15s',
                }}
                className="file-row"
            >
                {entry.isDirectory ? (
                    <>
                        <span style={{ width: 12, flexShrink: 0, color: 'var(--k-text-dim)', display: 'flex', alignItems: 'center' }}>
                            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        </span>
                        {expanded
                            ? <FolderOpen size={13} style={{ color: '#fbbf24', flexShrink: 0 }} />
                            : <Folder     size={13} style={{ color: '#fbbf24', flexShrink: 0 }} />
                        }
                    </>
                ) : (
                    <>
                        <span style={{ width: 12, flexShrink: 0 }} />
                        <ExtBadge ext={entry.ext} />
                    </>
                )}
                <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1, marginLeft: 2
                }}>
                    {entry.name}
                </span>
                {/* Node type dot */}
                {nodeTypeDot && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: nodeTypeDot, flexShrink: 0, boxShadow: `0 0 4px ${nodeTypeDot}` }} />
                )}
                {/* Recently touched indicator */}
                {recentlyTouched && !nodeTypeDot && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', flexShrink: 0, boxShadow: '0 0 4px #34d399', opacity: 0.85 }} />
                )}
            </div>

            {/* Children */}
            {entry.isDirectory && expanded && (
                loaded
                    ? children.map(child => (
                        <TreeRow
                            key={child.path}
                            entry={child}
                            depth={depth + 1}
                            expanded={expandedDirs.has(child.path)}
                            loaded={dirContents.has(child.path)}
                            children={dirContents.get(child.path) ?? []}
                            onToggle={onToggle}
                            onSelect={onSelect}
                            openFilePath={openFilePath}
                            dirContents={dirContents}
                            expandedDirs={expandedDirs}
                            resolveEntryDecorations={resolveEntryDecorations}
                            accent={accent}
                            activeItemBg={activeItemBg}
                        />
                    ))
                    : (
                        <div style={{ paddingLeft: pl + 20, fontSize: 11, color: 'var(--k-text-dim)', paddingTop: 2, paddingBottom: 2 }}>
                            Loading…
                        </div>
                    )
            )}
        </>
    )
}

export function FileExplorer() {
    const { activeWorkspace, openFilePath, setOpenFilePath, setFileExplorerOpen, setSelectedNodeId, setFlyToTarget, recentlyTouchedFiles, integrationStatus } = useAppStore()
    const nodes = useGraphStore(s => s.nodes)
    const layoutNodes = useGraphStore(s => s.layoutNodes)
    const graphTheme = useGraphStore(s => s.theme)
    const et = EXPLORER_THEMES[graphTheme] ?? EXPLORER_THEMES.default

    // Build lookup: relativePath → node type color
    const nodePathColorMap = useMemo(() => {
        const map = new Map<string, string>()
        if (!activeWorkspace) return map
        for (const n of nodes) {
            for (const p of n.paths ?? []) {
                const color = typeColors[n.type] || '#ffffff'
                map.set(p, color)
            }
        }
        return map
    }, [nodes, activeWorkspace])

    // Find a node whose paths[] matches the currently open file
    const matchedNode = useMemo(() => {
        if (!openFilePath || !activeWorkspace?.path) return null
        const workspaceRoot = activeWorkspace.path.endsWith('/')
            ? activeWorkspace.path
            : activeWorkspace.path + '/'
        return nodes.find(n =>
            n.paths?.some(p => {
                const abs = p.startsWith('/') ? p : workspaceRoot + p
                return abs === openFilePath
            })
        ) ?? null
    }, [openFilePath, nodes, activeWorkspace])

    const handleJumpToNode = useCallback(() => {
        if (!matchedNode) return
        setSelectedNodeId(matchedNode.id)
        const pos = layoutNodes[matchedNode.id]
        if (pos) setFlyToTarget({ x: pos.x, y: pos.y, z: pos.z })
    }, [matchedNode, layoutNodes, setSelectedNodeId, setFlyToTarget])

    // path → sorted FileEntry[]
    const [dirContents, setDirContents] = useState<Map<string, FileEntry[]>>(new Map())
    const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
    const [search, setSearch] = useState('')

    const loadDir = useCallback(async (path: string) => {
        const entries: FileEntry[] = await window.api.listDir(path)
        setDirContents(prev => {
            const next = new Map(prev)
            next.set(path, entries)
            return next
        })
    }, [])

    // Load root when workspace changes
    useEffect(() => {
        if (!activeWorkspace) return
        const root = activeWorkspace.path
        loadDir(root)
        setExpandedDirs(new Set([root]))
    }, [activeWorkspace, loadDir])

    const handleToggle = useCallback((path: string) => {
        setExpandedDirs(prev => {
            const next = new Set(prev)
            if (next.has(path)) {
                next.delete(path)
            } else {
                next.add(path)
                if (!dirContents.has(path)) {
                    loadDir(path)
                }
            }
            return next
        })
    }, [dirContents, loadDir])

    if (!activeWorkspace) return null

    const root = activeWorkspace.path
    const rootEntries = dirContents.get(root) ?? []

    // Flatten all loaded files for search
    const allFiles: FileEntry[] = []
    dirContents.forEach(entries => {
        for (const e of entries) {
            if (!e.isDirectory) allFiles.push(e)
        }
    })
    const filteredFiles = search.trim()
        ? allFiles.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
        : null

    // Prompt/instruction nodes for the pinned section
    const promptNodes = nodes.filter(n => n.type === 'prompt')

    // Workspace summary stats
    const agentCount = nodes.filter(n => n.type === 'agent').length
    const toolCount = nodes.filter(n => n.type === 'tool').length
    const promptCount = promptNodes.length
    const totalInGraph = nodes.length
    const ccConnected = integrationStatus.claudeCode.connected
    const ccLastEvent = integrationStatus.claudeCode.lastEvent
    const ccLastStr = ccLastEvent ? `${Math.round((Date.now() - ccLastEvent) / 1000)}s ago` : null

    const now = Date.now()
    const RECENT_MS = 60_000
    const resolveEntryDecorations = useCallback((entry: FileEntry) => {
        if (entry.isDirectory) return {}
        return getFileEntryDecorations({
            entryPath: entry.path,
            rootPath: root,
            nodePathColorMap,
            recentlyTouchedFiles,
            now,
            recentMs: RECENT_MS,
        })
    }, [nodePathColorMap, recentlyTouchedFiles, now, root])

    return (
        <div style={{
            width: 260, background: 'var(--k-bg-panel)',
            borderRight: '1px solid var(--k-border-subtle)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', flexShrink: 0
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 10px 10px',
                borderBottom: '1px solid var(--k-border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: 1, color: 'var(--k-text-dim)'
                }}>
                    {activeWorkspace.name}
                </span>
                <button
                    onClick={() => setFileExplorerOpen(false)}
                    style={{ color: 'var(--k-text-dim)', cursor: 'pointer', padding: 2 }}
                    title="Close explorer"
                >
                    <X size={13} />
                </button>
            </div>

            {/* Workspace summary */}
            {totalInGraph > 0 && (
                <div style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--k-border-subtle)',
                    fontSize: 11,
                    color: 'var(--k-text-dim)',
                    lineHeight: 1.6,
                }}>
                    <div style={{ color: 'var(--k-text-secondary)', marginBottom: 1 }}>
                        {[
                            agentCount > 0 ? `${agentCount} agent${agentCount !== 1 ? 's' : ''}` : '',
                            toolCount > 0 ? `${toolCount} tools` : '',
                            promptCount > 0 ? `${promptCount} prompts` : '',
                        ].filter(Boolean).join(' · ') || `${totalInGraph} nodes`}
                    </div>
                    {ccConnected ? (
                        <div style={{ color: et.connectedColor, fontSize: 10 }}>
                            ● Claude Code connected{ccLastStr ? ` · ${ccLastStr}` : ''}
                        </div>
                    ) : (
                        <div style={{ color: 'var(--k-text-dim)', fontSize: 10 }}>● Claude Code not connected</div>
                    )}
                </div>
            )}

            {/* Instruction Files section */}
            {promptNodes.length > 0 && (
                <div style={{ borderBottom: '1px solid var(--k-border-subtle)', padding: '6px 0' }}>
                    <div style={{ padding: '3px 12px 5px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.25)' }}>
                        Instruction Files
                    </div>
                    {promptNodes.map(pn => {
                        const filePath = (pn.meta as any)?.path as string | undefined
                        const analysis = (pn.meta as any)?.instructionAnalysis
                        const tokens = analysis?.estimatedTokens ?? 0
                        const tokenColor = tokens > 3000 ? (tokens > 6000 ? '#ef4444' : '#f59e0b') : (tokens > 0 ? '#34d399' : 'var(--k-text-dim)')

                        return (
                            <div
                                key={pn.id}
                                onClick={() => {
                                    if (!filePath) return
                                    const abs = activeWorkspace.path.endsWith('/')
                                        ? activeWorkspace.path + filePath
                                        : activeWorkspace.path + '/' + filePath
                                    setOpenFilePath(abs)
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '4px 12px', cursor: 'pointer', fontSize: 11,
                                    color: 'var(--k-text-secondary)',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f472b6', flexShrink: 0 }} />
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pn.name}</span>
                                {tokens > 0 && (
                                    <span style={{ fontSize: 9, fontWeight: 700, color: tokenColor, flexShrink: 0 }}>
                                        ~{tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens}t
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Search */}
            <div style={{ padding: '7px 8px', borderBottom: '1px solid var(--k-border-subtle)' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={11} style={{
                        position: 'absolute', left: 8, color: 'var(--k-text-dim)', pointerEvents: 'none'
                    }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Filter files…"
                        style={{
                            width: '100%', paddingLeft: 26, paddingRight: 8,
                            paddingTop: 4, paddingBottom: 4,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--k-border-subtle)',
                            borderRadius: 5, fontSize: 11,
                            color: 'var(--k-text-primary)', outline: 'none'
                        }}
                    />
                </div>
            </div>

            {/* Jump to Node banner */}
            {matchedNode && (
                <button
                    onClick={handleJumpToNode}
                    title={`Show ${matchedNode.name} in Graph Explorer`}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        width: '100%', padding: '7px 12px',
                        background: et.jumpBg,
                        borderTop: 'none',
                        borderBottom: `1px solid ${et.jumpBorder}`,
                        borderLeft: 'none', borderRight: 'none',
                        cursor: 'pointer',
                        color: et.accent,
                        fontSize: 11, fontWeight: 600,
                        textAlign: 'left',
                        transition: 'background 0.3s ease',
                    }}
                >
                    <Crosshair size={12} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        JUMP TO NODE — {matchedNode.name}
                    </span>
                </button>
            )}

            {/* File list */}
            <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4, paddingBottom: 16 }}>
                {filteredFiles ? (
                    filteredFiles.length > 0
                        ? filteredFiles.map(f => {
                            const relPath = f.path.startsWith(root)
                                ? f.path.slice(root.length).replace(/^\//, '')
                                : f.path
                            const dotColor = nodePathColorMap.get(relPath)
                            const touched = recentlyTouchedFiles[relPath] && (now - recentlyTouchedFiles[relPath]) < RECENT_MS

                            return (
                                <div
                                    key={f.path}
                                    onClick={() => setOpenFilePath(f.path)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '3px 10px', cursor: 'pointer', fontSize: 12,
                                        color: f.path === openFilePath ? et.accent : 'var(--k-text-secondary)',
                                        background: f.path === openFilePath ? et.activeItemBg : 'transparent',
                                        borderLeft: f.path === openFilePath ? `2px solid ${et.accent}` : '2px solid transparent',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    <ExtBadge ext={f.ext} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                        {f.name}
                                    </span>
                                    {dotColor && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0, boxShadow: `0 0 4px ${dotColor}` }} />}
                                    {touched && !dotColor && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />}
                                </div>
                            )
                        })
                        : (
                            <div style={{ padding: '16px 12px', fontSize: 11, color: 'var(--k-text-dim)', textAlign: 'center' }}>
                                No files match "{search}"
                            </div>
                        )
                ) : (
                    rootEntries.map(entry => {
                        return (
                            <TreeRow
                                key={entry.path}
                                entry={entry}
                                depth={0}
                                expanded={expandedDirs.has(entry.path)}
                                loaded={dirContents.has(entry.path)}
                                children={dirContents.get(entry.path) ?? []}
                                onToggle={handleToggle}
                                onSelect={setOpenFilePath}
                                openFilePath={openFilePath}
                                dirContents={dirContents}
                                expandedDirs={expandedDirs}
                                resolveEntryDecorations={resolveEntryDecorations}
                                accent={et.accent}
                                activeItemBg={et.activeItemBg}
                            />
                        )
                    })
                )}
            </div>
        </div>
    )
}
