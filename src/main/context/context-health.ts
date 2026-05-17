import type Database from 'better-sqlite3'
import {
    ContextHealthSummary,
    ContextSystemSummary,
    KosmosEdge,
    KosmosFinding,
    KosmosNode,
    WorkspaceScanSummary,
} from '../../shared/types'

const INSTRUCTION_TYPES = new Set(['prompt', 'instruction_file'])

function safeParse<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback
    try {
        return JSON.parse(value) as T
    } catch {
        return fallback
    }
}

export function parseNode(row: Record<string, unknown>): KosmosNode {
    return {
        id: row.id as string,
        name: row.name as string,
        type: row.type as KosmosNode['type'],
        source: row.source as KosmosNode['source'],
        confidence: row.confidence as number,
        description: row.description as string | undefined,
        tags: safeParse(row.tags as string, []),
        paths: safeParse(row.paths as string, []),
        workspaceId: row.workspace_id as string,
        createdAt: row.created_at as number,
        updatedAt: row.updated_at as number,
        meta: safeParse(row.meta as string, {}),
    }
}

export function parseEdge(row: Record<string, unknown>): KosmosEdge {
    return {
        id: row.id as string,
        type: row.type as KosmosEdge['type'],
        fromId: row.from_id as string,
        toId: row.to_id as string,
        workspaceId: row.workspace_id as string,
        weight: row.weight as number,
        meta: safeParse(row.meta as string, {}),
    }
}

export function parseFinding(row: Record<string, unknown>): KosmosFinding {
    const meta = safeParse<Record<string, unknown>>(row.meta as string, {})
    return {
        id: row.id as string,
        type: row.type as KosmosFinding['type'],
        severity: row.severity as KosmosFinding['severity'],
        title: row.title as string,
        description: typeof meta.description === 'string' ? meta.description : row.title as string,
        nodeIds: safeParse(row.node_ids as string, []),
        suggestion: typeof meta.suggestion === 'string' ? meta.suggestion : undefined,
    }
}

export function parseScan(row: Record<string, unknown>): WorkspaceScanSummary {
    return {
        id: row.id as string,
        workspaceId: row.workspace_id as string,
        startedAt: row.started_at as number,
        completedAt: row.completed_at as number | undefined,
        nodeCount: row.node_count as number,
        edgeCount: row.edge_count as number,
        findingCount: row.finding_count as number,
        meta: safeParse(row.meta as string, {}),
    }
}

