import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    User, FolderOpen, Plug, Info, ChevronRight,
    CheckCircle2, RefreshCw, FolderInput,
    Server, Zap, ExternalLink, GitBranch,
    Clock, Box, Link2, Copy, Check
} from 'lucide-react'
import { useAppStore } from '../../store/app.store'
import { useGraphStore } from '../../store/graph.store'
import { KosmosWorkspace } from '../../../shared/types'

// ── shared primitives ────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.9px', color: 'rgba(255,255,255,0.25)',
            marginBottom: 12, marginTop: 4,
        }}>
            {children}
        </div>
    )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--k-border-subtle)',
            borderRadius: 10,
            overflow: 'hidden',
            ...style,
        }}>
            {children}
        </div>
    )
}

function CardRow({
    icon, label, value, action, mono, accent, divider = true
}: {
    icon?: React.ReactNode
    label: string
    value?: React.ReactNode
    action?: React.ReactNode
    mono?: boolean
    accent?: string
    divider?: boolean
}) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px',
            borderBottom: divider ? '1px solid var(--k-border-subtle)' : 'none',
        }}>
            {icon && (
                <span style={{ color: accent ?? 'var(--k-text-dim)', flexShrink: 0, display: 'flex' }}>
                    {icon}
                </span>
            )}
            <span style={{ flex: 1, fontSize: 13, color: 'var(--k-text-secondary)' }}>{label}</span>
            {value !== undefined && (
                <span style={{
                    fontSize: 12,
                    color: accent ?? 'var(--k-text-dim)',
                    fontFamily: mono ? 'JetBrains Mono, monospace' : undefined,
                    maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {value}
                </span>
            )}
            {action}
        </div>
    )
}

function Badge({ label, color }: { label: string; color: string }) {
    return (
        <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
            padding: '2px 8px', borderRadius: 20,
            background: color + '18', border: `1px solid ${color}40`,
            color,
        }}>
            {label}
        </span>
    )
}

function PillButton({
    children, onClick, variant = 'ghost', disabled
}: {
    children: React.ReactNode
    onClick?: () => void
    variant?: 'ghost' | 'primary' | 'danger'
    disabled?: boolean
}) {
    const colors = {
        ghost:   { bg: 'rgba(255,255,255,0.06)', hover: 'rgba(255,255,255,0.1)',  text: 'var(--k-text-secondary)',  border: 'var(--k-border-subtle)' },
        primary: { bg: 'rgba(96,165,250,0.12)',   hover: 'rgba(96,165,250,0.2)',   text: '#60a5fa',                  border: 'rgba(96,165,250,0.3)' },
        danger:  { bg: 'rgba(239,68,68,0.1)',      hover: 'rgba(239,68,68,0.18)',   text: '#ef4444',                  border: 'rgba(239,68,68,0.25)' },
    }[variant]

    const [hovered, setHovered] = useState(false)

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                fontSize: 11, fontWeight: 600,
                padding: '4px 12px', borderRadius: 6,
                background: hovered ? colors.hover : colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.text,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
            }}
        >
            {children}
        </button>
    )
}

function StatusDot({ ok }: { ok: boolean }) {
    return (
        <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
            background: ok ? 'var(--k-status-ok)' : 'var(--k-status-offline)',
            boxShadow: ok ? '0 0 6px var(--k-status-ok)' : 'none',
        }} />
    )
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)
    const doCopy = () => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }
    return (
        <button onClick={doCopy} title="Copy" style={{ color: copied ? 'var(--k-status-ok)' : 'var(--k-text-dim)', padding: '2px 4px', borderRadius: 4, cursor: 'pointer' }}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
    )
}

// ── nav sections ─────────────────────────────────────────────────────────────

type Section = 'account' | 'workspace' | 'integrations' | 'about'

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'account',      label: 'Account',      icon: <User size={15} /> },
    { id: 'workspace',    label: 'Workspace',     icon: <FolderOpen size={15} /> },
    { id: 'integrations', label: 'Integrations',  icon: <Plug size={15} /> },
    { id: 'about',        label: 'About',         icon: <Info size={15} /> },
]

// ── section: Account ─────────────────────────────────────────────────────────

