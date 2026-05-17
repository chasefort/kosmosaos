/**
 * HelpOverlay — a global "help mode" that explains every UI element on hover.
 *
 * When helpMode is active:
 *  - A purple border frames the whole screen to signal the mode is on
 *  - Moving the mouse over any element with a `data-help="id"` attribute
 *    shows a floating explanation card near the cursor
 *  - A subtle hint banner reminds the user what to do
 */

import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../store/app.store'

// ── Help content registry ──────────────────────────────────────────────────────

interface HelpEntry {
    emoji: string
    title: string
    description: string
    color?: string
    tip?: string   // optional "Pro tip" line
}

const HELP_CONTENT: Record<string, HelpEntry> = {
    // ── Toolbar features ────────────────────────────────────────────────────
    'heatmap': {
        emoji: '🌡️',
        color: '#f59e0b',
        title: 'Activity Heatmap',
        description: 'Colors every node by how often it appeared across all your session events. Cold blue = rarely touched. Warm amber = moderate activity. Hot red = most active. Great for spotting overloaded agents and bottlenecks at a glance.',
        tip: 'Enable this after running a few sessions — the more data, the more useful the heat.'
    },
    'blast-radius': {
        emoji: '💥',
        color: '#a78bfa',
        title: 'Blast Radius',
        description: 'Select a node first, then enable Blast Radius. Animated sonar rings expand outward showing how far a bug, deletion, or change would ripple through your system. Inner ring = 1 hop, middle = 2 hops, outer = 3 hops.',
        tip: 'Use this before deleting a tool or agent to understand the downstream impact.'
    },
    'snapshot': {
        emoji: '📸',
        color: '#34d399',
        title: 'Graph Snapshot',
        description: 'Downloads the current 3D graph exactly as it appears on screen — as a full-resolution PNG. Useful for sharing architecture diagrams with teammates, embedding in design docs, or capturing specific states of your system.',
        tip: 'Rotate and zoom to a good angle first, then snapshot for the best image.'
    },
    'summary': {
        emoji: '📝',
        color: '#60a5fa',
        title: 'Architecture Summary',
        description: 'Generates a structured written report of your workspace: node counts by type, all edge relationships, detected entry points, the hottest files by activity frequency, and high-coupling warnings for nodes with too many connections.',
        tip: 'Hit "Copy Markdown" to paste the summary directly into Notion, GitHub, or any doc.'
    },
    'help-mode': {
        emoji: '❓',
        color: '#c084fc',
        title: 'Help Mode',
        description: "You're in Help Mode. Move your mouse over any button, panel, or control and an explanation card will appear here. Click the ? button again — or press Escape — to exit.",
    },

    // ── Graph Explorer (FilterPanel) ─────────────────────────────────────────
    'filter-panel': {
        emoji: '🔭',
        color: '#60a5fa',
        title: 'Graph Explorer',
        description: 'Controls what appears in the 3D Universe. Use the search bar to find nodes by name. Toggle node types on/off to reduce visual noise. Toggle connection lines and labels independently.',
    },
    'search-nodes': {
        emoji: '🔍',
        color: '#60a5fa',
        title: 'Node Search',
        description: 'Filter the 3D graph in real time by node name. Partial matches work — type "auth" to find all authentication-related nodes. Cleared automatically when you open a different workspace.',
    },
    'connections-toggle': {
        emoji: '🔗',
        color: '#60a5fa',
        title: 'Connections (Edges)',
        description: 'Show or hide the lines between nodes. Each line represents a relationship: calls, imports, uses, reads, writes, permits, or denies. Hiding connections gives a cleaner view when you only care about node presence.',
        tip: 'Edge colors match the legend in the bottom-left — hover the legend to learn each type.'
    },
    'edge-labels': {
        emoji: '🏷️',
        color: '#60a5fa',
        title: 'Edge Labels',
        description: 'Toggles the text labels that appear on connection lines, showing the relationship type (calls, imports, reads, writes, etc.). Labels can get cluttered on dense graphs — hide them for a cleaner view.',
    },
    'node-type-filter': {
        emoji: '⬡',
        color: '#60a5fa',
        title: 'Node Type Filter',
        description: 'Toggle this category of nodes on or off in the 3D graph. Each type has a unique shape and color: Agents (circles), Tools (squares), Memory stores, Prompts, APIs, Modules, Files, and Permission scopes.',
        tip: 'Disable "Files" and "Modules" first to reduce clutter and focus on agent relationships.'
    },

    // ── Inspector & context actions ──────────────────────────────────────────
    'inspector-panel': {
        emoji: '🔬',
        color: '#60a5fa',
        title: 'Node Inspector',
        description: 'Slides in when you click any node in the 3D graph or flowchart. Shows the node\'s type, confidence score, file paths, description, and all connected neighbors. Use the Edit button to open the source file in the document editor.',
        tip: 'Double-click a node to fly the camera directly to it and open the inspector.'
    },

    // ── Edge legend ──────────────────────────────────────────────────────────
    'edge-legend': {
        emoji: '🎨',
        color: '#60a5fa',
        title: 'Edge Type Legend',
        description: 'Color key for the relationship types in your graph. Every connection line is colored by what it means: calls (function invocations), imports (code dependencies), reads/writes (data access), permits/denies (permission decisions).',
    },

    // ── Session replay ───────────────────────────────────────────────────────
    'replay-controls': {
        emoji: '▶️',
        color: '#fbbf24',
        title: 'Session Replay Controls',
        description: 'Replays a Claude Code session live on the 3D graph. Gold particles travel along edges as each event fires in sequence. The scrub bar lets you jump to any moment. Speed buttons control how fast events play: 0.5× is great for dense sessions.',
        tip: 'Start a replay from the Runs tab — open a session and click "Replay on 3D".'
    },
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CardState {
    entry: HelpEntry
    x: number
    y: number
}

export function HelpOverlay() {
    const helpMode = useAppStore(s => s.helpMode)
    const setHelpMode = useAppStore(s => s.setHelpMode)
    const [card, setCard] = useState<CardState | null>(null)

    const handleMouseMove = useCallback((e: MouseEvent) => {
        // Walk up the DOM from the event target to find a data-help attribute
        let el = e.target as HTMLElement | null
        while (el && el !== document.body) {
            const helpId = el.getAttribute('data-help')
            if (helpId && HELP_CONTENT[helpId]) {
                setCard({ entry: HELP_CONTENT[helpId], x: e.clientX, y: e.clientY })
                return
            }
            el = el.parentElement
        }
        setCard(null)
    }, [])

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') setHelpMode(false)
    }, [setHelpMode])

    useEffect(() => {
        if (!helpMode) {
            setCard(null)
            return
        }
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [helpMode, handleMouseMove, handleKeyDown])

    if (!helpMode) return null

    return (
        <>
            {/* Purple border frame — shows help mode is active */}
            <div
                style={{
                    position: 'fixed', inset: 0,
                    border: '2px solid rgba(192, 132, 252, 0.5)',
                    boxShadow: 'inset 0 0 80px rgba(192, 132, 252, 0.06)',
                    pointerEvents: 'none',
                    zIndex: 9990,
                    borderRadius: 0,
                }}
            />

            {/* Bottom hint when nothing is hovered */}
            {!card && (
                <div style={{
                    position: 'fixed',
                    bottom: 28,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 9995,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 18px',
                    background: 'rgba(192, 132, 252, 0.12)',
                    border: '1px solid rgba(192, 132, 252, 0.4)',
                    borderRadius: 30,
                    fontSize: 12,
                    color: 'rgba(192, 132, 252, 0.9)',
                    pointerEvents: 'none',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                    whiteSpace: 'nowrap',
                }}>
                    <span style={{ opacity: 0.7 }}>❓</span>
                    Hover any button or panel to learn what it does · <strong>Esc</strong> to exit Help Mode
                </div>
            )}

            {/* Floating explanation card */}
            {card && <HelpCard entry={card.entry} x={card.x} y={card.y} />}
        </>
    )
}

