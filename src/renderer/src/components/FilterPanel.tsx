import { useGraphStore } from '../store/graph.store'
import { NodeType } from '../../../shared/types'
import { Filter, Search, GitBranch, Tag, Settings, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../store/app.store'

const ALL_TYPES: { type: NodeType; label: string; color: string }[] = [
    { type: 'agent',            label: 'Agents',      color: 'var(--k-node-agent)'  },
    { type: 'model',            label: 'Models',      color: 'var(--k-node-model)'  },
    { type: 'tool',             label: 'Tools',       color: 'var(--k-node-tool)'   },
    { type: 'memory_store',     label: 'Memory',      color: 'var(--k-node-memory)' },
    { type: 'prompt',           label: 'Prompts',     color: 'var(--k-node-prompt)' },
    { type: 'instruction_file', label: 'Instructions', color: '#c084fc'             },
    { type: 'source_doc',       label: 'Sources',     color: '#22d3ee'              },
    { type: 'wiki_page',        label: 'Wiki Pages',  color: '#38bdf8'              },
    { type: 'output_artifact',  label: 'Outputs',     color: '#f59e0b'              },
    { type: 'index_file',       label: 'Indexes',     color: '#86efac'              },
    { type: 'unresolved_link',  label: 'Broken Links', color: '#fb7185'             },
    { type: 'api',              label: 'APIs',        color: 'var(--k-node-api)'    },
    { type: 'module',           label: 'Modules',     color: 'var(--k-node-module)' },
    { type: 'file',             label: 'Files (off)',  color: '#94a3b8'              },
    { type: 'permission_scope', label: 'Permissions', color: '#ef4444'              },
]

// ── Space background data ──────────────────────────────────────────────────────
// [x%, y%, sizePx, opacity, twinkles]
const STARS: [number, number, number, number, boolean][] = [
    [8,  3,  1,   0.65, false], [22, 8,  1.5, 0.85, true ], [41, 5,  1,   0.45, false],
    [57, 12, 1,   0.55, false], [73, 4,  1.5, 0.75, true ], [89, 9,  1,   0.35, false],
    [14, 18, 1,   0.45, false], [33, 16, 1,   0.65, false], [52, 21, 1.5, 0.80, true ],
    [68, 17, 1,   0.45, false], [82, 23, 1,   0.55, false], [5,  31, 1,   0.35, false],
    [19, 29, 1.5, 0.70, false], [44, 34, 1,   0.55, true ], [63, 28, 1,   0.45, false],
    [78, 36, 1,   0.65, false], [92, 30, 1.5, 0.80, false], [11, 42, 1,   0.45, false],
    [28, 47, 1,   0.55, false], [47, 41, 1,   0.35, true ], [66, 45, 1,   0.60, false],
    [84, 43, 1.5, 0.75, false], [3,  55, 1,   0.40, false], [17, 52, 1,   0.55, false],
    [36, 58, 1,   0.35, false], [54, 54, 1.5, 0.85, true ], [71, 61, 1,   0.45, false],
    [88, 57, 1,   0.65, false], [25, 66, 1,   0.35, false], [43, 70, 1,   0.55, false],
    [61, 67, 1.5, 0.75, false], [79, 72, 1,   0.45, true ], [9,  75, 1,   0.55, false],
    [30, 78, 1,   0.35, false], [50, 82, 1,   0.65, false], [68, 79, 1,   0.45, false],
    [86, 84, 1.5, 0.80, false], [15, 88, 1,   0.35, false], [38, 91, 1,   0.55, false],
    [57, 87, 1,   0.45, true ], [74, 93, 1,   0.65, false], [93, 89, 1,   0.35, false],
    [2,  14, 1,   0.40, false], [97, 48, 1,   0.45, true ], [48, 96, 1,   0.35, false],
    [62, 37, 1,   0.30, false], [7,  62, 1,   0.40, false], [85, 71, 1,   0.35, false],
]


// ── Space background component ─────────────────────────────────────────────────
function SpaceBackground() {
    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: -1,
            pointerEvents: 'none',
            overflow: 'hidden',
        }}>
            {/* Deep-space base gradient with subtle colour bands */}
            <div style={{
                position: 'absolute', inset: 0,
                background: `
                    radial-gradient(ellipse 180% 80% at 50% 0%,   rgba(30,10,60,0.55)  0%, transparent 60%),
                    radial-gradient(ellipse 120% 60% at 80% 100%, rgba(10,20,50,0.45)  0%, transparent 55%),
                    radial-gradient(ellipse 100% 50% at 10% 50%,  rgba(20,5,40,0.35)   0%, transparent 50%)
                `,
            }} />

            {/* Static + twinkling stars */}
            {STARS.map(([x, y, size, opacity, twinkles], i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        left: `${x}%`,
                        top: `${y}%`,
                        width: size,
                        height: size,
                        borderRadius: '50%',
                        background: i % 7 === 0 ? 'rgba(200,190,255,0.9)' : 'white',
                        opacity,
                        boxShadow: size > 1 ? `0 0 ${size + 1}px rgba(200,200,255,0.6)` : 'none',
                        animation: twinkles
                            ? `kosmos-twinkle ${2.2 + (i % 4) * 0.6}s ease-in-out ${(i * 0.53) % 2.8}s infinite`
                            : undefined,
                    }}
                />
            ))}

            {/* Nebula clouds — soft colour washes */}
            <div style={{
                position: 'absolute', top: '10%', right: '-8%',
                width: 170, height: 130,
                background: 'radial-gradient(ellipse, rgba(139,92,246,0.09) 0%, transparent 68%)',
                borderRadius: '50%',
            }} />
            <div style={{
                position: 'absolute', bottom: '20%', left: '-8%',
                width: 160, height: 110,
                background: 'radial-gradient(ellipse, rgba(59,130,246,0.07) 0%, transparent 68%)',
                borderRadius: '50%',
            }} />
            <div style={{
                position: 'absolute', top: '50%', right: '15%',
                width: 120, height: 90,
                background: 'radial-gradient(ellipse, rgba(167,139,250,0.06) 0%, transparent 68%)',
                borderRadius: '50%',
            }} />
            <div style={{
                position: 'absolute', top: '35%', left: '40%',
                width: 90, height: 70,
                background: 'radial-gradient(ellipse, rgba(99,102,241,0.05) 0%, transparent 68%)',
                borderRadius: '50%',
            }} />

        </div>
    )
}