function AccountSection() {
    const [displayName, setDisplayName] = useState('')
    const [email, setEmail]             = useState('')
    const [saving, setSaving]           = useState(false)
    const [saved, setSaved]             = useState(false)

    useEffect(() => {
        ;(async () => {
            const name  = await window.api.getSetting('account.displayName')
            const email = await window.api.getSetting('account.email')
            if (name)  setDisplayName(name)
            if (email) setEmail(email)
        })()
    }, [])

    const save = async () => {
        setSaving(true)
        await window.api.setSetting('account.displayName', displayName)
        await window.api.setSetting('account.email', email)
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const initials = displayName
        ? displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : '?'

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Avatar + Identity */}
            <div>
                <SectionHeading>Profile</SectionHeading>
                <Card>
                    {/* Avatar row */}
                    <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--k-border-subtle)' }}>
                        <div style={{
                            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, #60a5fa33, #a78bfa33)',
                            border: '2px solid rgba(167,139,250,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18, fontWeight: 700, color: '#a78bfa', letterSpacing: 1,
                        }}>
                            {initials}
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--k-text-primary)' }}>
                                {displayName || 'Unnamed User'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--k-text-dim)', marginTop: 2 }}>
                                {email || 'No email set'}
                            </div>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                            <Badge label="Local" color="#64748b" />
                        </div>
                    </div>

                    {/* Name input */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--k-border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--k-text-dim)', width: 90, flexShrink: 0 }}>Display name</span>
                        <input
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            placeholder="Your name"
                            style={{
                                flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--k-border-subtle)',
                                borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--k-text-primary)',
                                outline: 'none', fontFamily: 'inherit',
                            }}
                            onFocus={e => (e.target.style.borderColor = 'rgba(96,165,250,0.5)')}
                            onBlur={e => (e.target.style.borderColor = 'var(--k-border-subtle)')}
                        />
                    </div>

                    {/* Email input */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--k-border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--k-text-dim)', width: 90, flexShrink: 0 }}>Email</span>
                        <input
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            type="email"
                            style={{
                                flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--k-border-subtle)',
                                borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--k-text-primary)',
                                outline: 'none', fontFamily: 'inherit',
                            }}
                            onFocus={e => (e.target.style.borderColor = 'rgba(96,165,250,0.5)')}
                            onBlur={e => (e.target.style.borderColor = 'var(--k-border-subtle)')}
                        />
                    </div>

                    {/* Save button */}
                    <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        {saved && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--k-status-ok)' }}>
                                <Check size={12} /> Saved
                            </span>
                        )}
                        <PillButton variant="primary" onClick={save} disabled={saving}>
                            {saving ? 'Saving…' : 'Save Profile'}
                        </PillButton>
                    </div>
                </Card>
            </div>


        </div>
    )
}

// ── section: Workspace ────────────────────────────────────────────────────────

