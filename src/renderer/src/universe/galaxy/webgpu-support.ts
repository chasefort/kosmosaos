let _cached: boolean | null = null
let _pending: Promise<boolean> | null = null

export function detectWebGPU(): Promise<boolean> {
    if (_cached !== null) return Promise.resolve(_cached)
    if (_pending) return _pending

    _pending = (async () => {
        if (typeof navigator === 'undefined' || !(navigator as { gpu?: unknown }).gpu) {
            _cached = false
            return false
        }
        try {
            const gpu = (navigator as unknown as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu
            const adapter = await gpu.requestAdapter()
            _cached = !!adapter
            return _cached
        } catch {
            _cached = false
            return false
        }
    })()
    return _pending
}

export function getCachedWebGPUResult(): boolean | null {
    return _cached
}
