import { useEffect } from 'react'
import { Eye, Compass, Activity, FileEdit } from 'lucide-react'
import { useAppStore } from '../store/app.store'
import { useGraphStore } from '../store/graph.store'

function resolvePath(workspacePath: string, nodePath: string): string {
    if (nodePath.startsWith('/')) return nodePath
    return workspacePath.replace(/\/$/, '') + '/' + nodePath
}

function shortPath(p: string) {
    const parts = p.replace(/\\/g, '/').split('/')
    return parts.slice(-2).join('/')
}

export function NodeContextMenu() {
    const contextMenu      = useAppStore(s => s.contextMenu)
    const setContextMenu   = useAppStore(s => s.setContextMenu)
    const setSelectedNodeId = useAppStore(s => s.setSelectedNodeId)
    const setFlyToTarget   = useAppStore(s => s.setFlyToTarget)
    const activeWorkspace  = useAppStore(s => s.activeWorkspace)
    const setOpenFilePath  = useAppStore(s => s.setOpenFilePath)
    const layoutNodes      = useGraphStore(s => s.layoutNodes)
    const nodes            = useGraphStore(s => s.nodes)

    // Close on any click outside
    useEffect(() => {
        if (!contextMenu) return
        const handleClose = () => setContextMenu(null)
        window.addEventListener('click', handleClose)
        window.addEventListener('contextmenu', handleClose)
        return () => {
            window.removeEventListener('click', handleClose)
            window.removeEventListener('contextmenu', handleClose)
        }
    }, [contextMenu, setContextMenu])

    if (!contextMenu) return null

    const node = nodes.find(n => n.id === contextMenu.nodeId)
    if (!node) return null

    const lNode = layoutNodes[contextMenu.nodeId]

    const actions = [
        {
            label: 'Focus on Node',
            icon: <Compass size={14} />,
            accent: undefined,
            onClick: () => {
                setSelectedNodeId(contextMenu.nodeId)
                if (lNode) setFlyToTarget({ x: lNode.x, y: lNode.y, z: lNode.z })
                setContextMenu(null)
            }
        },
        {
            label: 'Show Connections',
            icon: <Eye size={14} />,
            accent: undefined,
            onClick: () => {
                setSelectedNodeId(contextMenu.nodeId)
                setContextMenu(null)
            }
        },
        {
            label: 'View AI Sessions',
            icon: <Activity size={14} />,
            accent: undefined,
            onClick: () => {
                setContextMenu(null)
            }
        },
    ]

    // Per-file "Open" actions
    const fileActions = node.paths.map(relPath => {
        const fullPath = activeWorkspace ? resolvePath(activeWorkspace.path, relPath) : relPath
        return {
            label: shortPath(relPath),
            icon: <FileEdit size={14} />,
            accent: '#60a5fa',
            onClick: () => {
                setOpenFilePath(fullPath)
                setContextMenu(null)
            }
        }
    })

    return (
        <div
            style={{
                position: 'fixed',
                left: contextMenu.screenX,
                top: contextMenu.screenY,
                zIndex: 200,
                background: 'rgba(15, 15, 20, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: 4,
                minWidth: 200,
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Node name header */}
            <div style={{
                padding: '6px 12px 6px',
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.5)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            }}>
                {node.name}
            </div>

            {actions.map((action, i) => (
                <MenuButton key={i} action={action} />
            ))}

            {/* Source files section */}
            {fileActions.length > 0 && (
                <>
                    <div style={{
                        padding: '6px 12px 4px',
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'rgba(255, 255, 255, 0.3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginTop: 4,
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    }}>
                        Source Files
                    </div>
                    {fileActions.map((action, i) => (
                        <MenuButton key={`file-${i}`} action={action} />
                    ))}
                </>
            )}
        </div>
    )
}

interface ActionItem {
    label: string
    icon: React.ReactNode
    accent?: string
    onClick: () => void
}

function MenuButton({ action }: { action: ActionItem }) {
    return (
        <button
            onClick={action.onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '7px 12px',
                background: 'transparent',
                color: action.accent || 'var(--k-text-primary)',
                fontSize: 13,
                borderRadius: 4,
                cursor: 'pointer',
                border: 'none',
                textAlign: 'left',
                transition: 'background 0.1s',
                overflow: 'hidden',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
            <span style={{ color: action.accent || 'rgba(255, 255, 255, 0.5)', display: 'flex', flexShrink: 0 }}>
                {action.icon}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {action.label}
            </span>
        </button>
    )
}
