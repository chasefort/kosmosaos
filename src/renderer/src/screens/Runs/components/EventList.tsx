import { useEffect, useRef } from 'react'
import { KosmosEvent } from '../../../../shared/types'
import { Terminal, Database, MessageSquare, AlertTriangle, MonitorPlay, User, Bot, Zap } from 'lucide-react'

/** Extract a short readable snippet from an event for the list view */
function getSnippet(ev: KosmosEvent): string {
    if (ev.type === 'user_prompt') {
        const text = (ev.input as any)?.text as string | undefined
        if (text) return text.slice(0, 72)
    }
    if (ev.type === 'assistant_response') {
        const text = (ev.output as any)?.text as string | undefined
        if (text) return text.slice(0, 72)
    }
    if (ev.type === 'tool_call') {
        const name = ev.toolName ?? ''
        if (ev.phase === 'end') {
            const out = ev.output
            if (out && typeof out === 'object') {
                const text = (out as any).text ?? (out as any).result ?? ''
                if (text) return `→ ${String(text).slice(0, 60)}`
            }
            return `${name} completed`
        }
        const inp = ev.input
        if (inp && typeof inp === 'object') {
            const first = Object.entries(inp)[0]
            if (first) return `${first[0]}: ${String(first[1]).slice(0, 55)}`
        }
        return name
    }
    if (ev.type === 'agent_activity') {
        const text = (ev.output as any)?.summary as string | undefined
        if (text) return text.slice(0, 72)
        const inputText = (ev.input as any)?.text as string | undefined
        if (inputText) return inputText.slice(0, 72)
        return ev.agentId ? String(ev.agentId).slice(0, 72) : 'Agent activity'
    }
    if (ev.type === 'error') {
        return ev.error?.slice(0, 72) ?? 'Error'
    }
    return ''
}

const TYPE_META: Record<string, { label: string; color: string }> = {
    user_prompt:        { label: 'User',        color: '#60a5fa' },
    assistant_response: { label: 'Assistant',   color: '#a78bfa' },
    tool_call:          { label: 'Tool Call',   color: '#34d399' },
    memory_read:        { label: 'Memory Read', color: '#fbbf24' },
    memory_write:       { label: 'Memory Write',color: '#f87171' },
    session_start:      { label: 'Session Start', color: '#64748b' },
    session_end:        { label: 'Session End',   color: '#64748b' },
    model_call:         { label: 'Model Call',  color: '#f472b6' },
    agent_activity:     { label: 'Agent Activity', color: '#38bdf8' },
    error:              { label: 'Error',       color: '#ef4444' },
}

function getIcon(type: string) {
    switch (type) {
        case 'user_prompt':        return <User size={13} />
        case 'assistant_response': return <Bot size={13} />
        case 'tool_call':          return <Terminal size={13} />
        case 'memory_read':
        case 'memory_write':       return <Database size={13} />
        case 'model_call':         return <Zap size={13} />
        case 'agent_activity':     return <Bot size={13} />
        case 'session_start':
        case 'session_end':        return <MonitorPlay size={13} />
        case 'error':              return <AlertTriangle size={13} />
        default:                   return <MessageSquare size={13} />
    }
}

export function EventList({ events, playhead, onSelect, isLive }: {
    events: KosmosEvent[]
    playhead: number
    onSelect: (idx: number) => void
    isLive?: boolean
}) {
    const bottomRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom when new live events arrive, but only if user is
    // already near the bottom (don't hijack scroll when user is reviewing history)
    useEffect(() => {
        if (!isLive || !containerRef.current) return
        const el = containerRef.current
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
        if (nearBottom) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
    }, [events.length, isLive])

    return (
        <div ref={containerRef} style={{ width: 340, borderRight: '1px solid var(--k-border-subtle)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {events.map((ev, i) => {
                const active  = i === playhead
                const meta    = TYPE_META[ev.type] ?? { label: ev.type, color: '#64748b' }
                const snippet = getSnippet(ev)
                const isError = ev.type === 'error'

                // For tool calls, show a slightly different title
                const title = ev.type === 'tool_call' && ev.toolName
                    ? ev.toolName + (ev.phase === 'end' ? ' ↩' : '')
                    : ev.type === 'agent_activity' && ev.agentId
                        ? `Agent: ${ev.agentId}`
                        : meta.label

                // Latency badge for tool calls
                const showLatency = (ev.type === 'tool_call' || ev.type === 'model_call') && ev.durationMs != null && ev.durationMs > 0
                const latencyColor = ev.durationMs != null
                    ? ev.durationMs < 500 ? '#34d399' : ev.durationMs < 2000 ? '#fbbf24' : '#ef4444'
                    : '#64748b'

                return (
                    <div
                        key={ev.id}
                        onClick={() => onSelect(i)}
                        style={{
                            padding: '10px 16px',
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                            cursor: 'pointer',
                            background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                            borderLeft: `2px solid ${active ? meta.color : 'transparent'}`,
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = active ? 'rgba(255,255,255,0.06)' : 'transparent' }}
                    >
                        {/* Row 1: icon + type label + latency badge + time */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: snippet ? 4 : 0 }}>
                            <span style={{ color: isError ? 'var(--k-status-error)' : active ? meta.color : 'var(--k-text-dim)', flexShrink: 0 }}>
                                {getIcon(ev.type)}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: active ? meta.color : 'var(--k-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {title}
                            </span>
                            {showLatency && (
                                <span style={{
                                    fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                                    background: `${latencyColor}18`, color: latencyColor,
                                    border: `1px solid ${latencyColor}40`, flexShrink: 0,
                                }}>
                                    {ev.durationMs! < 1000 ? `${ev.durationMs}ms` : `${(ev.durationMs! / 1000).toFixed(1)}s`}
                                </span>
                            )}
                            <span style={{ fontSize: 10, color: 'var(--k-text-dim)', flexShrink: 0 }}>
                                {new Date(ev.tsMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        </div>

                        {/* Row 2: snippet text */}
                        {snippet && (
                            <div style={{
                                fontSize: 11,
                                color: 'var(--k-text-dim)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                paddingLeft: 19,
                            }}>
                                {snippet}
                            </div>
                        )}
                    </div>
                )
            })}
            <div ref={bottomRef} />
        </div>
    )
}
