import { describe, expect, it } from 'vitest'
import type { KosmosEdge, KosmosNode } from '../shared/types'
import { getSmartLabelDecisions } from '../renderer/src/universe/smart-labels'

const node = (id: string, type: KosmosNode['type'] = 'tool'): KosmosNode => ({
    id,
    name: id,
    type,
    workspaceId: 'workspace',
})

const edge = (fromId: string, toId: string): KosmosEdge => ({
    id: `${fromId}->${toId}`,
    fromId,
    toId,
    type: 'calls',
    workspaceId: 'workspace',
})

describe('getSmartLabelDecisions', () => {
    it('always shows selected, hovered, and selected-neighbor labels', () => {
        const nodes = [
            node('agent', 'agent'),
            node('tool-a'),
            node('tool-b'),
            node('prompt', 'prompt'),
        ]
        const edges = [edge('agent', 'tool-a'), edge('tool-a', 'tool-b')]

        const decisions = getSmartLabelDecisions({
            nodes,
            edges,
            selectedId: 'tool-a',
            hoveredId: 'prompt',
            maxAutomaticLabels: 0,
        })

        expect(decisions.get('tool-a')).toMatchObject({ visible: true, reason: 'selected' })
        expect(decisions.get('prompt')).toMatchObject({ visible: true, reason: 'hovered' })
        expect(decisions.get('agent')).toMatchObject({ visible: true, reason: 'neighbor' })
        expect(decisions.get('tool-b')).toMatchObject({ visible: true, reason: 'neighbor' })
    })

    it('limits automatic labels to the highest-priority graph nodes', () => {
        const nodes = [
            node('agent', 'agent'),
            node('model', 'model'),
            node('tool-a'),
            node('tool-b'),
            node('file', 'file'),
        ]
        const edges = [
            edge('agent', 'tool-a'),
            edge('agent', 'model'),
            edge('tool-a', 'tool-b'),
        ]

        const decisions = getSmartLabelDecisions({
            nodes,
            edges,
            selectedId: null,
            hoveredId: null,
            maxAutomaticLabels: 2,
        })

        expect(decisions.get('agent')).toMatchObject({ visible: true, reason: 'primary' })
        expect(decisions.get('model')).toMatchObject({ visible: true, reason: 'primary' })
        expect(decisions.get('file')).toMatchObject({ visible: false, reason: 'hidden' })
    })
})
