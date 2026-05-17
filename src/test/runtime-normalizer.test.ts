import claudeToolSession from './fixtures/runtime/claude-tool-session.json'
import openclawSession from './fixtures/runtime/openclaw-session.json'
import genericFileWrite from './fixtures/runtime/generic-file-write.json'
import { normalizeRuntimePayload, resetRuntimeNormalizerState } from '../main/ipc/runtime-normalizer'
import { generateFileNodeId } from '../shared/ids'

describe('runtime-normalizer', () => {
    const context = {
        workspaceId: 'ws_test',
        workspacePath: '/repo',
    }

    beforeEach(() => {
        resetRuntimeNormalizerState()
        vi.useRealTimers()
    })

    it('maps Claude Code tool start/result/session end onto one stable tool span without premature finalization', () => {
        const normalized = claudeToolSession.flatMap(payload => normalizeRuntimePayload(payload as Record<string, unknown>, context))

        expect(normalized).toHaveLength(3)

        const toolStart = normalized[0]
        const toolEnd = normalized[1]
        const sessionEnd = normalized[2]

        expect(toolStart.operation).toBe('tool')
        expect(toolStart.status).toBe('start')
        expect(toolStart.legacyEventType).toBe('tool_call')
        expect(toolStart.filePath).toBe('src/index.ts')
        expect(toolStart.fileInteraction).toBe('writes')

        expect(toolEnd.operation).toBe('tool')
        expect(toolEnd.status).toBe('end')
        expect(toolEnd.spanId).toBe(toolStart.spanId)
        expect(toolEnd.parentSpanId).toBe(toolStart.parentSpanId)
        expect(toolEnd.legacyEventType).toBe('tool_call')

        expect(sessionEnd.operation).toBe('agent')
        expect(sessionEnd.status).toBe('end')
        expect(sessionEnd.legacyEventType).toBe('session_end')
        expect(sessionEnd.parentSpanId).toBeUndefined()
        expect(sessionEnd.traceId).toBe('claude_code::session-claude-1')
    })

    it('maps OpenClaw subagent activity separately from terminal agent_end', () => {
        const normalized = openclawSession.flatMap(payload => normalizeRuntimePayload(payload as Record<string, unknown>, context))

        expect(normalized).toHaveLength(4)

        const [toolStart, subagent, toolEnd, agentEnd] = normalized

        expect(toolStart.operation).toBe('tool')
        expect(toolStart.status).toBe('start')
        expect(toolEnd.operation).toBe('tool')
        expect(toolEnd.status).toBe('end')
        expect(toolEnd.spanId).toBe(toolStart.spanId)

        expect(subagent.operation).toBe('agent')
        expect(subagent.legacyEventType).toBe('agent_activity')
        expect(subagent.parentSpanId).toBeTruthy()
        expect(subagent.status).toBe('update')

        expect(agentEnd.operation).toBe('agent')
        expect(agentEnd.legacyEventType).toBe('session_end')
        expect(agentEnd.parentSpanId).toBeUndefined()
        expect(agentEnd.status).toBe('end')
    })

    it('creates canonical path-based file node ids for generic file writes', () => {
        const [normalized] = normalizeRuntimePayload(genericFileWrite as Record<string, unknown>, context)
        const expectedFileNodeId = generateFileNodeId(context.workspaceId, 'src/index.ts', 'index.ts')

        expect(normalized.operation).toBe('file_write')
        expect(normalized.filePath).toBe('src/index.ts')
        expect(normalized.nodeIds).toContain(expectedFileNodeId)
    })

    it('never uses duration_ms as the event timestamp fallback', () => {
        vi.useFakeTimers()
        const now = new Date('2026-04-06T15:00:00.000Z')
        vi.setSystemTime(now)

        const [normalized] = normalizeRuntimePayload({
            source: 'generic',
            sessionId: 'generic-duration',
            toolName: 'write_file',
            duration_ms: 42,
            input: { path: 'src/index.ts', content: 'x' },
        }, context)

        expect(normalized.tsMs).toBe(now.getTime())
        expect(normalized.tsMs).not.toBe(42)
    })
})
