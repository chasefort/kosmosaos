import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Browser-only Vite build config for `npx kosmos`.
 * Builds src/renderer into out/browser/ as a standard web app.
 * The browser-api shim (src/server/browser-api.ts) is imported
 * conditionally in main.tsx when window.api is not set by Electron.
 */
export default defineConfig({
    root: 'src/renderer',
    base: '/',
    plugins: [react()],
    resolve: {
        alias: {
            '@renderer': resolve('src/renderer/src'),
            '@shared': resolve('src/shared'),
        },
    },
    build: {
        outDir: resolve('out/browser'),
        emptyOutDir: true,
        rollupOptions: {
            input: resolve('src/renderer/index.html'),
        },
    },
})
