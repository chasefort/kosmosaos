import { KosmosRun } from '../../../../shared/types'
import { CheckCircle2, XCircle, Clock, Cpu, Wrench } from 'lucide-react'

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
    claude_code: { label: 'Claude Code', color: '#60a5fa' },
    openclaw:    { label: 'OpenClaw',    color: '#34d399' },
    sdk:         { label: 'SDK',         color: '#a78bfa' },
    mock:        { label: 'Demo',        color: '#64748b' },
}

function formatDuration(startMs: number, endMs?: number): string {
    if (!endMs) return ''
    const ms = endMs - startMs
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`
    return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

function shortModel(model: string): string {
    if (!model) return ''
    const lower = model.toLowerCase()
    if (lower.includes('opus'))   return 'Opus'
    if (lower.includes('sonnet')) return 'Sonnet'
    if (lower.includes('haiku'))  return 'Haiku'
    if (lower.includes('gpt-4o')) return 'GPT-4o'
    if (lower.includes('gpt-4'))  return 'GPT-4'
    if (lower.includes('gemini')) return 'Gemini'
    return model.split('-').slice(0, 2).join('-')
}

export function RunList({ runs, activeRunId, onSelect }: {
    runs: KosmosRun[]
    activeRunId?: string
    onSelect: (r: KosmosRun) => void
}) {
    if (runs.length === 0) {
        return (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--k-text-dim)', fontSize: 13 }}>
                No sessions recorded yet.
            </div>
        )
    }

    // Sort live runs to the top
    const sorted = [...runs].sort((a, b) => {
        const aLive = a.status === 'running' ? 0 : 1
        const bLive = b.status === 'running' ? 0 : 1
        return aLive - bLive
    })

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sorted.map(run => {
                const active   = run.id === activeRunId
                const isLive   = run.status === 'running'
                const meta     = (run.meta ?? {}) as Record<string, unknown>
                const summary  = (meta.summary as string) ?? ''
                const model    = shortModel((meta.model as string) ?? '')
                const tools    = (meta.toolCallCount as number) ?? 0
                const src      = SOURCE_LABELS[run.source] ?? SOURCE_LABELS.mock
                const duration = formatDuration(run.startedAt, run.endedAt)

                return (
                    <div
                        key={run.id}
                        onClick={() => onSelect(run)}
                        style={{
                            padding: '14px 18px',
                            borderBottom: '1px solid var(--k-border-subtle)',
                            cursor: 'pointer',
                            background: active ? 'rgba(255,255,255,0.05)' : isLive ? 'rgba(96,165,250,0.04)' : 'transparent',
                            borderLeft: `3px solid ${active ? 'var(--k-accent-purple)' : isLive ? '#60a5fa' : 'transparent'}`,
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = active ? 'rgba(255,255,255,0.05)' : isLive ? 'rgba(96,165,250,0.04)' : 'transparent' }}
                    >
                        {/* Row 1: status + source badge + event count */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {run.status === 'completed' && <CheckCircle2 size={13} color="var(--k-status-ok)" />}
                                {run.status === 'error'     && <XCircle      size={13} color="var(--k-status-error)" />}
                                {isLive && (
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', boxShadow: '0 0 6px #60a5fa', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                                )}
                                <span style={{ fontSize: 12, fontWeight: 600, color: src.color }}>
                                    {src.label}
                                </span>
                                {isLive && (
                                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.5px', color: '#60a5fa', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4, padding: '1px 5px' }}>
                                        LIVE
                                    </span>
                                )}
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--k-text-dim)' }}>
                                {run.eventCount} events
                            </span>
                        </div>

                        {/* Row 2: session summary (2-line clamp) */}
                        {summary && (
                            <div style={{
                                fontSize: 12,
                                color: 'var(--k-text-primary)',
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical' as const,
                                lineHeight: 1.4,
                                marginBottom: 6,
                            }}>
                                {summary}
                            </div>
                        )}

                        {/* Row 3: timestamp + model + tool count + duration */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--k-text-dim)' }}>
                                <Clock size={10} />
                                {new Date(run.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {model && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--k-text-dim)' }}>
                                    <Cpu size={10} />
                                    {model}
                                </span>
                            )}
                            {tools > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--k-text-dim)' }}>
                                    <Wrench size={10} />
                                    {tools} tool calls
                                </span>
                            )}
                            {duration && (
                                <span style={{ fontSize: 11, color: 'var(--k-text-dim)', marginLeft: 'auto' }}>
                                    {duration}
                                </span>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
