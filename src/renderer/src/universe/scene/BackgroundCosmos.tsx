import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGraphStore } from '../../store/graph.store'
import { CONSTELLATION_BACKGROUND } from '../graph-visuals'

// ─── Vertex shader ─────────────────────────────────────────────────────────────
// Uses the view-space direction from the camera outward — no sphere polygon
// edges ever appear because we're walking rays not rasterizing geometry.
const vertexShader = /* glsl */`
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0); // stays at far plane
}
`

// ─── Fragment shader ──────────────────────────────────────────────────────────
const fragmentShader = /* glsl */`
precision highp float;

uniform float uTime;
uniform vec3  uBg;
uniform vec3  uNebA;   // first nebula tint (subtle)
uniform vec3  uNebB;   // second nebula region (different hue)

varying vec2 vUv;

// ── Hash — dot-product, no zero-boundary issues ─────────────────────────────
vec2 hash2(vec2 p) {
    p = vec2( dot(p, vec2(127.1,311.7)),
              dot(p, vec2(269.5,183.3)) );
    return fract(sin(p) * 43758.5453);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

// ── Smooth 2D noise ─────────────────────────────────────────────────────────
float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}

// ── FBM in 2D with low-frequency bias (large smooth blobs, not grid noise) ──
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 rot = mat2( 0.8, 0.6, -0.6, 0.8 ); // rotate each octave to break axes
    for (int i = 0; i < 7; i++) {
        v += a * noise2(p);
        p  = rot * p * 2.02;
        a *= 0.48;
    }
    return v;
}

// ── Star field (procedural, no texture needed) ──────────────────────────────
float stars(vec2 uv, float threshold) {
    vec2  c  = floor(uv * 400.0);
    float h  = hash(c);          // unique brightness per cell
    if (h < threshold) return 0.0;
    vec2  cellUv = fract(uv * 400.0) - 0.5;
    float d  = length(cellUv);
    return smoothstep(0.22, 0.0, d) * pow((h - threshold) / (1.0 - threshold), 3.0);
}

void main() {
    // Use cylindrical UV wrap to avoid polar pinching
    vec2 uv = vUv;
    float t = uTime * 0.018;

    // ── Domain-warped nebula ────────────────────────────────────────────────
    // Two different FBM scales & offsets create separate, non-overlapping blobs
    vec2 uvA = uv * vec2(2.8, 1.4) + vec2(-0.3, 0.15);
    float warpA = fbm(uvA + vec2(t, -t * 0.4));
    float nA    = fbm(uvA + warpA * 0.7 + vec2(t * 0.5, 0.2));

    vec2 uvB = uv * vec2(1.6, 2.2) + vec2(0.5, -0.4);
    float warpB = fbm(uvB + vec2(-t * 0.6, t * 0.3));
    float nB    = fbm(uvB + warpB * 0.5 - vec2(0.3, t * 0.4));

    // Keep only the upper tail of the FBM distribution (sparse, wispy look)
    float cloudA = smoothstep(0.52, 0.70, nA) * 0.55;
    float cloudB = smoothstep(0.55, 0.72, nB) * 0.45;

    // Very faint background haze across everything
    float hazeA = smoothstep(0.40, 0.60, nA) * 0.10;
    float hazeB = smoothstep(0.43, 0.62, nB) * 0.08;

    // ── Compose color ───────────────────────────────────────────────────────
    vec3 col = uBg;
    // Subtle nebula colour — mostly dark, hints of hue
    col += uNebA * hazeA;
    col += uNebB * hazeB;
    col += uNebA * cloudA;
    col += uNebB * cloudB;

    // Tiny bright cores inside dense regions
    float coreA = smoothstep(0.65, 0.80, nA) * 0.25;
    float coreB = smoothstep(0.68, 0.82, nB) * 0.20;
    col += (uNebA * 2.0 + 0.4) * coreA;
    col += (uNebB * 2.0 + 0.4) * coreB;

    // ── Stars ──────────────────────────────────────────────────────────────
    // Three layers at different densities/sizes
    float s1 = stars(uv,              0.978); // sparse large
    float s2 = stars(uv * 2.0,        0.970); // medium
    float s3 = stars(uv * 5.0 + 0.3,  0.960); // fine dust
    float star = s1 * 1.0 + s2 * 0.6 + s3 * 0.25;
    col += vec3(star); // pure white point lights

    // Clamp — keep dark, never blow out
    col = min(col, vec3(1.0));

    gl_FragColor = vec4(col, 1.0);
}
`

// ─── Theme palettes — very desaturated, dark, realistic ────────────────────
const THEMES = {
    default: {
        bg:    new THREE.Color(CONSTELLATION_BACKGROUND.base),
        nebA:  new THREE.Color(0.12, 0.06, 0.32),   // violet chart glow
        nebB:  new THREE.Color(0.04, 0.12, 0.28),   // midnight blue
    },
    nebula: {
        bg:    new THREE.Color(0.025, 0.01, 0.06),
        nebA:  new THREE.Color(0.26, 0.04, 0.24),   // dusty magenta
        nebB:  new THREE.Color(0.10, 0.04, 0.34),   // deep violet
    },
    cyberpunk: {
        bg:    new THREE.Color(0.00, 0.00, 0.00),
        nebA:  new THREE.Color(0.00, 0.14, 0.12),   // dark teal
        nebB:  new THREE.Color(0.18, 0.00, 0.10),   // dark crimson
    },
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function BackgroundCosmos() {
    const theme  = useGraphStore(s => s.theme)
    const matRef = useRef<THREE.ShaderMaterial>(null)

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uBg:   { value: new THREE.Color(THEMES.default.bg) },
        uNebA: { value: new THREE.Color(THEMES.default.nebA) },
        uNebB: { value: new THREE.Color(THEMES.default.nebB) },
    }), [])

    useFrame((state) => {
        if (!matRef.current) return
        const u = matRef.current.uniforms
        u.uTime.value = state.clock.elapsedTime

        const t = THEMES[theme] ?? THEMES.default
        u.uBg.value.lerp(t.bg, 0.03)
        u.uNebA.value.lerp(t.nebA, 0.03)
        u.uNebB.value.lerp(t.nebB, 0.03)
    })

    return (
        // Full-screen triangle — no sphere geometry so no dark-disc artifact
        <mesh frustumCulled={false} renderOrder={-100}>
            <planeGeometry args={[2, 2]} />
            <shaderMaterial
                ref={matRef}
                depthTest={false}
                depthWrite={false}
                uniforms={uniforms}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
            />
        </mesh>
    )
}
