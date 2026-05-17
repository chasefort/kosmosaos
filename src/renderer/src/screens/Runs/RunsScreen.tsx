import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, RefreshCw, Radio, WifiOff } from 'lucide-react'
import { useAppStore } from '../../store/app.store'
import { KosmosRun, KosmosEvent } from '../../../shared/types'
import { RunList } from './components/RunList'
import { RunPlayback } from './components/RunPlayback'

export function RunsScreen() {
    const { activeWorkspace, liveActivityTs, integrationStatus } = useAppStore()
    const [runs, setRuns] = useState<KosmosRun[]>([])
    const [activeRun, setActiveRun] = useState<KosmosRun | null>(null)
    const [events, setEvents] = useState<KosmosEvent[]>([])
    const [refreshing, setRefreshing] = useState(false)
    const activeRunRef = useRef<KosmosRun | null>(null)

    const loadRuns = useCallback(async (opts?: { selectFirst?: boolean; preserveSelection?: boolean }) => {
        if (!activeWorkspace) return
        const r: KosmosRun[] = await window.api.getRuns(activeWorkspace.id)
        setRuns(r)

        if (opts?.selectFirst && r.length > 0) {
            // Prefer the most recent live (running) session, otherwise the most recent overall
            const liveRun = r.find(run => run.status === 'running')
            await handleSelectRun(liveRun ?? r[0])
        } else if (opts?.preserveSelection && activeRunRef.current) {
            // Re-fetch updated run from the new list to keep metadata current
            const updated = r.find(run => run.id === activeRunRef.current!.id)
            if (updated) setActiveRun(updated)
        }
    }, [activeWorkspace])

    // Initial load
    useEffect(() => { loadRuns({ selectFirst: true }) }, [loadRuns])

    // Listen for background import completing — refresh immediately
    useEffect(() => {
        const cleanup = (window.api as any).onSessionsImported?.(() => {
            loadRuns({ preserveSelection: true })
        })
        return cleanup
    }, [loadRuns])

    // Auto-refresh when live events arrive (1s debounce — fast enough for monitoring)
    const liveRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => {
        if (!liveActivityTs || !activeWorkspace) return
        if (liveRefreshTimer.current) clearTimeout(liveRefreshTimer.current)
        liveRefreshTimer.current = setTimeout(async () => {
            const r: KosmosRun[] = await window.api.getRuns(activeWorkspace.id)
            setRuns(r)

            // If the currently selected run is live, refresh its events too
            if (activeRunRef.current?.status === 'running') {
                const evs = await window.api.getEvents(activeRunRef.current.id)
                setEvents(evs)
                // Update run metadata (event_count etc.)
                const updated = r.find(run => run.id === activeRunRef.current!.id)
                if (updated) setActiveRun(updated)
            }

            // Auto-select a newly appeared live run if nothing is selected
            if (!activeRunRef.current) {
                const liveRun = r.find(run => run.status === 'running')
                if (liveRun) await handleSelectRun(liveRun)
            }
        }, 1000)
        return () => { if (liveRefreshTimer.current) clearTimeout(liveRefreshTimer.current) }
    }, [liveActivityTs, activeWorkspace])

    const handleSelectRun = async (run: KosmosRun) => {
        setActiveRun(run)
        activeRunRef.current = run
        const evs = await window.api.getEvents(run.id)
        setEvents(evs)
    }

    const handleRefresh = async () => {
        if (!activeWorkspace || refreshing) return
        setRefreshing(true)
        try {
            await window.api.scanWorkspace(activeWorkspace.path)
            await loadRuns({ preserveSelection: true })
        } finally {
            setRefreshing(false)
        }
    }

    const isLiveConnected = (integrationStatus as any)?.claudeCode?.connected === true
        || (integrationStatus as any)?.openClaw?.connected === true

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', background: 'var(--k-bg-base)' }}>
            {/* Left Sidebar - Sessions List */}
            <div style={{ width: 300, borderRight: '1px solid var(--k-border-subtle)', background: 'var(--k-bg-panel)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--k-border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Activity size={18} color="var(--k-accent-purple)" />
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--k-text-primary)', flex: 1 }}>Sessions</span>

                    {/* Connection status badge */}
                    <span title={isLiveConnected ? 'Live monitoring active' : 'Live monitoring inactive'} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10, fontWeight: 600, letterSpacing: '0.3px',
                        color: isLiveConnected ? '#34d399' : 'var(--k-text-dim)',
                        padding: '2px 7px', borderRadius: 10,
                        background: isLiveConnected ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isLiveConnected ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                        {isLiveConnected
                            ? <><Radio size={9} style={{ animation: 'pulse 2s infinite' }} />LIVE</>
                            : <><WifiOff size={9} />OFF</>}
                    </span>

                    {runs.length > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--k-text-dim)' }}>{runs.length}</span>
                    )}

                    <button
                        onClick={handleRefresh}
                        title="Re-import all sessions"
                        style={{ color: refreshing ? 'var(--k-accent-purple)' : 'var(--k-text-dim)', padding: 4, borderRadius: 4, transition: 'color 0.2s' }}
                    >
                        <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {runs.length === 0 ? (
                        <div style={{
                            padding: 32, textAlign: 'center',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                        }}>
                            <Activity size={28} color="rgba(255,255,255,0.15)" />
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--k-text-secondary)' }}>
                                No Sessions Found
                            </div>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--k-text-dim)', lineHeight: 1.6, maxWidth: 220 }}>
                                Sessions appear automatically when Claude Code or OpenClaw is active in this workspace.
                                {!isLiveConnected && (
                                    <><br /><br />
                                    Live monitoring is <strong style={{ color: 'var(--k-status-error)' }}>inactive</strong> — make sure this workspace matches where Claude Code or OpenClaw is running.
                                    </>
                                )}
                            </p>
                            <button
                                onClick={handleRefresh}
                                style={{
                                    marginTop: 4, padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                    background: 'rgba(139,92,246,0.15)', color: 'var(--k-accent-purple)',
                                    border: '1px solid rgba(139,92,246,0.35)', cursor: 'pointer',
                                }}
                            >
                                Scan Now
                            </button>
                        </div>
                    ) : (
                        <RunList runs={runs} activeRunId={activeRun?.id} onSelect={handleSelectRun} />
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                {activeRun ? (
                    <RunPlayback run={activeRun} events={events} />
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--k-text-dim)', fontSize: 14 }}>
                        Select a session to view its events
                    </div>
                )}
            </div>
        </div>
    )
}
