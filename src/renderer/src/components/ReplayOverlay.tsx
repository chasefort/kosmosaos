/**
 * ReplayOverlay — appears at the bottom of UniverseMap while a session replay
 * is active.  Provides: play/pause, scrub, speed, current event label, stop.
 */

import { useEffect, useRef } from 'react'
import { Play, Pause, SkipBack, SkipForward, X, Gauge, Orbit } from 'lucide-react'
import { useAppStore } from '../store/app.store'

const EVENT_COLORS: Record<string, string> = {
    tool_call:          '#fbbf24',
    assistant_response: '#a78bfa',
    user_prompt:        '#60a5fa',
    model_call:         '#34d399',
    memory_read:        '#f472b6',
    memory_write:       '#f87171',
    error:              '#ef4444',
    session_start:      '#94a3b8',
    session_end:        '#94a3b8',
    permission_decision:'#10b981',
}

export function ReplayOverlay() {
    const {
        replayActive, setReplayActive,
        replayEvents, replayPlayhead, setReplayPlayhead,
        replaySpeed, setReplaySpeed,
        cameraOrbitEnabled, setCameraOrbitEnabled,
    } = useAppStore()

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const isPlayingRef = useRef(false)
    const [isPlaying, setIsPlaying_] = [
        isPlayingRef.current,
        (v: boolean) => { isPlayingRef.current = v; forceRender() },
    ]
    // simple way to force re-render without adding useState
    const renderRef = useRef(0)
    const forceRender = () => { renderRef.current++ }

    useEffect(() => {
        if (!replayActive) {
            if (timerRef.current) clearInterval(timerRef.current)
            isPlayingRef.current = false
        }
    }, [replayActive])

    // Auto-play timer
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current)
        if (!isPlayingRef.current || !replayActive) return

        const ms = 1000 / replaySpeed
        timerRef.current = setInterval(() => {
            setReplayPlayhead(Math.min(replayPlayhead + 1, replayEvents.length - 1))
            if (replayPlayhead >= replayEvents.length - 1) {
                clearInterval(timerRef.current!)
                isPlayingRef.current = false
            }
        }, ms)

        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [isPlaying, replayActive, replaySpeed, replayPlayhead, replayEvents.length])

    if (!replayActive || replayEvents.length === 0) return null

    const ev    = replayEvents[replayPlayhead]
    const evColor = ev ? (EVENT_COLORS[ev.type] ?? '#94a3b8') : '#94a3b8'
    const pct   = replayEvents.length > 1 ? (replayPlayhead / (replayEvents.length - 1)) * 100 : 0

    const SPEEDS = [0.5, 1, 2, 4]

    return (
        <div style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            background: 'rgba(8,8,12,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 12,
            padding: '10px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minWidth: 500,
            maxWidth: 700,
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}>
            {/* Event label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: evColor, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: evColor, fontWeight: 600, letterSpacing: 0.5 }}>
                    {ev?.type?.replace(/_/g, ' ').toUpperCase() ?? '—'}
                </span>
                {ev?.toolName && (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
                        {ev.toolName}
                    </span>
                )}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    {replayPlayhead + 1} / {replayEvents.length}
                </span>
                <button
                    onClick={() => { setReplayActive(false); isPlayingRef.current = false }}
                    style={{ color: 'rgba(255,255,255,0.3)', padding: 2, borderRadius: 4 }}
                    title="Stop replay"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Timeline scrubber */}
            <div
                style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, cursor: 'pointer' }}
                onClick={e => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                    const pctClick = (e.clientX - rect.left) / rect.width
                    const idx = Math.round(pctClick * (replayEvents.length - 1))
                    setReplayPlayhead(Math.max(0, Math.min(idx, replayEvents.length - 1)))
                }}
            >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: evColor, borderRadius: 3, transition: 'width 0.1s' }} />
                <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%', background: '#fff', boxShadow: `0 0 8px ${evColor}` }} />
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => { setReplayPlayhead(0); isPlayingRef.current = false }}
                    style={{ color: 'rgba(255,255,255,0.5)', padding: 6 }}>
                    <SkipBack size={16} />
                </button>

                <button
                    onClick={() => { isPlayingRef.current = !isPlayingRef.current; forceRender() }}
                    style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(139,92,246,0.8)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 12px rgba(139,92,246,0.5)',
                    }}
                >
                    {isPlayingRef.current
                        ? <Pause size={16} />
                        : <Play size={16} style={{ marginLeft: 2 }} />
                    }
                </button>

                <button
                    onClick={() => setReplayPlayhead(Math.min(replayPlayhead + 1, replayEvents.length - 1))}
                    style={{ color: 'rgba(255,255,255,0.5)', padding: 6 }}>
                    <SkipForward size={16} />
                </button>

                <div style={{ flex: 1 }} />

                {/* Speed selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                        onClick={() => setCameraOrbitEnabled(!cameraOrbitEnabled)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            marginRight: 8,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            background: cameraOrbitEnabled ? 'rgba(167,139,250,0.18)' : 'transparent',
                            color: cameraOrbitEnabled ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                            border: cameraOrbitEnabled ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                        title="Orbit around the full graph"
                    >
                        <Orbit size={12} />
                        <span>Orbit</span>
                    </button>
                    <Gauge size={13} style={{ color: 'rgba(255,255,255,0.35)' }} />
                    {SPEEDS.map(s => (
                        <button
                            key={s}
                            onClick={() => setReplaySpeed(s)}
                            style={{
                                padding: '2px 7px', borderRadius: 4, fontSize: 11,
                                background: replaySpeed === s ? 'rgba(96,165,250,0.2)' : 'transparent',
                                color: replaySpeed === s ? '#60a5fa' : 'rgba(255,255,255,0.35)',
                                border: replaySpeed === s ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent',
                            }}
                        >
                            {s}×
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
