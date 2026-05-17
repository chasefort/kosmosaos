/**
 * ReplayParticles — small spheres that travel along active edges during
 * session replay and flow tracing.  Uses InstancedMesh for GPU efficiency.
 */

import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useAppStore } from '../../store/app.store'
import { useGraphStore, useVisibleGraph } from '../../store/graph.store'
import { edgeTypeColors } from './EdgeLayer'

const PARTICLE_RADIUS = 0.18
const PARTICLE_TAIL_LENGTH = 1.9
const PARTICLE_GLOW_SCALE = 2.6
const BASE_PARTICLE_WORLD_SPEED = 9.5

interface ParticleState {
    edgeFromId: string
    edgeToId:   string
    t:          number  // 0..1 along the edge
    speed:      number
    scale:      number
    phase:      number
    color:      THREE.Color
}

const _src = new THREE.Vector3()
const _tgt = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _alt = new THREE.Vector3(1, 0, 0)
const _white = new THREE.Color('#f7fbff')

export function ReplayParticles() {
    const { visibleEdges } = useVisibleGraph()
    const layoutNodes = useGraphStore(s => s.layoutNodes)
    const edges       = useGraphStore(s => s.edges)
    const particleSpeedMulti = useGraphStore(s => s.particleSpeedMulti)
    const particleCountMulti = useGraphStore(s => s.particleCountMulti)

    const {
        replayActive, replayEvents, replayPlayhead,
        traceEdgeIds,
    } = useAppStore()

    // ── Build the active edge set from replay or trace ──────────────────────
    const activeEdgeIds = useMemo((): Set<string> => {
        const set = new Set<string>()
        // Trace always overrides replay for particle display
        if (traceEdgeIds.length > 0) {
            traceEdgeIds.forEach(id => set.add(id))
            return set
        }
        if (!replayActive || replayEvents.length === 0) return set
        // Include current and previous 3 events for a trailing effect
        for (let i = Math.max(0, replayPlayhead - 3); i <= replayPlayhead; i++) {
            const ev = replayEvents[i]
            if (!ev) continue
            // Find edges connected to activated nodes
            for (const nodeId of ev.nodeIds) {
                for (const edge of visibleEdges) {
                    if (edge.fromId === nodeId || edge.toId === nodeId) {
                        set.add(edge.id)
                    }
                }
            }
        }
        return set
    }, [replayActive, replayEvents, replayPlayhead, traceEdgeIds, visibleEdges])

    // ── Particle state — one particle per active edge ─────────────────────
    const particles = useRef<ParticleState[]>([])
    const meshRef = useRef<THREE.InstancedMesh>(null)
    const glowRef = useRef<THREE.InstancedMesh>(null)

    const maxParticles = useMemo(() => {
        let total = 0
        const countScale = Math.max(particleCountMulti, 0)

        for (const edgeId of activeEdgeIds) {
            const edge = edges.find(e => e.id === edgeId)
            if (!edge) continue
            const src = layoutNodes[edge.fromId]
            const tgt = layoutNodes[edge.toId]
            if (!src || !tgt) continue

            const baseCount = traceEdgeIds.includes(edgeId) ? 2 : 1
            const weightBonus = Math.min(Math.floor((edge.weight ?? 1) / 4), 2)
            total += Math.max(1, Math.round((baseCount + weightBonus) * Math.max(countScale, 0.35)))
        }

        return Math.max(total, 1)
    }, [activeEdgeIds, edges, layoutNodes, traceEdgeIds, particleCountMulti])

    // Rebuild particle list when active edges change
    useEffect(() => {
        const allEdges = edges
        const newParticles: ParticleState[] = []

        for (const edgeId of activeEdgeIds) {
            const edge = allEdges.find(e => e.id === edgeId)
            if (!edge) continue
            const src = layoutNodes[edge.fromId]
            const tgt = layoutNodes[edge.toId]
            if (!src || !tgt) continue

            const baseCount = traceEdgeIds.includes(edgeId) ? 2 : 1
            const weightBonus = Math.min(Math.floor((edge.weight ?? 1) / 4), 2)
            const count = Math.max(1, Math.round((baseCount + weightBonus) * Math.max(particleCountMulti, 0.35)))

            const isTrace = traceEdgeIds.includes(edgeId)
            const color = new THREE.Color(isTrace ? (edgeTypeColors[edge.type] ?? '#6ee7ff') : '#f6c453')

            for (let i = 0; i < count; i++) {
                newParticles.push({
                    edgeFromId: edge.fromId,
                    edgeToId: edge.toId,
                    t: (i / count + Math.random() * 0.18) % 1,
                    speed: BASE_PARTICLE_WORLD_SPEED * (0.88 + Math.random() * 0.3),
                    scale: 0.85 + Math.random() * 0.45,
                    phase: Math.random() * Math.PI * 2,
                    color: color.clone().lerp(_white, isTrace ? 0.16 : 0.26),
                })
            }
        }

        particles.current = newParticles
    }, [activeEdgeIds, edges, layoutNodes, traceEdgeIds, particleCountMulti])

    const dummy    = useMemo(() => new THREE.Object3D(), [])
    const glowDummy = useMemo(() => new THREE.Object3D(), [])
    const colorObj = useMemo(() => new THREE.Color(), [])

    // ── Animation loop ────────────────────────────────────────────────────
    useFrame((state, delta) => {
        const mesh = meshRef.current
        const glow = glowRef.current
        if (!mesh || !glow || particles.current.length === 0) {
            if (mesh) mesh.count = 0
            if (glow) glow.count = 0
            return
        }

        const speedScale = Math.max(particleSpeedMulti, 0)
        let idx = 0
        for (const p of particles.current) {
            const src = layoutNodes[p.edgeFromId]
            const tgt = layoutNodes[p.edgeToId]
            if (!src || !tgt) continue

            _src.set(src.x, src.y, src.z)
            _tgt.set(tgt.x, tgt.y, tgt.z)
            const edgeLength = _src.distanceTo(_tgt)
            if (edgeLength < 0.001) continue

            p.t = (p.t + delta * p.speed * speedScale / edgeLength) % 1

            const x = src.x + (tgt.x - src.x) * p.t
            const y = src.y + (tgt.y - src.y) * p.t
            const z = src.z + (tgt.z - src.z) * p.t

            dummy.position.set(x, y, z)
            _dir.subVectors(_tgt, _src).normalize()
            const dotY = Math.abs(_dir.dot(_up))
            dummy.quaternion.setFromUnitVectors(dotY > 0.999 ? _alt : _up, _dir)
            glowDummy.quaternion.copy(dummy.quaternion)

            const pulse = 0.82 + 0.18 * Math.sin(state.clock.elapsedTime * 1.8 + p.phase)
            const fadeIn = Math.min(p.t * 9, 1)
            const fadeOut = Math.min((1 - p.t) * 7, 1)
            const alpha = fadeIn * fadeOut
            const tail = PARTICLE_TAIL_LENGTH * p.scale * pulse

            dummy.scale.set(PARTICLE_RADIUS * p.scale, tail, PARTICLE_RADIUS * 0.6 * p.scale)
            dummy.updateMatrix()
            mesh.setMatrixAt(idx, dummy.matrix)

            glowDummy.position.copy(dummy.position)
            glowDummy.scale.set(
                PARTICLE_RADIUS * p.scale * PARTICLE_GLOW_SCALE,
                tail * 1.2,
                PARTICLE_RADIUS * p.scale * PARTICLE_GLOW_SCALE
            )
            glowDummy.updateMatrix()
            glow.setMatrixAt(idx, glowDummy.matrix)

            colorObj.copy(p.color).lerp(_white, 0.22).multiplyScalar((0.42 + alpha * 1.25) * pulse)
            mesh.setColorAt(idx, colorObj)

            colorObj.copy(p.color).lerp(_white, 0.4).multiplyScalar((0.12 + alpha * 0.42) * pulse)
            glow.setColorAt(idx, colorObj)

            idx++
        }

        mesh.count = idx
        glow.count = idx
        mesh.instanceMatrix.needsUpdate = true
        glow.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        if (glow.instanceColor) glow.instanceColor.needsUpdate = true
    })

    if (activeEdgeIds.size === 0) return null

    return (
        <>
            <instancedMesh ref={glowRef} args={[undefined, undefined, maxParticles]}>
                <sphereGeometry args={[1, 10, 10]} />
                <meshBasicMaterial
                    transparent
                    depthWrite={false}
                    opacity={0.25}
                    blending={THREE.AdditiveBlending}
                />
            </instancedMesh>
            <instancedMesh ref={meshRef} args={[undefined, undefined, maxParticles]}>
                <sphereGeometry args={[1, 12, 12]} />
                <meshBasicMaterial
                    transparent
                    depthWrite={false}
                    opacity={0.95}
                    blending={THREE.AdditiveBlending}
                />
            </instancedMesh>
        </>
    )
}
