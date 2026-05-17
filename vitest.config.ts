import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@renderer': resolve('src/renderer/src'),
            '@shared': resolve('src/shared'),
        },
    },
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],
        fileParallelism: false,
        restoreMocks: true,
        clearMocks: true,
    },
})
