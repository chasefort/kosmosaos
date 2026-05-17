import { useMemo, useEffect, useState } from 'react'
import {
    HeartPulse, CheckCircle2, AlertTriangle, XCircle,
    Info, ShieldAlert, Zap, GitBranch, BarChart3,
    Eye, Layers, ArrowUpRight, Wrench, Clock, Cpu,
    FileText, Activity, TrendingUp,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGraphStore } from '../../store/graph.store'
import { useAppStore } from '../../store/app.store'
import { ContextDriftSummary, ContextHealthSummary, KosmosNode, KosmosEdge, KosmosFinding, KosmosRun, KosmosEvent } from '../../../shared/types'

// ════════════════════════════════════════════════════════════════════════════════
// ── Architecture Analysis (existing logic, unchanged) ──────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

function computeFindings(nodes: KosmosNode[], edges: KosmosEdge[]): KosmosFinding[] {
    const findings: KosmosFinding[] = []
    if (nodes.length === 0) return findings

    const outDegree   = new Map<string, number>()
    const totalDegree = new Map<string, number>()
    const inDegree    = new Map<string, number>()
    for (const n of nodes) { outDegree.set(n.id, 0); inDegree.set(n.id, 0); totalDegree.set(n.id, 0) }
    for (const e of edges) {
        outDegree.set(e.fromId,   (outDegree.get(e.fromId)   ?? 0) + 1)
        inDegree.set(e.toId,      (inDegree.get(e.toId)      ?? 0) + 1)
        totalDegree.set(e.fromId, (totalDegree.get(e.fromId) ?? 0) + 1)
        totalDegree.set(e.toId,   (totalDegree.get(e.toId)   ?? 0) + 1)
    }
    const avgDegree = nodes.length > 0
        ? [...totalDegree.values()].reduce((a, b) => a + b, 0) / nodes.length : 0

    const agents = nodes.filter(n => n.type === 'agent')

    // God agents
    if (agents.length > 1) {
        const sorted    = [...agents].sort((a, b) => (outDegree.get(b.id) ?? 0) - (outDegree.get(a.id) ?? 0))
        const threshold = Math.max(5, (outDegree.get(sorted[0].id) ?? 0) * 0.6)
        const godAgents = sorted.filter(n => (outDegree.get(n.id) ?? 0) >= threshold)
        if (godAgents.length > 0) {
            const top   = godAgents[0]
            const calls = outDegree.get(top.id) ?? 0
            findings.push({
                id: 'god_agent', type: 'god_agent',
                severity: calls > 10 ? 'error' : 'warning',
                title: `God Agent: "${top.name}"`,
                description: `"${top.name}" has ${calls} outgoing connections — ${(calls / Math.max(avgDegree, 1)).toFixed(1)}× the graph average. This agent may be doing too much.`,
                nodeIds: godAgents.map(n => n.id),
                suggestion: `Split "${top.name}" into smaller, focused sub-agents. Delegate file I/O, API calls, and memory writes to dedicated child agents.`
            })
        }
    }

    // Orphaned nodes
    const orphans = nodes.filter(n => (totalDegree.get(n.id) ?? 0) === 0)
    if (orphans.length > 0) {
        findings.push({
            id: 'unused_node', type: 'unused_node',
            severity: orphans.length > 3 ? 'warning' : 'info',
            title: `${orphans.length} Orphaned Node${orphans.length > 1 ? 's' : ''}`,
            description: `${orphans.map(n => `"${n.name}"`).slice(0, 4).join(', ')}${orphans.length > 4 ? ` and ${orphans.length - 4} more` : ''} have no connections.`,
            nodeIds: orphans.map(n => n.id),
            suggestion: `Review each orphaned node. Delete if unused, or wire it in with the appropriate import or call.`
        })
    }

    // High coupling
    const highCoupling = nodes.filter(n => {
        const deg = totalDegree.get(n.id) ?? 0
        return deg >= Math.max(8, avgDegree * 3) && n.type !== 'agent'
    }).sort((a, b) => (totalDegree.get(b.id) ?? 0) - (totalDegree.get(a.id) ?? 0))
    if (highCoupling.length > 0) {
        const top = highCoupling[0]
        const deg = totalDegree.get(top.id) ?? 0
        findings.push({
            id: 'redundant_node', type: 'redundant_node',
            severity: 'warning',
            title: `High Coupling: "${top.name}"`,
            description: `"${top.name}" (${top.type}) has ${deg} connections — ${(deg / Math.max(avgDegree, 1)).toFixed(1)}× the graph average.`,
            nodeIds: highCoupling.map(n => n.id),
            suggestion: `Split "${top.name}" into more focused modules. Introduce an abstraction layer.`
        })
    }

    // Broad permissions
    const permNodes = nodes.filter(n => n.type === 'permission_scope')
    const broadPerms = permNodes.filter(n => (outDegree.get(n.id) ?? 0) > 3 || (inDegree.get(n.id) ?? 0) === 0)
    if (broadPerms.length > 0) {
        findings.push({
            id: 'broad_permission', type: 'broad_permission',
            severity: 'error',
            title: `Overly Broad Permission Scope${broadPerms.length > 1 ? 's' : ''}`,
            description: `${broadPerms.map(n => `"${n.name}"`).join(', ')} grant wide access that violates least privilege.`,
            nodeIds: broadPerms.map(n => n.id),
            suggestion: `Restrict each permission scope to only the tools and resources actually needed.`
        })
    }

    // Low confidence
    const lowConf = nodes.filter(n => n.confidence < 0.5)
    if (lowConf.length > 0) {
        findings.push({
            id: 'low_confidence', type: 'low_confidence',
            severity: 'info',
            title: `${lowConf.length} Low-Confidence Node${lowConf.length > 1 ? 's' : ''}`,
            description: `${lowConf.length} node${lowConf.length > 1 ? 's were' : ' was'} parsed with less than 50% confidence.`,
            nodeIds: lowConf.map(n => n.id),
            suggestion: `Add explicit type annotations or structured comments to help the parser.`
        })
    }

    // Instruction file analysis
    const promptNodes = nodes.filter(n => n.type === 'prompt' || n.type === 'instruction_file')
    for (const pn of promptNodes) {
        const analysis = (pn.meta as any)?.instructionAnalysis
        if (!analysis) continue

        if (analysis.estimatedTokens > 6000) {
            findings.push({
                id: `instruction_bloat_${pn.id}`, type: 'instruction_bloat',
                severity: 'error',
                title: `Instruction Bloat: "${pn.name}"`,
                description: `"${pn.name}" is ~${analysis.estimatedTokens.toLocaleString()} tokens (${analysis.charCount.toLocaleString()} chars, ${analysis.lineCount} lines). This is well above the recommended 1,500 token limit and will consume significant context window.`,
                nodeIds: [pn.id],
                suggestion: `Split "${pn.name}" into focused sections. Move tool-specific instructions to separate files. Remove examples that aren't critical.`
            })
        } else if (analysis.estimatedTokens > 3000) {
            findings.push({
                id: `instruction_bloat_${pn.id}`, type: 'instruction_bloat',
                severity: 'warning',
                title: `Large Instruction File: "${pn.name}"`,
                description: `"${pn.name}" is ~${analysis.estimatedTokens.toLocaleString()} tokens. Consider trimming to keep context lean.`,
                nodeIds: [pn.id],
                suggestion: `Review "${pn.name}" for redundant instructions, verbose examples, or content that could be split into separate files.`
            })
        }

        if (analysis.antiPatterns.includes('no_structure')) {
            findings.push({
                id: `instruction_unstructured_${pn.id}`, type: 'instruction_unstructured',
                severity: 'warning',
                title: `Unstructured: "${pn.name}"`,
                description: `"${pn.name}" has ${analysis.lineCount} lines but no markdown headers. Agents perform better with clearly structured instructions.`,
                nodeIds: [pn.id],
                suggestion: `Add ## section headers to organize instructions by topic (e.g., ## Role, ## Rules, ## Tools, ## Output Format).`
            })
        }

        if (analysis.antiPatterns.includes('stale_markers')) {
            findings.push({
                id: `instruction_stale_${pn.id}`, type: 'instruction_stale',
                severity: 'info',
                title: `Stale Markers in "${pn.name}"`,
                description: `"${pn.name}" contains TODO/FIXME markers, suggesting unfinished instructions.`,
                nodeIds: [pn.id],
                suggestion: `Resolve or remove TODO/FIXME items. Stale markers confuse agents and waste context.`
            })
        }
    }

    // Context graph health
    const contextNodes = nodes.filter(n => ['wiki_page', 'source_doc', 'output_artifact', 'instruction_file', 'index_file', 'unresolved_link'].includes(n.type))
    if (contextNodes.length > 0) {
        const unresolved = nodes.filter(n => n.type === 'unresolved_link')
        for (const node of unresolved.slice(0, 25)) {
            findings.push({
                id: `broken_link_${node.id}`,
                type: 'broken_link',
                severity: 'error',
                title: `Broken Link: "${node.name}"`,
                description: `A Markdown or wikilink target could not be resolved in this workspace.`,
                nodeIds: [node.id],
                suggestion: `Create the missing page or update the link target.`
            })
        }

        const sourceIds = new Set(nodes.filter(n => n.type === 'source_doc').map(n => n.id))
        const citedSourceIds = new Set(edges.filter(e => e.type === 'cites' && sourceIds.has(e.toId)).map(e => e.toId))
        const sourceBackedIds = new Set(edges.filter(e => e.type === 'cites' || e.type === 'derived_from').map(e => e.fromId))
        const wikiWithoutSource = nodes.filter(n => n.type === 'wiki_page' && !sourceBackedIds.has(n.id))
        if (wikiWithoutSource.length > 0) {
            findings.push({
                id: 'missing_source_wiki_pages',
                type: 'missing_source',
                severity: wikiWithoutSource.length > 5 ? 'warning' : 'info',
                title: `${wikiWithoutSource.length} Wiki Page${wikiWithoutSource.length > 1 ? 's' : ''} Missing Sources`,
                description: `${wikiWithoutSource.slice(0, 4).map(n => `"${n.name}"`).join(', ')}${wikiWithoutSource.length > 4 ? ` and ${wikiWithoutSource.length - 4} more` : ''} do not cite raw/source material.`,
                nodeIds: wikiWithoutSource.map(n => n.id),
                suggestion: `Add frontmatter sources or local links into raw/source material where provenance matters.`
            })
        }

        const outputsWithoutSource = nodes.filter(n => n.type === 'output_artifact' && !sourceBackedIds.has(n.id))
        if (outputsWithoutSource.length > 0) {
            findings.push({
                id: 'outputs_without_provenance',
                type: 'output_without_provenance',
                severity: 'error',
                title: `${outputsWithoutSource.length} Output${outputsWithoutSource.length > 1 ? 's' : ''} Without Provenance`,
                description: `${outputsWithoutSource.slice(0, 4).map(n => `"${n.name}"`).join(', ')}${outputsWithoutSource.length > 4 ? ` and ${outputsWithoutSource.length - 4} more` : ''} do not link to upstream wiki pages or source docs.`,
                nodeIds: outputsWithoutSource.map(n => n.id),
                suggestion: `Link generated outputs back to their source docs or the wiki pages they derive from.`
            })
        }

        const unusedSources = nodes.filter(n => n.type === 'source_doc' && !citedSourceIds.has(n.id))
        if (unusedSources.length > 0) {
            findings.push({
                id: 'unused_sources',
                type: 'unused_source',
                severity: 'info',
                title: `${unusedSources.length} Uncited Source${unusedSources.length > 1 ? 's' : ''}`,
                description: `${unusedSources.slice(0, 4).map(n => `"${n.name}"`).join(', ')}${unusedSources.length > 4 ? ` and ${unusedSources.length - 4} more` : ''} are not cited by wiki pages or outputs.`,
                nodeIds: unusedSources.map(n => n.id),
                suggestion: `Either cite these sources from durable pages or archive them outside the active context graph.`
            })
        }

        const linkedContextIds = new Set(edges.filter(e => ['links_to', 'cites', 'derived_from', 'indexes', 'documents'].includes(e.type)).flatMap(e => [e.fromId, e.toId]))
        const orphanPages = nodes.filter(n => (n.type === 'wiki_page' || n.type === 'index_file') && !linkedContextIds.has(n.id))
        if (orphanPages.length > 0) {
            findings.push({
                id: 'orphan_context_pages',
                type: 'orphan_page',
                severity: orphanPages.length > 5 ? 'warning' : 'info',
                title: `${orphanPages.length} Orphan Context Page${orphanPages.length > 1 ? 's' : ''}`,
                description: `${orphanPages.slice(0, 4).map(n => `"${n.name}"`).join(', ')}${orphanPages.length > 4 ? ` and ${orphanPages.length - 4} more` : ''} are not connected through context links.`,
                nodeIds: orphanPages.map(n => n.id),
                suggestion: `Add links from index pages or related concepts so agents can traverse this context.`
            })
        }
    }

    // No agents
    if (agents.length === 0 && nodes.length > 0) {
        findings.push({
            id: 'unused_node', type: 'unused_node',
            severity: 'warning',
            title: 'No Agent Nodes Detected',
            description: `The workspace has ${nodes.length} nodes but no agents were found.`,
            nodeIds: [],
            suggestion: `Ensure agent files use a recognised pattern (Claude Code, LangChain, AutoGen, etc.) and re-scan.`
        })
    }

    return findings
}

