import { useState, useEffect, useCallback, useMemo } from 'react'
import { Play, Pause, SkipForward, SkipBack, MonitorPlay, Clock, Cpu, Wrench, FileText, AlertTriangle, Timer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { KosmosRun, KosmosEvent } from '../../../../shared/types'
import { EventList } from './EventList'
import { EventDetailPanel } from './EventDetailPanel'
import { TraceInspectorPanel } from './TraceInspectorPanel'
import { useAppStore } from '../../../store/app.store'
import { useGraphStore } from '../../../store/graph.store'

// ── Analytics computation ──────────────────────────────────────────────────────
function useSessionStats(run: KosmosRun, events: KosmosEvent[]) {
    const graphNodes = useGraphStore(s => s.nodes)
    return useMemo(() => {
        const meta = (run.meta ?? {}) as Record<string, unknown>
        const model = (meta.model as string) ?? ''

        // Duration
        const durationMs = run.endedAt ? run.endedAt - run.startedAt : 0
        const durationStr = durationMs < 60_000
            ? `${Math.round(durationMs / 1000)}s`
            : `${Math.floor(durationMs / 60_000)}m ${Math.round((durationMs % 60_000) / 1000)}s`

        // Tool calls
        const toolCalls = events.filter(e => e.type === 'tool_call' && e.phase !== 'end')
        const toolCallCount = toolCalls.length

        // Files touched (prefer explicit file paths from tool inputs/outputs)
        const touchedFilePaths = new Set<string>()
        const allNodeIds = new Set<string>()
        events.forEach(e => {
            e.nodeIds.forEach(id => allNodeIds.add(id))
            const inputPath = (e.input as any)?.file_path ?? (e.input as any)?.path
            const outputPath = (e.output as any)?.file_path ?? (e.output as any)?.path
            if (typeof inputPath === 'string') touchedFilePaths.add(inputPath)
            if (typeof outputPath === 'string') touchedFilePaths.add(outputPath)
        })
        const filesTouched = touchedFilePaths.size > 0
            ? touchedFilePaths.size
            : allNodeIds.size
        const touchedNodes = graphNodes.filter(node => allNodeIds.has(node.id))
        const wikiRead = touchedNodes.filter(node => node.type === 'wiki_page').length
        const sourceRead = touchedNodes.filter(node => node.type === 'source_doc').length
        const outputsWritten = touchedNodes.filter(node => node.type === 'output_artifact').length
        const instructionsTouched = touchedNodes.filter(node => node.type === 'instruction_file').length

        // Errors
        const errorCount = events.filter(e => e.type === 'error').length

        // Avg tool latency
        const toolDurations = events
            .filter(e => e.type === 'tool_call' && e.durationMs != null && e.durationMs > 0)
            .map(e => e.durationMs!)
        const avgLatency = toolDurations.length > 0
            ? Math.round(toolDurations.reduce((a, b) => a + b, 0) / toolDurations.length)
            : 0

        // Tool breakdown (top 5)
        const toolFreq: Record<string, number> = {}
        toolCalls.forEach(e => {
            const name = e.toolName ?? 'unknown'
            toolFreq[name] = (toolFreq[name] ?? 0) + 1
        })
        const toolBreakdown = Object.entries(toolFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
        const maxToolCount = toolBreakdown.length > 0 ? toolBreakdown[0][1] : 1

        // Model short name
        const shortModel = (() => {
            const l = model.toLowerCase()
            if (l.includes('opus'))   return 'Opus'
            if (l.includes('sonnet')) return 'Sonnet'
            if (l.includes('haiku'))  return 'Haiku'
            if (l.includes('gpt-4o')) return 'GPT-4o'
            if (l.includes('gemini')) return 'Gemini'
            if (!model) return '—'
            return model.split('-').slice(0, 2).join('-')
        })()

        return { durationStr, shortModel, toolCallCount, filesTouched, errorCount, avgLatency, toolBreakdown, maxToolCount, wikiRead, sourceRead, outputsWritten, instructionsTouched }
    }, [run, events, graphNodes])
}

const TOOL_COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#f87171']

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
            <span style={{ color, flexShrink: 0 }}>{icon}</span>
            <div>
                <div style={{ fontSize: 10, color: 'var(--k-text-dim)', marginBottom: 1 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--k-text-primary)' }}>{value}</div>
            </div>
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function RunPlayback({ run, events }: { run: KosmosRun, events: KosmosEvent[] }) {
    const [playhead, setPlayhead] = useState(0)
    const [playing, setPlaying] = useState(false)
    const navigate = useNavigate()
    const { setReplayEvents, setReplayActive } = useAppStore()
    const stats = useSessionStats(run, events)

    // Basic auto-playback
    useEffect(() => {
        let timer: any
        if (playing && events.length > 0) {
            timer = setInterval(() => {
                setPlayhead(p => {
                    if (p >= events.length - 1) {
                        setPlaying(false)
                        return p
                    }
                    return p + 1
                })
            }, 1000)
        }
        return () => clearInterval(timer)
    }, [playing, events.length])

    // Reset playhead on run change
    useEffect(() => {
        setPlayhead(0)
        setPlaying(false)
    }, [run.id])

    const activeEvent = events[playhead]

    // Feature 1: Launch session replay on the 3D graph
    const handleReplayOn3D = useCallback(() => {
        if (!events.length) return
        setReplayEvents(events)
        setReplayActive(true)
        navigate('/universe')
    }, [events, setReplayEvents, setReplayActive, navigate])

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

            {/* ── Session Analytics Header ── */}
            <div style={{
                padding: '16px 24px', borderBottom: '1px solid var(--k-border-subtle)',
                background: 'linear-gradient(180deg, rgba(15,10,30,0.6) 0%, transparent 100%)',
            }}>
                {/* Stat cards row */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                    <StatCard icon={<Clock size={14} />} label="Duration" value={stats.durationStr} color="#60a5fa" />
                    <StatCard icon={<Cpu size={14} />} label="Model" value={stats.shortModel} color="#a78bfa" />
                    <StatCard icon={<Wrench size={14} />} label="Tool Calls" value={stats.toolCallCount} color="#34d399" />
                    <StatCard icon={<FileText size={14} />} label="Nodes Touched" value={stats.filesTouched} color="#fbbf24" />
                    <StatCard icon={<FileText size={14} />} label="Wiki" value={stats.wikiRead} color="#38bdf8" />
                    <StatCard icon={<FileText size={14} />} label="Sources" value={stats.sourceRead} color="#22d3ee" />
                    <StatCard icon={<FileText size={14} />} label="Outputs" value={stats.outputsWritten} color="#f59e0b" />
                    <StatCard icon={<FileText size={14} />} label="Instructions" value={stats.instructionsTouched} color="#c084fc" />
                    <StatCard icon={<AlertTriangle size={14} />} label="Errors" value={stats.errorCount} color={stats.errorCount > 0 ? '#ef4444' : '#34d399'} />
                    <StatCard icon={<Timer size={14} />} label="Avg Latency" value={stats.avgLatency > 0 ? `${stats.avgLatency}ms` : '—'} color="#f472b6" />
                </div>

                {/* Tool breakdown horizontal bars */}
                {stats.toolBreakdown.length > 0 && (
                    <div style={{
                        display: 'grid', gridTemplateColumns: '120px 1fr 30px', gap: '4px 10px', alignItems: 'center',
                        padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)',
                    }}>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.25)', gridColumn: 'span 3', marginBottom: 2 }}>
                            Tool Breakdown
                        </div>
                        {stats.toolBreakdown.map(([name, count], i) => (
                            <div key={name} style={{ display: 'contents' }}>
                                <span style={{ fontSize: 11, color: 'var(--k-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace' }}>
                                    {name}
                                </span>
                                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 3,
                                        width: `${(count / stats.maxToolCount) * 100}%`,
                                        background: TOOL_COLORS[i % TOOL_COLORS.length],
                                        transition: 'width 0.3s ease',
                                    }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 600, color: TOOL_COLORS[i % TOOL_COLORS.length], textAlign: 'right' }}>
                                    {count}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Top Scrubber & Controls ── */}
            <div style={{ height: 64, borderBottom: '1px solid var(--k-border-subtle)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 18, flexShrink: 0 }}>

                <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setPlayhead(0)} style={{ color: 'var(--k-text-dim)', padding: 6 }}>
                        <SkipBack size={16} />
                    </button>

                    <button
                        onClick={() => setPlaying(!playing)}
                        style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: 'var(--k-accent-purple)', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 12px rgba(139, 92, 246, 0.4)'
                        }}
                    >
                        {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
                    </button>

                    <button onClick={() => setPlayhead(Math.min(playhead + 1, events.length - 1))} style={{ color: 'var(--k-text-dim)', padding: 6 }}>
                        <SkipForward size={16} />
                    </button>
                </div>

                {/* Timeline bar */}
                <div style={{ flex: 1, position: 'relative', height: 32, display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', width: '100%', height: 3, background: 'var(--k-border-subtle)', borderRadius: 2 }} />

                    {events.map((ev, i) => {
                        const pct = events.length > 1 ? (i / (events.length - 1)) * 100 : 0
                        const isError = ev.type === 'error' || ev.phase === 'error'
                        const color = isError ? 'var(--k-status-error)' : 'var(--k-accent-blue)'

                        return (
                            <div
                                key={ev.id}
                                onClick={() => { setPlayhead(i); setPlaying(false) }}
                                style={{
                                    position: 'absolute',
                                    left: `${pct}%`,
                                    width: i === playhead ? 10 : 6,
                                    height: i === playhead ? 10 : 6,
                                    borderRadius: '50%',
                                    background: i === playhead ? '#fff' : color,
                                    transform: 'translate(-50%, 0)',
                                    cursor: 'pointer',
                                    zIndex: i === playhead ? 10 : 1,
                                    boxShadow: i === playhead ? `0 0 10px ${color}` : 'none'
                                }}
                            />
                        )
                    })}
                </div>

                <div style={{ color: 'var(--k-text-dim)', fontSize: 12, width: 55, textAlign: 'right' }}>
                    {playhead + 1} / {events.length}
                </div>

                {/* Replay on 3D Graph */}
                <button
                    onClick={handleReplayOn3D}
                    disabled={events.length === 0}
                    title="Replay this session on the 3D Universe graph"
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                        background: events.length > 0 ? 'rgba(139,92,246,0.15)' : 'transparent',
                        color: events.length > 0 ? 'var(--k-accent-purple)' : 'var(--k-text-dim)',
                        border: `1px solid ${events.length > 0 ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                        cursor: events.length > 0 ? 'pointer' : 'default',
                        transition: 'all 0.15s',
                        whiteSpace: 'nowrap',
                    }}
                >
                    <MonitorPlay size={13} />
                    Replay 3D
                </button>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Event List (Left) */}
                <EventList events={events} playhead={playhead} onSelect={(i) => { setPlayhead(i); setPlaying(false) }} isLive={run.status === 'running'} />

                {/* Event Detail (Right) */}
                {activeEvent && <EventDetailPanel event={activeEvent} />}

                <TraceInspectorPanel traceId={run.id} workspaceId={run.workspaceId} />
            </div>
        </div>
    )
}
