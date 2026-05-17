import { IpcMain } from 'electron'
import { readdir, stat, readFile, writeFile } from 'fs/promises'
import { join, resolve, sep } from 'path'
import { getDb } from '../storage/db'
import { syncPromptVersion } from '../runtime/prompt-store'

/** Directories to hide from the file tree */
const SKIP_DIRS = new Set([
    'node_modules', '__pycache__', '.git', 'dist', 'build',
    '.next', '.venv', 'venv', '.mypy_cache', '.pytest_cache',
    '.ruff_cache', 'coverage', '.turbo', '.vercel', 'out'
])

/** Hidden files/dirs (starting with dot) to skip */
const SKIP_HIDDEN = true

export interface FileEntry {
    name: string
    path: string
    isDirectory: boolean
    ext: string
    size: number
    mtime: number
}

export function registerFileHandlers(ipcMain: IpcMain): void {
    /** List one level of a directory */
    ipcMain.handle('files:list-dir', async (_e, dirPath: string): Promise<FileEntry[]> => {
        try {
            const names = await readdir(dirPath)
            const results: FileEntry[] = []

            for (const name of names) {
                if (SKIP_HIDDEN && name.startsWith('.')) continue
                if (SKIP_DIRS.has(name)) continue

                const fullPath = join(dirPath, name)
                try {
                    const s = await stat(fullPath)
                    const isDirectory = s.isDirectory()
                    const ext = isDirectory ? '' : (name.includes('.') ? name.split('.').pop()! : '')
                    results.push({ name, path: fullPath, isDirectory, ext, size: s.size, mtime: s.mtimeMs })
                } catch {
                    // skip unreadable
                }
            }

            // Dirs first, then files; both alpha-sorted
            return results.sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
                return a.name.localeCompare(b.name)
            })
        } catch {
            return []
        }
    })

    /** Read a text file — restricted to the active workspace directory */
    ipcMain.handle('files:read-file', async (_e, filePath: string): Promise<string | null> => {
        try {
            const db = getDb()
            const workspaces = db.prepare('SELECT path FROM workspaces ORDER BY opened_at DESC LIMIT 1').all() as { path: string }[]
            const workspaceRoot = workspaces[0]?.path
            if (workspaceRoot) {
                const resolvedFile = resolve(filePath)
                const resolvedRoot = resolve(workspaceRoot)
                if (!resolvedFile.startsWith(resolvedRoot + sep) && resolvedFile !== resolvedRoot) {
                    return null
                }
            }
            return await readFile(filePath, 'utf-8')
        } catch {
            return null
        }
    })

    /** Write a text file — restricted to the active workspace directory */
    ipcMain.handle('files:write-file', async (_e, filePath: string, content: string): Promise<boolean> => {
        try {
            // Resolve the workspace root from DB to prevent writes outside it
            const db = getDb()
            const workspaces = db.prepare('SELECT id, path FROM workspaces ORDER BY opened_at DESC LIMIT 1').all() as { id: string; path: string }[]
            const workspaceRoot = workspaces[0]?.path
            if (workspaceRoot) {
                const resolvedFile = resolve(filePath)
                const resolvedRoot = resolve(workspaceRoot)
                if (!resolvedFile.startsWith(resolvedRoot + sep) && resolvedFile !== resolvedRoot) {
                    return false
                }
            }
            await writeFile(filePath, content, 'utf-8')
            if (workspaceRoot && workspaces[0]?.id) {
                syncPromptVersion(db, {
                    workspaceId: workspaces[0].id,
                    workspacePath: workspaceRoot,
                    filePath,
                    content,
                    source: 'editor',
                })
            }
            return true
        } catch {
            return false
        }
    })
}
