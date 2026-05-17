import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, Cpu, FileText, Layers3, MessageSquarePlus, Sparkles, Wrench } from 'lucide-react'
import { TraceDetail } from '../../../../shared/types'
import { useAppStore } from '../../../store/app.store'

function formatCurrency(value: number): string {
    return `$${value.toFixed(2)}`
}

function formatTokens(value: number): string {
    return value > 0 ? value.toLocaleString() : '0'
}

function timeLabel(ts: number): string {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function buildSpanDepths(detail: TraceDetail): Array<TraceDetail['spans'][number] & { depth: number }> {
    const byParent = new Map<string | undefined, TraceDetail['spans']>()
    for (const span of detail.spans) {
        const bucket = byParent.get(span.parentSpanId) ?? []
        bucket.push(span)
        byParent.set(span.parentSpanId, bucket)
    }

    const ordered: Array<TraceDetail['spans'][number] & { depth: number }> = []
    const walk = (parentId: string | undefined, depth: number) => {
        const children = (byParent.get(parentId) ?? []).sort((a, b) => a.startedAt - b.startedAt)
        for (const child of children) {
            ordered.push({ ...child, depth })
            walk(child.id, depth + 1)
        }
    }

    walk(undefined, 0)
    return ordered
}

function ScoreButtons({
    onSelect,
    currentValue,
}: {
    onSelect: (value: number) => void
    currentValue?: number
}) {
    return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5].map(value => (
                <button
                    key={value}
                    onClick={() => onSelect(value)}
                    style={{
                        padding: '3px 7px',
                        borderRadius: 6,
                        border: `1px solid ${currentValue === value ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        background: currentValue === value ? 'rgba(96,165,250,0.14)' : 'rgba(255,255,255,0.03)',
                        color: currentValue === value ? '#60a5fa' : 'var(--k-text-dim)',
                        fontSize: 10,
                        cursor: 'pointer',
                    }}
                >
                    {value}
                </button>
            ))}
        </div>
    )
}

export function TraceInspectorPanel({ traceId, workspaceId }: { traceId: string; workspaceId: string }) {
    const { activeWorkspace, setOpenFilePath } = useAppStore()
    const [detail, setDetail] = useState<TraceDetail | null>(null)
    const [datasets, setDatasets] = useState<Array<{ id: string; name: string }>>([])
    const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null)
    const [savingExample, setSavingExample] = useState(false)

    const load = useCallback(async () => {
        const [nextDetail, nextDatasets] = await Promise.all([
            window.api.getTraceDetail(traceId),
            window.api.listDatasets(workspaceId),
        ])
        setDetail(nextDetail)
        setDatasets(nextDatasets)
    }, [traceId, workspaceId])

    useEffect(() => {
        load()
    }, [load])

    const spanRows = useMemo(() => detail ? buildSpanDepths(detail) : [], [detail])
    const selectedSpan = detail?.spans.find(span => span.id === selectedSpanId) ?? null
    const traceScore = detail?.feedback.find(item => !item.spanId && item.name === 'quality')
    const selectedSpanScore = detail?.feedback.find(item => item.spanId === selectedSpanId && item.name === 'quality')

    const handleFeedback = useCallback(async (value: number, spanId?: string) => {
        await window.api.addFeedback({
            workspaceId,
            traceId,
            spanId,
            name: 'quality',
            value,
        })
        await load()
    }, [load, traceId, workspaceId])

    const handleSaveExample = useCallback(async () => {
        setSavingExample(true)
        try {
            await window.api.saveTraceExample(workspaceId, traceId)
            await load()
        } finally {
            setSavingExample(false)
        }
    }, [load, traceId, workspaceId])

    const openSpanFile = useCallback((filePath?: string) => {
        if (!filePath || !activeWorkspace?.path) return
        const absolute = filePath.startsWith('/')
            ? filePath
            : `${activeWorkspace.path.replace(/\/$/, '')}/${filePath}`
        setOpenFilePath(absolute)
    }, [activeWorkspace, setOpenFilePath])

    if (!detail) {
        return (
            <div style={{ width: 340, borderLeft: '1px solid var(--k-border-subtle)', padding: 16, color: 'var(--k-text-dim)', fontSize: 12 }}>
                Loading trace…
            </div>
        )
    }

    return (
        <div style={{ width: 340, borderLeft: '1px solid var(--k-border-subtle)', background: 'var(--k-bg-panel)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--k-border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Layers3 size={15} color="#60a5fa" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--k-text-primary)' }}>Trace Inspector</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--k-text-dim)', lineHeight: 1.6 }}>
                    <div>{detail.thread?.title ?? detail.trace.rootAgentName ?? detail.trace.id}</div>
                    <div>{detail.trace.status} · {detail.spans.length} spans · {timeLabel(detail.trace.startedAt)}</div>
                </div>
            </div>

            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--k-border-subtle)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--k-text-dim)' }}>
                    <div style={{ marginBottom: 3, color: 'var(--k-text-secondary)' }}>Tokens</div>
                    <div style={{ fontWeight: 700, color: 'var(--k-text-primary)' }}>{formatTokens(detail.usage.totalTokens ?? 0)}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--k-text-dim)' }}>
                    <div style={{ marginBottom: 3, color: 'var(--k-text-secondary)' }}>Cost</div>
                    <div style={{ fontWeight: 700, color: 'var(--k-text-primary)' }}>{formatCurrency(detail.usage.costUsd)}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--k-text-dim)' }}>
                    <div style={{ marginBottom: 3, color: 'var(--k-text-secondary)' }}>Prompt Versions</div>
                    <div style={{ fontWeight: 700, color: 'var(--k-text-primary)' }}>{detail.promptVersions.length}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--k-text-dim)' }}>
                    <div style={{ marginBottom: 3, color: 'var(--k-text-secondary)' }}>Datasets</div>
                    <div style={{ fontWeight: 700, color: 'var(--k-text-primary)' }}>{detail.datasetExamples.length}</div>
                </div>
            </div>

            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--k-border-subtle)' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--k-text-dim)', marginBottom: 8 }}>
                    Trace Feedback
                </div>
                <ScoreButtons currentValue={traceScore?.value} onSelect={(value) => handleFeedback(value)} />
                <button
                    onClick={handleSaveExample}
                    style={{
                        marginTop: 10,
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(52,211,153,0.25)',
                        background: 'rgba(52,211,153,0.12)',
                        color: '#34d399',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    <MessageSquarePlus size={12} />
                    {savingExample ? 'Saving…' : `Save To ${datasets[0]?.name ?? 'Dataset'}`}
                </button>
            </div>

            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--k-border-subtle)' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--k-text-dim)', marginBottom: 8 }}>
                    Active Prompt Versions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detail.promptVersions.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--k-text-dim)' }}>No prompt versions linked yet</div>
                    ) : detail.promptVersions.map(item => (
                        <button
                            key={item.versionId}
                            onClick={() => openSpanFile(item.sourcePath)}
                            style={{
                                textAlign: 'left',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 8,
                                padding: '8px 10px',
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ fontSize: 12, color: 'var(--k-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Sparkles size={11} color="#f472b6" />
                                {item.templateName} · v{item.version}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--k-text-dim)', marginTop: 3 }}>{item.sourcePath}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ padding: '12px 18px 8px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--k-text-dim)' }}>
                Span Tree
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
                {spanRows.map(span => (
                    <button
                        key={span.id}
                        onClick={() => setSelectedSpanId(span.id)}
                        style={{
                            width: '100%',
                            textAlign: 'left',
                            border: 'none',
                            cursor: 'pointer',
                            padding: `8px 10px 8px ${10 + span.depth * 16}px`,
                            background: selectedSpanId === span.id ? 'rgba(96,165,250,0.12)' : 'transparent',
                            borderLeft: selectedSpanId === span.id ? '2px solid #60a5fa' : '2px solid transparent',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--k-text-primary)' }}>
                            {span.operation === 'agent' && <Bot size={11} />}
                            {span.operation === 'tool' && <Wrench size={11} />}
                            {span.operation === 'model' && <Cpu size={11} />}
                            {(span.operation === 'file_write' || span.operation === 'file_read') && <FileText size={11} />}
                            <span>{span.name}</span>
                        </div>
                        <div style={{ marginTop: 3, fontSize: 10, color: 'var(--k-text-dim)' }}>
                            {span.operation} · {span.status}
                            {span.filePath ? ` · ${span.filePath}` : ''}
                        </div>
                    </button>
                ))}
            </div>

            {selectedSpan && (
                <div style={{ borderTop: '1px solid var(--k-border-subtle)', padding: '12px 18px' }}>
                    <div style={{ fontSize: 11, color: 'var(--k-text-secondary)', marginBottom: 8 }}>{selectedSpan.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--k-text-dim)', lineHeight: 1.6, marginBottom: 8 }}>
                        <div>{selectedSpan.operation} · {selectedSpan.status}</div>
                        <div>{formatTokens(selectedSpan.usage?.totalTokens ?? 0)} tokens · {formatCurrency(selectedSpan.costUsd ?? 0)}</div>
                    </div>
                    <ScoreButtons currentValue={selectedSpanScore?.value} onSelect={(value) => handleFeedback(value, selectedSpan.id)} />
                    {selectedSpan.filePath && (
                        <button
                            onClick={() => openSpanFile(selectedSpan.filePath)}
                            style={{
                                marginTop: 10,
                                padding: '6px 10px',
                                borderRadius: 8,
                                border: '1px solid rgba(96,165,250,0.25)',
                                background: 'rgba(96,165,250,0.12)',
                                color: '#60a5fa',
                                fontSize: 11,
                                cursor: 'pointer',
                            }}
                        >
                            Open {selectedSpan.filePath}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
