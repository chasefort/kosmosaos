import { NavLink } from 'react-router-dom'
import { Box, Activity, HeartPulse, Settings, FolderOpen, GitFork, Terminal, LayoutDashboard } from 'lucide-react'
import { useAppStore } from '../store/app.store'
import { useEffect, useState } from 'react'

export function Sidebar() {
    const { fileExplorerOpen, setFileExplorerOpen, terminalOpen, toggleTerminal, integrationStatus } = useAppStore()
    const [now, setNow] = useState(Date.now())

    // Tick every 10s so staleness indicators stay current
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 10_000)
        return () => clearInterval(t)
    }, [])

    const ccConnected = integrationStatus.claudeCode.connected
    const ocConnected = integrationStatus.openClaw.connected

    const lastEvent = integrationStatus.claudeCode.lastEvent ?? integrationStatus.openClaw.lastEvent
    const secondsAgo = lastEvent ? Math.round((now - lastEvent) / 1000) : null
    const lastStr = secondsAgo != null
        ? secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.floor(secondsAgo / 60)}m ago`
        : 'idle'

    // Staleness: connected but no events for >60s → amber
    const ccStale = ccConnected && integrationStatus.claudeCode.lastEvent != null
        && (now - integrationStatus.claudeCode.lastEvent) > 60_000
    const ocStale = ocConnected && integrationStatus.openClaw.lastEvent != null
        && (now - integrationStatus.openClaw.lastEvent) > 60_000

    return (
        <div style={{
            width: 52,
            background: 'var(--k-bg-panel)',
            borderRight: '1px solid var(--k-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px 0 20px',
            zIndex: 100,
            flexShrink: 0
        }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Files toggle */}
                <button
                    title="File Explorer (⌘E)"
                    onClick={() => setFileExplorerOpen(!fileExplorerOpen)}
                    style={{
                        color: fileExplorerOpen ? 'var(--k-text-primary)' : 'var(--k-text-dim)',
                        padding: 10,
                        borderRadius: 8,
                        background: fileExplorerOpen ? 'var(--k-border-subtle)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s ease',
                        marginBottom: 8
                    }}
                >
                    <FolderOpen size={19} />
                </button>

                <NavItem to="/dashboard" icon={<LayoutDashboard size={19} />} title="Trust Overview (⌘0)" />
                <NavItem to="/universe"  icon={<Box size={19} />}         title="Context Map (⌘1)" />
                <NavItem to="/flow"      icon={<GitFork size={19} />}     title="Flow Chart (⌘4)" />
                <NavItem to="/runs"      icon={<Activity size={19} />}    title="AI Sessions / Replay (⌘2)" />
                <NavItem to="/health"    icon={<HeartPulse size={19} />}  title="Context Audit (⌘3)" />

                {/* Terminal toggle */}
                <button
                    title="Terminal (⌘`)"
                    onClick={toggleTerminal}
                    style={{
                        color: terminalOpen ? 'var(--k-text-primary)' : 'var(--k-text-dim)',
                        padding: 10,
                        borderRadius: 8,
                        background: terminalOpen ? 'var(--k-border-subtle)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s ease',
                        marginTop: 4
                    }}
                >
                    <Terminal size={19} />
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {/* Runtime status indicators */}
                {(ccConnected || ocConnected) && (
                    <div
                        title={[
                            ccConnected ? `Claude Code: connected${lastStr !== 'idle' ? `, last event ${lastStr}` : ', idle'}` : '',
                            ocConnected ? `OpenClaw: connected${integrationStatus.openClaw.url ? ` (${integrationStatus.openClaw.url})` : ''}` : '',
                        ].filter(Boolean).join('\n')}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
                    >
                        {ccConnected && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: ccStale ? '#f59e0b' : '#34d399',
                                    boxShadow: ccStale ? '0 0 5px #f59e0b' : '0 0 5px #34d399'
                                }} />
                                <span style={{ fontSize: 8, fontWeight: 700, color: ccStale ? '#f59e0b' : '#34d399', letterSpacing: 0.3 }}>CC</span>
                            </div>
                        )}
                        {ocConnected && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: ocStale ? '#f59e0b' : '#a78bfa',
                                    boxShadow: ocStale ? '0 0 5px #f59e0b' : '0 0 5px #a78bfa'
                                }} />
                                <span style={{ fontSize: 8, fontWeight: 700, color: ocStale ? '#f59e0b' : '#a78bfa', letterSpacing: 0.3 }}>OC</span>
                            </div>
                        )}
                        {lastStr !== 'idle' && (
                            <span style={{ fontSize: 7, color: 'var(--k-text-dim)', textAlign: 'center' }}>{lastStr}</span>
                        )}
                    </div>
                )}
                <NavItem to="/settings" icon={<Settings size={19} />} title="Settings" />
            </div>
        </div>
    )
}

function NavItem({ to, icon, title }: { to: string; icon: React.ReactNode; title: string }) {
    return (
        <NavLink
            to={to}
            title={title}
            style={({ isActive }) => ({
                color: isActive ? 'var(--k-text-primary)' : 'var(--k-text-dim)',
                padding: 10,
                borderRadius: 8,
                background: isActive ? 'var(--k-border-subtle)' : 'transparent',
                transition: 'all 0.15s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            })}
        >
            {icon}
        </NavLink>
    )
}