// ── Toggle switch ──────────────────────────────────────────────────────────────
function Toggle({ active }: { active: boolean }) {
    return (
        <div
            style={{
                width: 32, height: 18,
                borderRadius: 9,
                background: active
                    ? 'linear-gradient(90deg, #7c3aed, #a855f7)'
                    : 'rgba(255,255,255,0.08)',
                boxShadow: active ? '0 0 8px rgba(168,85,247,0.5)' : 'none',
                position: 'relative',
                transition: 'all 0.25s ease',
                cursor: 'pointer',
                flexShrink: 0,
                border: active ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.06)',
            }}
        >
            <div style={{
                position: 'absolute',
                top: 2, left: active ? 15 : 2,
                width: 12, height: 12,
                borderRadius: '50%',
                background: active ? '#fff' : 'rgba(255,255,255,0.4)',
                boxShadow: active ? '0 0 4px rgba(255,255,255,0.8)' : 'none',
                transition: 'all 0.25s ease',
            }} />
        </div>
    )
}

function SliderRow({ label, value, min, max, step, onChange }: { label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                <span>{label}</span>
                <span style={{ color: '#a855f7', fontWeight: 600 }}>{value.toFixed(1)}x</span>
            </div>
            <input 
                type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
                style={{
                    width: '100%', cursor: 'pointer',
                    accentColor: '#a855f7'
                }}
            />
        </div>
    )
}

