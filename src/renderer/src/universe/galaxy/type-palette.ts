import type { NodeType } from '../../../../shared/types'
import { EDGE_HEX, NODE_HEX } from '../graph-visuals'

/**
 * Constellation-inspired palette. Keep the stars mostly white/silver and use
 * subtle type tints so the graph stays readable and polished instead of
 * turning into a saturated galaxy poster.
 */
export interface StarSpec {
    color: number
    emissive: number
}

export const NODE_TYPE_PALETTE: Record<NodeType, StarSpec> = {
    agent:            { color: NODE_HEX.agent, emissive: 1.42 },
    tool:             { color: NODE_HEX.tool, emissive: 1.22 },
    prompt:           { color: NODE_HEX.prompt, emissive: 1.18 },
    model:            { color: NODE_HEX.model, emissive: 1.3 },
    memory_store:     { color: NODE_HEX.memory_store, emissive: 1.2 },
    api:              { color: NODE_HEX.api, emissive: 1.16 },
    file:             { color: NODE_HEX.file, emissive: 0.86 },
    module:           { color: NODE_HEX.module, emissive: 0.92 },
    permission_scope: { color: NODE_HEX.permission_scope, emissive: 1.08 },
    wiki_page:        { color: NODE_HEX.wiki_page, emissive: 1.16 },
    source_doc:       { color: NODE_HEX.source_doc, emissive: 1.22 },
    output_artifact:  { color: NODE_HEX.output_artifact, emissive: 1.2 },
    instruction_file: { color: NODE_HEX.instruction_file, emissive: 1.26 },
    index_file:       { color: NODE_HEX.index_file, emissive: 1.08 },
    unresolved_link:  { color: NODE_HEX.unresolved_link, emissive: 1.28 },
}

/**
 * Small type offsets so the force layout keeps its organic shape while some
 * categories float slightly above/below the main star plane.
 */
export interface TypeBand {
    radius: number
    halo: number
}

export const TYPE_BAND: Record<NodeType, TypeBand> = {
    agent:            { radius: 0, halo: 0 },
    tool:             { radius: 0, halo: 0 },
    prompt:           { radius: 0, halo: 0.25 },
    model:            { radius: 0, halo: 0.08 },
    api:              { radius: 0, halo: -0.06 },
    memory_store:     { radius: 0, halo: 0.5 },
    permission_scope: { radius: 0, halo: -0.4 },
    file:             { radius: 0, halo: 0.12 },
    module:           { radius: 0, halo: -0.18 },
    wiki_page:        { radius: 0, halo: 0.22 },
    source_doc:       { radius: 0, halo: 0.42 },
    output_artifact:  { radius: 0, halo: -0.22 },
    instruction_file: { radius: 0, halo: 0.36 },
    index_file:       { radius: 0, halo: 0.08 },
    unresolved_link:  { radius: 0, halo: -0.46 },
}

export const EDGE_TYPE_COLORS: Record<string, number> = {
    defines: EDGE_HEX.defines,
    uses: EDGE_HEX.uses,
    calls: EDGE_HEX.calls,
    reads: EDGE_HEX.reads,
    writes: EDGE_HEX.writes,
    imports: EDGE_HEX.imports,
    permits: EDGE_HEX.permits,
    denies: EDGE_HEX.denies,
    emits: EDGE_HEX.emits,
    correlates: EDGE_HEX.correlates,
    links_to: EDGE_HEX.links_to,
    cites: EDGE_HEX.cites,
    derived_from: EDGE_HEX.derived_from,
    indexes: EDGE_HEX.indexes,
    documents: EDGE_HEX.documents,
    mentions: EDGE_HEX.mentions,
}
