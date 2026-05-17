/**
 * GraphToolbar — floating toolbar above the 3D graph with toggles for:
 *   Feature 2: Heatmap Mode
 *   Feature 3: Blast Radius
 *   Feature 4: Snapshot export
 *   Feature 5: Architecture Summary
 */

import { useCallback, useEffect, useState } from 'react'
import { Thermometer, Zap, Camera, FileText, HelpCircle, Check } from 'lucide-react'
import { useAppStore } from '../store/app.store'
import { useGraphStore } from '../store/graph.store'

interface ToolbarBtnProps {
    icon: React.ReactNode
    label: string
    active?: boolean
    onClick: () => void
    color?: string
    helpId?: string
    compact?: boolean
}

function ToolbarBtn({ icon, label, active, onClick, color = '#60a5fa', helpId, compact = false }: ToolbarBtnProps) {
    return (
        <button
            title={label}
            onClick={onClick}
            data-help={helpId}
            style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: compact ? 7 : '6px 12px', borderRadius: 6, cursor: 'pointer',
                background: active ? `${color}22` : 'transparent',
                color: active ? color : 'rgba(255,255,255,0.45)',
                border: active ? `1px solid ${color}44` : '1px solid transparent',
                fontSize: 12, fontWeight: active ? 600 : 400,
                fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
                if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)'
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'
                }
            }}
            onMouseLeave={e => {
                if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }
            }}
        >
            {icon}
            {!compact && <span>{label}</span>}
        </button>
    )
}

export function GraphToolbar() {
    const {
        heatmapMode, setHeatmapMode, setNodeHeatmap,
        blastRadiusMode, setBlastRadiusMode,
        triggerSnapshot,
        setSummaryOpen,
        helpMode, setHelpMode,
    } = useAppStore()

    const { nodes } = useGraphStore()
    const [snapshotDone, setSnapshotDone] = useState(false)
    const [compact, setCompact] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 760 : false)

    useEffect(() => {
        const handler = () => {
            setSnapshotDone(true)
            setTimeout(() => setSnapshotDone(false), 2000)
        }
        window.addEventListener('kosmos:snapshot-done', handler)
        return () => window.removeEventListener('kosmos:snapshot-done', handler)
    }, [])

    useEffect(() => {
        const onResize = () => setCompact(window.innerWidth < 760)
        onResize()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    // Toggle heatmap — when enabling, fetch all events and compute frequency
    const handleHeatmapToggle = useCallback(async () => {
        if (heatmapMode) {
            setHeatmapMode(false)
            setNodeHeatmap({})
            return
        }

        setHeatmapMode(true)

        try {
            // Load all runs for the workspace to build frequency map
            const runs = await window.api.getRuns(nodes[0]?.workspaceId ?? '')
            if (!runs?.length) return

            const freq: Record<string, number> = {}
            let maxCount = 0

            for (const run of runs) {
                const events = await window.api.getEvents(run.id)
                for (const ev of (events ?? [])) {
                    for (const nodeId of (ev.nodeIds ?? [])) {
                        freq[nodeId] = (freq[nodeId] ?? 0) + 1
                        if (freq[nodeId] > maxCount) maxCount = freq[nodeId]
                    }
                }
            }

            // Normalize to 0..1
            const heatmap: Record<string, number> = {}
            for (const [id, count] of Object.entries(freq)) {
                heatmap[id] = maxCount > 0 ? count / maxCount : 0
            }
            setNodeHeatmap(heatmap)
        } catch (err) {
            void err
        }
    }, [heatmapMode, setHeatmapMode, setNodeHeatmap, nodes])

    return (
        <div style={{
            position: 'absolute',
            top: 16,
            right: compact ? 12 : 20,
            left: compact ? 64 : 'auto',
            zIndex: 10,
            display: 'flex',
            gap: 2,
            background: 'rgba(10,10,14,0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8,
            padding: '4px 6px',
            overflowX: compact ? 'auto' : 'visible',
        }}>
            <ToolbarBtn
                icon={<Thermometer size={14} />}
                label="Heatmap"
                active={heatmapMode}
                color="#f59e0b"
                onClick={handleHeatmapToggle}
                helpId="heatmap"
                compact={compact}
            />

            <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 2px' }} />

            <ToolbarBtn
                icon={<Zap size={14} />}
                label="Blast Radius"
                active={blastRadiusMode}
                color="#a78bfa"
                onClick={() => setBlastRadiusMode(!blastRadiusMode)}
                helpId="blast-radius"
                compact={compact}
            />

            <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 2px' }} />

            <ToolbarBtn
                icon={snapshotDone ? <Check size={14} /> : <Camera size={14} />}
                label={snapshotDone ? 'Copied!' : 'Snapshot — copy to clipboard'}
                color={snapshotDone ? '#34d399' : '#34d399'}
                active={snapshotDone}
                onClick={triggerSnapshot}
                helpId="snapshot"
                compact={compact}
            />

            <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 2px' }} />

            <ToolbarBtn
                icon={<FileText size={14} />}
                label="Summary"
                color="#60a5fa"
                onClick={() => setSummaryOpen(true)}
                helpId="summary"
                compact={compact}
            />

            <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 2px' }} />

            {/* Help mode toggle */}
            <button
                title={helpMode ? 'Exit Help Mode (Esc)' : 'Help Mode — hover anything to learn what it does'}
                onClick={() => setHelpMode(!helpMode)}
                data-help="help-mode"
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 28, borderRadius: 6, cursor: 'pointer',
                    background: helpMode ? 'rgba(192,132,252,0.2)' : 'transparent',
                    color: helpMode ? '#c084fc' : 'rgba(255,255,255,0.35)',
                    border: helpMode ? '1px solid rgba(192,132,252,0.45)' : '1px solid transparent',
                    transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                    if (!helpMode) {
                        (e.currentTarget as HTMLButtonElement).style.color = '#c084fc'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(192,132,252,0.1)'
                    }
                }}
                onMouseLeave={e => {
                    if (!helpMode) {
                        (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    }
                }}
            >
                <HelpCircle size={14} />
            </button>
        </div>
    )
}
