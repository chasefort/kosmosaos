import type { KosmosNode } from '../../../../shared/types'
import { TYPE_BAND } from './type-palette'

const CONSTELLATION_SCALE = 1.18
const VERTICAL_DAMPING = 0.06
const HALO_LIFT = 12

export interface Vec3 {
    x: number
    y: number
    z: number
}

/**
 * Projects a force-directed position into a flatter constellation-like sky.
 *
 * - Preserves the force-layout clustering so the graph still feels structural.
 * - Flattens the layout into a star chart instead of a galaxy spiral.
 * - Keeps only small vertical separation for halo-ish node types.
 */
export function projectToSpiral(pos: Vec3, node: KosmosNode): Vec3 {
    const band = TYPE_BAND[node.type] ?? { radius: 100, halo: 0 }
    const x = pos.x * CONSTELLATION_SCALE
    const z = pos.z * CONSTELLATION_SCALE
    const y = band.halo * HALO_LIFT + pos.y * VERTICAL_DAMPING

    return { x, y, z }
}

/** Batch version — writes into a Float32Array for GPU upload. */
export function projectBatchToSpiral(
    positions: Record<string, Vec3>,
    nodes: KosmosNode[],
    out: Float32Array,
): void {
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        const raw = positions[node.id]
        if (!raw) {
            out[i * 3] = 0
            out[i * 3 + 1] = 0
            out[i * 3 + 2] = 0
            continue
        }
        const p = projectToSpiral(raw, node)
        out[i * 3] = p.x
        out[i * 3 + 1] = p.y
        out[i * 3 + 2] = p.z
    }
}
