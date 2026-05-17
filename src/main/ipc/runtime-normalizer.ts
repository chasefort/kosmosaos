import { basename, relative, resolve } from 'path'
import {
    generateFileNodeId,
    generateNodeId,
    generateSpanId,
    generateStableId,
    generateThreadId,
} from '../../shared/ids'
import {
    NormalizedRuntimeEvent,
    RuntimeAdapter,
    RuntimeEventStatus,
    RuntimeSource,
    RuntimeSpanOperation,
    UsageMetrics,
} from '../../shared/types'

interface RuntimeContext {
    workspaceId: string
    workspacePath?: string
}

interface OpenSpanState {
    source: RuntimeSource
    sessionId: string
    spanId: string
    spanStableKey: string
    parentSpanId?: string
    agentName?: string
    toolName?: string
    modelName?: string
    filePath?: string
    fileInteraction?: 'reads' | 'writes'
}

const openSpans = new Map<string, OpenSpanState>()
const sessionSpanOrder = new Map<string, string[]>()

function buildTraceId(source: RuntimeSource, sessionId: string): string {
    return `${source}::${sessionId}`
}

function buildThreadId(source: RuntimeSource, threadKey: string): string {
    return threadKey.includes('::')
        ? threadKey
        : generateThreadId(source, threadKey)
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function asNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function pickString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
    for (const key of keys) {
        const value = asString(record[key])
        if (value) return value
    }
    return undefined
}

function pickNumber(record: Record<string, unknown>, ...keys: string[]): number | undefined {
    for (const key of keys) {
        const value = asNumber(record[key])
        if (value !== undefined) return value
    }
    return undefined
}

function toPlainObject(value: unknown, fallbackKey = 'value'): Record<string, unknown> | undefined {
    const record = asRecord(value)
    if (record) return record
    if (typeof value === 'string') return { [fallbackKey]: value }
    if (Array.isArray(value)) return { [fallbackKey]: value }
    return undefined
}

