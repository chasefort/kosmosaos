/**
 * BlastRadiusRings — animated concentric expanding rings showing 1st/2nd/3rd
 * degree connections from the selected node.
 *
 * Two visual layers:
 *   1. Sonar-ping: a wireframe sphere that expands outward and fades (loops every 2s)
 *   2. Static tinted node colouring is handled in NodeLayer via neighborSet
 */

import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useAppStore } from '../../store/app.store'
import { useGraphStore } from '../../store/graph.store'
import { computeBlastRadius } from '../utils/graph-algorithms'

const RING_COLORS = [
    new THREE.Color('#60a5fa'),  // 1st degree — blue
    new THREE.Color('#a78bfa'),  // 2nd degree — violet
    new THREE.Color('#64748b'),  // 3rd degree — slate
]

interface PingRef {
    t: number   // 0..1 normalized progress
    ring: number  // 0,1,2 which degree
}

export function BlastRadiusRings() {
    const selectedNodeId  = useAppStore(s => s.selectedNodeId)
    const blastRadiusMode = useAppStore(s => s.blastRadiusMode)
    const layoutNodes     = useGraphStore(s => s.layoutNodes)
    const edges           = useGraphStore(s => s.edges)

    const ring1Ref = useRef<THREE.Mesh>(null)
    const ring2Ref = useRef<THREE.Mesh>(null)
    const ring3Ref = useRef<THREE.Mesh>(null)

    // ping state: staggered across 3 rings, each completing a full expand per 3s cycle
    const pings = useRef<PingRef[]>([
        { t: 0,    ring: 0 },
        { t: 0.33, ring: 1 },
        { t: 0.66, ring: 2 },
    ])

    // Blast radius distances per ring
    const blastData = useMemo(() => {
        if (!selectedNodeId || !blastRadiusMode) return null
        const lNode = layoutNodes[selectedNodeId]
        if (!lNode) return null

        const radiusMap = computeBlastRadius(selectedNodeId, edges, 3)

        // Average distance per ring
        const ringDistances = [0, 0, 0]
        const ringCounts    = [0, 0, 0]

        for (const [nodeId, depth] of radiusMap) {
            const ln = layoutNodes[nodeId]
            if (!ln) continue
            const d = Math.sqrt(
                (ln.x - lNode.x) ** 2 +
                (ln.y - lNode.y) ** 2 +
                (ln.z - lNode.z) ** 2
            )
            ringDistances[depth - 1] += d
            ringCounts[depth - 1]++
        }

        const radii = ringDistances.map((d, i) =>
            ringCounts[i] > 0 ? (d / ringCounts[i]) * 1.3 : (i + 1) * 20
        )

        const nodeCount = [
            ...Array.from(radiusMap.values()).filter(d => d === 1),
            ...Array.from(radiusMap.values()).filter(d => d === 2),
            ...Array.from(radiusMap.values()).filter(d => d === 3),
        ]

        return {
            center: new THREE.Vector3(lNode.x, lNode.y, lNode.z),
            radii,
            counts: [
                Array.from(radiusMap.values()).filter(d => d === 1).length,
                Array.from(radiusMap.values()).filter(d => d === 2).length,
                Array.from(radiusMap.values()).filter(d => d === 3).length,
            ]
        }
    }, [selectedNodeId, blastRadiusMode, layoutNodes, edges])

    const meshRefs = [ring1Ref, ring2Ref, ring3Ref]

    useFrame((_, delta) => {
        if (!blastData) return

        // Advance each ping
        pings.current.forEach((ping, i) => {
            ping.t = (ping.t + delta * 0.35) % 1  // complete cycle ~2.9s

            const ref = meshRefs[i].current
            if (!ref) return

            const targetRadius = blastData.radii[ping.ring] ?? (ping.ring + 1) * 20
            const currentRadius = ping.t * targetRadius * 1.2  // overshoot slightly

            ref.scale.setScalar(currentRadius)
            ref.position.copy(blastData.center)

            const mat = ref.material as THREE.MeshBasicMaterial
            // Opacity: ramps up fast, then fades out as it approaches outer edge
            const opacity = ping.t < 0.2
                ? ping.t / 0.2 * 0.5
                : (1 - ping.t) * 0.5
            mat.opacity = opacity
        })
    })

    if (!blastData || !blastRadiusMode || !selectedNodeId) return null

    return (
        <>
            {[ring1Ref, ring2Ref, ring3Ref].map((ref, i) => (
                <mesh key={i} ref={ref}>
                    <sphereGeometry args={[1, 24, 12]} />
                    <meshBasicMaterial
                        color={RING_COLORS[i]}
                        transparent
                        opacity={0.3}
                        depthWrite={false}
                        wireframe
                        blending={THREE.AdditiveBlending}
                    />
                </mesh>
            ))}
        </>
    )
}