function WorkspaceSection() {
    const { activeWorkspace, setActiveWorkspace, incrementScanVersion } = useAppStore()
    const { nodes, edges } = useGraphStore()
    const navigate = useNavigate()
    const [recent, setRecent]   = useState<KosmosWorkspace[]>([])
    const [rescanning, setRescanning] = useState(false)
    const [rescanned, setRescanned]   = useState(false)

    useEffect(() => {
        window.api.getRecentWorkspaces().then((ws: KosmosWorkspace[]) => setRecent(ws))
    }, [])

    const handleRescan = async () => {
        if (!activeWorkspace) return
        setRescanning(true)
        await window.api.scanWorkspace(activeWorkspace.path)
        incrementScanVersion()
        setRescanning(false)
        setRescanned(true)
        setTimeout(() => setRescanned(false), 2500)
    }

    const handleOpenNew = async () => {
        const path = await window.api.openWorkspaceDialog()
        if (!path) return
        const ws = await window.api.scanWorkspace(path)
        if (ws) {
            setActiveWorkspace(ws)
            navigate('/universe')
        }
    }

    const handleOpenRecent = async (ws: KosmosWorkspace) => {
        const result = await window.api.scanWorkspace(ws.path)
        if (result) {
            setActiveWorkspace(result)
            navigate('/universe')
        }
    }

    const shortPath = (p: string) => p.replace(/\\/g, '/').split('/').slice(-3).join('/')

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Current workspace */}
            {activeWorkspace ? (
                <div>
                    <SectionHeading>Current Workspace</SectionHeading>
                    <Card>
                        {/* Header */}
                        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, borderBottom: '1px solid var(--k-border-subtle)' }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                                background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <FolderOpen size={18} color="#60a5fa" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--k-text-primary)', marginBottom: 3 }}>
                                    {activeWorkspace.name}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--k-text-dim)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {activeWorkspace.path}
                                </div>
                            </div>
                            <CopyButton text={activeWorkspace.path} />
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, borderBottom: '1px solid var(--k-border-subtle)' }}>
                            {[
                                { label: 'Nodes',   value: nodes.length,              icon: <Box size={12} /> },
                                { label: 'Edges',   value: edges.length,              icon: <Link2 size={12} /> },
                                { label: 'ID',      value: activeWorkspace.id.slice(0, 8) + '…', icon: <GitBranch size={12} />, mono: true },
                            ].map(({ label, value, icon, mono }, i) => (
                                <div key={label} style={{
                                    padding: '12px 16px', textAlign: 'center',
                                    borderRight: i < 2 ? '1px solid var(--k-border-subtle)' : 'none',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, color: 'var(--k-text-dim)', marginBottom: 4 }}>
                                        {icon}
                                        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
                                    </div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--k-text-primary)', fontFamily: mono ? 'monospace' : undefined }}>
                                        {value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div style={{ padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
                            <PillButton variant="primary" onClick={handleRescan} disabled={rescanning}>
                                {rescanning
                                    ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite', marginRight: 5 }} />Rescanning…</>
                                    : <><RefreshCw size={11} style={{ marginRight: 5 }} />Rescan Workspace</>
                                }
                            </PillButton>
                            {rescanned && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--k-status-ok)' }}>
                                    <CheckCircle2 size={11} /> Done
                                </span>
                            )}
                            <div style={{ flex: 1 }} />
                            <PillButton variant="ghost" onClick={() => navigate('/universe')}>
                                View Map
                            </PillButton>
                        </div>
                    </Card>
                </div>
            ) : (
                <div>
                    <SectionHeading>Current Workspace</SectionHeading>
                    <Card>
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--k-text-dim)', fontSize: 13 }}>
                            No workspace open
                        </div>
                    </Card>
                </div>
            )}

            {/* Open new workspace */}
            <div>
                <SectionHeading>Open Workspace</SectionHeading>
                <Card>
                    <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                            width: 34, height: 34, borderRadius: 7,
                            background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <FolderInput size={16} color="#a78bfa" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--k-text-primary)', marginBottom: 2 }}>
                                Open a folder
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--k-text-dim)' }}>
                                Pick any directory to scan and visualize its AI architecture
                            </div>
                        </div>
                        <PillButton variant="primary" onClick={handleOpenNew}>
                            Browse…
                        </PillButton>
                    </div>
                </Card>
            </div>

            {/* Recent workspaces */}
            {recent.length > 0 && (
                <div>
                    <SectionHeading>Recent Workspaces</SectionHeading>
                    <Card>
                        {recent.map((ws, i) => {
                            const isCurrent = ws.id === activeWorkspace?.id
                            return (
                                <div key={ws.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '11px 16px',
                                    borderBottom: i < recent.length - 1 ? '1px solid var(--k-border-subtle)' : 'none',
                                }}>
                                    <FolderOpen size={14} color={isCurrent ? '#60a5fa' : 'var(--k-text-dim)'} style={{ flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, color: isCurrent ? '#60a5fa' : 'var(--k-text-secondary)', fontWeight: isCurrent ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {ws.name}
                                            {isCurrent && <span style={{ marginLeft: 7, fontSize: 10, color: 'var(--k-text-dim)' }}>• current</span>}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--k-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                                            {shortPath(ws.path)}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                                            <Clock size={9} style={{ display: 'inline', marginRight: 3 }} />
                                            {new Date(ws.openedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                        {!isCurrent && (
                                            <PillButton variant="ghost" onClick={() => handleOpenRecent(ws)}>
                                                Open
                                            </PillButton>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </Card>
                </div>
            )}

        </div>
    )
}

// ── section: Integrations ─────────────────────────────────────────────────────

function IntegrationsSection() {
    const { integrationStatus, activeWorkspace, setFileExplorerOpen } = useAppStore()
    const navigate = useNavigate()
    const [ccSessions, setCcSessions]   = useState<number | null>(null)
    const [ingestToggling, setIngestToggling] = useState(false)
    const [reimporting, setReimporting] = useState(false)

    useEffect(() => {
        if (!activeWorkspace) return
        window.api.readClaudeSessions(activeWorkspace.path).then((sessions: unknown[]) => {
            setCcSessions(Array.isArray(sessions) ? sessions.length : 0)
        }).catch(() => setCcSessions(0))
    }, [activeWorkspace])

    const toggleIngest = async () => {
        setIngestToggling(true)
        try {
            if (integrationStatus.ingestServer.running) {
                await window.api.stopIngestServer()
            } else {
                await window.api.startIngestServer()
            }
            const status = await window.api.getIntegrationStatus()
            useAppStore.getState().setIntegrationStatus(status)
        } finally {
            setIngestToggling(false)
        }
    }

    const cc  = integrationStatus.claudeCode
    const ocl = integrationStatus.openClaw
    const ing = integrationStatus.ingestServer

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Claude Code */}
            <div>
                <SectionHeading>Claude Code</SectionHeading>
                <Card>
                    <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, borderBottom: '1px solid var(--k-border-subtle)' }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                            background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Zap size={17} color="#60a5fa" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--k-text-primary)' }}>Claude Code</span>
                                <StatusDot ok={cc.connected || (ccSessions !== null && ccSessions > 0)} />
                                <Badge
                                    label={cc.connected || (ccSessions !== null && ccSessions > 0) ? 'Detected' : 'Not found'}
                                    color={cc.connected || (ccSessions !== null && ccSessions > 0) ? '#10b981' : '#64748b'}
                                />
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--k-text-dim)', lineHeight: 1.5 }}>
                                Auto-detects sessions from <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>~/.claude/projects/</span>.
                                No configuration needed.
                            </div>
                        </div>
                    </div>

                    <CardRow
                        icon={<Server size={13} />}
                        label="Sessions found"
                        value={ccSessions === null ? '…' : ccSessions === 0 ? 'None in this workspace' : `${ccSessions} session${ccSessions !== 1 ? 's' : ''}`}
                        accent={ccSessions !== null && ccSessions > 0 ? '#10b981' : undefined}
                        divider
                    />
                    {cc.lastEvent && (
                        <CardRow
                            icon={<Clock size={13} />}
                            label="Last activity"
                            value={new Date(cc.lastEvent).toLocaleString()}
                            divider
                        />
                    )}
                    <div style={{ padding: '10px 16px' }}>
                        <PillButton variant="primary" disabled={reimporting} onClick={async () => {
                            if (!activeWorkspace) return
                            setReimporting(true)
                            try {
                                await window.api.scanWorkspace(activeWorkspace.path)
                                const s = await window.api.getIntegrationStatus()
                                useAppStore.getState().setIntegrationStatus(s)
                                // Reload session count
                                window.api.readClaudeSessions(activeWorkspace.path).then((sessions: unknown[]) => {
                                    setCcSessions(Array.isArray(sessions) ? sessions.length : 0)
                                })
                                // Open workspace in Kosmos file explorer and navigate there
                                setFileExplorerOpen(true)
                                navigate('/universe')
                            } finally {
                                setReimporting(false)
                            }
                        }}>
                            {reimporting
                                ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite', marginRight: 5 }} />Importing…</>
                                : 'Re-import Sessions'
                            }
                        </PillButton>
                    </div>
                </Card>
            </div>

            {/* OpenClaw */}
            <div>
                <SectionHeading>OpenClaw</SectionHeading>
                <Card>
                    <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, borderBottom: '1px solid var(--k-border-subtle)' }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                            background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Plug size={17} color="#34d399" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--k-text-primary)' }}>OpenClaw Gateway</span>
                                <StatusDot ok={ocl.connected} />
                                <Badge label={ocl.connected ? 'Connected' : 'Offline'} color={ocl.connected ? '#10b981' : '#64748b'} />
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--k-text-dim)', lineHeight: 1.5 }}>
                                Connects to the local OpenClaw gateway for real-time agent event streaming.
                            </div>
                        </div>
                    </div>

                    <CardRow icon={<Server size={13} />} label="Gateway URL"   value={ocl.url ?? 'ws://127.0.0.1:18789'} mono divider />
                    <CardRow icon={<StatusDot ok={ocl.connected} />} label="Status" value={ocl.connected ? 'Connected' : 'Not reachable'} divider={false} />
                </Card>
            </div>

            {/* Ingest Server */}
            <div>
                <SectionHeading>Ingest Server</SectionHeading>
                <Card>
                    <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, borderBottom: '1px solid var(--k-border-subtle)' }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                            background: ing.running ? 'rgba(167,139,250,0.12)' : 'rgba(100,116,139,0.1)',
                            border: `1px solid ${ing.running ? 'rgba(167,139,250,0.3)' : 'rgba(100,116,139,0.2)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Server size={17} color={ing.running ? '#a78bfa' : '#64748b'} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--k-text-primary)' }}>Local Ingest Server</span>
                                <StatusDot ok={ing.running} />
                                <Badge label={ing.running ? 'Running' : 'Stopped'} color={ing.running ? '#10b981' : '#64748b'} />
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--k-text-dim)', lineHeight: 1.5 }}>
                                HTTP endpoint that any SDK can push events to. Used for custom integrations.
                            </div>
                        </div>
                    </div>

                    <CardRow icon={<Server size={13} />} label="Port"   value={`:${ing.port}`} mono divider />
                    <CardRow icon={<Link2 size={13} />}  label="Endpoint" value={`http://localhost:${ing.port}/ingest`} mono divider />
                    <div style={{ padding: '10px 16px', display: 'flex', gap: 8 }}>
                        <PillButton
                            variant={ing.running ? 'danger' : 'primary'}
                            onClick={toggleIngest}
                            disabled={ingestToggling}
                        >
                            {ingestToggling ? 'Working…' : ing.running ? 'Stop Server' : 'Start Server'}
                        </PillButton>
                    </div>
                </Card>
            </div>

        </div>
    )
}

