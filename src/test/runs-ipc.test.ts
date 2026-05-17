import type { IpcMain } from 'electron'
import { registerRunsHandlers } from '../main/ipc/runs.ipc'

describe('runs ipc handlers', () => {
    it('only exposes compatibility read handlers and no direct save bypass', () => {
        const channels: string[] = []
        const ipcMain = {
            handle(channel: string) {
                channels.push(channel)
            },
        } as unknown as IpcMain

        registerRunsHandlers(ipcMain)

        expect(channels).toEqual(['runs:get-runs', 'runs:get-events'])
        expect(channels).not.toContain('runs:save-run')
        expect(channels).not.toContain('runs:save-event')
    })
})