function truncate(text: string, max = 240): string {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function toolResultText(content: unknown): string {
    if (typeof content === 'string') return truncate(content, 2000)
    if (!Array.isArray(content)) return ''
    return truncate(content
        .map(item => {
            const record = asRecord(item)
            return record ? (asString(record.text) ?? asString(record.content) ?? '') : ''
        })
        .filter(Boolean)
        .join('\n'), 2000)
}

function extractTimestampMs(raw: Record<string, unknown>): number {
    const direct = pickNumber(raw, 'tsMs', 'ts_ms', 'ts', 'timestamp_ms')
    if (direct !== undefined) return direct

    const timestamp = raw.timestamp
    if (typeof timestamp === 'number' && Number.isFinite(timestamp)) return timestamp
    if (typeof timestamp === 'string') {
        const parsed = Date.parse(timestamp)
        if (!Number.isNaN(parsed)) return parsed
    }

    const nestedMessage = asRecord(raw.message)
    if (nestedMessage) {
        const nested = nestedMessage.timestamp
        if (typeof nested === 'string') {
            const parsed = Date.parse(nested)
            if (!Number.isNaN(parsed)) return parsed
        }
    }

    return Date.now()
}

function normalizeFilePath(workspacePath: string | undefined, rawPath: string | undefined): {
    absolutePath?: string
    relativePath?: string
    fileName?: string
} {
    if (!rawPath) return {}

    const normalized = rawPath.replace(/\\/g, '/')
    const candidateAbsolute = normalized.startsWith('/')
        ? normalized
        : workspacePath
            ? resolve(workspacePath, normalized)
            : normalized

    if (workspacePath) {
        const root = resolve(workspacePath)
        const abs = resolve(candidateAbsolute)
        if (abs === root || abs.startsWith(`${root}/`)) {
            const rel = relative(root, abs).replace(/\\/g, '/')
            return {
                absolutePath: abs,
                relativePath: rel,
                fileName: basename(abs),
            }
        }
    }

    return {
        absolutePath: candidateAbsolute,
        relativePath: normalized,
        fileName: basename(normalized),
    }
}

function inferFileInteraction(toolName: string | undefined, rawType: string | undefined, input: Record<string, unknown> | undefined): 'reads' | 'writes' | undefined {
    const haystack = `${toolName ?? ''} ${rawType ?? ''}`.toLowerCase()

    if (/write|edit|patch|replace|append|save|create|persist/.test(haystack)) return 'writes'
    if (/read|open|view|search|grep|glob|list|find|cat/.test(haystack)) return 'reads'

    if (input) {
        if ('content' in input || 'text' in input || 'new_str' in input || 'old_str' in input) return 'writes'
    }

    return undefined
}

function buildNodeIds(args: {
    workspaceId: string
    agentName?: string
    toolName?: string
    modelName?: string
    filePath?: string
    fileName?: string
}): string[] {
    const ids = new Set<string>()

    if (args.agentName) ids.add(generateNodeId(args.workspaceId, 'agent', args.agentName))
    if (args.toolName) ids.add(generateNodeId(args.workspaceId, 'tool', args.toolName))
    if (args.modelName) ids.add(generateNodeId(args.workspaceId, 'model', args.modelName))
    if (args.filePath) ids.add(generateFileNodeId(args.workspaceId, args.filePath, args.fileName))

    return Array.from(ids)
}

function sessionKey(source: RuntimeSource, sessionId: string): string {
    return `${source}::${sessionId}`
}

function rememberOpenSpan(source: RuntimeSource, sessionId: string, externalKey: string, state: OpenSpanState): void {
    const key = `${sessionKey(source, sessionId)}::${externalKey}`
    openSpans.set(key, state)

    const orderKey = sessionKey(source, sessionId)
    const order = sessionSpanOrder.get(orderKey) ?? []
    order.push(key)
    sessionSpanOrder.set(orderKey, order.slice(-24))
}

function takeOpenSpan(source: RuntimeSource, sessionId: string, externalKey?: string): OpenSpanState | undefined {
    if (externalKey) {
        const key = `${sessionKey(source, sessionId)}::${externalKey}`
        const state = openSpans.get(key)
        if (state) {
            openSpans.delete(key)
            return state
        }
    }

    const orderKey = sessionKey(source, sessionId)
    const order = sessionSpanOrder.get(orderKey)
    if (!order || order.length === 0) return undefined

    while (order.length > 0) {
        const key = order.pop()
        if (!key) break
        const state = openSpans.get(key)
        if (state) {
            openSpans.delete(key)
            sessionSpanOrder.set(orderKey, order)
            return state
        }
    }

    sessionSpanOrder.set(orderKey, order)
    return undefined
}

function clearOpenSpanState(): void {
    openSpans.clear()
    sessionSpanOrder.clear()
}

function buildEvent(args: {
    context: RuntimeContext
    source: RuntimeSource
    sessionId: string
    threadKey: string
    operation: RuntimeSpanOperation
    status: RuntimeEventStatus
    legacyEventType: NormalizedRuntimeEvent['legacyEventType']
    tsMs: number
    title: string
    parentSpanId?: string
    spanStableKey: string
    phase?: NormalizedRuntimeEvent['phase']
    durationMs?: number
    agentName?: string
    toolName?: string
    modelName?: string
    filePath?: string
    fileInteraction?: 'reads' | 'writes'
    usage?: UsageMetrics
    costUsd?: number
    input?: Record<string, unknown>
    output?: Record<string, unknown>
    error?: string
    summary?: string
    meta?: Record<string, unknown>
}): NormalizedRuntimeEvent {
    const traceId = buildTraceId(args.source, args.sessionId)
    const threadId = buildThreadId(args.source, args.threadKey)
    const fileInfo = normalizeFilePath(args.context.workspacePath, args.filePath)
    const filePath = fileInfo.relativePath ?? fileInfo.absolutePath ?? args.filePath
    const fileName = fileInfo.fileName
    const spanId = generateSpanId(traceId, args.spanStableKey)
    const eventId = generateStableId(
        'runtime_event',
        args.source,
        args.sessionId,
        args.spanStableKey,
        args.status,
        args.tsMs,
        args.error,
    )

    return {
        id: eventId,
        workspaceId: args.context.workspaceId,
        source: args.source,
        sessionId: args.sessionId,
        traceId,
        threadId,
        spanId,
        parentSpanId: args.parentSpanId,
        operation: args.operation,
        status: args.status,
        legacyEventType: args.legacyEventType,
        tsMs: args.tsMs,
        durationMs: args.durationMs,
        phase: args.phase,
        agentName: args.agentName,
        toolName: args.toolName,
        modelName: args.modelName,
        filePath,
        fileName,
        fileInteraction: args.fileInteraction,
        title: args.title,
        summary: args.summary,
        usage: args.usage,
        costUsd: args.costUsd,
        input: args.input,
        output: args.output,
        error: args.error,
        nodeIds: buildNodeIds({
            workspaceId: args.context.workspaceId,
            agentName: args.agentName,
            toolName: args.toolName,
            modelName: args.modelName,
            filePath,
            fileName,
        }),
        meta: args.meta,
    }
}

function extractSessionId(raw: Record<string, unknown>): string {
    return pickString(
        raw,
        'session',
        'sessionId',
        'session_id',
        'runId',
        'run_id',
        'traceId',
        'trace_id',
        'conversationId',
        'conversation_id',
    ) ?? 'default'
}

function extractThreadKey(raw: Record<string, unknown>, sessionId: string): string {
    return pickString(raw, 'threadId', 'thread_id', 'conversationId', 'conversation_id') ?? sessionId
}

function extractAgentName(raw: Record<string, unknown>, fallback: string): string {
    return pickString(raw, 'agentName', 'agent_name', 'agentId', 'agent_id', 'agent') ?? fallback
}

function extractToolName(raw: Record<string, unknown>): string | undefined {
    const direct = pickString(raw, 'toolName', 'tool_name', 'tool')
    if (direct) return direct

    const toolInput = asRecord(raw.toolInput)
    if (toolInput) {
        const nested = pickString(toolInput, 'toolName', 'tool_name', 'tool')
        if (nested) return nested
    }

    const input = asRecord(raw.input)
    if (input) return pickString(input, 'toolName', 'tool_name', 'tool')

    return undefined
}

function extractModelName(raw: Record<string, unknown>): string | undefined {
    const direct = pickString(raw, 'modelName', 'model_name', 'model')
    if (direct) return direct

    const message = asRecord(raw.message)
    if (message) return pickString(message, 'model')

    return undefined
}

function extractFilePath(raw: Record<string, unknown>): string | undefined {
    const direct = pickString(raw, 'filePath', 'file_path', 'path')
    if (direct) return direct

    const toolInput = asRecord(raw.toolInput)
    if (toolInput) {
        const nested = pickString(toolInput, 'filePath', 'file_path', 'path')
        if (nested) return nested
    }

    const input = asRecord(raw.input)
    if (input) {
        const nested = pickString(input, 'filePath', 'file_path', 'path')
        if (nested) return nested
    }

    return undefined
}

function extractUsage(raw: Record<string, unknown>): { usage?: UsageMetrics; costUsd?: number } {
    const directUsage = asRecord(raw.usage)
    const message = asRecord(raw.message)
    const messageUsage = message ? asRecord(message.usage) : null
    const usageSource = directUsage ?? messageUsage

    const usage = usageSource
        ? {
            inputTokens: pickNumber(usageSource, 'input_tokens', 'inputTokens'),
            outputTokens: pickNumber(usageSource, 'output_tokens', 'outputTokens'),
            cacheReadTokens: pickNumber(usageSource, 'cache_read_input_tokens', 'cacheReadTokens'),
            cacheWriteTokens: pickNumber(usageSource, 'cache_creation_input_tokens', 'cacheWriteTokens'),
            totalTokens: pickNumber(usageSource, 'total_tokens', 'totalTokens'),
        }
        : undefined

    const totalTokens = usage
        ? (usage.totalTokens
            ?? ((usage.inputTokens ?? 0)
                + (usage.outputTokens ?? 0)
                + (usage.cacheReadTokens ?? 0)
                + (usage.cacheWriteTokens ?? 0)))
        : undefined

    return {
        usage: usage ? { ...usage, totalTokens } : undefined,
        costUsd: pickNumber(raw, 'costUsd', 'cost_usd', 'cost')
            ?? (usageSource ? pickNumber(usageSource, 'costUsd', 'cost_usd', 'cost') : undefined),
    }
}

function normalizeClaudeCode(rawEvent: Record<string, unknown>, context: RuntimeContext): NormalizedRuntimeEvent[] {
    const sessionId = extractSessionId(rawEvent)
    const threadKey = extractThreadKey(rawEvent, sessionId)
    const source: RuntimeSource = 'claude_code'
    const agentName = 'Claude Code'
    const rootAgentSpanId = generateSpanId(buildTraceId(source, sessionId), `agent:${agentName}`)
    const tsMs = extractTimestampMs(rawEvent)
    const rawType = pickString(rawEvent, 'type')
    const { usage, costUsd } = extractUsage(rawEvent)
    const message = asRecord(rawEvent.message)
    const content = message ? asArray(message.content) : []
    const events: NormalizedRuntimeEvent[] = []

    if (rawType === 'assistant' && content.length > 0) {
        for (const blockValue of content) {
            const block = asRecord(blockValue)
            if (!block) continue

            const blockType = pickString(block, 'type')
            if (blockType === 'tool_use') {
                const toolName = pickString(block, 'name') ?? extractToolName(rawEvent) ?? 'tool'
                const input = toPlainObject(block.input)
                const filePath = extractFilePath({ input: block.input })
                const fileInteraction = inferFileInteraction(toolName, rawType, input)
                const externalKey = pickString(block, 'id') ?? generateStableId('claude_tool_use', sessionId, toolName, tsMs, filePath)
                const spanStableKey = `tool:${externalKey}`
                const spanId = generateSpanId(buildTraceId(source, sessionId), spanStableKey)

                rememberOpenSpan(source, sessionId, externalKey, {
                    source,
                    sessionId,
                    spanId,
                    spanStableKey,
                    parentSpanId: rootAgentSpanId,
                    agentName,
                    toolName,
                    filePath,
                    fileInteraction,
                })

                events.push(buildEvent({
                    context,
                    source,
                    sessionId,
                    threadKey,
                    operation: 'tool',
                    status: 'start',
                    legacyEventType: 'tool_call',
                    phase: 'start',
                    tsMs,
                    title: toolName,
                    parentSpanId: rootAgentSpanId,
                    spanStableKey,
                    agentName,
                    toolName,
                    filePath,
                    fileInteraction,
                    input,
                    summary: filePath ? `${toolName} → ${filePath}` : toolName,
                    meta: { rawType, externalKey },
                }))
                continue
            }

            if (blockType === 'text') {
                const text = pickString(block, 'text')
                if (!text) continue
                const modelName = extractModelName(rawEvent)
                events.push(buildEvent({
                    context,
                    source,
                    sessionId,
                    threadKey,
                    operation: 'model',
                    status: 'end',
                    legacyEventType: 'assistant_response',
                    tsMs,
                    title: modelName ?? 'Assistant response',
                    parentSpanId: rootAgentSpanId,
                    spanStableKey: `assistant:${pickString(rawEvent, 'uuid') ?? tsMs}:${text.slice(0, 48)}`,
                    agentName,
                    modelName,
                    usage,
                    costUsd,
                    output: { text: truncate(text, 4000) },
                    summary: truncate(text, 96),
                    meta: { rawType },
                }))
            }
        }
    }

    if (rawType === 'assistant' && typeof message?.content === 'string' && message.content.trim()) {
        const modelName = extractModelName(rawEvent)
        const text = message.content
        events.push(buildEvent({
            context,
            source,
            sessionId,
            threadKey,
            operation: 'model',
            status: 'end',
            legacyEventType: 'assistant_response',
            tsMs,
            title: modelName ?? 'Assistant response',
            parentSpanId: rootAgentSpanId,
            spanStableKey: `assistant:${pickString(rawEvent, 'uuid') ?? tsMs}:${text.slice(0, 48)}`,
            agentName,
            modelName,
            usage,
            costUsd,
            output: { text: truncate(text, 4000) },
            summary: truncate(text, 96),
            meta: { rawType },
        }))
    }

    if (rawType === 'user' && typeof message?.content === 'string' && message.content.trim()) {
        const text = message.content
        events.push(buildEvent({
            context,
            source,
            sessionId,
            threadKey,
            operation: 'agent',
            status: 'update',
            legacyEventType: 'user_prompt',
            tsMs,
            title: 'User prompt',
            parentSpanId: rootAgentSpanId,
            spanStableKey: `user:${pickString(rawEvent, 'uuid') ?? tsMs}`,
            agentName,
            input: { text: truncate(text, 4000) },
            summary: truncate(text, 96),
            meta: { rawType },
        }))
    }

    if (rawType === 'user' && content.length > 0) {
        for (const blockValue of content) {
            const block = asRecord(blockValue)
            if (!block || pickString(block, 'type') !== 'tool_result') continue

            const toolUseId = pickString(block, 'tool_use_id')
            const state = takeOpenSpan(source, sessionId, toolUseId)
            const toolName = state?.toolName ?? 'tool'
            const filePath = state?.filePath
            const fileInteraction = state?.fileInteraction
            const outputText = toolResultText(block.content)
            const isError = rawEvent.isToolError === true || block.is_error === true

            events.push(buildEvent({
                context,
                source,
                sessionId,
                threadKey,
                operation: 'tool',
                status: isError ? 'error' : 'end',
                legacyEventType: 'tool_call',
                phase: isError ? 'error' : 'end',
                tsMs,
                durationMs: pickNumber(block, 'durationMs', 'duration_ms') ?? pickNumber(rawEvent, 'durationMs', 'duration_ms'),
                title: toolName,
                parentSpanId: state?.parentSpanId ?? rootAgentSpanId,
                spanStableKey: state
                    ? state.spanStableKey
                    : `tool:${toolUseId ?? generateStableId('claude_tool_result', sessionId, toolName, tsMs)}`,
                agentName,
                toolName,
                filePath,
                fileInteraction,
                output: outputText ? { result: outputText } : undefined,
                error: isError ? (outputText || 'Claude Code tool call failed') : undefined,
                summary: outputText ? truncate(outputText, 96) : `${toolName} completed`,
                meta: { rawType, toolUseId },
            }))
        }
    }

    if (rawType === 'session_end' || rawType === 'agent_end') {
        const summary = pickString(rawEvent, 'summary')
        return [buildEvent({
            context,
            source,
            sessionId,
            threadKey,
            operation: 'agent',
            status: pickString(rawEvent, 'error') ? 'error' : 'end',
            legacyEventType: 'session_end',
            phase: pickString(rawEvent, 'error') ? 'error' : 'end',
            tsMs,
            title: agentName,
            spanStableKey: `agent:${agentName}`,
            agentName,
            output: summary ? { summary } : undefined,
            error: pickString(rawEvent, 'error'),
            summary: summary ?? `${agentName} completed`,
            meta: {
                rawType,
                synthetic: rawType === 'session_end',
            },
        })]
    }

    if (events.length > 0) return events
    return []
}

function normalizeOpenClaw(rawEvent: Record<string, unknown>, context: RuntimeContext): NormalizedRuntimeEvent[] {
    const sessionId = extractSessionId(rawEvent)
    const threadKey = extractThreadKey(rawEvent, sessionId)
    const source: RuntimeSource = 'openclaw'
    const agentName = extractAgentName(rawEvent, 'OpenClaw')
    const rootAgentSpanId = generateSpanId(buildTraceId(source, sessionId), `agent:${agentName}`)
    const tsMs = extractTimestampMs(rawEvent)
    const rawType = pickString(rawEvent, 'type')
    const toolName = extractToolName(rawEvent)
    const modelName = extractModelName(rawEvent)
    const filePath = extractFilePath(rawEvent)
    const input = toPlainObject(rawEvent.input)
    const output = toPlainObject(rawEvent.output)
    const error = pickString(rawEvent, 'error', 'message')
    const callKey = pickString(rawEvent, 'callId', 'call_id', 'toolCallId', 'tool_call_id', 'tool_use_id')
    const { usage, costUsd } = extractUsage(rawEvent)

    if (rawType === 'before_tool_call') {
        const fileInteraction = inferFileInteraction(toolName, rawType, input)
        const externalKey = callKey ?? generateStableId('openclaw_tool_start', sessionId, toolName, tsMs, filePath)
        const spanStableKey = `tool:${externalKey}`
        const spanId = generateSpanId(buildTraceId(source, sessionId), spanStableKey)

        rememberOpenSpan(source, sessionId, externalKey, {
            source,
            sessionId,
            spanId,
            spanStableKey,
            parentSpanId: rootAgentSpanId,
            agentName,
            toolName,
            filePath,
            fileInteraction,
        })

        return [buildEvent({
            context,
            source,
            sessionId,
            threadKey,
            operation: 'tool',
            status: 'start',
            legacyEventType: 'tool_call',
            phase: 'start',
            tsMs,
            title: toolName ?? 'Tool call',
            parentSpanId: rootAgentSpanId,
            spanStableKey,
            agentName,
            toolName,
            filePath,
            fileInteraction,
            input,
            summary: filePath ? `${toolName ?? 'Tool'} → ${filePath}` : (toolName ?? 'Tool call'),
            meta: { rawType, externalKey },
        })]
    }

    if (rawType === 'after_tool_call') {
        const state = takeOpenSpan(source, sessionId, callKey)
        const resolvedToolName = state?.toolName ?? toolName ?? 'Tool call'
        const resolvedFilePath = state?.filePath ?? filePath
        const fileInteraction = state?.fileInteraction ?? inferFileInteraction(resolvedToolName, rawType, input)
        const isError = Boolean(error)

        return [buildEvent({
            context,
            source,
            sessionId,
            threadKey,
            operation: 'tool',
            status: isError ? 'error' : 'end',
            legacyEventType: 'tool_call',
            phase: isError ? 'error' : 'end',
            tsMs,
            durationMs: pickNumber(rawEvent, 'durationMs', 'duration_ms'),
            title: resolvedToolName,
            parentSpanId: state?.parentSpanId ?? rootAgentSpanId,
            spanStableKey: state
                ? state.spanStableKey
                : `tool:${callKey ?? generateStableId('openclaw_tool_end', sessionId, resolvedToolName, tsMs)}`,
            agentName,
            toolName: resolvedToolName,
            filePath: resolvedFilePath,
            fileInteraction,
            input,
            output,
            error,
            summary: error
                ? `${resolvedToolName} failed`
                : truncate(JSON.stringify(output ?? { ok: true }), 96),
            meta: { rawType, callKey },
        })]
    }

    if (rawType === 'llm_input') {
        return [buildEvent({
            context,
            source,
            sessionId,
            threadKey,
            operation: 'model',
            status: 'start',
            legacyEventType: 'model_call',
            phase: 'start',
            tsMs,
            title: modelName ?? 'Model request',
            parentSpanId: rootAgentSpanId,
            spanStableKey: `model:${callKey ?? generateStableId('openclaw_model_start', sessionId, modelName, tsMs)}`,
            agentName,
            modelName,
            usage,
            costUsd,
            input,
            summary: truncate(JSON.stringify(input ?? { model: modelName ?? 'unknown' }), 96),
            meta: { rawType },
        })]
    }

    if (rawType === 'llm_output') {
        return [buildEvent({
            context,
            source,
            sessionId,
            threadKey,
            operation: 'model',
            status: error ? 'error' : 'end',
            legacyEventType: output?.text ? 'assistant_response' : 'model_call',
            phase: error ? 'error' : 'end',
            tsMs,
            durationMs: pickNumber(rawEvent, 'durationMs', 'duration_ms'),
            title: modelName ?? 'Model response',
            parentSpanId: rootAgentSpanId,
            spanStableKey: `model:${callKey ?? generateStableId('openclaw_model_end', sessionId, modelName, tsMs)}`,
            agentName,
            modelName,
            usage,
            costUsd,
            output,
            error,
            summary: output?.text
                ? truncate(String(output.text), 96)
                : truncate(JSON.stringify(output ?? { ok: true }), 96),
            meta: { rawType },
        })]
    }

    if (rawType === 'subagent_spawning' || rawType === 'subagent_spawned' || rawType === 'subagent_ended') {
        const subagentName = pickString(rawEvent, 'subagentName', 'subagent_name', 'name', 'agentName', 'agent_name') ?? 'Subagent'
        const status: RuntimeEventStatus = rawType === 'subagent_spawning'
            ? 'start'
            : rawType === 'subagent_spawned'
                ? 'update'
                : (error ? 'error' : 'end')

        return [buildEvent({
            context,
            source,
            sessionId,
            threadKey,
            operation: 'agent',
            status,
            legacyEventType: 'agent_activity',
            phase: status === 'start' ? 'start' : status === 'end' ? 'end' : (status === 'error' ? 'error' : undefined),
            tsMs,
            title: subagentName,
            parentSpanId: rootAgentSpanId,
            spanStableKey: `subagent:${pickString(rawEvent, 'subagentId', 'subagent_id') ?? subagentName}`,
            agentName: subagentName,
            input,
            output,
            error,
            summary: `${subagentName} ${status}`,
            meta: { rawType },
        })]
    }

    if (rawType === 'agent_end') {
        return [buildEvent({
            context,
            source,
            sessionId,
            threadKey,
            operation: 'agent',
            status: error ? 'error' : 'end',
            legacyEventType: 'session_end',
            phase: error ? 'error' : 'end',
            tsMs,
            title: agentName,
            spanStableKey: `agent:${agentName}`,
            agentName,
            output,
            error,
            summary: error ? `${agentName} failed` : `${agentName} completed`,
            meta: { rawType },
        })]
    }

    return []
}

function normalizeGeneric(rawEvent: Record<string, unknown>, context: RuntimeContext): NormalizedRuntimeEvent[] {
    const source = (pickString(rawEvent, 'source') as RuntimeSource | undefined) ?? 'generic'
    const sessionId = extractSessionId(rawEvent)
    const threadKey = extractThreadKey(rawEvent, sessionId)
    const agentName = extractAgentName(rawEvent, source === 'generic' ? 'Agent runtime' : source)
    const tsMs = extractTimestampMs(rawEvent)
    const operation = (pickString(rawEvent, 'operation') as RuntimeSpanOperation | undefined)
        ?? (extractFilePath(rawEvent)
            ? (inferFileInteraction(extractToolName(rawEvent), pickString(rawEvent, 'type'), toPlainObject(rawEvent.input)) === 'writes' ? 'file_write' : 'file_read')
            : (extractToolName(rawEvent) ? 'tool' : (extractModelName(rawEvent) ? 'model' : 'agent')))
    const status = (pickString(rawEvent, 'status') as RuntimeEventStatus | undefined)
        ?? (pickString(rawEvent, 'phase') === 'start' ? 'start' : (pickString(rawEvent, 'phase') === 'end' ? 'end' : (pickString(rawEvent, 'error') ? 'error' : 'update')))
    const toolName = extractToolName(rawEvent)
    const modelName = extractModelName(rawEvent)
    const filePath = extractFilePath(rawEvent)
    const input = toPlainObject(rawEvent.input)
    const output = toPlainObject(rawEvent.output)
    const fileInteraction = filePath
        ? (operation === 'file_write' ? 'writes' : operation === 'file_read' ? 'reads' : inferFileInteraction(toolName, pickString(rawEvent, 'type'), input))
        : undefined
    const { usage, costUsd } = extractUsage(rawEvent)

    return [buildEvent({
        context,
        source,
        sessionId,
        threadKey,
        operation,
        status,
        legacyEventType: pickString(rawEvent, 'legacyEventType') as NormalizedRuntimeEvent['legacyEventType'] | undefined
            ?? (toolName ? 'tool_call' : modelName ? 'model_call' : 'agent_activity'),
        phase: pickString(rawEvent, 'phase') as NormalizedRuntimeEvent['phase'] | undefined,
        tsMs,
        durationMs: pickNumber(rawEvent, 'durationMs', 'duration_ms'),
        title: pickString(rawEvent, 'title') ?? toolName ?? modelName ?? agentName,
        spanStableKey: pickString(rawEvent, 'spanStableKey', 'spanId', 'span_id')
            ?? generateStableId('generic_span', source, sessionId, toolName, modelName, filePath, tsMs),
        parentSpanId: pickString(rawEvent, 'parentSpanId', 'parent_span_id'),
        agentName,
        toolName,
        modelName,
        filePath,
        fileInteraction,
        usage,
        costUsd,
        input,
        output,
        error: pickString(rawEvent, 'error'),
        summary: pickString(rawEvent, 'summary')
            ?? truncate(JSON.stringify(output ?? input ?? { title: pickString(rawEvent, 'title') ?? toolName ?? modelName ?? agentName }), 96),
        meta: { rawType: pickString(rawEvent, 'type') ?? 'generic' },
    })]
}

const adapters: RuntimeAdapter[] = [
    {
        source: 'claude_code',
        normalize: normalizeClaudeCode,
    },
    {
        source: 'openclaw',
        normalize: normalizeOpenClaw,
    },
    {
        source: 'generic',
        normalize: normalizeGeneric,
    },
]

export function normalizeRuntimePayload(
    rawEvent: Record<string, unknown>,
    context: RuntimeContext,
): NormalizedRuntimeEvent[] {
    const source = (pickString(rawEvent, 'source') as RuntimeSource | undefined)
        ?? (pickString(rawEvent, 'type')?.startsWith('subagent_') ? 'openclaw' : undefined)
        ?? 'generic'

    const adapter = adapters.find(candidate => candidate.source === source) ?? adapters[adapters.length - 1]
    const normalized = adapter.normalize(rawEvent, context)
    if (normalized.length > 0) return normalized
    return normalizeGeneric({ ...rawEvent, source }, context)
}

export function resetRuntimeNormalizerState(): void {
    clearOpenSpanState()
}
