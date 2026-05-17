import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { scanWorkspace } from '../main/parser/workspace-scanner'
import { computeContextFindings } from '../main/context/context-health'

describe('context scanner', () => {
    let root: string

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'kosmos-context-scan-'))
        await mkdir(join(root, 'raw'), { recursive: true })
        await mkdir(join(root, 'wiki', 'concepts'), { recursive: true })
        await mkdir(join(root, 'outputs'), { recursive: true })

        await writeFile(join(root, 'AGENTS.md'), [
            '# Agent Instructions',
            '',
            'Use raw/, wiki/, and outputs/ for durable context.',
        ].join('\n'))

        await writeFile(join(root, 'raw', 'interview.md'), '# Interview\n\nPrimary source.')
        await writeFile(join(root, 'raw', 'unused.md'), '# Unused\n')
        await writeFile(join(root, 'wiki', 'index.md'), [
            '# Index',
            '',
            '- [[concepts/agent-context]]',
        ].join('\n'))
        await writeFile(join(root, 'wiki', 'concepts', 'agent-context.md'), [
            '---',
            'title: Agent Context',
            'aliases: [Context Layer]',
            'sources:',
            '  - ../../raw/interview.md',
            '---',
            '',
            '# Agent Context',
            '',
            'See [[Missing Page]] for a deliberately broken link.',
        ].join('\n'))
        await writeFile(join(root, 'outputs', 'plan.md'), [
            '# Plan',
            '',
            'Derived from [Agent Context](../wiki/concepts/agent-context.md).',
        ].join('\n'))
    })

    afterEach(async () => {
        await rm(root, { recursive: true, force: true })
    })

    it('classifies context files and creates provenance and broken-link graph edges', async () => {
        const { nodes, edges } = await scanWorkspace('ws_test', root)

        expect(nodes.some(node => node.type === 'instruction_file' && node.paths.includes('AGENTS.md'))).toBe(true)
        expect(nodes.some(node => node.type === 'source_doc' && node.paths.includes('raw/interview.md'))).toBe(true)
        expect(nodes.some(node => node.type === 'wiki_page' && node.name === 'Agent Context')).toBe(true)
        expect(nodes.some(node => node.type === 'output_artifact' && node.paths.includes('outputs/plan.md'))).toBe(true)
        expect(nodes.some(node => node.type === 'index_file' && node.paths.includes('wiki/index.md'))).toBe(true)
        expect(nodes.some(node => node.type === 'unresolved_link' && node.name === 'Missing Page')).toBe(true)

        const source = nodes.find(node => node.paths.includes('raw/interview.md'))!
        const wiki = nodes.find(node => node.name === 'Agent Context')!
        const output = nodes.find(node => node.paths.includes('outputs/plan.md'))!
        const unresolved = nodes.find(node => node.type === 'unresolved_link' && node.name === 'Missing Page')!

        expect(edges.some(edge => edge.type === 'cites' && edge.fromId === wiki.id && edge.toId === source.id)).toBe(true)
        expect(edges.some(edge => edge.type === 'derived_from' && edge.fromId === output.id && edge.toId === wiki.id)).toBe(true)
        expect(edges.some(edge => edge.type === 'links_to' && edge.fromId === wiki.id && edge.toId === unresolved.id)).toBe(true)
    })

    it('surfaces deterministic audit findings for weak AI context systems', async () => {
        await writeFile(join(root, 'CLAUDE.md'), [
            'These instructions intentionally have no navigation map.',
            '',
            'TODO: update this later.',
            '',
            'Repeat this exact paragraph so the optimizer can catch duplicate instruction text in the local context audit.',
            '',
            'Repeat this exact paragraph so the optimizer can catch duplicate instruction text in the local context audit.',
            '',
            'Read missing/path.md before writing reports.',
        ].join('\n'))
        await writeFile(join(root, 'outputs', 'unsupported.md'), '# Unsupported\n\nNo source links here.')

        const { nodes, edges } = await scanWorkspace('ws_test', root)
        const findings = computeContextFindings(nodes, edges)
        const types = new Set(findings.map(finding => finding.type))

        expect(types.has('broken_link')).toBe(true)
        expect(types.has('output_without_provenance')).toBe(true)
        expect(types.has('unused_source')).toBe(true)
        expect(types.has('instruction_duplicate')).toBe(true)
        expect(types.has('instruction_stale')).toBe(true)
        expect(types.has('instruction_path_missing')).toBe(true)
        expect(types.has('missing_index')).toBe(true)
    })
})
