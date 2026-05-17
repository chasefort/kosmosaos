/**
 * SnapshotCapture — lives inside the R3F Canvas so it can access the WebGL
 * renderer. Captures the 3D canvas, overlays Kosmos branding, and copies
 * to clipboard. Also triggers a download as a fallback.
 */

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useAppStore } from '../../store/app.store'
import { useGraphStore } from '../../store/graph.store'
import { typeColors } from './NodeLayer'

export function SnapshotCapture() {
    const { gl, scene, camera } = useThree()
    const snapshotTrigger = useAppStore(s => s.snapshotTrigger)
    const activeWorkspace = useAppStore(s => s.activeWorkspace)
    const nodes = useGraphStore(s => s.nodes)
    const edges = useGraphStore(s => s.edges)
    const filterTypes = useGraphStore(s => s.filterTypes)

    useEffect(() => {
        if (snapshotTrigger === 0) return

        // Render current frame
        gl.render(scene, camera)

        const sourceCanvas = gl.domElement
        const W = sourceCanvas.width * 2
        const H = sourceCanvas.height * 2

        const canvas = document.createElement('canvas')
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext('2d')!

        // Draw 3D scene as background (scaled 2x)
        ctx.drawImage(sourceCanvas, 0, 0, W, H)

        // ── Overlay branding ──────────────────────────────────────────────

        const pad = 28
        const name = activeWorkspace?.name ?? 'workspace'

        // Top-left: workspace name
        ctx.font = `700 ${Math.round(H * 0.022)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.textBaseline = 'top'
        ctx.fillText(name, pad, pad)

        // Bottom-left: node + edge count
        const visibleNodes = nodes.filter(n => filterTypes.has(n.type))
        const countStr = `${visibleNodes.length} nodes · ${edges.length} edges`
        ctx.font = `500 ${Math.round(H * 0.016)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.textBaseline = 'bottom'
        ctx.fillText(countStr, pad, H - pad)

        // Bottom-right: "kosmos" branding
        const brandText = 'kosmos'
        ctx.font = `700 ${Math.round(H * 0.02)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.textBaseline = 'bottom'
        ctx.textAlign = 'right'
        ctx.fillText(brandText, W - pad, H - pad)
        ctx.textAlign = 'left'

        // Bottom-center: color legend
        const typeList = Array.from(filterTypes).filter(t => t !== 'file').slice(0, 6)
        if (typeList.length > 0) {
            const legendY = H - pad - Math.round(H * 0.025)
            const dotR = Math.round(H * 0.006)
            const itemW = Math.round(W * 0.09)
            const totalW = typeList.length * itemW
            let lx = (W - totalW) / 2

            ctx.font = `600 ${Math.round(H * 0.014)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
            ctx.textBaseline = 'middle'

            for (const t of typeList) {
                const color = typeColors[t] || '#ffffff'
                ctx.beginPath()
                ctx.arc(lx + dotR, legendY, dotR, 0, Math.PI * 2)
                ctx.fillStyle = color
                ctx.fill()
                ctx.fillStyle = 'rgba(255,255,255,0.55)'
                ctx.fillText(t.replace('_', ' '), lx + dotR * 2 + 5, legendY)
                lx += itemW
            }
        }

        // ── Export ─────────────────────────────────────────────────────────

        const wsName = name.replace(/\s+/g, '-')
        const filename = `kosmos-${wsName}-${Date.now()}.png`

        canvas.toBlob(async (blob) => {
            if (!blob) return

            // Copy to clipboard
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ])
                // Dispatch a custom event so GraphToolbar can show success state
                window.dispatchEvent(new CustomEvent('kosmos:snapshot-done', { detail: { ok: true } }))
            } catch {
                // Clipboard not available — fall through to download
            }

            // Also download
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()
            setTimeout(() => URL.revokeObjectURL(url), 5000)
        }, 'image/png')

    }, [snapshotTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

    return null
}
