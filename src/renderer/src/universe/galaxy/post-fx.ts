import * as THREE from 'three/webgpu'
import { Fn, float, vec2, vec3, vec4, pass, screenUV, uniform, mix, dot } from 'three/tsl'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'

/**
 * Post-FX chain wrapped around the galaxy scene:
 *   scene → bloom → vignette → saturation tweak.
 *
 * No selective MRT bloom in this revision — every emissive material is
 * additive-blended already, so a global bloom on the whole scene composites
 * cleanly without blowing out the UI (which is rendered separately by React
 * over the top of the canvas).
 */

export interface PostFxHandle {
    postProcessing: THREE.PostProcessing
    render: () => Promise<void>
    setSize: (w: number, h: number) => void
    dispose: () => void
}

export function createPostFx(
    renderer: THREE.WebGPURenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
): PostFxHandle {
    const postProcessing = new THREE.PostProcessing(renderer)

    const scenePass = pass(scene, camera)
    const sceneColor = scenePass.getTextureNode('output')

    const bloomPass = bloom(sceneColor, 0.16, 0.23, 0.34)

    // Vignette around the frame edges
    const vignetteStrength = uniform(0.18)
    const vignette = Fn(() => {
        const offset = screenUV.sub(vec2(0.5, 0.5))
        const d = offset.length()
        const dim = float(1).sub(d.mul(1.25)).saturate().pow(1.4)
        return float(1).sub(vignetteStrength).add(dim.mul(vignetteStrength))
    })

    // Gentle saturation boost so constellation nodes read against the sky.
    const composed = Fn(() => {
        const c = sceneColor.add(bloomPass).rgb
        const lum = dot(c, vec3(0.2126, 0.7152, 0.0722))
        const boosted = mix(vec3(lum, lum, lum), c, float(1.035))
        const v = vignette()
        return vec4(boosted.mul(v), float(1))
    })()

    postProcessing.outputNode = composed

    return {
        postProcessing,
        async render() {
            await postProcessing.renderAsync()
        },
        setSize(w, h) {
            renderer.setSize(w, h, false)
        },
        dispose() {
            // PostProcessing in three 0.172 has no dispose method; nothing to free here.
        },
    }
}
