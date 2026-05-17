import { useEffect, useMemo, useState } from 'react'
import { Bot, Wrench, FileText, Cpu, Activity } from 'lucide-react'
import { useAppStore } from '../store/app.store'

function sourceLabel(source: string): string {
    if (source === 'claude_code') return 'Claude'
    if (source === 'openclaw') return 'OpenClaw'
    if (source === 'sdk') return 'SDK'
    return 'Runtime'
}

function operationLabel(operation: string): string {
    if (operation === 'file_write') return 'write'
    if (operation === 'file_read') return 'read'
    return operation.replace(/_/g, ' ')
}

function statusColor(status: string): string {
    if (status === 'error') return '#ef4444'
    if (status === 'end') return '#34d399'
    if (status === 'start') return '#60a5fa'
    return '#a78bfa'
}

export function LiveActivityRail() {
    const liveActivity = useAppStore(s => s.liveActivity)
    const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 760 : false)

    useEffect(() => {
        const onResize = () => setIsNarrow(window.innerWidth < 760)
        onResize()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const items = useMemo(() => liveActivity.slice(0, 5), [liveActivity])
    if (items.length === 0 || isNarrow) return null

    return (
        <div style={{
            position: 'absolute',
            top: 54,
            right: 20,
            zIndex: 11,
            width: 340,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            pointerEvents: 'none',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(10,10,18,0.9)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'var(--k-text-secondary)',
                backdropFilter: 'blur(10px)',
            }}>
                <Activity size={13} color="#34d399" />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Live Activity
                </span>
            </div>

            {items.map(item => {
                const fileName = item.filePath?.split('/').pop()
                const color = statusColor(item.status)
                return (
                    <div
                        key={`${item.id}-${item.tsMs}`}
                        style={{
                            padding: '9px 10px',
                            borderRadius: 8,
                            background: 'rgba(10,10,18,0.88)',
                            border: `1px solid ${color}33`,
                            backdropFilter: 'blur(10px)',
                            boxShadow: `0 0 0 1px ${color}14`,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
                            <span style={{ fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {sourceLabel(item.source)} · {operationLabel(item.operation)}
                            </span>
                            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--k-text-dim)' }}>
                                {new Date(item.tsMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--k-text-primary)', lineHeight: 1.45 }}>
                            {item.summary}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap', fontSize: 10, color: 'var(--k-text-dim)' }}>
                            {item.agentName && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Bot size={10} />
                                    {item.agentName}
                                </span>
                            )}
                            {item.toolName && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Wrench size={10} />
                                    {item.toolName}
                                </span>
                            )}
                            {fileName && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <FileText size={10} />
                                    {fileName}
                                </span>
                            )}
                            {!item.toolName && !fileName && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Cpu size={10} />
                                    {item.status}
                                </span>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
