import { KosmosEvent } from '../../../../shared/types'
import { Clock, Hash, Timer } from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: 'rgba(255,255,255,0.3)',
            marginBottom: 8,
        }}>
            {children}
        </div>
    )
}

function CodeBlock({ value }: { value: unknown }) {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    return (
        <div style={{
            background: 'rgba(0,0,0,0.35)', border: '1px solid var(--k-border-subtle)',
            borderRadius: 8, padding: '12px 14px', overflowX: 'auto',
        }}>
            <pre style={{
                margin: 0, fontSize: 12, color: 'var(--k-text-primary)',
                fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
                {text}
            </pre>
        </div>
    )
}

/** Readable prose block — for user_prompt / assistant_response text */
function TextBlock({ text }: { text: string }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--k-border-subtle)',
            borderRadius: 8, padding: '14px 16px', fontSize: 13,
            color: 'var(--k-text-primary)', lineHeight: 1.65,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflowY: 'auto',
        }}>
            {text}
        </div>
    )
}

const EVENT_COLORS: Record<string, string> = {
    user_prompt:        '#60a5fa',
    assistant_response: '#a78bfa',
    tool_call:          '#34d399',
    memory_read:        '#fbbf24',
    memory_write:       '#f87171',
    model_call:         '#f472b6',
    agent_activity:     '#38bdf8',
    error:              '#ef4444',
    session_start:      '#64748b',
    session_end:        '#64748b',
}

// ── main component ────────────────────────────────────────────────────────────

export function EventDetailPanel({ event }: { event: KosmosEvent }) {
    const isError  = event.type === 'error' || event.phase === 'error'
    const color    = isError ? 'var(--k-status-error)' : (EVENT_COLORS[event.type] ?? 'var(--k-text-primary)')

    // Human-readable title
    const titleMap: Partial<Record<string, string>> = {
        user_prompt:        'User Prompt',
        assistant_response: 'Assistant Response',
        tool_call:          event.toolName ? `Tool: ${event.toolName}` : 'Tool Call',
        memory_read:        'Memory Read',
        memory_write:       'Memory Write',
        model_call:         'Model Call',
        agent_activity:     event.agentId ? `Agent Activity: ${event.agentId}` : 'Agent Activity',
        error:              'Error',
        session_start:      'Session Start',
        session_end:        'Session End',
    }
    const title = titleMap[event.type] ?? event.type.replace(/_/g, ' ')
    const phaseLabel = event.phase === 'start' ? 'invoked' : event.phase === 'end' ? 'returned' : event.phase

    // Extract text body for prose events
    const promptText   = event.type === 'user_prompt'        ? (event.input as any)?.text as string | undefined  : undefined
    const responseText = event.type === 'assistant_response' ? (event.output as any)?.text as string | undefined : undefined

    return (
        <div style={{
            flex: 1, padding: '28px 28px', overflowY: 'auto',
            background: 'var(--k-bg-panel)', display: 'flex', flexDirection: 'column', gap: 20,
        }}>

            {/* ── Header ── */}
            <div style={{ borderBottom: '1px solid var(--k-border-subtle)', paddingBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color, marginBottom: 6 }}>
                    {phaseLabel ? `${event.type.replace(/_/g, ' ')} · ${phaseLabel}` : event.type.replace(/_/g, ' ')}
                </div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: isError ? 'var(--k-status-error)' : 'var(--k-text-primary)' }}>
                    {title}
                </h2>
                <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--k-text-dim)' }}>
                        <Clock size={10} />
                        {new Date(event.tsMs).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    {event.durationMs !== undefined && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--k-text-dim)' }}>
                            <Timer size={10} />
                            {event.durationMs}ms
                        </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace' }}>
                        <Hash size={10} />
                        {event.id.slice(0, 10)}
                    </span>
                </div>
            </div>

            {/* ── Error ── */}
            {event.error && (
                <div style={{ padding: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8 }}>
                    <Label>Error</Label>
                    <div style={{ color: 'var(--k-status-error)', fontSize: 13, whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.55 }}>
                        {event.error}
                    </div>
                </div>
            )}

            {/* ── User Prompt — render as readable text ── */}
            {promptText && (
                <div>
                    <Label>Prompt</Label>
                    <TextBlock text={promptText} />
                </div>
            )}

            {/* ── Assistant Response — render as readable text ── */}
            {responseText && (
                <div>
                    <Label>Response</Label>
                    <TextBlock text={responseText} />
                </div>
            )}

            {/* ── Tool Call — structured input + output ── */}
            {event.type === 'tool_call' && event.input && Object.keys(event.input).length > 0 && (
                <div>
                    <Label>Input</Label>
                    <CodeBlock value={event.input} />
                </div>
            )}
            {event.type === 'tool_call' && event.output && Object.keys(event.output).length > 0 && (
                <div>
                    <Label>Output</Label>
                    <CodeBlock value={event.output} />
                </div>
            )}

            {/* ── Fallback: raw input/output for other event types ── */}
            {event.type !== 'user_prompt' && event.type !== 'assistant_response' && event.type !== 'tool_call' && (
                <>
                    {event.input && Object.keys(event.input).length > 0 && (
                        <div>
                            <Label>Input</Label>
                            <CodeBlock value={event.input} />
                        </div>
                    )}
                    {event.output && Object.keys(event.output).length > 0 && (
                        <div>
                            <Label>Output</Label>
                            <CodeBlock value={event.output} />
                        </div>
                    )}
                </>
            )}

            {/* ── Involved Nodes ── */}
            {event.nodeIds.length > 0 && (
                <div>
                    <Label>Nodes Referenced</Label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {event.nodeIds.map(id => (
                            <span key={id} style={{
                                padding: '3px 10px', background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--k-border-subtle)', borderRadius: 12,
                                fontSize: 11, color: 'var(--k-text-dim)', fontFamily: 'monospace',
                            }}>
                                {id.split(':').pop() || id}
                            </span>
                        ))}
                    </div>
                </div>
            )}

        </div>
    )
}