export function computeContextFindings(nodes: KosmosNode[], edges: KosmosEdge[]): KosmosFinding[] {
    const findings: KosmosFinding[] = []
    const sourceIds = new Set(nodes.filter(n => n.type === 'source_doc').map(n => n.id))
    const contextEdgeTypes = new Set(['links_to', 'cites', 'derived_from', 'indexes', 'documents'])
    const sourceBackedIds = new Set(edges.filter(e => e.type === 'cites' || e.type === 'derived_from').map(e => e.fromId))
    const citedSourceIds = new Set(edges.filter(e => e.type === 'cites' && sourceIds.has(e.toId)).map(e => e.toId))
    const linkedContextIds = new Set(edges.filter(e => contextEdgeTypes.has(e.type)).flatMap(e => [e.fromId, e.toId]))
    const contextNodes = nodes.filter(n => ['wiki_page', 'source_doc', 'output_artifact', 'instruction_file', 'index_file', 'unresolved_link'].includes(n.type))
    const pathSet = new Set(nodes.flatMap(n => n.paths).filter(Boolean).map(path => path.replace(/\\/g, '/').replace(/^\.\/+/, '').toLowerCase()))
    const contextSystem = nodes
        .map(n => (n.meta as { contextSystem?: ContextSystemSummary })?.contextSystem)
        .find(Boolean)

    for (const node of nodes.filter(n => n.type === 'unresolved_link')) {
        findings.push({
            id: `broken_link_${node.id}`,
            type: 'broken_link',
            severity: 'error',
            title: `Broken Link: "${node.name}"`,
            description: `A Markdown or wikilink target could not be resolved in this workspace.`,
            nodeIds: [node.id],
            suggestion: 'Create the missing page or update the link target.',
        })
    }

    const wikiWithoutSource = nodes.filter(n => n.type === 'wiki_page' && !sourceBackedIds.has(n.id))
    if (wikiWithoutSource.length > 0) {
        findings.push({
            id: 'missing_source_wiki_pages',
            type: 'missing_source',
            severity: wikiWithoutSource.length > 5 ? 'warning' : 'info',
            title: `${wikiWithoutSource.length} Wiki Page${wikiWithoutSource.length > 1 ? 's' : ''} Missing Sources`,
            description: `${wikiWithoutSource.slice(0, 4).map(n => `"${n.name}"`).join(', ')}${wikiWithoutSource.length > 4 ? ` and ${wikiWithoutSource.length - 4} more` : ''} do not cite raw/source material.`,
            nodeIds: wikiWithoutSource.map(n => n.id),
            suggestion: 'Add frontmatter sources or local links into raw/source material where provenance matters.',
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
            suggestion: 'Link generated outputs back to their source docs or the wiki pages they derive from.',
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
            suggestion: 'Either cite these sources from durable pages or archive them outside the active context graph.',
        })
    }

    const orphanPages = nodes.filter(n => (n.type === 'wiki_page' || n.type === 'index_file') && !linkedContextIds.has(n.id))
    if (orphanPages.length > 0) {
        findings.push({
            id: 'orphan_context_pages',
            type: 'orphan_page',
            severity: orphanPages.length > 5 ? 'warning' : 'info',
            title: `${orphanPages.length} Orphan Context Page${orphanPages.length > 1 ? 's' : ''}`,
            description: `${orphanPages.slice(0, 4).map(n => `"${n.name}"`).join(', ')}${orphanPages.length > 4 ? ` and ${orphanPages.length - 4} more` : ''} are not connected through context links.`,
            nodeIds: orphanPages.map(n => n.id),
            suggestion: 'Add links from index pages or related concepts so agents can traverse this context.',
        })
    }

    const hasRaw = nodes.some(n => n.type === 'source_doc')
    const hasWiki = nodes.some(n => n.type === 'wiki_page')
    const hasOutput = nodes.some(n => n.type === 'output_artifact')
    const hasCompleteChain = edges.some(e => e.type === 'cites') && edges.some(e => e.type === 'derived_from')
    if (hasRaw && hasWiki && hasOutput && !hasCompleteChain) {
        findings.push({
            id: 'raw_wiki_output_gap',
            type: 'raw_wiki_output_gap',
            severity: 'error',
            title: 'Raw/Wiki/Output Flow Gap',
            description: 'This workspace has source docs, wiki pages, and outputs, but no complete provenance chain is visible.',
            nodeIds: [],
            suggestion: 'Connect raw sources to wiki pages with citations, then connect outputs to the pages or sources they derive from.',
        })
    }

    const indexDirs = new Set(nodes.filter(n => n.type === 'index_file').flatMap(n => n.paths.map(path => path.replace(/\\/g, '/').replace(/(^|\/)(index|_index|README)\.md$/i, '').replace(/\/$/, ''))))
    const importantDirs = Array.from(new Set(contextNodes.flatMap(node => node.paths.map(path => path.replace(/\\/g, '/').split('/')[0]).filter(Boolean))))
        .filter(dir => ['raw', 'source', 'sources', 'wiki', 'notes', 'concepts', 'entities', 'decisions', 'projects', 'outputs', 'deliverables', 'reports', 'drafts'].includes(dir.toLowerCase()))
    const missingIndexDirs = importantDirs.filter(dir => !indexDirs.has(dir) && !pathSet.has(`${dir.toLowerCase()}/index.md`) && !pathSet.has(`${dir.toLowerCase()}/readme.md`))
    if (contextSystem?.isMarkdownVault && missingIndexDirs.length > 0) {
        findings.push({
            id: 'missing_context_indexes',
            type: 'missing_index',
            severity: missingIndexDirs.length > 2 ? 'warning' : 'info',
            title: `${missingIndexDirs.length} Context Folder${missingIndexDirs.length > 1 ? 's' : ''} Missing Indexes`,
            description: `${missingIndexDirs.join(', ')} ${missingIndexDirs.length === 1 ? 'does' : 'do'} not have an index page to guide agents through the workspace.`,
            nodeIds: [],
            suggestion: 'Add index.md files that explain what belongs in each folder and link to the most important pages.',
        })
    }

    const thinPages = nodes.filter(n => n.type === 'wiki_page' && typeof (n.meta as any)?.size === 'number' && ((n.meta as any).size as number) < 220)
    if (thinPages.length > 0) {
        findings.push({
            id: 'thin_context_pages',
            type: 'thin_page',
            severity: 'info',
            title: `${thinPages.length} Thin Context Page${thinPages.length > 1 ? 's' : ''}`,
            description: `${thinPages.slice(0, 4).map(n => `"${n.name}"`).join(', ')}${thinPages.length > 4 ? ` and ${thinPages.length - 4} more` : ''} may not contain enough context for reliable agent use.`,
            nodeIds: thinPages.map(n => n.id),
            suggestion: 'Expand durable pages with source links, decisions, examples, or move scratch notes out of the active context graph.',
        })
    }

    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const staleNodes = nodes.filter(n => (n.type === 'wiki_page' || n.type === 'instruction_file') && n.updatedAt < monthAgo)
    if (staleNodes.length > 0) {
        findings.push({
            id: 'stale_context_pages',
            type: 'stale_page',
            severity: 'info',
            title: `${staleNodes.length} Stale Context File${staleNodes.length > 1 ? 's' : ''}`,
            description: `${staleNodes.slice(0, 4).map(n => `"${n.name}"`).join(', ')}${staleNodes.length > 4 ? ` and ${staleNodes.length - 4} more` : ''} have not changed recently.`,
            nodeIds: staleNodes.map(n => n.id),
            suggestion: 'Review stale instructions and durable pages before letting agents rely on them.',
        })
    }

    for (const node of nodes.filter(n => INSTRUCTION_TYPES.has(n.type))) {
        const analysis = (node.meta as any)?.instructionAnalysis
        if (!analysis) continue
        const estimatedTokens = typeof analysis.estimatedTokens === 'number' ? analysis.estimatedTokens : 0
        const antiPatterns = Array.isArray(analysis.antiPatterns) ? analysis.antiPatterns as string[] : []
        if (estimatedTokens > 6000) {
            findings.push({
                id: `instruction_too_long_${node.id}`,
                type: 'instruction_too_long',
                severity: 'error',
                title: `Instruction Too Long: "${node.name}"`,
                description: `"${node.name}" is about ${estimatedTokens.toLocaleString()} tokens, which is likely to crowd out useful workspace context.`,
                nodeIds: [node.id],
                suggestion: 'Split this instruction file into focused sections or linked files and keep the active control surface lean.',
            })
        } else if (estimatedTokens > 3000) {
            findings.push({
                id: `instruction_bloat_${node.id}`,
                type: 'instruction_bloat',
                severity: 'warning',
                title: `Large Instruction File: "${node.name}"`,
                description: `"${node.name}" is about ${estimatedTokens.toLocaleString()} tokens.`,
                nodeIds: [node.id],
                suggestion: 'Trim repeated guidance and move background material into linked reference pages.',
            })
        }
        if (antiPatterns.includes('no_structure')) {
            findings.push({
                id: `instruction_unstructured_${node.id}`,
                type: 'instruction_unstructured',
                severity: 'warning',
                title: `Unstructured Instruction File: "${node.name}"`,
                description: 'This instruction file has substantial content but no clear Markdown sections.',
                nodeIds: [node.id],
                suggestion: 'Add headers for role, workflow, navigation, constraints, and output expectations.',
            })
        }
        if (antiPatterns.includes('missing_navigation')) {
            findings.push({
                id: `instruction_missing_navigation_${node.id}`,
                type: 'instruction_missing_navigation',
                severity: 'warning',
                title: `Missing Navigation Map: "${node.name}"`,
                description: 'This instruction file does not clearly tell agents where to look or where to save durable context.',
                nodeIds: [node.id],
                suggestion: 'Add a short map of important folders, index files, source material, and output locations.',
            })
        }
        if (antiPatterns.includes('duplicate_content')) {
            findings.push({
                id: `instruction_duplicate_${node.id}`,
                type: 'instruction_duplicate',
                severity: 'warning',
                title: `Duplicate Instruction Content: "${node.name}"`,
                description: 'This instruction file appears to repeat a paragraph, which wastes context and can create conflicting emphasis.',
                nodeIds: [node.id],
                suggestion: 'Deduplicate repeated guidance and keep the canonical version in one section.',
            })
        }
        if (antiPatterns.includes('stale_markers')) {
            findings.push({
                id: `instruction_stale_${node.id}`,
                type: 'instruction_stale',
                severity: 'info',
                title: `Stale Markers in "${node.name}"`,
                description: 'This instruction file contains TODO/FIXME-style markers.',
                nodeIds: [node.id],
                suggestion: 'Resolve or remove unfinished instruction notes before agents use this file as policy.',
            })
        }
        const missingPaths = (Array.isArray(analysis.referencedPaths) ? analysis.referencedPaths as string[] : [])
            .map(path => path.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/$/, ''))
            .filter(path => path.length > 0 && !pathSet.has(path.toLowerCase()) && !pathSet.has(`${path.toLowerCase()}/index.md`))
        if (missingPaths.length > 0) {
            findings.push({
                id: `instruction_path_missing_${node.id}`,
                type: 'instruction_path_missing',
                severity: 'error',
                title: `Instruction References Missing Paths: "${node.name}"`,
                description: `${missingPaths.slice(0, 4).join(', ')}${missingPaths.length > 4 ? ` and ${missingPaths.length - 4} more` : ''} could not be found in the scanned workspace.`,
                nodeIds: [node.id],
                suggestion: 'Create the referenced files/folders or update the instruction file so agents do not navigate into dead ends.',
            })
        }
    }

    return findings
}

