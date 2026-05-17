// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react'
import { useGraphStore } from '../renderer/src/store/graph.store'

const { mockCreateGalaxyScene } = vi.hoisted(() => ({
    mockCreateGalaxyScene: vi.fn(),
}))

vi.mock('../renderer/src/universe/galaxy/galaxy-scene', () => ({
    createGalaxyScene: mockCreateGalaxyScene,
}))

import { SpiralGalaxy } from '../renderer/src/universe/galaxy/SpiralGalaxy'

describe('SpiralGalaxy init failure handling', () => {
    beforeEach(() => {
        class ResizeObserverMock {
            observe() {}
            disconnect() {}
        }

        vi.stubGlobal('ResizeObserver', ResizeObserverMock)
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 1))
        vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))

        useGraphStore.setState({
            nodes: [],
            edges: [],
            layoutNodes: {},
            liveVisibleNodesUntil: {},
            filterTypes: new Set(['agent', 'tool', 'model', 'memory_store', 'prompt', 'api', 'module']),
            searchQuery: '',
            showEdges: true,
            showEdgeLabels: true,
            pinnedNodes: new Set<string>(),
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        mockCreateGalaxyScene.mockReset()
    })

    it('reports initialization failures so the caller can fall back instead of showing a blank canvas', async () => {
        mockCreateGalaxyScene.mockRejectedValue(new Error('WebGPU init failed'))
        const onError = vi.fn()

        render(<SpiralGalaxy onError={onError} />)

        await waitFor(() => {
            expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'WebGPU init failed' }), 'init')
        })
    })
})
