import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Wrench, Share2, GitBranch,
    Activity, Zap, BarChart3, Clock, Cpu,
    ArrowRight, Radio, FileText, AlertTriangle
} from 'lucide-react'
import { useAppStore } from '../../store/app.store'
import { ContextHealthSummary } from '../../../shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardStats {
    agentCount: number
    toolCount: number
    nodeCount: number
    edgeCount: number
    traceCount: number
    runsToday: number
    eventsToday: number
    totalTokens: number
    totalCostUsd: number
    feedbackAverage: number | null
    feedbackCount: number
    toolUsage: { name: string; count: number }[]
    modelUsage: { name: string; tokens: number; costUsd: number }[]
    hourlyActivity: number[]
    recentRuns: {
        id: string
        source: string
        started_at: number
        ended_at: number | null
        event_count: number
        status: string
        meta: Record<string, unknown>
    }[]
    computedAt: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ms: number): string {
    const diff = Date.now() - ms
    if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return `${Math.floor(diff / 86_400_000)}d ago`
}

function runTitle(run: DashboardStats['recentRuns'][0]): string {
    const meta = run.meta as any
    // Try to extract a meaningful title from the first user prompt stored in meta
    if (meta?.firstPrompt && typeof meta.firstPrompt === 'string') {
        const trimmed = meta.firstPrompt.trim()
        return trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed
    }
    const src = run.source === 'claude_code' ? 'Claude Code' : run.source === 'openclaw' ? 'OpenClaw' : run.source
    return `${src} session`
}

function severityRank(level: string): number {
    return level === 'error' ? 0 : level === 'warning' ? 1 : 2
}

function severityColor(level: string): string {
    return level === 'error' ? '#ef4444' : level === 'warning' ? '#f59e0b' : '#60a5fa'
}

function readinessLabel(score: number): string {
    if (score >= 85) return 'Ready for agent work'
    if (score >= 65) return 'Review before relying on agents'
    return 'Needs audit before agent work'
}

function conventionLabel(convention: string): string {
    const labels: Record<string, string> = {
        obsidian: 'Obsidian vault',
        'raw-wiki-outputs': 'raw/wiki/outputs',
        'markdown-heavy': 'Markdown context',
        'agent-instructions': 'Agent instructions',
    }
    return labels[convention] ?? convention
}

// ── Activity Sparkline ────────────────────────────────────────────────────────