export function computeContextScore(findings: KosmosFinding[], nodeCount: number): number {
    if (nodeCount === 0) return 0
    const penalty = findings.filter(f => f.severity === 'error').length * 18
        + findings.filter(f => f.severity === 'warning').length * 9
        + findings.filter(f => f.severity === 'info').length * 2
    return Math.max(0, 100 - penalty)
}

export function buildContextHealthSummary(
    db: Database.Database,
    workspaceId: string,
    latestScan?: WorkspaceScanSummary,
): ContextHealthSummary {
    const nodes = (db.prepare('SELECT * FROM nodes WHERE workspace_id = ?').all(workspaceId) as Record<string, unknown>[]).map(parseNode)
    const edges = (db.prepare('SELECT * FROM edges WHERE workspace_id = ?').all(workspaceId) as Record<string, unknown>[]).map(parseEdge)
    const findings = computeContextFindings(nodes, edges)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    const sessionsToday = (db.prepare('SELECT COUNT(*) as count FROM traces WHERE workspace_id = ? AND started_at > ?').get(workspaceId, dayAgo) as { count: number }).count
    const activeTraces = (db.prepare("SELECT COUNT(*) as count FROM traces WHERE workspace_id = ? AND status = 'running'").get(workspaceId) as { count: number }).count

    const wikiPages = nodes.filter(n => n.type === 'wiki_page').length
    const sourceDocs = nodes.filter(n => n.type === 'source_doc').length
    const outputArtifacts = nodes.filter(n => n.type === 'output_artifact').length
    const sourceBacked = new Set(edges.filter(e => e.type === 'cites' || e.type === 'derived_from').map(e => e.fromId))
    const sourceCoveragePct = wikiPages + outputArtifacts === 0
        ? 100
        : Math.round((nodes.filter(n => (n.type === 'wiki_page' || n.type === 'output_artifact') && sourceBacked.has(n.id)).length / (wikiPages + outputArtifacts)) * 100)

    const firstContextSystem = nodes
        .map(n => (n.meta as { contextSystem?: ContextSystemSummary })?.contextSystem)
        .find(Boolean)

    return {
        score: computeContextScore(findings, nodes.length),
        findings,
        metrics: {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            wikiPages,
            sourceDocs,
            outputArtifacts,
            instructionFiles: nodes.filter(n => n.type === 'instruction_file').length,
            indexFiles: nodes.filter(n => n.type === 'index_file').length,
            brokenLinks: nodes.filter(n => n.type === 'unresolved_link').length,
            missingSourcePages: findings.find(f => f.id === 'missing_source_wiki_pages')?.nodeIds.length ?? 0,
            outputsWithoutProvenance: findings.find(f => f.id === 'outputs_without_provenance')?.nodeIds.length ?? 0,
            unusedSources: findings.find(f => f.id === 'unused_sources')?.nodeIds.length ?? 0,
            orphanPages: findings.find(f => f.id === 'orphan_context_pages')?.nodeIds.length ?? 0,
            sourceCoveragePct,
            sessionsToday,
            activeTraces,
        },
        contextSystem: firstContextSystem,
        latestScan,
    }
}
