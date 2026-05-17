/**
 * broadcast.ts
 *
 * Injectable broadcast function. In Electron mode, the main process sets this
 * to send over webContents. In server mode, the server sets this to send over
 * WebSocket connections.
 */

let broadcastFn: (channel: string, payload: unknown) => void = () => {}

export function setBroadcast(fn: (channel: string, payload: unknown) => void): void {
    broadcastFn = fn
}

export function broadcast(channel: string, payload: unknown): void {
    broadcastFn(channel, payload)
}
