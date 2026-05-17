import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { clearLiveRuntimeState, flushLivePersistence } from '../../main/ipc/live-persist'
import { getDb, initDatabase } from '../../main/storage/db'

export interface TestDatabaseHandle {
    dir: string
    path: string
    db: Database.Database
    dispose(): void
}

export function createTestDatabase(): TestDatabaseHandle {
    const dir = mkdtempSync(join(tmpdir(), 'kosmos-test-db-'))
    initDatabase(dir)
    const db = getDb()

    return {
        dir,
        path: join(dir, 'kosmos.db'),
        db,
        dispose() {
            try {
                flushLivePersistence()
            } catch {
                // ignore
            }
            clearLiveRuntimeState()
            try {
                db.close()
            } catch {
                // ignore
            }
            rmSync(dir, { recursive: true, force: true })
        },
    }
}
