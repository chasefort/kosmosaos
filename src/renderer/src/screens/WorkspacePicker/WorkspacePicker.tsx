import { useState, useEffect } from 'react'
import { FolderOpen, Settings2, Clock, ArrowRight, Terminal, Zap, Sparkles } from 'lucide-react'
import { useAppStore } from '../../store/app.store'
import { KosmosWorkspace } from '../../../shared/types'
import { DEMO_WORKSPACE_ID } from '../../universe/layout/demo-graph'

interface DetectedIntegrations {
    claudeCode: { detected: boolean; workspacePath: string | null }
}

export function WorkspacePicker() {
    const { setActiveWorkspace, integrationStatus } = useAppStore()
    const [recent, setRecent] = useState<KosmosWorkspace[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingPath, setLoadingPath] = useState<string | null>(null)
    const [detected, setDetected] = useState<DetectedIntegrations>({
        claudeCode: { detected: false, workspacePath: null }
    })
    const [showPathInput, setShowPathInput] = useState(false)
    const [manualPath, setManualPath] = useState('')

    useEffect(() => {
        window.api.getRecentWorkspaces().then(setRecent)
        // Proactively scan for known integrations (Claude Code at ~/.claude, etc.)
        window.api.detectAvailableIntegrations().then((res: DetectedIntegrations) => {
            setDetected(res)
        })
        // In browser mode (npx kosmos-aos), check if a workspace path was passed via CLI
        if (window.location.protocol !== 'file:') {
            fetch('/api/server-config')
                .then(r => r.json())
                .then((cfg: { workspacePath: string | null; preScannedWorkspace?: KosmosWorkspace | null }) => {
                    if (cfg.preScannedWorkspace) setActiveWorkspace(cfg.preScannedWorkspace)
                    else if (cfg.workspacePath) openWorkspace(cfg.workspacePath)
                })
                .catch(() => { /* not in server mode */ })
        }
    }, [])

    const openWorkspace = async (path: string) => {
        try {
            setLoading(true)
            setLoadingPath(path)
            const ws = await window.api.scanWorkspace(path)
            setActiveWorkspace(ws)
        } catch {
            // scan failed — stay on picker
        } finally {
            setLoading(false)
            setLoadingPath(null)
        }
    }

    const handleDemo = () => {
        setActiveWorkspace({
            id: DEMO_WORKSPACE_ID,
            name: 'Demo — Multi-Agent Coding Assistant',
            path: '',
            openedAt: Date.now(),
        })
    }

    const handleOpen = async () => {
        try {
            setLoading(true)
            setLoadingPath('dialog')
            const path = await window.api.openWorkspaceDialog()
            if (path) {
                await openWorkspace(path)
            } else {
                // Browser mode: dialog not available, show text input instead
                setShowPathInput(true)
            }
        } catch {
            // dialog cancelled or scan failed
        } finally {
            setLoading(false)
            setLoadingPath(null)
        }
    }

    const handleManualPathSubmit = async () => {
        const trimmed = manualPath.trim()
        if (!trimmed) return
        setShowPathInput(false)
        await openWorkspace(trimmed)
    }

    // Integrations visible in the "detected" banner
    const detectedItems: { key: string; label: string; sub: string; icon: JSX.Element; accentColor: string; workspacePath: string | null }[] = []

    if (detected.claudeCode.detected && detected.claudeCode.workspacePath) {
        detectedItems.push({
            key: 'claudeCode',
            label: 'Claude Code',
            sub: detected.claudeCode.workspacePath,
            icon: <Terminal size={18} />,
            accentColor: '#f97316',   // orange
            workspacePath: detected.claudeCode.workspacePath,
        })
    }

    // OpenClaw shows if its WS is live (can connect after startup via auto-detect)
    if (integrationStatus.openClaw.connected) {
        detectedItems.push({
            key: 'openClaw',
            label: 'OpenClaw Gateway',
            sub: integrationStatus.openClaw.url ?? 'ws://localhost:18789',
            icon: <Zap size={18} />,
            accentColor: '#a855f7',   // purple
            workspacePath: null,       // WS-based, no FS path
        })
    }

    const hasDetected = detectedItems.length > 0

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, #0B0E1A 0%, var(--k-bg-base) 100%)'
        }}>
            <div style={{
                width: 840,
                background: 'var(--k-bg-panel)',
                borderRadius: 16,
                padding: 40,
                border: '1px solid var(--k-border-subtle)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: hasDetected ? 32 : 40 }}>
                    <div style={{
                        width: 72, height: 72,
                        borderRadius: 16,
                        margin: '0 auto 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        boxShadow: '0 0 32px rgba(139,92,246,0.35), 0 8px 24px rgba(0,0,0,0.5)',
                    }}>
                        <img
                            src="/icon.png"
                            alt="Kosmos"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                    </div>
                    <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 700 }}>Kosmos</h1>
                    <p style={{ margin: 0, color: 'var(--k-text-secondary)', fontSize: 14 }}>The operating system for AI agents</p>
                </div>

                {/* ── Detected Integration Banner ────────────────────────────── */}
                {hasDetected && (
                    <div style={{ marginBottom: 28 }}>
                        <div style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'rgba(255,255,255,0.35)',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            marginBottom: 10,
                        }}>
                            Detected on this machine
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {detectedItems.map(item => (
                                <DetectedCard
                                    key={item.key}
                                    icon={item.icon}
                                    label={item.label}
                                    sub={item.sub}
                                    accentColor={item.accentColor}
                                    workspacePath={item.workspacePath}
                                    loading={loading && loadingPath === item.workspacePath}
                                    onOpen={item.workspacePath ? () => openWorkspace(item.workspacePath!) : undefined}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Main Content Row ───────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 40 }}>
                    {/* Left column */}
                    <div style={{ flex: 1 }}>
                        {/* Open workspace button */}
                        <button
                            onClick={handleOpen}
                            disabled={loading}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                padding: 18,
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid var(--k-border-subtle)',
                                borderRadius: 10,
                                color: 'var(--k-text-primary)',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                                cursor: loading ? 'wait' : 'pointer',
                                opacity: loading ? 0.7 : 1
                            }}
                            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                        >
                            <div style={{
                                width: 38, height: 38,
                                borderRadius: 8,
                                background: 'rgba(255,255,255,0.06)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--k-text-primary)',
                                flexShrink: 0,
                            }}>
                                <FolderOpen size={18} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 15 }}>Open Workspace</div>
                                <div style={{ color: 'var(--k-text-dim)', fontSize: 12, marginTop: 3 }}>
                                    {loading && loadingPath === 'dialog' ? 'Scanning repository...' : 'Select a local folder to analyze'}
                                </div>
                            </div>
                            <ArrowRight size={16} style={{ color: 'var(--k-text-dim)', flexShrink: 0 }} />
                        </button>

                        {/* Browser mode: manual path input (shown when file dialog is unavailable) */}
                        {showPathInput && (
                            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                                <input
                                    autoFocus
                                    type="text"
                                    value={manualPath}
                                    onChange={e => setManualPath(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleManualPathSubmit()}
                                    placeholder="/path/to/your/project"
                                    style={{
                                        flex: 1,
                                        padding: '10px 14px',
                                        borderRadius: 8,
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--k-border-subtle)',
                                        color: 'var(--k-text-primary)',
                                        fontSize: 13,
                                        fontFamily: 'JetBrains Mono, monospace',
                                        outline: 'none',
                                    }}
                                />
                                <button
                                    onClick={handleManualPathSubmit}
                                    disabled={!manualPath.trim() || loading}
                                    style={{
                                        padding: '10px 16px',
                                        borderRadius: 8,
                                        background: 'var(--k-accent)',
                                        color: '#fff',
                                        fontWeight: 600,
                                        fontSize: 13,
                                        cursor: manualPath.trim() && !loading ? 'pointer' : 'not-allowed',
                                        opacity: manualPath.trim() && !loading ? 1 : 0.5,
                                        transition: 'opacity 0.15s',
                                    }}
                                >
                                    Open
                                </button>
                            </div>
                        )}

                        {/* Try Demo button */}
                        <button
                            onClick={handleDemo}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                padding: 18,
                                marginTop: 10,
                                background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.08) 100%)',
                                border: '1px solid rgba(139,92,246,0.3)',
                                borderRadius: 10,
                                color: 'var(--k-text-primary)',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                                cursor: 'pointer',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(59,130,246,0.14) 100%)'
                                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(139,92,246,0.55)'
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.08) 100%)'
                                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(139,92,246,0.3)'
                            }}
                        >
                            <div style={{
                                width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                                background: 'rgba(139,92,246,0.15)',
                                border: '1px solid rgba(139,92,246,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#a78bfa',
                            }}>
                                <Sparkles size={18} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 15 }}>Try Demo Graph</div>
                                <div style={{ color: 'var(--k-text-dim)', fontSize: 12, marginTop: 3 }}>
                                    Explore a pre-built multi-agent system — no workspace needed
                                </div>
                            </div>
                            <ArrowRight size={16} style={{ color: '#a78bfa', flexShrink: 0 }} />
                        </button>

                        {/* Integration status (compact, secondary) */}
                        <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 8, border: '1px solid var(--k-border-subtle)', background: 'rgba(0,0,0,0.15)' }}>
                            <div style={{ fontSize: 11, color: 'var(--k-text-dim)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                                <Settings2 size={11} /> Integration Status
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                <StatusRow
                                    label="Local Claude Code"
                                    active={integrationStatus.claudeCode.connected || detected.claudeCode.detected}
                                    workspacePath={detected.claudeCode.workspacePath}
                                    loading={loading && loadingPath === detected.claudeCode.workspacePath}
                                    onOpen={detected.claudeCode.workspacePath ? () => openWorkspace(detected.claudeCode.workspacePath!) : undefined}
                                />
                                <StatusRow
                                    label="OpenClaw Gateway"
                                    active={integrationStatus.openClaw.connected}
                                    workspacePath={null}
                                    loading={false}
                                    onOpen={undefined}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Recent workspaces */}
                    <div style={{ width: 280, borderLeft: '1px solid var(--k-border-subtle)', paddingLeft: 36 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--k-text-dim)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: '1px' }}>
                            <Clock size={11} /> Recent
                        </div>
                        {recent.length === 0 ? (
                            <div style={{ color: 'var(--k-text-dim)', fontSize: 13 }}>No recent workspaces</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {recent.map(ws => (
                                    <button
                                        key={ws.id}
                                        onClick={() => openWorkspace(ws.path)}
                                        disabled={loading}
                                        style={{
                                            display: 'block', width: '100%', textAlign: 'left',
                                            padding: '8px 10px', borderRadius: 6,
                                            background: 'transparent',
                                            color: 'var(--k-text-primary)',
                                            opacity: loading ? 0.5 : 1,
                                            cursor: loading ? 'wait' : 'pointer',
                                            transition: 'background 0.1s',
                                        }}
                                        onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <div style={{ fontWeight: 500, fontSize: 13 }}>{ws.name}</div>
                                        <div style={{ color: 'var(--k-text-dim)', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {ws.path}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Detected Integration Card ────────────────────────────────────────────────

interface DetectedCardProps {
    icon: JSX.Element
    label: string
    sub: string
    accentColor: string
    workspacePath: string | null
    loading: boolean
    onOpen?: () => void
}

function DetectedCard({ icon, label, sub, accentColor, loading, onOpen }: DetectedCardProps) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 18px',
            borderRadius: 10,
            background: `linear-gradient(135deg, ${accentColor}14 0%, rgba(255,255,255,0.03) 100%)`,
            border: `1px solid ${accentColor}40`,
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Subtle glow strip on left */}
            <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                background: accentColor,
                borderRadius: '10px 0 0 10px',
            }} />

            {/* Pulsing dot */}
            <div style={{ position: 'relative', flexShrink: 0, marginLeft: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: accentColor }} />
                <div style={{
                    position: 'absolute', inset: -3,
                    borderRadius: '50%',
                    border: `2px solid ${accentColor}`,
                    animation: 'kosmos-ping 1.6s cubic-bezier(0,0,0.2,1) infinite',
                    opacity: 0.5,
                }} />
            </div>

            {/* Icon */}
            <div style={{ color: accentColor, flexShrink: 0 }}>{icon}</div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--k-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {label}
                    <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px',
                        padding: '2px 7px', borderRadius: 20,
                        background: `${accentColor}25`, color: accentColor,
                    }}>
                        Detected
                    </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--k-text-dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sub}
                </div>
            </div>

            {/* Open button */}
            {onOpen && (
                <button
                    onClick={onOpen}
                    disabled={loading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 8,
                        background: accentColor,
                        color: '#fff',
                        fontWeight: 600, fontSize: 13,
                        flexShrink: 0,
                        cursor: loading ? 'wait' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                        transition: 'all 0.15s',
                        boxShadow: `0 0 16px ${accentColor}50`,
                    }}
                    onMouseEnter={(e) => !loading && (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = loading ? '0.7' : '1')}
                >
                    {loading ? 'Opening...' : 'Open'}
                    {!loading && <ArrowRight size={14} />}
                </button>
            )}
        </div>
    )
}

// ── Compact status row (in the secondary panel) ──────────────────────────────

interface StatusRowProps {
    label: string
    active: boolean
    workspacePath: string | null
    loading: boolean
    onOpen?: () => void
}

function StatusRow({ label, active, loading, onOpen }: StatusRowProps) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{
                width: 7, height: 7, borderRadius: 2, flexShrink: 0,
                background: active ? 'var(--k-status-ok)' : 'var(--k-status-offline)'
            }} />
            <span style={{ flex: 1, color: active ? 'var(--k-text-primary)' : 'var(--k-text-dim)' }}>
                {label}
            </span>
            {onOpen && active && (
                <button
                    onClick={onOpen}
                    disabled={loading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 9px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: 'var(--k-text-secondary)',
                        fontSize: 11, fontWeight: 500,
                        cursor: loading ? 'wait' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        transition: 'all 0.1s',
                    }}
                    onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                >
                    {loading ? '...' : 'Open'}
                </button>
            )}
        </div>
    )
}
