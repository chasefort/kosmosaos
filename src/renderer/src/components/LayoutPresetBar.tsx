/**
 * LayoutPresetBar — floating pill-bar below the graph toolbar that lets the user
 * switch between layout presets: Force Simulation, Type Clusters, Radial Rings, Grid
 */

import { LayoutGrid, Orbit, Layers, AlignJustify } from 'lucide-react'
import { useGraphStore, LayoutPreset } from '../store/graph.store'

const PRESETS: { id: LayoutPreset; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'force',         label: 'Force',        icon: <Orbit size={13} />,         color: '#60a5fa' },
    { id: 'type-clusters', label: 'Type Groups',  icon: <Layers size={13} />,        color: '#a78bfa' },
    { id: 'radial',        label: 'Radial',        icon: <AlignJustify size={13} />, color: '#34d399' },
    { id: 'grid',          label: 'Grid',          icon: <LayoutGrid size={13} />,   color: '#f59e0b' },
]

export function LayoutPresetBar() {
    const layoutPreset = useGraphStore(s => s.layoutPreset)
    const setLayoutPreset = useGraphStore(s => s.setLayoutPreset)

    return (
        <div
            data-help="layout-preset-bar"
            style={{
                display: 'flex',
                gap: 2,
                background: 'rgba(10,10,14,0.85)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 8,
                padding: '4px 6px',
            }}
        >
            <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.25)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                alignSelf: 'center',
                paddingRight: 8,
                paddingLeft: 4,
            }}>
                Layout
            </span>

            {PRESETS.map((p, i) => {
                const active = layoutPreset === p.id
                return (
                    <button
                        key={p.id}
                        title={p.label}
                        onClick={() => setLayoutPreset(p.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', borderRadius: 5, cursor: 'pointer',
                            background: active ? `${p.color}22` : 'transparent',
                            color: active ? p.color : 'rgba(255,255,255,0.4)',
                            border: active ? `1px solid ${p.color}44` : '1px solid transparent',
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
                                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'
                                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                            }
                        }}
                    >
                        {p.icon}
                        <span>{p.label}</span>
                    </button>
                )
            })}
        </div>
    )
}
