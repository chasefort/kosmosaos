/**
 * TerminalPanel — embedded PTY terminal with tabbed interface.
 *
 * Features:
 *  - Bottom or right-side docking (toggle in header)
 *  - Drag-to-resize handle
 *  - Multiple tabs (Shell / Claude Code quick-launch)
 *  - Click-to-focus, keyboard shortcut ⌘`
 *  - Dark glass UI matching Kosmos design language
 */

import { useEffect, useRef, useState, useCallback, type MouseEvent as RMouseEvent } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import {
    X, Plus, ChevronDown, Terminal,
    LayoutPanelTop, LayoutPanelLeft, Maximize2, Minimize2,
} from 'lucide-react'
import { useAppStore } from '../store/app.store'
import { useGraphStore, type GraphTheme } from '../store/graph.store'
import 'xterm/css/xterm.css'

// ── Per-theme xterm color palettes ────────────────────────────────────────────
const XTERM_THEMES: Record<GraphTheme, Record<string, string>> = {
    default: {
        background:          '#0c0c13',
        foreground:          '#d4d4e0',
        cursor:              '#60a5fa',
        cursorAccent:        '#0c0c13',
        selectionBackground: 'rgba(96,165,250,0.25)',
        black:   '#1a1a2e', red:     '#f87171', green:   '#34d399', yellow:  '#fbbf24',
        blue:    '#60a5fa', magenta: '#a78bfa', cyan:    '#22d3ee', white:   '#d4d4e0',
        brightBlack:   '#4a4a6a', brightRed:     '#fb7185', brightGreen:   '#6ee7b7',
        brightYellow:  '#fde68a', brightBlue:    '#93c5fd', brightMagenta: '#c4b5fd',
        brightCyan:    '#67e8f9', brightWhite:   '#f8f8fc',
    },
    nebula: {
        background:          '#0d0818',
        foreground:          '#e2d4f8',
        cursor:              '#c084fc',
        cursorAccent:        '#0d0818',
        selectionBackground: 'rgba(192,132,252,0.25)',
        black:   '#1a0d2e', red:     '#f87171', green:   '#34d399', yellow:  '#fbbf24',
        blue:    '#818cf8', magenta: '#e879f9', cyan:    '#a5f3fc', white:   '#e2d4f8',
        brightBlack:   '#5a3a7a', brightRed:     '#fb7185', brightGreen:   '#6ee7b7',
        brightYellow:  '#fde68a', brightBlue:    '#a5b4fc', brightMagenta: '#f0abfc',
        brightCyan:    '#cffafe', brightWhite:   '#f5f0ff',
    },
    cyberpunk: {
        background:          '#020208',
        foreground:          '#e0f0e8',
        cursor:              '#00f5d4',
        cursorAccent:        '#020208',
        selectionBackground: 'rgba(0,245,212,0.2)',
        black:   '#0a0a14', red:     '#ff3366', green:   '#00f5a0', yellow:  '#ffd700',
        blue:    '#00b4ff', magenta: '#ff00cc', cyan:    '#00f5d4', white:   '#e0f0e8',
        brightBlack:   '#2a2a3a', brightRed:     '#ff6688', brightGreen:   '#33ffbb',
        brightYellow:  '#ffe44d', brightBlue:    '#44ccff', brightMagenta: '#ff44dd',
        brightCyan:    '#44ffee', brightWhite:   '#ffffff',
    },
}

