import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Starfield } from './scene/Starfield'
import { ShootingStars } from './scene/ShootingStars'
import { NodeLayer } from './scene/NodeLayer'
import { EdgeLayer } from './scene/EdgeLayer'
import { BlastRadiusRings } from './scene/BlastRadiusRings'
import { ReplayParticles } from './scene/ReplayParticles'
import { SnapshotCapture } from './scene/SnapshotCapture'
import { BackgroundCosmos } from './scene/BackgroundCosmos'
import { useAppStore } from '../store/app.store'

import { useGraphStore } from '../store/graph.store'
import { CONSTELLATION_BACKGROUND } from './graph-visuals'

export function UniverseCanvas() {
    const theme = useGraphStore(s => s.theme)
    const bgColor = theme === 'cyberpunk' ? '#020208' : theme === 'nebula' ? '#080313' : CONSTELLATION_BACKGROUND.base

    return (
        <Canvas
            camera={{ position: [0, 0, 150], fov: 45, near: 1, far: 5000 }}
            dpr={[1, 2]}
            frameloop="always"
            gl={{ preserveDrawingBuffer: true }}   // needed for toDataURL() snapshot
            style={{ background: CONSTELLATION_BACKGROUND.css }}
        >
            <color attach="background" args={[bgColor]} />
            <BackgroundCosmos />

            <ambientLight intensity={0.2} />
            <directionalLight position={[100, 100, 50]} intensity={1} />
            <pointLight position={[-100, -100, -50]} intensity={0.5} />

            {/* Core Scene */}
            <Starfield />
            <ShootingStars />
            <NodeLayer />
            <EdgeLayer />

            {/* Feature 1: Replay + Feature 6: Trace particles */}
            <ReplayParticles />

            {/* Feature 3: Blast radius sonar rings */}
            <BlastRadiusRings />

            {/* Feature 4: Snapshot helper (invisible, just triggers PNG download) */}
            <SnapshotCapture />

            {/* Controls + camera animation */}
            <CameraController />
        </Canvas>
    )
}

/** Handles OrbitControls + smooth fly-to animation when flyToTarget is set */
function CameraController() {
    const controlsRef = useRef<any>(null)
    const { camera } = useThree()
    const flyToTarget = useAppStore(s => s.flyToTarget)
    const setFlyToTarget = useAppStore(s => s.setFlyToTarget)
    const draggingNodeId = useAppStore(s => s.draggingNodeId)
    const cameraOrbitEnabled = useAppStore(s => s.cameraOrbitEnabled)
    const layoutNodes = useGraphStore(s => s.layoutNodes)
    const fittedSignatureRef = useRef('')

    const targetPos   = useMemo(() => new THREE.Vector3(), [])
    const cameraTarget = useMemo(() => new THREE.Vector3(), [])
    const orbitCenter = useMemo(() => {
        const entries = Object.values(layoutNodes)
        if (entries.length === 0) return new THREE.Vector3()

        const center = new THREE.Vector3()
        for (const node of entries) center.add(new THREE.Vector3(node.x, node.y, node.z))
        center.divideScalar(entries.length)
        return center
    }, [layoutNodes])

    useFrame(() => {
        const layoutEntries = Object.values(layoutNodes)
        const signature = `${layoutEntries.length}:${layoutEntries.slice(0, 8).map((node: any) => `${Math.round(node.x)},${Math.round(node.y)},${Math.round(node.z)}`).join('|')}`
        if (controlsRef.current && layoutEntries.length > 0 && fittedSignatureRef.current !== signature && !flyToTarget) {
            fittedSignatureRef.current = signature
            const center = new THREE.Vector3()
            for (const node of layoutEntries as any[]) center.add(new THREE.Vector3(node.x, node.y, node.z))
            center.divideScalar(layoutEntries.length)

            let maxRadius = 80
            for (const node of layoutEntries as any[]) {
                maxRadius = Math.max(maxRadius, center.distanceTo(new THREE.Vector3(node.x, node.y, node.z)))
            }

            const distance = Math.min(2800, Math.max(260, maxRadius * 1.55))
            camera.position.set(center.x, center.y + Math.max(70, distance * 0.16), center.z + distance)
            controlsRef.current.target.copy(center)
            controlsRef.current.update()
        }

        // Fly-to animation (user double-click or replay auto-follow)
        if (flyToTarget && controlsRef.current) {
            targetPos.set(flyToTarget.x, flyToTarget.y, flyToTarget.z)
            cameraTarget.set(flyToTarget.x, flyToTarget.y + 10, flyToTarget.z + 30)

            const cam = controlsRef.current.object as THREE.PerspectiveCamera
            cam.position.lerp(cameraTarget, 0.05)
            controlsRef.current.target.lerp(targetPos, 0.05)
            controlsRef.current.update()

            if (cam.position.distanceTo(cameraTarget) < 0.5) {
                setFlyToTarget(null)
            }
        }

        if (cameraOrbitEnabled && controlsRef.current && !draggingNodeId) {
            controlsRef.current.autoRotate = true
            controlsRef.current.autoRotateSpeed = 0.4
            if (!flyToTarget) {
                controlsRef.current.target.lerp(orbitCenter, 0.04)
            }
            controlsRef.current.update()
        } else if (controlsRef.current) {
            controlsRef.current.autoRotate = false
        }
    })

    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.05}
            minDistance={10}
            maxDistance={1000}
            enabled={!draggingNodeId}
        />
    )
}
