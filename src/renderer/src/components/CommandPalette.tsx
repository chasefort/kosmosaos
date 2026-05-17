import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Map, Activity, MonitorPlay } from 'lucide-react'
import { useAppStore } from '../store/app.store'
import { useGraphStore } from '../store/graph.store'
import { KosmosNode } from '../../shared/types'

export function CommandPalette() {
    const { commandPaletteOpen, setCommandPaletteOpen, activeWorkspace, setSelectedNodeId } = useAppStore()
    const nodes = useGraphStore(s => s.nodes)
    const navigate = useNavigate()

    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    // Toggle shortcut
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setCommandPaletteOpen(!useAppStore.getState().commandPaletteOpen)
            }
            if (e.key === 'Escape' && useAppStore.getState().commandPaletteOpen) {
                setCommandPaletteOpen(false)
            }
        }
        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [setCommandPaletteOpen])

    useEffect(() => {
        if (commandPaletteOpen) {
            setTimeout(() => inputRef.current?.focus(), 50)
            setQuery('')
            setSelectedIndex(0)
        }
    }, [commandPaletteOpen])

    if (!commandPaletteOpen) return null

    // Mix of static actions and dynamic nodes
    const actions = [
        { id: 'nav-map', name: 'Go to Context Map', icon: <Map size={16} />, onSelect: () => navigate('/universe') },
        { id: 'nav-runs', name: 'Go to AI Sessions', icon: <Activity size={16} />, onSelect: () => navigate('/runs') },
    ]

    const q = query.toLowerCase()
    const filteredActions = q ? actions.filter(a => a.name.toLowerCase().includes(q)) : actions

    // Quick client-side filter instead of relying on the reactive getVisibleNodes
    const filteredNodes = q ? nodes.filter(n => n.name.toLowerCase().includes(q)).slice(0, 10) : nodes.slice(0, 5)

    const allItems = [
        ...filteredActions.map(a => ({ ...a, type: 'action' })),
        ...(activeWorkspace ? filteredNodes.map(n => ({
            id: n.id,
            name: n.name,
            icon: <MonitorPlay size={16} />, // Simplified icon for all nodes here
            node: n,
            type: 'node',
            onSelect: () => {
                setSelectedNodeId(n.id)
                navigate('/universe')
            }
        })) : [])
    ]

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(s => (s + 1) % allItems.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(s => (s - 1 + allItems.length) % allItems.length)
        } else if (e.key === 'Enter') {
            e.preventDefault()
            const item = allItems[selectedIndex]
            if (item) {
                item.onSelect()
                setCommandPaletteOpen(false)
            }
        }
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: '15vh',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'var(--k-blur-panel)'
        }} onClick={() => setCommandPaletteOpen(false)}>
            <div
                style={{
                    width: 600, maxWidth: '90%',
                    background: 'var(--k-bg-base)',
                    border: '1px solid var(--k-border-subtle)',
                    borderRadius: 4,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    display: 'flex', flexDirection: 'column'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--k-border-subtle)' }}>
                    <Search size={20} color="var(--k-text-dim)" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                        onKeyDown={handleKeyDown}
                        placeholder="Search nodes, run actions..."
                        style={{
                            flex: 1, background: 'transparent', border: 'none',
                            color: 'var(--k-text-primary)', fontSize: 18,
                            outline: 'none', padding: '0 16px'
                        }}
                    />
                </div>

                <div style={{ maxHeight: 400, overflowY: 'auto', padding: 8 }}>
                    {allItems.length === 0 && (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--k-text-dim)' }}>No results found</div>
                    )}
                    {allItems.map((item, i) => (
                        <div
                            key={item.id}
                            onClick={() => { item.onSelect(); setCommandPaletteOpen(false) }}
                            onMouseOver={() => setSelectedIndex(i)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 16px',
                                borderRadius: 2,
                                cursor: 'pointer',
                                background: selectedIndex === i ? 'rgba(255,255,255,0.08)' : 'transparent',
                                color: selectedIndex === i ? 'var(--k-text-primary)' : 'var(--k-text-secondary)',
                            }}
                        >
                            <div style={{ color: item.type === 'action' ? 'var(--k-accent-blue)' : 'var(--k-accent-purple)' }}>
                                {item.icon}
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 500 }}>{item.name}</span>
                                {item.type === 'node' && (
                                    <span style={{ fontSize: 12, color: 'var(--k-text-dim)', marginTop: 2 }}>
                                        {(item as any).node.type} • {(item as any).node.workspaceId}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
