import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAppStore } from './store/app.store'
import { useGraphStore } from './store/graph.store'
import { Sidebar } from './components/Sidebar'
import { FileExplorer } from './components/FileExplorer'
import { MarkdownEditor } from './components/MarkdownEditor'
import { CommandPalette } from './components/CommandPalette'
import { TerminalPanel } from './components/TerminalPanel'
import { applyLiveRuntimeEvent } from './live/runtime-event-handler'
import { runForceLayout } from './universe/layout/force-layout'
import { NormalizedRuntimeEvent } from '../../shared/types'
import { DEMO_NODES, DEMO_EDGES, DEMO_WORKSPACE_ID } from './universe/layout/demo-graph'

// Placeholder imports for screens
import { WorkspacePicker } from './screens/WorkspacePicker/WorkspacePicker'
import { UniverseMap } from './screens/UniverseMap/UniverseMap'
import { RunsScreen } from './screens/Runs/RunsScreen'
import { HealthScreen } from './screens/Health/HealthScreen'
import { FlowScreen } from './screens/FlowScreen/FlowScreen'
import { SettingsScreen } from './screens/Settings/SettingsScreen'
import { DashboardScreen } from './screens/Dashboard/DashboardScreen'

export default function App() {
    const {
        activeWorkspace,
        setIntegrationStatus,
        fileExplorerOpen,
        openFilePath,
        scanVersion,
        flashNodes,
        setLiveActivityTs,
        markFileTouched,
        terminalOpen,
        terminalPosition,
        pushLiveActivity,
    } = useAppStore()
    const {
        setGraph,
        setLayoutNodes,
        upsertRuntimeNode,
        incrementEdgeWeight,
        nodes: graphNodes,
        touchLiveVisibleNodes,
        pruneLiveVisibleNodes,
    } = useGraphStore()

    // Listen for integration events and live status updates
    useEffect(() => {
        window.api.getIntegrationStatus().then(setIntegrationStatus)
        const cleanupIngest = window.api.onIngestEvent((ev: NormalizedRuntimeEvent) => {
            const wsId = activeWorkspace?.id
            const wsPath = activeWorkspace?.path
            if (!wsId || ev.workspaceId !== wsId) return
            applyLiveRuntimeEvent({
                workspaceId: wsId,
                workspacePath: wsPath,
                graphNodes,
                flashNodes,
                markFileTouched,
                upsertRuntimeNode,
                incrementEdgeWeight,
                touchLiveVisibleNodes,
                pushLiveActivity,
                setLiveActivityTs,
            }, ev)
        })
        const cleanupStatus = window.api.onIntegrationStatus(setIntegrationStatus)
        return () => { cleanupIngest(); cleanupStatus() }
    }, [
        setIntegrationStatus,
        activeWorkspace,
        flashNodes,
        setLiveActivityTs,
        markFileTouched,
        upsertRuntimeNode,
        incrementEdgeWeight,
        graphNodes,
        pushLiveActivity,
        touchLiveVisibleNodes,
    ])

    useEffect(() => {
        const timer = setInterval(() => pruneLiveVisibleNodes(), 2000)
        return () => clearInterval(timer)
    }, [pruneLiveVisibleNodes])

    // Auto-connect integrations when workspace opens (skip for demo)
    useEffect(() => {
        if (activeWorkspace && activeWorkspace.id !== DEMO_WORKSPACE_ID) {
            window.api.autoConnectIntegrations(activeWorkspace.path).then(setIntegrationStatus)
            window.api.startIngestServer()
        }
    }, [activeWorkspace, setIntegrationStatus])

    // Load graph when workspace changes OR when scanVersion increments (rescan)
    useEffect(() => {
        if (!activeWorkspace) return

        const loadGraph = (nodes: typeof DEMO_NODES, edges: typeof DEMO_EDGES) => {
            setGraph(nodes, edges)
            if (nodes.length > 0) {
                runForceLayout(nodes, edges, (layoutNodes) => {
                    const dict: Record<string, unknown> = {}
                    for (const ln of layoutNodes) dict[ln.id] = ln
                    setLayoutNodes(dict as any)
                })
            }
        }

        if (activeWorkspace.id === DEMO_WORKSPACE_ID) {
            // Demo mode — no IPC needed
            loadGraph(DEMO_NODES, DEMO_EDGES)
        } else {
            Promise.all([
                window.api.getNodes(activeWorkspace.id),
                window.api.getEdges(activeWorkspace.id)
            ]).then(([nodes, edges]) => loadGraph(nodes, edges))
        }
    }, [activeWorkspace, scanVersion, setGraph, setLayoutNodes])

    return (
        <HashRouter>
            <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="titlebar-drag-region" />

                {/* Main content row — sidebar + explorer + content + optional right terminal */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {activeWorkspace && <Sidebar />}
                {activeWorkspace && fileExplorerOpen && <FileExplorer />}

                {/* Centre column: stacks main content + optional bottom terminal */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                        <Routes>
                            <Route path="/" element={
                                activeWorkspace ? <Navigate to="/dashboard" replace /> : <WorkspacePicker />
                            } />
                            <Route path="/dashboard" element={
                                activeWorkspace ? <DashboardScreen /> : <Navigate to="/" replace />
                            } />
                            <Route path="/universe" element={
                                activeWorkspace ? <UniverseMap /> : <Navigate to="/" replace />
                            } />
                            <Route path="/runs" element={
                                activeWorkspace ? <RunsScreen /> : <Navigate to="/" replace />
                            } />
                            <Route path="/health" element={
                                activeWorkspace ? <HealthScreen /> : <Navigate to="/" replace />
                            } />
                            <Route path="/flow" element={
                                activeWorkspace ? <FlowScreen /> : <Navigate to="/" replace />
                            } />
                            <Route path="/settings" element={
                                activeWorkspace ? <SettingsScreen /> : <Navigate to="/" replace />
                            } />
                        </Routes>
                    </main>

                    {/* Bottom terminal */}
                    {activeWorkspace && terminalOpen && terminalPosition === 'bottom' && <TerminalPanel />}
                </div>

                {/* Editor panel */}
                {activeWorkspace && openFilePath && <MarkdownEditor />}

                {/* Right-side terminal */}
                {activeWorkspace && terminalOpen && terminalPosition === 'right' && <TerminalPanel />}
                </div>
                <CommandPalette />
            </div>
        </HashRouter>
    )
}