// ── section: About ────────────────────────────────────────────────────────────

function AboutSection() {
    const { version } = useAppStore()

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            <div>
                <SectionHeading>Application</SectionHeading>
                <Card>
                    {/* Logo + version */}
                    <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--k-border-subtle)' }}>
                        <div style={{
                            width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                            background: 'linear-gradient(135deg, rgba(96,165,250,0.2), rgba(167,139,250,0.2))',
                            border: '1px solid rgba(167,139,250,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Box size={24} color="#a78bfa" />
                        </div>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--k-text-primary)', letterSpacing: '-0.3px' }}>Kosmos</div>
                            <div style={{ fontSize: 12, color: 'var(--k-text-dim)', marginTop: 2 }}>Trust layer for AI workspaces</div>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                            <Badge label={`v${version}`} color="#a78bfa" />
                        </div>
                    </div>

                    <CardRow label="Version"       value={version}    mono divider />
                    <CardRow label="Build type"    value="Production" divider />
                    <CardRow label="Electron"      value="35.x"       mono divider />
                    <CardRow label="React"         value="18.x"       mono divider={false} />
                </Card>
            </div>

            <div>
                <SectionHeading>Links</SectionHeading>
                <Card>
                    {[
                        { label: 'Documentation',  href: 'https://www.getkosmos.xyz' },
                        { label: 'Report an Issue', href: 'https://github.com/chasefort/kosmosaos/issues' },
                        { label: 'Changelog',       href: 'https://github.com/chasefort/kosmosaos/releases' },
                    ].map(({ label, href }, i, arr) => (
                        <div
                            key={label}
                            onClick={() => window.open(href, '_blank')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 16px', cursor: 'pointer',
                                borderBottom: i < arr.length - 1 ? '1px solid var(--k-border-subtle)' : 'none',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <span style={{ flex: 1, fontSize: 13, color: 'var(--k-text-secondary)' }}>{label}</span>
                            <ExternalLink size={12} color="var(--k-text-dim)" />
                        </div>
                    ))}
                </Card>
            </div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', textAlign: 'center', marginTop: 8 }}>
                © {new Date().getFullYear()} Kosmos · All rights reserved
            </div>

        </div>
    )
}

