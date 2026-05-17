import * as THREE from 'three/webgpu'

/**
 * The earlier galaxy core ended up competing with the graph too much.
 * Keep the interface, but render no central graphic so the constellations
 * themselves become the focal point.
 */

export interface CoreLayerHandle {
    group: THREE.Group
    pulse: (intensity?: number) => void
    update: (deltaSeconds: number) => void
    dispose: () => void
}
export function createCoreLayer(): CoreLayerHandle {
    const group = new THREE.Group()

    return {
        group,
        pulse() {},
        update() {},
        dispose() {},
    }
}

export function faceCoreToCamera(coreGroup: THREE.Group, camera: THREE.Camera) {
    void coreGroup
    void camera
}
