/**
 * terminal.ipc.ts
 *
 * PTY terminal management for embedded terminal panes.
 * Uses node-pty to spawn and manage shell processes.
 */

import { IpcMain } from 'electron'
import * as os from 'os'
import * as pty from 'node-pty'
import { broadcast } from './broadcast'

interface ActiveTerminal {
    pty: pty.IPty
    id: string
    cwd: string
}

const terminals = new Map<string, ActiveTerminal>()

function getDefaultShell(): string {
    if (os.platform() === 'win32') return 'powershell.exe'
    return process.env.SHELL || '/bin/zsh'
}

export function registerTerminalHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('terminal:spawn', (_e, opts: { id: string; cwd?: string }) => {
        const { id, cwd } = opts
        if (terminals.has(id)) return { ok: true, pid: terminals.get(id)!.pty.pid }

        const shell = getDefaultShell()
        const workDir = cwd || os.homedir()

        // Strip well-known secret env vars from the PTY environment so they
        // don't leak into shell history, logs, or accidental `env` output.
        const STRIP_VARS = [
            'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY',
            'GITHUB_TOKEN', 'GH_TOKEN',
            'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
            'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY',
            'DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
        ]
        const ptyEnv: Record<string, string> = { ...process.env as Record<string, string> }
        for (const key of STRIP_VARS) delete ptyEnv[key]

        let ptyProcess: pty.IPty
        try {
            ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: workDir,
                env: ptyEnv
            })
        } catch (e: any) {
            console.error('[terminal] Failed to spawn PTY:', e)
            broadcast('terminal:output', { id, data: `\r\nError: Failed to spawn shell: ${e.message}\r\n` })
            return { ok: false, error: e.message }
        }

        ptyProcess.onData((data) => {
            broadcast('terminal:output', { id, data })
        })

        ptyProcess.onExit(({ exitCode }) => {
            broadcast('terminal:exit', { id, exitCode })
            terminals.delete(id)
        })

        terminals.set(id, { pty: ptyProcess, id, cwd: workDir })
        return { ok: true, pid: ptyProcess.pid }
    })

    ipcMain.handle('terminal:write', (_e, id: string, data: string) => {
        const term = terminals.get(id)
        if (!term) return { ok: false, error: 'terminal not found' }
        term.pty.write(data)
        return { ok: true }
    })

    ipcMain.handle('terminal:resize', (_e, id: string, cols: number, rows: number) => {
        const term = terminals.get(id)
        if (!term) return { ok: false }
        try { term.pty.resize(cols, rows) } catch { /* ignore race conditions */ }
        return { ok: true }
    })

    ipcMain.handle('terminal:kill', (_e, id: string) => {
        const term = terminals.get(id)
        if (!term) return { ok: false }
        try { term.pty.kill() } catch { /* ignore */ }
        terminals.delete(id)
        return { ok: true }
    })

    ipcMain.handle('terminal:list', () => {
        return Array.from(terminals.values()).map(t => ({
            id: t.id,
            pid: t.pty.pid,
            cwd: t.cwd,
        }))
    })
}

export function killAllTerminals(): void {
    for (const term of terminals.values()) {
        try { term.pty.kill() } catch { /* ignore */ }
    }
    terminals.clear()
}