function computeScore(findings: KosmosFinding[], nodeCount: number): number {
    if (nodeCount === 0) return 0
    const p = findings.filter(f => f.severity === 'error').length   * 20
            + findings.filter(f => f.severity === 'warning').length * 10
            + findings.filter(f => f.severity === 'info').length    * 3
    return Math.max(0, 100 - p)
}

// ════════════════════════════════════════════════════════════════════════════════
// ── UI Components ──────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

function ScoreGauge({ score }: { score: number }) {
    const color = score >= 80 ? '#34d399' : score >= 50 ? '#f59e0b' : '#ef4444'
    const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Work' : 'Critical'
    const C = 2 * Math.PI * 44
    const offset = C * (1 - score / 100)
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', width: 100, height: 100 }}>
                <svg width={100} height={100} viewBox="0 0 120 120">
                    <circle cx={60} cy={60} r={44} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={9} />
                    <circle cx={60} cy={60} r={44} fill="none" stroke={color} strokeWidth={9}
                        strokeLinecap="round"
                        strokeDasharray={C} strokeDashoffset={offset}
                        transform="rotate(-90 60 60)"
                        style={{ filter: `drop-shadow(0 0 8px ${color}99)`, transition: 'stroke-dashoffset 0.9s ease' }}
                    />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>/100</span>
                </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color, padding: '2px 10px', borderRadius: 20, background: `${color}18`, border: `1px solid ${color}40` }}>{label}</div>
        </div>
    )
}

function OverviewCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string }) {
    return (
        <div style={{
            flex: '1 1 150px', minWidth: 140, padding: '16px 18px', borderRadius: 12,
            background: 'var(--k-bg-panel)', border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column', gap: 8,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}15`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                    {icon}
                </div>
                <span style={{ fontSize: 10, color: 'var(--k-text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--k-text-primary)' }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: 'var(--k-text-dim)', marginTop: -4 }}>{sub}</div>}
        </div>
    )
}

const SEV_META = {
    error:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  label: 'Critical', Icon: XCircle       },
    warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'Warning',  Icon: AlertTriangle  },
    info:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  label: 'Info',     Icon: Info           },
}
const TYPE_META: Record<KosmosFinding['type'], { Icon: React.ComponentType<any>; label: string }> = {
    god_agent:                { Icon: Zap,         label: 'God Agent'        },
    unused_node:              { Icon: Eye,         label: 'Orphaned / Unused' },
    redundant_node:           { Icon: GitBranch,   label: 'High Coupling'    },
    broad_permission:         { Icon: ShieldAlert, label: 'Broad Permission' },
    circular_dep:             { Icon: BarChart3,   label: 'Circular Dep'     },
    low_confidence:           { Icon: Layers,      label: 'Low Confidence'   },
    instruction_bloat:        { Icon: FileText,    label: 'Instruction Bloat' },
    instruction_unstructured: { Icon: Layers,      label: 'Unstructured'      },
    instruction_stale:        { Icon: Clock,       label: 'Stale Markers'     },
    broken_link:              { Icon: XCircle,     label: 'Broken Link'       },
    orphan_page:              { Icon: Eye,         label: 'Orphan Page'       },
    missing_source:           { Icon: FileText,    label: 'Missing Source'    },
    unused_source:            { Icon: Info,        label: 'Unused Source'     },
    thin_page:                { Icon: FileText,    label: 'Thin Page'         },
    missing_index:            { Icon: Layers,      label: 'Missing Index'     },
    instruction_missing_navigation: { Icon: GitBranch, label: 'Instruction Navigation' },
    instruction_path_missing: { Icon: XCircle,     label: 'Missing Path'      },
    instruction_too_long:     { Icon: FileText,    label: 'Instruction Length' },
    instruction_duplicate:    { Icon: Layers,      label: 'Duplicate Instruction' },
    raw_wiki_output_gap:      { Icon: GitBranch,   label: 'Context Flow Gap'  },
    weak_cross_links:         { Icon: GitBranch,   label: 'Weak Links'        },
    stale_page:               { Icon: Clock,       label: 'Stale Page'        },
    output_without_provenance:{ Icon: AlertTriangle, label: 'Output Provenance' },
    runtime_used_weak_context:{ Icon: Activity,    label: 'Weak Runtime Context' },
}

