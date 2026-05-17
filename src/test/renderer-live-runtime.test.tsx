// @vitest-environment jsdom

import { applyLiveRuntimeEvent } from '../renderer/src/live/runtime-event-handler'
import { getFileEntryDecorations } from '../renderer/src/components/file-explorer.decorations'
import { useAppStore } from '../renderer/src/store/app.store'
import { useGraphStore } from '../renderer/src/store/graph.store'
import { generateFileNodeId, generateNodeId } from '../shared/ids'
import type { NormalizedRuntimeEvent } from '../shared/types'

describe('renderer live runtime acceptance', () => {
    beforeEach(() => {
        useAppStore.setState({
            activeWorkspace: { id: 'ws_ui', name: 'repo', path: '/repo', openedAt: Date.now() },
            integrationStatus: {
                ingestServer: { running: true, port: 41414 },
                claudeCode: { connected: true },
                openClaw: { connected: false },
            },
            nodeFlashTimestamps: {},
            liveActivityTs: 0,
            recentlyTouchedFiles: {},
            liveActivity: [],
        })
        useGraphStore.setState({
            nodes: [],
            edges: [],
            layoutNodes: {},
            liveVisibleNodesUntil: {},
            filterTypes: new Set(['agent', 'tool', 'model', 'memory_store', 'prompt', 'api', 'module']),
            searchQuery: '',
            showEdges: true,
            showEdgeLabels: true,
            pinnedNodes: new Set<string>(),
        })
    })

    it('updates graph state, touched files, live visibility, and explorer decorations for a live file write', () => {
        const event: NormalizedRuntimeEvent = {
            id: 'runtime-event-1',
            workspaceId: 'ws_ui',
            source: 'claude_code',
            sessionId: 'session-1',
            traceId: 'claude_code::session-1',
            threadId: 'thread-1',
            spanId: 'span-1',
            parentSpanId: 'span-root',
            operation: 'file_write',
            status: 'end',
            legacyEventType: 'tool_call',
            tsMs: Date.parse('2026-04-06T10:00:00.000Z'),
            phase: 'end',
            agentName: 'Claude Code',
            toolName: 'write_file',
            filePath: 'src/index.ts',
            fileName: 'index.ts',
            fileInteraction: 'writes',
            title: 'write_file',
            summary: 'Updated src/index.ts',
            nodeIds: [
                generateNodeId('ws_ui', 'agent', 'Claude Code'),
                generateNodeId('ws_ui', 'tool', 'write_file'),
                generateFileNodeId('ws_ui', 'src/index.ts', 'index.ts'),
            ],
            output: { ok: true },
        }

        const appState = useAppStore.getState()
        const graphState = useGraphStore.getState()

        applyLiveRuntimeEvent({
            workspaceId: 'ws_ui',
            workspacePath: '/repo',
            graphNodes: graphState.nodes,
            flashNodes: appState.flashNodes,
            markFileTouched: appState.markFileTouched,
            upsertRuntimeNode: graphState.upsertRuntimeNode,
            incrementEdgeWeight: graphState.incrementEdgeWeight,
            touchLiveVisibleNodes: graphState.touchLiveVisibleNodes,
            pushLiveActivity: appState.pushLiveActivity,
            setLiveActivityTs: appState.setLiveActivityTs,
        }, event)

        const nextAppState = useAppStore.getState()
        const nextGraphState = useGraphStore.getState()
        const fileNodeId = generateFileNodeId('ws_ui', 'src/index.ts', 'index.ts')

        expect(nextGraphState.nodes.some(node => node.id === fileNodeId && node.type === 'file')).toBe(true)
        expect(nextGraphState.edges.some(edge => edge.type === 'writes' && edge.toId === fileNodeId)).toBe(true)
        expect((nextGraphState.liveVisibleNodesUntil[fileNodeId] ?? 0)).toBeGreaterThan(Date.now())
        expect(nextAppState.recentlyTouchedFiles['src/index.ts']).toBeTruthy()
        expect(nextAppState.liveActivity[0]?.filePath).toBe('src/index.ts')
        expect(nextAppState.nodeFlashTimestamps[fileNodeId]).toBeTruthy()

        const nodePathColorMap = new Map<string, string>([['src/index.ts', '#ffffff']])
        const decorations = getFileEntryDecorations({
            entryPath: '/repo/src/index.ts',
            rootPath: '/repo',
            nodePathColorMap,
            recentlyTouchedFiles: nextAppState.recentlyTouchedFiles,
            now: Date.now(),
        })

        expect(decorations.nodeTypeDot).toBe('#ffffff')
        expect(decorations.recentlyTouched).toBe(true)
        expect(nextGraphState.filterTypes.has('file')).toBe(false)
    })
})