// ── main ─────────────────────────────────────────────────────────────────────

export function SettingsScreen() {
    const [section, setSection] = useState<Section>('account')

    const CONTENT: Record<Section, React.ReactNode> = {
        account:      <AccountSection />,
        workspace:    <WorkspaceSection />,
        integrations: <IntegrationsSection />,
        about:        <AboutSection />,
    }

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', background: 'var(--k-bg-base)' }}>

            {/* Left nav */}
            <div style={{
                width: 220, flexShrink: 0,
                background: 'var(--k-bg-panel)',
                borderRight: '1px solid var(--k-border-subtle)',
                display: 'flex', flexDirection: 'column',
                padding: '24px 0',
            }}>
                {/* Header */}
                <div style={{ padding: '0 18px 20px', borderBottom: '1px solid var(--k-border-subtle)', marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.25)' }}>
                        Settings
                    </div>
                </div>

                {/* Nav items */}
                {SECTIONS.map(({ id, label, icon }) => {
                    const active = section === id
                    return (
                        <button
                            key={id}
                            onClick={() => setSection(id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '9px 18px',
                                background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                                borderLeft: `2px solid ${active ? 'var(--k-accent-blue)' : 'transparent'}`,
                                color: active ? 'var(--k-text-primary)' : 'var(--k-text-dim)',
                                cursor: 'pointer',
                                transition: 'all 0.12s',
                                width: '100%', textAlign: 'left',
                            }}
                            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = active ? 'rgba(255,255,255,0.06)' : 'transparent' }}
                        >
                            <span style={{ display: 'flex', opacity: active ? 1 : 0.6 }}>{icon}</span>
                            <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{label}</span>
                            {active && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />}
                        </button>
                    )
                })}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
                <div style={{ maxWidth: 600 }}>
                    {CONTENT[section]}
                </div>
            </div>

        </div>
    )
}
