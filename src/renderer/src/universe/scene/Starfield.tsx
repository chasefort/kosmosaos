import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export function Starfield({ count = 5000, radius = 2800 }) {
    const pointsRef = useRef<THREE.Points>(null)

    const [positions, colors, sizes, phases] = useMemo(() => {
        const pos  = new Float32Array(count * 3)
        const col  = new Float32Array(count * 3)
        const size = new Float32Array(count)
        const pha  = new Float32Array(count)

        // Cosmic color palette  [r, g, b]
        const palette = [
            [1.00, 1.00, 1.00],   // pure white (brightest stars)  — 8 %
            [0.82, 0.90, 1.00],   // blue-white                    — 12%
            [0.72, 0.80, 1.00],   // soft blue                     — 14%
            [0.65, 0.70, 0.95],   // medium blue                   — 16%
            [0.58, 0.55, 0.90],   // blue-purple                   — 15%
            [0.50, 0.48, 0.80],   // dim indigo                    — 13%
            [0.88, 0.78, 1.00],   // lavender                      — 8 %
            [1.00, 0.88, 0.70],   // warm gold (rare giants)       — 3 %
            [1.00, 0.70, 0.55],   // orange (rare giants)          — 2 %
            [0.30, 0.35, 0.60],   // very dim slate                — 9 %
        ]
        // Cumulative probability thresholds for palette selection
        const thresholds = [0.08, 0.20, 0.34, 0.50, 0.65, 0.78, 0.86, 0.89, 0.91, 1.00]

        for (let i = 0; i < count; i++) {
            const u     = Math.random()
            const v     = Math.random()
            const theta = 2 * Math.PI * u
            const phi   = Math.acos(2 * v - 1)
            // Keep the absolute center (0-300) clear for the graph, scatter out to 'radius'
            const r     = 300 + Math.pow(Math.random(), 1 / 3) * (radius - 300)

            pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
            pos[i * 3 + 1] = r * Math.cos(phi)
            pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)

            // Pick colour from palette
            const rand = Math.random()
            let idx = 0
            for (let k = 0; k < thresholds.length; k++) {
                if (rand < thresholds[k]) { idx = k; break }
            }
            const [cr, cg, cb] = palette[idx]
            // Randomise brightness slightly per-star
            const brightness = 0.55 + Math.random() * 0.45
            col[i * 3]     = cr * brightness
            col[i * 3 + 1] = cg * brightness
            col[i * 3 + 2] = cb * brightness

            // Vary point size (most small, a few large)
            size[i] = Math.random() < 0.05 ? 2.5 + Math.random() * 1.5
                    : Math.random() < 0.20 ? 1.5 + Math.random() * 0.8
                    : 0.8 + Math.random() * 0.5
                    
            // Random phase for twisting
            pha[i] = Math.random() * Math.PI * 2
        }

        return [pos, col, size, pha]
    }, [count, radius])

    const materialRef = useRef<THREE.ShaderMaterial>(null)
    
    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
        }
    })

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
                <bufferAttribute attach="attributes-aColor"   count={count} array={colors}    itemSize={3} />
                <bufferAttribute attach="attributes-aSize"    count={count} array={sizes}     itemSize={1} />
                <bufferAttribute attach="attributes-aPhase"   count={count} array={phases}    itemSize={1} />
            </bufferGeometry>
            <shaderMaterial
                ref={materialRef}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                uniforms={{
                    uTime: { value: 0 }
                }}
                vertexShader={`
                    uniform float uTime;
                    attribute float aSize;
                    attribute float aPhase;
                    attribute vec3 aColor;
                    varying vec3 vColor;
                    varying float vAlpha;

                    void main() {
                        vColor = aColor;
                        // Twinkle calculation: base alpha + sine wave varying by aPhase
                        float twinkle = 0.6 + 0.4 * sin(uTime * 1.5 + aPhase);
                        vAlpha = twinkle;
                        
                        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                        gl_PointSize = aSize * (300.0 / -mvPosition.z) * (0.8 + 0.2 * twinkle);
                        gl_Position = projectionMatrix * mvPosition;
                    }
                `}
                fragmentShader={`
                    varying vec3 vColor;
                    varying float vAlpha;
                    
                    void main() {
                        // Soft circle
                        float dist = length(gl_PointCoord - vec2(0.5));
                        if (dist > 0.5) discard;
                        
                        // Soft glowing edge
                        float strength = 1.0 - (dist * 2.0);
                        strength = pow(strength, 1.5); // core is brighter
                        
                        gl_FragColor = vec4(vColor * strength, vAlpha * strength);
                    }
                `}
            />
        </points>
    )
}