// ── Per-theme panel chrome colors ─────────────────────────────────────────────
const PANEL_THEMES: Record<GraphTheme, {
    panelBg: string; tabBarBg: string; popupBg: string
    accent: string; border: string; tabActiveBg: string; dot: string
}> = {
    default: {
        panelBg:     '#0c0c13',
        tabBarBg:    '#080810',
        popupBg:     '#16161f',
        accent:      '#60a5fa',
        border:      'rgba(255,255,255,0.07)',
        tabActiveBg: 'rgba(255,255,255,0.07)',
        dot:         '#34d399',
    },
    nebula: {
        panelBg:     '#0d0818',
        tabBarBg:    '#08050f',
        popupBg:     '#140d22',
        accent:      '#c084fc',
        border:      'rgba(180,100,255,0.13)',
        tabActiveBg: 'rgba(180,100,255,0.1)',
        dot:         '#e879f9',
    },
    cyberpunk: {
        panelBg:     '#020208',
        tabBarBg:    '#000005',
        popupBg:     '#05050f',
        accent:      '#00f5d4',
        border:      'rgba(0,245,212,0.13)',
        tabActiveBg: 'rgba(0,245,212,0.08)',
        dot:         '#00f5a0',
    },
}

// ── ID counter ────────────────────────────────────────────────────────────────
let tabIdCounter = 0
function genId() { return `term-${++tabIdCounter}-${Date.now()}` }

interface TermTab { id: string; label: string; exited?: boolean }