function ActivitySparkline({ data }: { data: number[] }) {
    const max = Math.max(...data, 1)
    const barW = 100 / data.length
    return (
        <svg viewBox="0 0 100 28" preserveAspectRatio="none" style={{ width: '100%', height: 44, display: 'block' }}>
            {data.map((v, i) => {
                const h = (v / max) * 26
                return (
                    <rect
                        key={i}
                        x={i * barW + barW * 0.1}
                        y={28 - h}
                        width={barW * 0.8}
                        height={Math.max(h, v > 0 ? 1.5 : 0)}
                        rx={0.8}
                        fill="var(--k-accent-blue)"
                        opacity={v > 0 ? 0.35 + (v / max) * 0.65 : 0.08}
                    />
                )
            })}
        </svg>
    )
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
    label, value, icon, color, sub
}: {
    label: string
    value: number | string
    icon: React.ReactNode
    color: string
    sub?: string
}) {
    return (
        <div style={{
            background: 'var(--k-bg-panel)',
            border: '1px solid var(--k-border-subtle)',
            borderRadius: 10,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--k-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {label}
                </span>
                <span style={{ color, opacity: 0.7 }}>{icon}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--k-text-primary)', lineHeight: 1 }}>
                {value}
            </div>
            {sub && (
                <div style={{ fontSize: 10, color: 'var(--k-text-dim)' }}>{sub}</div>
            )}
        </div>
    )
}

// ── Quick Nav Card ───────────────────────────────────────────────────────────

function QuickNavCard({ label, desc, icon, to, onClick }: {
    label: string; desc: string; icon: React.ReactNode; to: string; onClick: (to: string) => void
}) {
    return (
        <button
            onClick={() => onClick(to)}
            style={{
                background: 'var(--k-bg-panel)',
                border: '1px solid var(--k-border-subtle)',
                borderRadius: 10,
                padding: '14px 16px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--k-border-focus)'
                ;(e.currentTarget as HTMLElement).style.background = 'var(--k-bg-panel-hover)'
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--k-border-subtle)'
                ;(e.currentTarget as HTMLElement).style.background = 'var(--k-bg-panel)'
            }}
        >
            <span style={{ color: 'var(--k-text-dim)' }}>{icon}</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--k-text-primary)' }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--k-text-dim)', marginTop: 2 }}>{desc}</div>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--k-text-dim)', flexShrink: 0 }} />
        </button>
    )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function DashboardScreen() {
    const { activeWorkspace, liveActivityTs, integrationStatus } = useAppStore()
    const navigate = useNavigate()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [contextHealth, setContextHealth] = useState<ContextHealthSummary | null>(null)
    const [loading, setLoading] = useState(true)

    const loadStats = useCallback(async () => {
        if (!activeWorkspace) return
        try {
            const s = await (window.api as any).getDashboardStats(activeWorkspace.id)
            setStats(s)
            setContextHealth(await window.api.getContextHealth(activeWorkspace.id))
        } finally {
            setLoading(false)
        }
    }, [activeWorkspace])

    // Initial load
    useEffect(() => { loadStats() }, [loadStats])

    // Refresh when live events arrive (2s debounce)
    useEffect(() => {
        if (!liveActivityTs) return
        const t = setTimeout(() => loadStats(), 2000)
        return () => clearTimeout(t)
    }, [liveActivityTs, loadStats])

    const ccConnected = integrationStatus.claudeCode.connected
    const ocConnected = integrationStatus.openClaw.connected
    const anyConnected = ccConnected || ocConnected

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--k-text-dim)', fontSize: 13 }}>
                Loading…
            </div>
        )
    }

    const noData = !stats || stats.eventsToday === 0
    const score = contextHealth?.score ?? 0
    const topFindings = [...(contextHealth?.findings ?? [])]
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
        .slice(0, 5)
    const conventions = contextHealth?.contextSystem?.detectedConventions ?? []
    const instructionFiles = contextHealth?.contextSystem?.instructionFiles ?? []

    return (
        <div style={{
            height: '100%',
            overflowY: 'auto',
            padding: '28px 32px',
            background: 'var(--k-bg-base)',
            boxSizing: 'border-box',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--k-text-primary)', margin: 0 }}>
                        Trust Overview
                    </h1>
                    <p style={{ fontSize: 12, color: 'var(--k-text-dim)', margin: '4px 0 0' }}>
                        {activeWorkspace?.name ?? 'Workspace'} · AI context trust layer
                        {stats && (
                            <> · Updated {timeAgo(stats.computedAt)}</>
                        )}
                    </p>
                </div>

                {/* Connection badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, background: 'var(--k-bg-panel)', border: '1px solid var(--k-border-subtle)' }}>
                    <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: anyConnected ? 'var(--k-status-ok)' : 'var(--k-status-offline)',
                        boxShadow: anyConnected ? '0 0 6px var(--k-status-ok)' : 'none',
                    }} />
                    <span style={{ fontSize: 11, color: anyConnected ? 'var(--k-status-ok)' : 'var(--k-text-dim)' }}>
                        {anyConnected
                            ? [ccConnected && 'Claude Code', ocConnected && 'OpenClaw'].filter(Boolean).join(', ')
                            : 'Not connected'}
                    </span>
                    {!anyConnected && <Radio size={11} style={{ color: 'var(--k-text-dim)' }} />}
                </div>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <StatCard label="AI Readiness" value={score} icon={<BarChart3 size={15} />} color={score >= 80 ? 'var(--k-status-ok)' : '#f59e0b'} sub={readinessLabel(score)} />
                <StatCard label="Wiki Pages" value={contextHealth?.metrics.wikiPages ?? 0} icon={<FileText size={15} />} color="#38bdf8" />
                <StatCard label="Sources" value={contextHealth?.metrics.sourceDocs ?? 0} icon={<Share2 size={15} />} color="#22d3ee" />
                <StatCard label="Outputs" value={contextHealth?.metrics.outputArtifacts ?? 0} icon={<GitBranch size={15} />} color="#f59e0b" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <StatCard label="Broken Links" value={contextHealth?.metrics.brokenLinks ?? 0} icon={<AlertTriangle size={15} />} color={(contextHealth?.metrics.brokenLinks ?? 0) > 0 ? '#ef4444' : 'var(--k-status-ok)'} />
                <StatCard label="Missing Sources" value={contextHealth?.metrics.missingSourcePages ?? 0} icon={<AlertTriangle size={15} />} color="#f59e0b" />
                <StatCard label="Sessions Today" value={contextHealth?.metrics.sessionsToday ?? stats?.runsToday ?? 0} icon={<Activity size={15} />} color="var(--k-status-ok)" />
                <StatCard label="Source Coverage" value={`${contextHealth?.metrics.sourceCoveragePct ?? 0}%`} icon={<BarChart3 size={15} />} color="var(--k-accent-blue)" />
            </div>

            {/* Audit-first review queue */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.45fr) minmax(280px, 0.75fr)',
                gap: 12,
                marginBottom: 20,
            }}>
                <div style={{
                    background: 'var(--k-bg-panel)',
                    border: '1px solid var(--k-border-subtle)',
                    borderRadius: 10,
                    padding: '16px 18px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: 'var(--k-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <AlertTriangle size={12} /> Review Before Agents Rely On This
                        </span>
                        <button
                            onClick={() => navigate('/health')}
                            style={{ fontSize: 11, color: '#93c5fd', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                            Open Context Audit <ArrowRight size={12} />
                        </button>
                    </div>
                    {topFindings.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', color: 'var(--k-text-dim)', fontSize: 12 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 8, background: 'var(--k-status-ok)', boxShadow: '0 0 7px var(--k-status-ok)' }} />
                            No context audit findings yet. Scan a Markdown vault or AI workspace to see broken links, missing sources, risky instructions, and unsupported outputs here.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {topFindings.map(finding => {
                                const color = severityColor(finding.severity)
                                return (
                                    <button
                                        key={finding.id}
                                        onClick={() => navigate('/health')}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '10px 12px',
                                            borderRadius: 8,
                                            border: `1px solid ${color}33`,
                                            borderLeft: `3px solid ${color}`,
                                            background: `${color}0f`,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                            <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 48 }}>{finding.severity}</span>
                                            <span style={{ fontSize: 13, color: 'var(--k-text-primary)', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{finding.title}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--k-text-dim)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {finding.suggestion ?? finding.description}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div style={{
                    background: 'var(--k-bg-panel)',
                    border: '1px solid var(--k-border-subtle)',
                    borderRadius: 10,
                    padding: '16px 18px',
                }}>
                    <div style={{ fontSize: 11, color: 'var(--k-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                        Detected Context System
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {conventions.length === 0 ? (
                            <span style={{ fontSize: 12, color: 'var(--k-text-dim)' }}>No vault conventions detected yet</span>
                        ) : conventions.map(convention => (
                            <span key={convention} style={{ fontSize: 11, color: '#93c5fd', border: '1px solid rgba(147,197,253,0.25)', background: 'rgba(96,165,250,0.08)', borderRadius: 6, padding: '4px 7px' }}>
                                {conventionLabel(convention)}
                            </span>
                        ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                        <div style={{ color: 'var(--k-text-dim)' }}>Instruction files</div>
                        <div style={{ color: instructionFiles.length > 0 ? 'var(--k-text-secondary)' : 'var(--k-text-dim)', textAlign: 'right' }}>{instructionFiles.length}</div>
                        <div style={{ color: 'var(--k-text-dim)' }}>Raw/wiki/outputs</div>
                        <div style={{ color: contextHealth?.contextSystem?.hasRawWikiOutputs ? 'var(--k-status-ok)' : 'var(--k-text-dim)', textAlign: 'right' }}>{contextHealth?.contextSystem?.hasRawWikiOutputs ? 'Detected' : 'Not detected'}</div>
                        <div style={{ color: 'var(--k-text-dim)' }}>Obsidian</div>
                        <div style={{ color: contextHealth?.contextSystem?.isObsidianVault ? 'var(--k-status-ok)' : 'var(--k-text-dim)', textAlign: 'right' }}>{contextHealth?.contextSystem?.isObsidianVault ? 'Detected' : 'No'}</div>
                    </div>
                </div>
            </div>

            {/* Activity + Sessions row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <StatCard
                    label="Runs today"
                    value={stats?.runsToday ?? 0}
                    icon={<Activity size={15} />}
                    color="var(--k-status-ok)"
                    sub={noData ? 'No AI activity recorded yet' : `Based on last 24h`}
                />
                <StatCard
                    label="Events today"
                    value={stats?.eventsToday ?? 0}
                    icon={<Zap size={15} />}
                    color="var(--k-accent-cyan)"
                    sub={noData ? 'No AI activity recorded yet' : `Based on last 24h`}
                />
            </div>

            {/* Activity sparkline */}
            <div style={{
                background: 'var(--k-bg-panel)',
                border: '1px solid var(--k-border-subtle)',
                borderRadius: 10,
                padding: '16px 18px',
                marginBottom: 20,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--k-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BarChart3 size={12} /> AI Activity — last 24h
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--k-text-dim)' }}>
                        {noData ? 'No data' : `${stats!.eventsToday} events`}
                    </span>
                </div>
                {noData
                    ? <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--k-text-dim)', fontSize: 12 }}>No AI activity recorded yet</div>
                    : <ActivitySparkline data={stats!.hourlyActivity} />
                }
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--k-text-dim)' }}>24h ago</span>
                    <span style={{ fontSize: 9, color: 'var(--k-text-dim)' }}>now</span>
                </div>
            </div>

            {/* Tool usage + Recent sessions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {/* Tool usage */}
                <div style={{
                    background: 'var(--k-bg-panel)',
                    border: '1px solid var(--k-border-subtle)',
                    borderRadius: 10,
                    padding: '16px 18px',
                }}>
                    <div style={{ fontSize: 11, color: 'var(--k-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Wrench size={12} /> AI Tool Calls
                    </div>
                    {noData || !stats?.toolUsage.length ? (
                        <div style={{ fontSize: 12, color: 'var(--k-text-dim)', padding: '8px 0' }}>No tool calls recorded yet</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {stats.toolUsage.map((t, i) => {
                                const maxCount = stats.toolUsage[0].count
                                const pct = (t.count / maxCount) * 100
                                return (
                                    <div key={t.name}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                            <span style={{ fontSize: 12, color: 'var(--k-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: 10, color: 'var(--k-text-dim)', minWidth: 12 }}>{i + 1}</span>
                                                {t.name}
                                            </span>
                                            <span style={{ fontSize: 11, color: 'var(--k-text-dim)' }}>{t.count}</span>
                                        </div>
                                        <div style={{ height: 2, background: 'var(--k-border-subtle)', borderRadius: 1 }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--k-node-tool)', borderRadius: 1, opacity: 0.6 }} />
                                        </div>
                                    </div>
                                )
                            })}
                            <div style={{ fontSize: 10, color: 'var(--k-text-dim)', marginTop: 4 }}>Based on events from last 24h</div>
                        </div>
                    )}
                </div>

                {/* Recent sessions */}
                <div style={{
                    background: 'var(--k-bg-panel)',
                    border: '1px solid var(--k-border-subtle)',
                    borderRadius: 10,
                    padding: '16px 18px',
                }}>
                    <div style={{ fontSize: 11, color: 'var(--k-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} /> Recent AI Sessions
                    </div>
                    {!stats?.recentRuns.length ? (
                        <div style={{ fontSize: 12, color: 'var(--k-text-dim)', padding: '8px 0' }}>No sessions recorded yet</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {stats.recentRuns.map(run => (
                                <button
                                    key={run.id}
                                    onClick={() => navigate('/runs')}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: 0,
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 8,
                                    }}
                                >
                                    <span style={{
                                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                                        background: run.status === 'running' ? 'var(--k-status-ok)'
                                            : run.status === 'error' ? 'var(--k-status-error)'
                                                : 'var(--k-text-dim)',
                                        boxShadow: run.status === 'running' ? '0 0 5px var(--k-status-ok)' : 'none',
                                    }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, color: 'var(--k-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {runTitle(run)}
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--k-text-dim)', marginTop: 2, display: 'flex', gap: 8 }}>
                                            <span>{timeAgo(run.started_at)}</span>
                                            <span>{run.event_count} events</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div style={{
                background: 'var(--k-bg-panel)',
                border: '1px solid var(--k-border-subtle)',
                borderRadius: 10,
                padding: '16px 18px',
                marginBottom: 20,
            }}>
                <div style={{ fontSize: 11, color: 'var(--k-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Cpu size={12} /> Model Usage
                </div>
                {!stats?.modelUsage.length ? (
                    <div style={{ fontSize: 12, color: 'var(--k-text-dim)', padding: '8px 0' }}>No model usage recorded yet</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {stats.modelUsage.map(model => (
                            <div key={model.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
                                <span style={{ color: 'var(--k-text-secondary)' }}>{model.name}</span>
                                <span style={{ color: 'var(--k-text-dim)' }}>
                                    {model.tokens.toLocaleString()} tokens · ${model.costUsd.toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick nav */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
            }}>
                <QuickNavCard label="Context Map" desc="Notes, sources, outputs, and AI paths" icon={<Share2 size={16} />} to="/universe" onClick={navigate} />
                <QuickNavCard label="AI Sessions" desc="Replay what agents read and changed" icon={<Activity size={16} />} to="/runs" onClick={navigate} />
                <QuickNavCard label="Context Audit" desc="Broken links, missing sources, risk" icon={<BarChart3 size={16} />} to="/health" onClick={navigate} />
            </div>
        </div>
    )
}