const AUDIT_GROUPS = [
    { id: 'overview', label: 'Top Findings', types: null },
    { id: 'provenance', label: 'Provenance', types: ['missing_source', 'unused_source', 'output_without_provenance', 'raw_wiki_output_gap'] },
    { id: 'navigation', label: 'Navigation', types: ['broken_link', 'orphan_page', 'weak_cross_links', 'missing_index', 'thin_page'] },
    { id: 'instructions', label: 'Instructions', types: ['instruction_bloat', 'instruction_unstructured', 'instruction_stale', 'instruction_missing_navigation', 'instruction_path_missing', 'instruction_too_long', 'instruction_duplicate'] },
    { id: 'maintenance', label: 'Cleanup', types: ['stale_page', 'unused_node', 'redundant_node', 'low_confidence'] },
    { id: 'runtime', label: 'Runtime', types: ['runtime_used_weak_context'] },
] as const

type AuditTab = typeof AUDIT_GROUPS[number]['id'] | 'drift'

function normalizeContextHealth(summary: ContextHealthSummary | null): ContextHealthSummary | null {
    if (!summary) return null
    return {
        ...summary,
        findings: summary.findings ?? [],
        metrics: {
            nodeCount: 0,
            edgeCount: 0,
            wikiPages: 0,
            sourceDocs: 0,
            outputArtifacts: 0,
            instructionFiles: 0,
            indexFiles: 0,
            brokenLinks: 0,
            missingSourcePages: 0,
            outputsWithoutProvenance: 0,
            unusedSources: 0,
            orphanPages: 0,
            sourceCoveragePct: 0,
            sessionsToday: 0,
            activeTraces: 0,
            ...summary.metrics,
        },
        contextSystem: summary.contextSystem ? {
            isMarkdownVault: Boolean(summary.contextSystem.isMarkdownVault),
            isObsidianVault: Boolean(summary.contextSystem.isObsidianVault),
            hasRawWikiOutputs: Boolean(summary.contextSystem.hasRawWikiOutputs),
            instructionFiles: summary.contextSystem.instructionFiles ?? [],
            detectedConventions: summary.contextSystem.detectedConventions ?? [],
        } : undefined,
    }
}

function normalizeContextDrift(summary: ContextDriftSummary | null): ContextDriftSummary | null {
    if (!summary) return null
    return {
        ...summary,
        newFiles: summary.newFiles ?? [],
        deletedFiles: summary.deletedFiles ?? [],
        changedFiles: summary.changedFiles ?? [],
        newFindings: summary.newFindings ?? [],
        resolvedFindings: summary.resolvedFindings ?? [],
        sourceCoverageDelta: summary.sourceCoverageDelta ?? 0,
        brokenLinkDelta: summary.brokenLinkDelta ?? 0,
        instructionFilesChanged: summary.instructionFilesChanged ?? [],
    }
}