// ── Quick-launch options ───────────────────────────────────────────────────────
const QUICK_LAUNCH = [
    { label: 'Shell',        icon: '⌨',  cmd: undefined     },
    { label: 'Claude Code',  icon: '◇',  cmd: 'claude\n'    },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// ─────────────────────────────────────────────────────────────────────────────
export function TerminalPanel() {
    const {
        setTerminalOpen,
        terminalPosition, setTerminalPosition,
        activeWorkspace,
    } = useAppStore()
    const graphTheme = useGraphStore(s => s.theme)
    const tp = PANEL_THEMES[graphTheme] ?? PANEL_THEMES.default

    const [tabs, setTabs] = useState<TermTab[]>([])
    const [activeTabId, setActiveTabId] = useState<string | null>(null)
    const [size, setSize] = useState(300)            // px (height for bottom, width for right)
    const [isResizing, setIsResizing] = useState(false)
    const [quickAnchor, setQuickAnchor] = useState<{ x: number; y: number } | null>(null)
    const [maximised, setMaximised] = useState(false)

    const resizeStart = useRef({ pos: 0, size: 0 })
    const isBottom = terminalPosition === 'bottom'

    // ── Keyboard shortcut ⌘` ─────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === '`') setTerminalOpen(false)
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [setTerminalOpen])

    // ── Create a new tab — batch state so activeTabId is set before first render
    const createTab = useCallback(async (label: string, cmd?: string) => {
        const id = genId()
        // Batch both updates in a single React flush so TerminalInstance mounts
        // with active=true (container is visible when term.open() is called)
        setTabs(prev => [...prev, { id, label }])
        setActiveTabId(id)
        setQuickAnchor(null)
        // Spawn PTY after a tick so the DOM has painted
        setTimeout(async () => {
            await window.api.spawnTerminal({ id, cwd: activeWorkspace?.path })
            if (cmd) setTimeout(() => window.api.writeTerminal(id, cmd), 400)
        }, 50)
    }, [activeWorkspace])

    useEffect(() => {
        if (tabs.length === 0) createTab('Shell')
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Tab close ────────────────────────────────────────────────────────────
    const closeTab = useCallback(async (id: string) => {
        await window.api.killTerminal(id)
        setTabs(prev => {
            const next = prev.filter(t => t.id !== id)
            if (activeTabId === id) setActiveTabId(next.at(-1)?.id ?? null)
            return next
        })
    }, [activeTabId])

    // ── Mark tab as exited ───────────────────────────────────────────────────
    const markExited = useCallback((id: string) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, exited: true } : t))
    }, [])

    // ── Resize drag ──────────────────────────────────────────────────────────
    const onResizeMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
        resizeStart.current = { pos: isBottom ? e.clientY : e.clientX, size }
    }

    useEffect(() => {
        if (!isResizing) return
        const onMove = (e: MouseEvent) => {
            const delta = isBottom
                ? resizeStart.current.pos - e.clientY
                : resizeStart.current.pos - e.clientX
            setSize(clamp(resizeStart.current.size + delta, 140, isBottom ? 700 : 800))
        }
        const onUp = () => setIsResizing(false)
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    }, [isResizing, isBottom])

    // ── Computed sizes ────────────────────────────────────────────────────────
    const panelStyle: React.CSSProperties = maximised
        ? { position: 'fixed', inset: 0, zIndex: 200, background: tp.panelBg }
        : isBottom
            ? { height: size, flexShrink: 0 }
            : { width: size, flexShrink: 0 }

    const resizeHandleStyle: React.CSSProperties = isBottom
        ? { position: 'absolute', top: 0, left: 0, right: 0, height: 5, cursor: 'ns-resize', zIndex: 10, background: isResizing ? tp.accent + '44' : 'transparent' }
        : { position: 'absolute', top: 0, bottom: 0, left: 0, width: 5, cursor: 'ew-resize', zIndex: 10, background: isResizing ? tp.accent + '44' : 'transparent' }

    const contentHeight = maximised
        ? 'calc(100vh - 36px)'
        : isBottom
            ? `${size - 36}px`
            : '100%'

    return (
        <div style={{
            ...panelStyle,
            display: 'flex',
            flexDirection: 'column',
            background: tp.panelBg,
            borderTop: isBottom ? `1px solid ${tp.border}` : 'none',
            borderLeft: !isBottom ? `1px solid ${tp.border}` : 'none',
            position: 'relative',
            userSelect: isResizing ? 'none' : 'auto',
            transition: 'background 0.4s ease, border-color 0.4s ease',
        }}>

            {/* Drag-to-resize handle */}
            <div onMouseDown={onResizeMouseDown} style={resizeHandleStyle} />

            {/* ── Tab bar ──────────────────────────────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center',
                height: 36, flexShrink: 0,
                background: tp.tabBarBg,
                borderBottom: `1px solid ${tp.border}`,
                gap: 1, paddingLeft: 6, paddingRight: 4,
                transition: 'background 0.4s ease',
            }}>
                {/* Panel icon */}
                <Terminal size={12} style={{ color: 'rgba(255,255,255,0.2)', marginRight: 6, flexShrink: 0 }} />

                {/* Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, overflow: 'hidden' }}>
                    {tabs.map(tab => {
                        const isActive = tab.id === activeTabId
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTabId(tab.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '0 10px 0 12px',
                                    height: 28, borderRadius: 6,
                                    background: isActive ? tp.tabActiveBg : 'transparent',
                                    color: isActive
                                        ? (tab.exited ? 'rgba(255,255,255,0.3)' : '#e2e2e2')
                                        : 'rgba(255,255,255,0.3)',
                                    fontSize: 11.5,
                                    fontWeight: isActive ? 600 : 400,
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                    borderBottom: isActive ? `1px solid ${tp.accent}80` : '1px solid transparent',
                                    transition: 'background 0.1s, color 0.1s',
                                    cursor: 'pointer',
                                }}
                            >
                                {/* Active dot */}
                                {!tab.exited && (
                                    <span style={{
                                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                        background: isActive ? tp.dot : 'rgba(255,255,255,0.15)',
                                        boxShadow: isActive ? `0 0 5px ${tp.dot}` : 'none',
                                    }} />
                                )}
                                <span>{tab.label}</span>
                                <span
                                    onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                                    style={{
                                        color: 'rgba(255,255,255,0.2)',
                                        padding: 2, borderRadius: 3,
                                        display: 'flex', alignItems: 'center',
                                        cursor: 'pointer', fontSize: 10, lineHeight: 1,
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                                >
                                    <X size={10} />
                                </span>
                            </button>
                        )
                    })}

                    {/* New tab button — opens a position:fixed popup to avoid overflow:hidden clipping */}
                    <button
                        onClick={(e: RMouseEvent<HTMLButtonElement>) => {
                            const r = e.currentTarget.getBoundingClientRect()
                            setQuickAnchor(a => a ? null : { x: r.left, y: r.top })
                        }}
                        title="New terminal"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 3,
                            padding: '0 8px', height: 26, borderRadius: 6,
                            color: quickAnchor ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
                            fontSize: 11, cursor: 'pointer',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                        onMouseLeave={e => (e.currentTarget.style.color = quickAnchor ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)')}
                    >
                        <Plus size={13} />
                    </button>
                </div>

                {/* ── Right controls ──────────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    {/* Position toggle */}
                    <button
                        onClick={() => setTerminalPosition(isBottom ? 'right' : 'bottom')}
                        title={isBottom ? 'Move to right panel' : 'Move to bottom panel'}
                        style={{ padding: '4px 7px', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', borderRadius: 5, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
                    >
                        {isBottom ? <LayoutPanelLeft size={13} /> : <LayoutPanelTop size={13} />}
                    </button>

                    {/* Maximise */}
                    <button
                        onClick={() => setMaximised(v => !v)}
                        title={maximised ? 'Restore' : 'Maximise'}
                        style={{ padding: '4px 7px', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', borderRadius: 5, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
                    >
                        {maximised ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>

                    {/* Close */}
                    <button
                        onClick={() => setTerminalOpen(false)}
                        title="Hide terminal (⌘`)"
                        style={{ padding: '4px 7px', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', borderRadius: 5, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
                    >
                        <ChevronDown size={13} />
                    </button>
                </div>
            </div>

            {/* ── New-tab popup — position:fixed so it escapes overflow:hidden ── */}
            {quickAnchor && (
                <>
                    {/* Backdrop */}
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                        onClick={() => setQuickAnchor(null)}
                    />
                    {/* Menu — appears above the + button */}
                    <div style={{
                        position: 'fixed',
                        left: quickAnchor.x,
                        top: quickAnchor.y - 104,   // opens upward
                        zIndex: 9999,
                        background: tp.popupBg,
                        border: `1px solid ${tp.border}`,
                        borderRadius: 8,
                        overflow: 'hidden',
                        minWidth: 160,
                        boxShadow: `0 -4px 24px rgba(0,0,0,0.7), 0 0 0 1px ${tp.accent}18`,
                    }}>
                        <div style={{ padding: '7px 12px 5px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.25)' }}>
                            New Terminal
                        </div>
                        {QUICK_LAUNCH.map(opt => (
                            <button
                                key={opt.label}
                                onClick={() => createTab(opt.label, opt.cmd)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    width: '100%', padding: '9px 14px',
                                    fontSize: 12.5, color: '#d4d4e8', cursor: 'pointer',
                                    textAlign: 'left',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <span style={{ fontSize: 14, width: 20, textAlign: 'center', opacity: 0.65 }}>{opt.icon}</span>
                                <span>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* ── Terminal content area ─────────────────────────────────────── */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', height: contentHeight }}>
                {tabs.map(tab => (
                    <TerminalInstance
                        key={tab.id}
                        id={tab.id}
                        active={tab.id === activeTabId}
                        onExited={() => markExited(tab.id)}
                    />
                ))}
                {tabs.length === 0 && (
                    <div style={{
                        height: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255,255,255,0.2)', fontSize: 12,
                    }}>
                        Click <Plus size={11} style={{ margin: '0 4px' }} /> to open a terminal
                    </div>
                )}
            </div>
        </div>
    )
}

// ── TerminalInstance ──────────────────────────────────────────────────────────

const fitTimers: Record<string, ReturnType<typeof setTimeout>> = {}

function TerminalInstance({
    id,
    active,
    onExited,
}: {
    id: string
    active: boolean
    onExited: () => void
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<XTerm | null>(null)
    const fitRef = useRef<FitAddon | null>(null)
    // Store onExited in a ref so it never triggers a terminal re-mount
    const onExitedRef = useRef(onExited)
    useEffect(() => { onExitedRef.current = onExited }, [onExited])

    // ── Live theme sync ────────────────────────────────────────────────────
    const graphTheme = useGraphStore(s => s.theme)
    useEffect(() => {
        const term = xtermRef.current
        if (!term) return
        term.options.theme = XTERM_THEMES[graphTheme] ?? XTERM_THEMES.default
    }, [graphTheme])

    const doFit = useCallback(() => {
        clearTimeout(fitTimers[id])
        fitTimers[id] = setTimeout(() => {
            const el = containerRef.current
            if (!el || !fitRef.current || !xtermRef.current) return
            // Only fit when container has real dimensions
            if (el.offsetWidth < 10 || el.offsetHeight < 10) return
            try {
                fitRef.current.fit()
                window.api.resizeTerminal(id, xtermRef.current.cols, xtermRef.current.rows)
            } catch { /* ignore race */ }
        }, 80)
    }, [id])

    // ── Mount: create terminal ─────────────────────────────────────────────
    useEffect(() => {
        const el = containerRef.current
        if (!el || xtermRef.current) return

        const term = new XTerm({
            allowProposedApi: true,
            theme: XTERM_THEMES[graphTheme] ?? XTERM_THEMES.default,
            fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, Consolas, monospace',
            fontSize: 12.5,
            lineHeight: 1.45,
            letterSpacing: 0.3,
            cursorBlink: true,
            cursorStyle: 'bar',
            scrollback: 5000,
            allowTransparency: true,
        })

        const fit = new FitAddon()
        term.loadAddon(fit)
        term.open(el)

        // Fit once after paint — guard against zero-size container
        requestAnimationFrame(() => {
            if (!el || el.offsetWidth < 10 || el.offsetHeight < 10) return
            try {
                fit.fit()
                window.api.resizeTerminal(id, term.cols, term.rows)
            } catch { /* ignore */ }
        })

        xtermRef.current = term
        fitRef.current = fit

        // User keystroke / paste → PTY
        term.onData(data => window.api.writeTerminal(id, data))

        // PTY output → terminal
        const offOutput = window.api.onTerminalOutput(({ id: eid, data }) => {
            if (eid === id) term.write(data)
        })

        // PTY exit
        const offExit = window.api.onTerminalExit(({ id: eid, exitCode }) => {
            if (eid !== id) return
            term.write(`\r\n\x1b[2m[Process exited — code ${exitCode}]\x1b[0m\r\n`)
            onExitedRef.current()
        })

        return () => {
            offOutput()
            offExit()
            clearTimeout(fitTimers[id])
            term.dispose()
            xtermRef.current = null
            fitRef.current = null
        }
    }, [id]) // ← id only — onExited lives in a ref so it never re-mounts the terminal

    // ── Focus + fit when tab becomes active ──────────────────────────────────
    useEffect(() => {
        if (!active) return
        doFit()
        setTimeout(() => xtermRef.current?.focus(), 100)
    }, [active, doFit])

    // ── Refit when panel resizes ─────────────────────────────────────────────
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const ro = new ResizeObserver(() => {
            // Guard: only fit when xterm renderer is ready
            const core = (xtermRef.current as any)?._core
            if (!core?._renderService?.dimensions) return
            doFit()
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [doFit])

    return (
        <div
            ref={containerRef}
            onClick={() => xtermRef.current?.focus()}
            style={{
                position: 'absolute', inset: 0,
                padding: '6px 2px 4px 4px',
                // Use visibility instead of display:none — xterm's renderer needs
                // the container to have real dimensions even when the tab is hidden
                visibility: active ? 'visible' : 'hidden',
                pointerEvents: active ? 'auto' : 'none',
                cursor: 'text',
            }}
        />
    )
}