// ── Main FilterPanel ───────────────────────────────────────────────────────────
export function FilterPanel() {
    const {
        filterTypes, toggleFilterType,
        searchQuery, setSearchQuery,
        showEdges, setShowEdges,
        showEdgeLabels, setShowEdgeLabels,
        nodeSizeMulti, setNodeSizeMulti,
        edgeWidthMulti, setEdgeWidthMulti,
        particleSpeedMulti, setParticleSpeedMulti,
        particleCountMulti, setParticleCountMulti,
        theme, setTheme
    } = useGraphStore()
    const cameraOrbitEnabled = useAppStore(s => s.cameraOrbitEnabled)
    const setCameraOrbitEnabled = useAppStore(s => s.setCameraOrbitEnabled)

    const [activeTab, setActiveTab] = useState<'filters' | 'settings'>('filters')

    return (
        <div
            data-help="filter-panel"
            style={{
                width: 268,
                borderRadius: 12,
                overflow: 'hidden',
                border: theme === 'cyberpunk' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(139,92,246,0.2)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
                background: theme === 'cyberpunk'
                    ? 'linear-gradient(160deg, rgba(6,10,6,0.98) 0%, rgba(0,0,0,0.98) 100%)'
                    : 'linear-gradient(160deg, rgba(8,5,20,0.98) 0%, rgba(5,4,14,0.98) 100%)',
                backdropFilter: 'blur(20px)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* ── Deep-space animated background ────────────────────────────── */}
            <SpaceBackground />

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div style={{
                padding: '14px 16px 12px',
                borderBottom: '1px solid rgba(139,92,246,0.15)',
                background: 'linear-gradient(180deg, rgba(88,28,135,0.2) 0%, transparent 100%)',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Header nebula orbs */}
                <div style={{
                    position: 'absolute', top: -20, right: -20,
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(139,92,246,0.28) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', top: 0, left: 30,
                    width: 60, height: 60, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            width: 26, height: 26, borderRadius: 6,
                            background: 'rgba(139,92,246,0.2)',
                            border: '1px solid rgba(139,92,246,0.35)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#a78bfa',
                            boxShadow: '0 0 8px rgba(139,92,246,0.3)',
                        }}>
                            {activeTab === 'filters' ? <Filter size={13} /> : <SlidersHorizontal size={13} />}
                        </div>
                        <span style={{
                            fontWeight: 600, fontSize: 13,
                            color: 'rgba(255,255,255,0.9)',
                            letterSpacing: '-0.01em',
                        }}>
                            {activeTab === 'filters' ? 'Graph Explorer' : 'Visual Settings'}
                        </span>
                    </div>

                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: 2 }}>
                        <button onClick={() => setActiveTab('filters')} style={{ background: activeTab === 'filters' ? 'rgba(139,92,246,0.3)' : 'transparent', color: activeTab === 'filters' ? '#fff' : 'rgba(255,255,255,0.5)', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}>
                            <Filter size={12} />
                        </button>
                        <button onClick={() => setActiveTab('settings')} style={{ background: activeTab === 'settings' ? 'rgba(139,92,246,0.3)' : 'transparent', color: activeTab === 'settings' ? '#fff' : 'rgba(255,255,255,0.5)', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}>
                            <Settings size={12} />
                        </button>
                    </div>
                </div>

                {/* Search box (only when filters tab is active) */}
                {activeTab === 'filters' && (
                    <div data-help="search-nodes" style={{ position: 'relative' }}>
                        <Search
                            size={12}
                            color="rgba(139,92,246,0.6)"
                            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
                        />
                        <input
                            type="text"
                            placeholder="Search nodes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(139,92,246,0.08)',
                                border: '1px solid rgba(139,92,246,0.2)',
                                borderRadius: 7,
                                padding: '7px 10px 7px 28px',
                                color: 'rgba(255,255,255,0.85)',
                                fontSize: 12,
                                outline: 'none',
                                transition: 'border-color 0.15s',
                                boxSizing: 'border-box',
                            }}
                            onFocus={e => (e.target.style.borderColor = 'rgba(139,92,246,0.5)')}
                            onBlur={e => (e.target.style.borderColor = 'rgba(139,92,246,0.2)')}
                        />
                    </div>
                )}
            </div>

            {activeTab === 'settings' ? (
                <div style={{ padding: '16px', maxHeight: 300, overflowY: 'auto' }}>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                            <span>Visual Theme</span>
                        </div>
                        <select
                            value={theme}
                            onChange={e => setTheme(e.target.value as any)}
                            style={{
                                width: '100%',
                                background: 'rgba(139,92,246,0.15)',
                                border: '1px solid rgba(139,92,246,0.3)',
                                padding: '6px 8px',
                                borderRadius: 6,
                                color: 'rgba(255,255,255,0.9)',
                                outline: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            <option value="default">Default Space</option>
                            <option value="nebula">Deep Nebula</option>
                            <option value="cyberpunk">Cyberpunk Neon</option>
                        </select>
                    </div>

                    <div
                        onClick={() => setCameraOrbitEnabled(!cameraOrbitEnabled)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            marginBottom: 16,
                            padding: '8px 10px',
                            cursor: 'pointer',
                            borderRadius: 8,
                            background: 'rgba(139,92,246,0.08)',
                            border: '1px solid rgba(139,92,246,0.15)',
                        }}
                    >
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.86)', fontWeight: 600 }}>
                                Orbit Camera
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2, lineHeight: 1.4 }}>
                                Slowly orbit around the graph center.
                            </div>
                        </div>
                        <Toggle active={cameraOrbitEnabled} />
                    </div>
                
                    <SliderRow label="Node Size" value={nodeSizeMulti} min={0.5} max={3.0} step={0.1} onChange={setNodeSizeMulti} />
                    <SliderRow label="Edge Thickness" value={edgeWidthMulti} min={0.2} max={4.0} step={0.1} onChange={setEdgeWidthMulti} />
                    <SliderRow label="Particle Speed" value={particleSpeedMulti} min={0.0} max={3.0} step={0.2} onChange={setParticleSpeedMulti} />
                    <SliderRow label="Particle Count" value={particleCountMulti} min={0.0} max={3.0} step={0.2} onChange={setParticleCountMulti} />
                </div>
            ) : (
                <>

            {/* ── Edge visibility toggles ─────────────────────────────────── */}
            <div style={{
                padding: '10px 16px 8px',
                borderBottom: '1px solid rgba(139,92,246,0.1)',
            }}>
                {/* Connections */}
                <div
                    data-help="connections-toggle"
                    onClick={() => setShowEdges(!showEdges)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '5px 0',
                        cursor: 'pointer',
                        opacity: showEdges ? 1 : 0.45,
                        transition: 'opacity 0.2s',
                    }}
                >
                    <GitBranch size={12} color="rgba(139,92,246,0.7)" />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', flex: 1 }}>
                        Connections
                    </span>
                    <Toggle active={showEdges} />
                </div>

                {/* Edge Labels */}
                <div
                    data-help="edge-labels"
                    onClick={() => setShowEdgeLabels(!showEdgeLabels)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '5px 0',
                        cursor: 'pointer',
                        opacity: showEdgeLabels && showEdges ? 1 : 0.45,
                        transition: 'opacity 0.2s',
                        pointerEvents: showEdges ? 'auto' : 'none',
                    }}
                >
                    <Tag size={12} color="rgba(139,92,246,0.7)" />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', flex: 1 }}>
                        Edge Labels
                    </span>
                    <Toggle active={showEdgeLabels && showEdges} />
                </div>
            </div>

            {/* ── Node type filters ───────────────────────────────────────── */}
            <div style={{
                padding: '8px 12px 10px',
                maxHeight: 300,
                overflowY: 'auto',
            }}>
                {ALL_TYPES.map(t => {
                    const active = filterTypes.has(t.type)
                    return (
                        <div
                            key={t.type}
                            data-help="node-type-filter"
                            onClick={() => toggleFilterType(t.type)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '6px 4px',
                                cursor: 'pointer',
                                opacity: active ? 1 : 0.35,
                                transition: 'all 0.2s',
                                borderRadius: 6,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                            {/* Node shape indicator */}
                            <div style={{
                                width: 10, height: 10,
                                borderRadius: t.type === 'agent' ? '50%' : 2,
                                background: active ? t.color : 'rgba(255,255,255,0.15)',
                                boxShadow: active ? `0 0 6px ${t.color}88` : 'none',
                                transition: 'all 0.2s',
                                flexShrink: 0,
                            }} />
                            <span style={{
                                fontSize: 12,
                                color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                                fontWeight: active ? 500 : 400,
                                flex: 1,
                            }}>
                                {t.label}
                            </span>
                            <Toggle active={active} />
                        </div>
                    )
                })}
            </div>
            </>
            )}
        </div>
    )
}
