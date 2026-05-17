// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react'
import { useAppStore } from '../renderer/src/store/app.store'
import { useGraphStore } from '../renderer/src/store/graph.store'

const mockUseWebGPUSupport = vi.fn<boolean | null, []>()
const spiralBehavior = { mode: 'ok' as 'ok' | 'fail-init' | 'fail-render' }

vi.mock('../renderer/src/universe/galaxy/use-webgpu-support', () => ({
    useWebGPUSupport: () => mockUseWebGPUSupport(),
}))

vi.mock('../renderer/src/universe/galaxy/SpiralGalaxy', async () => {
    const React = await import('react')

    return {
        SpiralGalaxy: ({ onError }: { onError?: (error: Error, phase: 'init' | 'render') => void }) => {
            React.useEffect(() => {
                if (spiralBehavior.mode === 'fail-init') onError?.(new Error('Spiral init failed'), 'init')
                if (spiralBehavior.mode === 'fail-render') onError?.(new Error('Spiral render failed'), 'render')
            }, [onError])

            return <div data-testid="constellation-renderer">Constellation Renderer</div>
        },
    }
})

vi.mock('../renderer/src/universe/UniverseCanvas', () => ({
    UniverseCanvas: () => <div data-testid="universe-canvas">Classic Universe</div>,
}))

vi.mock('../renderer/src/universe/galaxy/UnsupportedBrowserBanner', () => ({
    UnsupportedBrowserBanner: () => <div data-testid="webgpu-banner">Unsupported WebGPU</div>,
}))

vi.mock('../renderer/src/components/FilterPanel', () => ({
    FilterPanel: () => <div data-testid="filter-panel" />,
}))

vi.mock('../renderer/src/components/InspectorPanel', () => ({
    InspectorPanel: () => null,
}))

vi.mock('../renderer/src/universe/scene/NodeTooltip', () => ({
    NodeTooltip: () => null,
}))

vi.mock('../renderer/src/components/NodeContextMenu', () => ({
    NodeContextMenu: () => null,
}))

vi.mock('../renderer/src/components/GraphToolbar', () => ({
    GraphToolbar: () => <div data-testid="graph-toolbar" />,
}))

vi.mock('../renderer/src/components/LayoutPresetBar', () => ({
    LayoutPresetBar: () => <div data-testid="layout-preset-bar" />,
}))

vi.mock('../renderer/src/components/ReplayOverlay', () => ({
    ReplayOverlay: () => null,
}))

vi.mock('../renderer/src/components/ArchSummaryModal', () => ({
    ArchSummaryModal: () => null,
}))

vi.mock('../renderer/src/components/HelpOverlay', () => ({
    HelpOverlay: () => null,
}))

vi.mock('../renderer/src/components/LiveActivityRail', () => ({
    LiveActivityRail: () => null,
}))

import { UniverseMap } from '../renderer/src/screens/UniverseMap/UniverseMap'

describe('UniverseMap renderer selection', () => {
    beforeEach(() => {
        delete (window as typeof window & { __KOSMOS_UNIVERSE_RENDER_FALLBACK__?: string }).__KOSMOS_UNIVERSE_RENDER_FALLBACK__

        mockUseWebGPUSupport.mockReset()
        mockUseWebGPUSupport.mockReturnValue(true)
        spiralBehavior.mode = 'ok'

        useAppStore.setState({
            nodeFlashTimestamps: {},
            selectedNodeId: null,
            hoveredNodeId: null,
            contextMenu: null,
        })

        useGraphStore.setState({
            nodes: [],
            edges: [],
            layoutNodes: {},
            liveVisibleNodesUntil: {},
            filterTypes: new Set(['agent', 'tool', 'model', 'memory_store', 'prompt', 'api', 'module']),
            searchQuery: '',
            showEdges: true,
            showEdgeLabels: true,
            layoutPreset: 'force',
            pinnedNodes: new Set<string>(),
        })
    })

    it('prefers the WebGPU constellation renderer when WebGPU is supported', () => {
        render(<UniverseMap />)

        expect(screen.getByTestId('constellation-renderer')).toBeInTheDocument()
        expect(screen.queryByTestId('universe-canvas')).not.toBeInTheDocument()
        expect(screen.queryByTestId('webgpu-banner')).not.toBeInTheDocument()
    })

    it('uses the matched classic renderer when WebGPU is unavailable', () => {
        mockUseWebGPUSupport.mockReturnValue(false)

        render(<UniverseMap />)

        expect(screen.getByTestId('universe-canvas')).toBeInTheDocument()
        expect(screen.getByTestId('renderer-fallback-notice')).toHaveTextContent('WebGPU is unavailable')
        expect(screen.queryByTestId('constellation-renderer')).not.toBeInTheDocument()
        expect(screen.queryByTestId('webgpu-banner')).not.toBeInTheDocument()
    })

    it('falls back to the matched classic renderer when WebGPU initialization fails', async () => {
        spiralBehavior.mode = 'fail-init'

        render(<UniverseMap />)

        await waitFor(() => expect(screen.getByTestId('universe-canvas')).toBeInTheDocument())
        expect(screen.getByTestId('renderer-fallback-notice')).toBeInTheDocument()
        expect(screen.queryByTestId('webgpu-banner')).not.toBeInTheDocument()
    })

    it('falls back to the matched classic renderer when WebGPU rendering fails', async () => {
        spiralBehavior.mode = 'fail-render'

        render(<UniverseMap />)

        await waitFor(() => expect(screen.getByTestId('universe-canvas')).toBeInTheDocument())
        expect(screen.getByTestId('renderer-fallback-notice')).toHaveTextContent('WebGPU constellation renderer hit an issue')
        expect(screen.queryByTestId('webgpu-banner')).not.toBeInTheDocument()
    })
})
