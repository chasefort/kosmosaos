import { useEffect, useState } from 'react'
import { detectWebGPU, getCachedWebGPUResult } from './webgpu-support'

/** null = still checking, true = supported, false = unsupported */
export function useWebGPUSupport(): boolean | null {
    const [supported, setSupported] = useState<boolean | null>(getCachedWebGPUResult())

    useEffect(() => {
        if (supported !== null) return
        let cancelled = false
        detectWebGPU().then((result) => {
            if (!cancelled) setSupported(result)
        })
        return () => {
            cancelled = true
        }
    }, [supported])

    return supported
}