function FindingCard({ finding, onShowOnMap }: { finding: KosmosFinding; onShowOnMap: () => void }) {
    const sev      = SEV_META[finding.severity]
    const typeM    = TYPE_META[finding.type]
    const TypeIcon = typeM.Icon
    const SevIcon  = sev.Icon
    return (
        <div style={{ background: 'var(--k-bg-panel)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${sev.color}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 10px', background: `linear-gradient(135deg, ${sev.bg} 0%, transparent 70%)`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: sev.bg, border: `1px solid ${sev.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sev.color }}>
                    <TypeIcon size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--k-text-primary)' }}>{finding.title}</h3>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', padding: '1px 7px', borderRadius: 20, background: sev.bg, color: sev.color, border: `1px solid ${sev.color}44`, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <SevIcon size={8} /> {sev.label}
                        </span>
                    </div>
                </div>
            </div>
            <div style={{ padding: '0 18px 14px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--k-text-secondary)', lineHeight: 1.6 }}>{finding.description}</p>
                {finding.suggestion && (
                    <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 7, padding: '8px 12px', marginBottom: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#34d399', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
                            <CheckCircle2 size={9} style={{ verticalAlign: -1 }} /> Suggested Fix
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>{finding.suggestion}</div>
                    </div>
                )}
                {finding.nodeIds.length > 0 && (
                    <button onClick={onShowOnMap}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'var(--k-text-dim)', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}>
                        <ArrowUpRight size={11} /> Show on Graph
                    </button>
                )}
            </div>
        </div>
    )
}

// ── Activity Timeline ──────────────────────────────────────────────────────────
function ActivityTimeline({ runs }: { runs: KosmosRun[] }) {
    if (runs.length === 0) return null

    const sorted = [...runs].sort((a, b) => a.startedAt - b.startedAt)
    const earliest = sorted[0].startedAt
    const latest = Math.max(...sorted.map(r => r.endedAt ?? r.startedAt))
    const span = Math.max(latest - earliest, 1)

    return (
        <div style={{
            background: 'var(--k-bg-panel)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
            padding: '14px 18px',
        }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>
                Session Activity Timeline
            </div>
            <div style={{ position: 'relative', height: 32, background: 'rgba(255,255,255,0.02)', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
                {sorted.map((r) => {
                    const left = ((r.startedAt - earliest) / span) * 100
                    const width = Math.max(((r.endedAt ?? r.startedAt) - r.startedAt) / span * 100, 0.8)
                    const color = r.status === 'error' ? '#ef4444' : r.status === 'running' ? '#60a5fa' : '#34d399'
                    return (
                        <div
                            key={r.id}
                            title={`${new Date(r.startedAt).toLocaleString()} — ${r.status} — ${r.eventCount} events`}
                            style={{
                                position: 'absolute',
                                left: `${left}%`, width: `${width}%`,
                                top: 4, bottom: 4,
                                background: `${color}55`, borderRadius: 4,
                                border: `1px solid ${color}88`,
                                minWidth: 4,
                                cursor: 'default',
                            }}
                        />
                    )
                })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--k-text-dim)' }}>
                    {new Date(earliest).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <span style={{ fontSize: 10, color: 'var(--k-text-dim)' }}>
                    {new Date(latest).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
            </div>
        </div>
    )
}

// ════════════════════════════════════════════════════════════════════════════════
// ── Main Screen ────────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

function InstructionHealthSection({ nodes, onOpenFile }: { nodes: KosmosNode[]; onOpenFile: (path: string) => void }) {
    const promptNodes = nodes.filter(n => n.type === 'prompt' || n.type === 'instruction_file')
    if (promptNodes.length === 0) return null

    return (
        <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                Instruction Health
            </div>
            <div style={{ background: 'var(--k-bg-panel)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px 70px 70px', padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['File', 'Tokens', 'Lines', 'Sections', 'Issues'].map(h => (
                        <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.25)' }}>{h}</span>
                    ))}
                </div>
                {promptNodes.map(pn => {
                    const analysis = (pn.meta as any)?.instructionAnalysis
                    const tokens = analysis?.estimatedTokens ?? 0
                    const lines = analysis?.lineCount ?? 0
                    const sections = analysis?.sectionCount ?? 0
                    const issues = (analysis?.antiPatterns ?? []).length
                    const tokenColor = tokens > 3000 ? (tokens > 6000 ? '#ef4444' : '#f59e0b') : '#34d399'
                    const filePath = (pn.meta as any)?.path as string | undefined

                    return (
                        <div key={pn.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px 70px 70px', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
                            <button
                                onClick={() => filePath && onOpenFile(filePath)}
                                style={{ textAlign: 'left', fontSize: 12, color: '#60a5fa', cursor: filePath ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                                {pn.name}
                            </button>
                            <span style={{ fontSize: 12, fontWeight: 700, color: tokenColor }}>
                                {tokens > 0 ? `~${tokens.toLocaleString()}` : '—'}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--k-text-dim)' }}>{lines || '—'}</span>
                            <span style={{ fontSize: 12, color: 'var(--k-text-dim)' }}>{sections || '—'}</span>
                            <span style={{ fontSize: 12, color: issues > 0 ? '#f59e0b' : 'var(--k-text-dim)', fontWeight: issues > 0 ? 700 : 400 }}>
                                {issues > 0 ? `⚠ ${issues}` : '✓'}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export function HealthScreen() {
    const { nodes, edges }                       = useGraphStore()
    const { activeWorkspace, setSelectedNodeId, setOpenFilePath }  = useAppStore()
    const navigate                                = useNavigate()

    // ── Load runs for operational metrics ──
    const [runs, setRuns] = useState<KosmosRun[]>([])
    const [allEvents, setAllEvents] = useState<KosmosEvent[]>([])
    const [contextHealth, setContextHealth] = useState<ContextHealthSummary | null>(null)
    const [drift, setDrift] = useState<ContextDriftSummary | null>(null)
    const [activeTab, setActiveTab] = useState<AuditTab>('overview')

    useEffect(() => {
        if (!activeWorkspace) return
        ;(async () => {
            const r: KosmosRun[] = await window.api.getRuns(activeWorkspace.id)
            setRuns(r)
            setContextHealth(normalizeContextHealth(await window.api.getContextHealth(activeWorkspace.id)))
            setDrift(normalizeContextDrift(await window.api.getContextDrift(activeWorkspace.id)))
            // Load events for each run to compute aggregate tool stats
            const eventsArr: KosmosEvent[] = []
            for (const run of r.slice(0, 20)) { // cap at 20 most recent for perf
                const evs = await window.api.getEvents(run.id)
                eventsArr.push(...evs)
            }
            setAllEvents(eventsArr)
        })()
    }, [activeWorkspace])

    const architectureFindings = useMemo(() => computeFindings(nodes, edges).filter(f => ['god_agent', 'broad_permission', 'circular_dep'].includes(f.type)), [nodes, edges])
    const findings = useMemo(() => {
        const contextFindings = contextHealth?.findings ?? []
        const seen = new Set(contextFindings.map(f => f.id))
        return [
            ...contextFindings,
            ...architectureFindings.filter(f => !seen.has(f.id)),
        ]
    }, [architectureFindings, contextHealth])
    const score = contextHealth?.score ?? computeScore(findings, nodes.length)

    // ── Operational metrics ──
    const opMetrics = useMemo(() => {
        const totalSessions = runs.length
        const toolCalls = allEvents.filter(e => e.type === 'tool_call' && e.phase !== 'end')
        const totalToolInvocations = toolCalls.length

        // Most used tool
        const toolFreq: Record<string, number> = {}
        toolCalls.forEach(e => { toolFreq[e.toolName ?? 'unknown'] = (toolFreq[e.toolName ?? 'unknown'] ?? 0) + 1 })
        const mostUsedTool = Object.entries(toolFreq).sort((a, b) => b[1] - a[1])[0]

        // Avg session duration
        const durations = runs.filter(r => r.endedAt).map(r => r.endedAt! - r.startedAt)
        const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
        const avgDurationStr = avgDuration < 60_000
            ? `${Math.round(avgDuration / 1000)}s`
            : `${Math.floor(avgDuration / 60_000)}m ${Math.round((avgDuration % 60_000) / 1000)}s`

        // Error rate
        const errorSessions = runs.filter(r => r.status === 'error').length
        const errorRate = totalSessions > 0 ? Math.round((errorSessions / totalSessions) * 100) : 0

        // Files in graph
        const fileNodes = nodes.filter(n => ['file', 'wiki_page', 'source_doc', 'output_artifact', 'instruction_file', 'index_file'].includes(n.type)).length

        // Top tools breakdown (for chart)
        const topTools = Object.entries(toolFreq).sort((a, b) => b[1] - a[1]).slice(0, 5)
        const maxToolCount = topTools.length > 0 ? topTools[0][1] : 1

        return { totalSessions, totalToolInvocations, mostUsedTool, avgDurationStr, errorRate, fileNodes, topTools, maxToolCount }
    }, [runs, allEvents, nodes])

    const errors   = findings.filter(f => f.severity === 'error')
    const warnings = findings.filter(f => f.severity === 'warning')
    const infos    = findings.filter(f => f.severity === 'info')
    const visibleFindings = findings.filter(f => {
        if (activeTab === 'overview') return true
        if (activeTab === 'drift') return false
        const group = AUDIT_GROUPS.find(item => item.id === activeTab)
        return group?.types?.includes(f.type as any) ?? true
    })

    return (
        <div style={{ width: '100%', height: '100%', background: 'var(--k-bg-base)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── Header ── */}
            <div style={{ padding: '18px 32px', borderBottom: '1px solid var(--k-border-subtle)', background: 'linear-gradient(180deg, rgba(15,10,30,0.9) 0%, var(--k-bg-panel) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: score >= 80 ? 'rgba(52,211,153,0.15)' : score >= 50 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', color: score >= 80 ? '#34d399' : score >= 50 ? '#f59e0b' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <HeartPulse size={19} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--k-text-primary)' }}>Context Audit</h1>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--k-text-dim)' }}>{activeWorkspace?.name ?? 'No workspace'} · local checks for provenance, navigation, instructions, and runtime trust</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {[
                        { count: errors.length,   color: '#ef4444', label: 'Critical', Icon: XCircle      },
                        { count: warnings.length, color: '#f59e0b', label: 'Warnings', Icon: AlertTriangle },
                        { count: infos.length,    color: '#60a5fa', label: 'Info',     Icon: Info         },
                    ].map(({ count, color, label, Icon }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: count > 0 ? `${color}15` : 'rgba(255,255,255,0.04)', border: `1px solid ${count > 0 ? color + '40' : 'rgba(255,255,255,0.07)'}`, fontSize: 11, fontWeight: 500, color: count > 0 ? color : 'rgba(255,255,255,0.25)' }}>
                            <Icon size={11} /><span style={{ fontWeight: 700, fontSize: 14 }}>{count}</span><span style={{ opacity: 0.7 }}>{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Body ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                        ...AUDIT_GROUPS.map(group => [group.id, group.label] as const),
                        ['drift', 'Drift'] as const,
                    ].map(([id, label]) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            style={{
                                padding: '7px 12px',
                                borderRadius: 7,
                                border: activeTab === id ? '1px solid rgba(96,165,250,0.45)' : '1px solid rgba(255,255,255,0.08)',
                                background: activeTab === id ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.03)',
                                color: activeTab === id ? '#93c5fd' : 'var(--k-text-dim)',
                                fontSize: 12,
                                cursor: 'pointer',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {contextHealth && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <OverviewCard icon={<HeartPulse size={15} />} label="AI Readiness" value={contextHealth.score} sub={contextHealth.score >= 85 ? 'Ready for agent work' : contextHealth.score >= 65 ? 'Review recommended' : 'Audit required'} color={contextHealth.score >= 80 ? '#34d399' : contextHealth.score >= 50 ? '#f59e0b' : '#ef4444'} />
                        <OverviewCard icon={<FileText size={15} />} label="Wiki Pages" value={contextHealth.metrics.wikiPages} color="#38bdf8" />
                        <OverviewCard icon={<FileText size={15} />} label="Source Docs" value={contextHealth.metrics.sourceDocs} color="#22d3ee" />
                        <OverviewCard icon={<FileText size={15} />} label="Outputs" value={contextHealth.metrics.outputArtifacts} color="#f59e0b" />
                        <OverviewCard icon={<AlertTriangle size={15} />} label="Broken Links" value={contextHealth.metrics.brokenLinks} color={contextHealth.metrics.brokenLinks > 0 ? '#ef4444' : '#34d399'} />
                        <OverviewCard icon={<BarChart3 size={15} />} label="Source Coverage" value={`${contextHealth.metrics.sourceCoveragePct}%`} color="#34d399" />
                    </div>
                )}

                {contextHealth?.contextSystem && (
                    <div style={{ background: 'var(--k-bg-panel)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>
                                Detected Context System
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {contextHealth.contextSystem.detectedConventions.length === 0 ? (
                                    <span style={{ fontSize: 12, color: 'var(--k-text-dim)' }}>No structured vault conventions detected.</span>
                                ) : contextHealth.contextSystem.detectedConventions.map(convention => (
                                    <span key={convention} style={{ fontSize: 11, color: '#93c5fd', border: '1px solid rgba(147,197,253,0.25)', background: 'rgba(96,165,250,0.08)', borderRadius: 6, padding: '4px 7px' }}>
                                        {convention}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--k-text-dim)' }}>
                            <span>Instruction files: <strong style={{ color: 'var(--k-text-secondary)' }}>{contextHealth.contextSystem.instructionFiles.length}</strong></span>
                            <span>Raw/wiki/outputs: <strong style={{ color: contextHealth.contextSystem.hasRawWikiOutputs ? '#34d399' : 'var(--k-text-dim)' }}>{contextHealth.contextSystem.hasRawWikiOutputs ? 'yes' : 'no'}</strong></span>
                            <span>Obsidian: <strong style={{ color: contextHealth.contextSystem.isObsidianVault ? '#34d399' : 'var(--k-text-dim)' }}>{contextHealth.contextSystem.isObsidianVault ? 'yes' : 'no'}</strong></span>
                        </div>
                    </div>
                )}

                {activeTab === 'drift' && (
                    <div style={{ background: 'var(--k-bg-panel)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 18px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>
                            Scan Drift
                        </div>
                        {!drift ? (
                            <div style={{ fontSize: 12, color: 'var(--k-text-dim)' }}>Run two scans to compare drift.</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                                <OverviewCard icon={<TrendingUp size={15} />} label="New Files" value={drift.newFiles.length} color="#34d399" />
                                <OverviewCard icon={<Clock size={15} />} label="Changed" value={drift.changedFiles.length} color="#f59e0b" />
                                <OverviewCard icon={<XCircle size={15} />} label="Deleted" value={drift.deletedFiles.length} color="#ef4444" />
                                <OverviewCard icon={<AlertTriangle size={15} />} label="New Findings" value={drift.newFindings.length} color="#f59e0b" />
                                <OverviewCard icon={<CheckCircle2 size={15} />} label="Resolved" value={drift.resolvedFindings.length} color="#34d399" />
                            </div>
                        )}
                    </div>
                )}

                {/* ── Section A: Agent OS Overview ── */}
                <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                        Runtime Context Signals
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <OverviewCard icon={<Activity size={15} />} label="Sessions" value={opMetrics.totalSessions} color="#a78bfa" />
                        <OverviewCard icon={<Wrench size={15} />} label="Tool Invocations" value={opMetrics.totalToolInvocations} color="#34d399" />
                        <OverviewCard
                            icon={<TrendingUp size={15} />}
                            label="Most Used Tool"
                            value={opMetrics.mostUsedTool ? opMetrics.mostUsedTool[0] : '—'}
                            sub={opMetrics.mostUsedTool ? `${opMetrics.mostUsedTool[1]} calls` : undefined}
                            color="#60a5fa"
                        />
                        <OverviewCard icon={<Clock size={15} />} label="Avg Duration" value={opMetrics.avgDurationStr} color="#fbbf24" />
                        <OverviewCard icon={<AlertTriangle size={15} />} label="Error Rate" value={`${opMetrics.errorRate}%`} color={opMetrics.errorRate > 20 ? '#ef4444' : '#34d399'} />
                        <OverviewCard icon={<FileText size={15} />} label="Context Files" value={opMetrics.fileNodes} color="#f472b6" />
                    </div>
                </div>

                {/* ── Top Tools Chart ── */}
                {opMetrics.topTools.length > 0 && (
                    <div style={{ background: 'var(--k-bg-panel)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 18px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>
                            Most Used Tools (All Sessions)
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 40px', gap: '5px 12px', alignItems: 'center' }}>
                            {opMetrics.topTools.map(([name, count], i) => {
                                const colors = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f472b6']
                                const c = colors[i % colors.length]
                                return (
                                    <div key={name} style={{ display: 'contents' }}>
                                        <span style={{ fontSize: 11, color: 'var(--k-text-dim)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                                        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 4, width: `${(count / opMetrics.maxToolCount) * 100}%`, background: c, transition: 'width 0.4s ease' }} />
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: c, textAlign: 'right' }}>{count}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ── Activity Timeline ── */}
                <ActivityTimeline runs={runs} />

                {/* ── Section B: Instruction Health ── */}
                <InstructionHealthSection
                    nodes={nodes}
                    onOpenFile={(relPath) => {
                        if (!activeWorkspace) return
                        const abs = activeWorkspace.path.endsWith('/')
                            ? activeWorkspace.path + relPath
                            : activeWorkspace.path + '/' + relPath
                        setOpenFilePath(abs)
                    }}
                />

                {/* ── Section C: Audit Findings ── */}
                {activeTab !== 'drift' && (
                <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                        {activeTab === 'overview' ? 'Prioritized Audit Queue' : `${AUDIT_GROUPS.find(group => group.id === activeTab)?.label ?? 'Context'} Findings`}
                    </div>
                    <div style={{ display: 'flex', gap: 20 }}>
                        <div style={{ width: 160, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                            <ScoreGauge score={score} />
                            <div style={{ background: 'var(--k-bg-panel)', border: '1px solid var(--k-border-subtle)', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
                                {[
                                    { label: 'Total Nodes', value: nodes.length, color: '#60a5fa' },
                                    { label: 'Total Edges', value: edges.length, color: '#a78bfa' },
                                    { label: 'Agents',      value: nodes.filter(n => n.type === 'agent').length, color: '#34d399' },
                                    { label: 'Wiki Pages',  value: nodes.filter(n => n.type === 'wiki_page').length, color: '#38bdf8' },
                                    { label: 'Sources',     value: nodes.filter(n => n.type === 'source_doc').length, color: '#22d3ee' },
                                    { label: 'Outputs',     value: nodes.filter(n => n.type === 'output_artifact').length, color: '#f59e0b' },
                                ].map(({ label, value, color }) => (
                                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 10, color: 'var(--k-text-dim)' }}>{label}</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
                                    </div>
                                ))}
                            </div>
                            {nodes.length === 0 && (
                                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 7, padding: '10px', fontSize: 11, color: 'rgba(245,158,11,0.8)', lineHeight: 1.4 }}>
                                    Open a workspace to see live health analysis.
                                </div>
                            )}
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                            {findings.length === 0 && nodes.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12, background: 'var(--k-bg-panel)', border: '1px solid var(--k-border-subtle)', borderRadius: 10 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(52,211,153,0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CheckCircle2 size={22} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--k-text-primary)', marginBottom: 4 }}>No Audit Findings</div>
                                        <div style={{ fontSize: 12, color: 'var(--k-text-dim)', maxWidth: 330, lineHeight: 1.5 }}>Kosmos did not find broken links, unsupported outputs, missing sources, or risky instruction files in this scan.</div>
                                    </div>
                                </div>
                            )}
                            {[...visibleFindings]
                                .sort((a, b) => ({ error: 0, warning: 1, info: 2 }[a.severity] - { error: 0, warning: 1, info: 2 }[b.severity]))
                                .map(f => (
                                    <FindingCard key={f.id} finding={f} onShowOnMap={() => { if (f.nodeIds.length > 0) { setSelectedNodeId(f.nodeIds[0]); navigate('/universe') } }} />
                                ))
                            }
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>
    )
}
