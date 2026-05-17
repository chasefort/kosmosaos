import { clearLiveRuntimeState, flushLivePersistence, persistLiveEvent, persistNormalizedEvents } from '../main/ipc/live-persist'
import { resetRuntimeNormalizerState } from '../main/ipc/runtime-normalizer'
import { createTestDatabase } from './helpers/test-db'

describe('live persistence', () => {
    beforeEach(() => {
        clearLiveRuntimeState()
        resetRuntimeNormalizerState()
    })

    it('keeps runs and traces running until a terminal event arrives', () => {
        const handle = createTestDatabase()
        const { db } = handle
        db.prepare('INSERT INTO workspaces (id, name, path, opened_at) VALUES (?, ?, ?, ?)').run('ws_live', 'repo', '/repo', Date.now())

        const context = { workspaceId: 'ws_live', workspacePath: '/repo' }

        persistLiveEvent(db, context, {
            source: 'openclaw',
            sessionId: 'persist-openclaw-1',
            type: 'before_tool_call',
            timestamp: '2026-04-06T11:00:00.000Z',
            agentName: 'OpenClaw',
            toolName: 'write_file',
            callId: 'call-1',
            input: { path: 'src/index.ts', content: 'alpha' },
        })
        persistLiveEvent(db, context, {
            source: 'openclaw',
            sessionId: 'persist-openclaw-1',
            type: 'after_tool_call',
            timestamp: '2026-04-06T11:00:01.000Z',
            agentName: 'OpenClaw',
            toolName: 'write_file',
            callId: 'call-1',
            output: { ok: true },
        })
        flushLivePersistence()

        let run = db.prepare('SELECT status, ended_at FROM runs WHERE id = ?').get('openclaw::persist-openclaw-1') as { status: string; ended_at: number | null }
        let trace = db.prepare('SELECT status, ended_at FROM traces WHERE id = ?').get('openclaw::persist-openclaw-1') as { status: string; ended_at: number | null }

        expect(run.status).toBe('running')
        expect(run.ended_at).toBeNull()
        expect(trace.status).toBe('running')
        expect(trace.ended_at).toBeNull()

        persistLiveEvent(db, context, {
            source: 'openclaw',
            sessionId: 'persist-openclaw-1',
            type: 'agent_end',
            timestamp: '2026-04-06T11:00:02.000Z',
            agentName: 'OpenClaw',
        })
        flushLivePersistence()

        run = db.prepare('SELECT status, ended_at, meta FROM runs WHERE id = ?').get('openclaw::persist-openclaw-1') as { status: string; ended_at: number | null; meta: string }
        trace = db.prepare('SELECT status, ended_at, meta FROM traces WHERE id = ?').get('openclaw::persist-openclaw-1') as { status: string; ended_at: number | null; meta: string }
        const thread = db.prepare('SELECT ended_at, meta FROM threads WHERE workspace_id = ? AND source = ?').get('ws_live', 'openclaw') as { ended_at: number | null; meta: string } | undefined

        expect(run.status).toBe('completed')
        expect(run.ended_at).not.toBeNull()
        expect(trace.status).toBe('completed')
        expect(trace.ended_at).not.toBeNull()
        expect(JSON.parse(trace.meta).summary).toContain('completed')
        expect(thread?.ended_at).not.toBeNull()
        expect(JSON.parse(thread?.meta ?? '{}').summary).toContain('completed')

        handle.dispose()
    })

    it('is idempotent when the same normalized batch is replayed', () => {
        const handle = createTestDatabase()
        const { db } = handle
        db.prepare('INSERT INTO workspaces (id, name, path, opened_at) VALUES (?, ?, ?, ?)').run('ws_live', 'repo', '/repo', Date.now())

        const batch = [{
            id: 'event-1',
            workspaceId: 'ws_live',
            source: 'generic',
            sessionId: 'generic-1',
            traceId: 'generic::generic-1',
            threadId: 'thread-generic-1',
            spanId: 'span-generic-1',
            operation: 'file_write',
            status: 'end',
            legacyEventType: 'tool_call',
            tsMs: Date.parse('2026-04-06T12:00:00.000Z'),
            toolName: 'write_file',
            agentName: 'SDK Agent',
            filePath: 'src/index.ts',
            fileName: 'index.ts',
            fileInteraction: 'writes',
            title: 'Write file',
            summary: 'Write file',
            nodeIds: ['n1'],
            output: { ok: true },
        }] as any

        persistNormalizedEvents(db, batch)
        persistNormalizedEvents(db, batch)
        flushLivePersistence()

        const eventCount = (db.prepare('SELECT COUNT(*) AS count FROM events WHERE run_id = ?').get('generic::generic-1') as { count: number }).count
        const spanCount = (db.prepare('SELECT COUNT(*) AS count FROM spans WHERE trace_id = ?').get('generic::generic-1') as { count: number }).count

        expect(eventCount).toBe(1)
        expect(spanCount).toBe(1)

        handle.dispose()
    })
})
