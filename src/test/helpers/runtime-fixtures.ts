import type { NormalizedRuntimeEvent } from '../../shared/types'

export function expectSharedSpanIdentity(events: NormalizedRuntimeEvent[]): void {
    expect(events.length).toBeGreaterThan(1)
    const spanIds = new Set(events.map(event => event.spanId))
    expect(spanIds.size).toBeLessThan(events.length + 1)
}
