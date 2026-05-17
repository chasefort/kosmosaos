import type { NodeType } from '../../../shared/types'

export const CONSTELLATION_BACKGROUND = {
    base: '#050712',
    clear: 0x050712,
    css: `
        radial-gradient(ellipse 90% 70% at 52% 42%, rgba(88, 45, 170, 0.16), transparent 58%),
        radial-gradient(ellipse 70% 52% at 82% 78%, rgba(37, 82, 166, 0.16), transparent 62%),
        radial-gradient(ellipse 62% 48% at 16% 22%, rgba(124, 58, 237, 0.12), transparent 56%),
        linear-gradient(180deg, #070817 0%, #03050d 62%, #040714 100%)
    `,
    panel: 'rgba(10, 8, 24, 0.84)',
    panelStrong: 'rgba(11, 8, 28, 0.94)',
    border: 'rgba(167, 139, 250, 0.22)',
    borderSoft: 'rgba(255, 255, 255, 0.08)',
}

export const NODE_COLORS: Record<NodeType, string> = {
    agent: '#fbbf24',
    tool: '#a78bfa',
    prompt: '#f472b6',
    model: '#60a5fa',
    memory_store: '#34d399',
    api: '#f87171',
    file: '#94a3b8',
    module: '#64748b',
    permission_scope: '#ef4444',
    wiki_page: '#38bdf8',
    source_doc: '#22d3ee',
    output_artifact: '#f59e0b',
    instruction_file: '#c084fc',
    index_file: '#86efac',
    unresolved_link: '#fb7185',
}

export const NODE_HEX: Record<NodeType, number> = {
    agent: 0xfbbf24,
    tool: 0xa78bfa,
    prompt: 0xf472b6,
    model: 0x60a5fa,
    memory_store: 0x34d399,
    api: 0xf87171,
    file: 0x94a3b8,
    module: 0x64748b,
    permission_scope: 0xef4444,
    wiki_page: 0x38bdf8,
    source_doc: 0x22d3ee,
    output_artifact: 0xf59e0b,
    instruction_file: 0xc084fc,
    index_file: 0x86efac,
    unresolved_link: 0xfb7185,
}

export const EDGE_COLORS: Record<string, string> = {
    calls: '#34d399',
    reads: '#a78bfa',
    uses: '#fbbf24',
    writes: '#fb7185',
    imports: '#67e8f9',
    defines: '#93c5fd',
    permits: '#86efac',
    denies: '#fca5a5',
    emits: '#f9a8d4',
    correlates: '#cbd5e1',
    links_to: '#38bdf8',
    cites: '#22d3ee',
    derived_from: '#f59e0b',
    indexes: '#86efac',
    documents: '#c084fc',
    mentions: '#cbd5e1',
}

export const EDGE_HEX: Record<string, number> = {
    calls: 0x34d399,
    reads: 0xa78bfa,
    uses: 0xfbbf24,
    writes: 0xfb7185,
    imports: 0x67e8f9,
    defines: 0x93c5fd,
    permits: 0x86efac,
    denies: 0xfca5a5,
    emits: 0xf9a8d4,
    correlates: 0xcbd5e1,
    links_to: 0x38bdf8,
    cites: 0x22d3ee,
    derived_from: 0xf59e0b,
    indexes: 0x86efac,
    documents: 0xc084fc,
    mentions: 0xcbd5e1,
}

export const LABEL_VISUALS = {
    maxAutomaticLabels: 30,
    selectedNeighborLabels: 18,
    minOpacityDistance: 980,
    fullOpacityDistance: 330,
}