// ── Floating card ─────────────────────────────────────────────────────────────

const CARD_WIDTH = 300

function HelpCard({ entry, x, y }: { entry: HelpEntry; x: number; y: number }) {
    const accentColor = entry.color ?? '#60a5fa'
    const OFFSET_X = 16
    const OFFSET_Y = 12
    // Rough card height estimate (description length determines it)
    const approxH = 140 + (entry.tip ? 36 : 0)

    const left = Math.min(x + OFFSET_X, window.innerWidth - CARD_WIDTH - 20)
    const top  = y + OFFSET_Y + approxH > window.innerHeight
        ? y - approxH - OFFSET_Y
        : y + OFFSET_Y

    return (
        <div style={{
            position: 'fixed',
            left,
            top,
            width: CARD_WIDTH,
            zIndex: 9999,
            background: 'rgba(8, 8, 16, 0.97)',
            border: `1px solid ${accentColor}55`,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: `0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 20px ${accentColor}22`,
            backdropFilter: 'blur(16px)',
            pointerEvents: 'none',
            animation: 'helpcard-in 0.12s ease-out',
        }}>
            {/* Accent top bar */}
            <div style={{ height: 3, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44)` }} />

            <div style={{ padding: '14px 16px 16px' }}>
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{entry.emoji}</span>
                    <span style={{
                        fontWeight: 700, fontSize: 13,
                        color: accentColor,
                        letterSpacing: '-0.01em',
                    }}>
                        {entry.title}
                    </span>
                </div>

                {/* Description */}
                <p style={{
                    margin: '0 0 0',
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.72)',
                    lineHeight: 1.6,
                }}>
                    {entry.description}
                </p>

                {/* Pro tip */}
                {entry.tip && (
                    <div style={{
                        marginTop: 10,
                        padding: '7px 10px',
                        borderRadius: 6,
                        background: `${accentColor}12`,
                        border: `1px solid ${accentColor}25`,
                        fontSize: 11,
                        color: accentColor,
                        lineHeight: 1.5,
                    }}>
                        <span style={{ fontWeight: 700, opacity: 0.8 }}>💡 Tip: </span>
                        {entry.tip}
                    </div>
                )}
            </div>
        </div>
    )
}
