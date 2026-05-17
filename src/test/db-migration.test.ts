import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { generateEdgeId, generateFileNodeId, generateNodeId } from '../shared/ids'
import { getDb, initDatabase } from '../main/storage/db'

describe('db migration v3', () => {
    it('rewrites basename-colliding file nodes to canonical path-based ids', () => {
        const dir = mkdtempSync(join(tmpdir(), 'kosmos-migrate-'))
        const dbPath = join(dir, 'kosmos.db')
        const seedDb = new Database(dbPath)

        seedDb.exec(`
            PRAGMA user_version = 2;
            CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL UNIQUE, opened_at INTEGER NOT NULL);
            CREATE TABLE nodes (
              id TEXT PRIMARY KEY,
              workspace_id TEXT NOT NULL,
              name TEXT NOT NULL,
              type TEXT NOT NULL,
              source TEXT NOT NULL,
              confidence REAL DEFAULT 1.0,
              description TEXT,
              tags TEXT DEFAULT '[]',
              paths TEXT DEFAULT '[]',
              meta TEXT DEFAULT '{}',
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            );
            CREATE TABLE edges (
              id TEXT PRIMARY KEY,
              workspace_id TEXT NOT NULL,
              type TEXT NOT NULL,
              from_id TEXT NOT NULL,
              to_id TEXT NOT NULL,
              weight REAL DEFAULT 1.0,
              meta TEXT DEFAULT '{}'
            );
            CREATE TABLE runs (
              id TEXT PRIMARY KEY,
              workspace_id TEXT NOT NULL,
              source TEXT NOT NULL,
              started_at INTEGER NOT NULL,
              ended_at INTEGER,
              event_count INTEGER DEFAULT 0,
              status TEXT DEFAULT 'running',
              meta TEXT DEFAULT '{}'
            );
            CREATE TABLE events (
              id TEXT PRIMARY KEY,
              run_id TEXT NOT NULL,
              type TEXT NOT NULL,
              phase TEXT,
              ts_ms INTEGER NOT NULL,
              agent_id TEXT,
              tool_name TEXT,
              node_ids TEXT DEFAULT '[]',
              input TEXT,
              output TEXT,
              error TEXT,
              duration_ms INTEGER
            );
            CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        `)

        seedDb.prepare('INSERT INTO workspaces (id, name, path, opened_at) VALUES (?, ?, ?, ?)').run('ws_migrate', 'repo', '/repo', Date.now())
        seedDb.prepare('INSERT INTO runs (id, workspace_id, source, started_at, event_count, status, meta) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            'claude_code::migration-1',
            'ws_migrate',
            'claude_code',
            Date.now(),
            1,
            'running',
            '{}',
        )

        const oldSrcFileId = generateNodeId('ws_migrate', 'file', 'index.ts')
        const oldTestFileId = generateNodeId('ws_migrate', 'file', 'index.ts')
        const toolId = generateNodeId('ws_migrate', 'tool', 'write_file')

        seedDb.prepare(`
            INSERT INTO nodes (id, workspace_id, name, type, source, confidence, description, tags, paths, meta, created_at, updated_at)
            VALUES (?, ?, ?, 'file', 'runtime', 1, ?, '[]', ?, '{}', ?, ?)
        `).run(oldSrcFileId, 'ws_migrate', 'index.ts', 'src file', '["src/index.ts"]', 1, 1)
        seedDb.prepare(`
            INSERT INTO nodes (id, workspace_id, name, type, source, confidence, description, tags, paths, meta, created_at, updated_at)
            VALUES (?, ?, ?, 'file', 'runtime', 1, ?, '[]', ?, '{}', ?, ?)
        `).run(`${oldTestFileId}::dup`, 'ws_migrate', 'index.ts', 'test file', '["tests/index.ts"]', 1, 1)
        seedDb.prepare(`
            INSERT INTO nodes (id, workspace_id, name, type, source, confidence, description, tags, paths, meta, created_at, updated_at)
            VALUES (?, ?, ?, 'tool', 'runtime', 1, ?, '[]', '[]', '{}', ?, ?)
        `).run(toolId, 'ws_migrate', 'write_file', 'tool', 1, 1)

        seedDb.prepare('INSERT INTO edges (id, workspace_id, type, from_id, to_id, weight, meta) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            generateEdgeId(toolId, oldSrcFileId, 'writes'),
            'ws_migrate',
            'writes',
            toolId,
            oldSrcFileId,
            1,
            '{}',
        )
        seedDb.prepare('INSERT INTO events (id, run_id, type, phase, ts_ms, node_ids) VALUES (?, ?, ?, ?, ?, ?)').run(
            'event-1',
            'claude_code::migration-1',
            'tool_call',
            'end',
            Date.now(),
            JSON.stringify([oldSrcFileId, `${oldTestFileId}::dup`]),
        )

        seedDb.close()

        initDatabase(dir)
        const db = getDb()

        const newSrcFileId = generateFileNodeId('ws_migrate', 'src/index.ts', 'index.ts')
        const newTestFileId = generateFileNodeId('ws_migrate', 'tests/index.ts', 'index.ts')

        const srcNode = db.prepare('SELECT id FROM nodes WHERE id = ?').get(newSrcFileId)
        const testNode = db.prepare('SELECT id FROM nodes WHERE id = ?').get(newTestFileId)
        const event = db.prepare('SELECT node_ids FROM events WHERE id = ?').get('event-1') as { node_ids: string }
        const rewrittenEdge = db.prepare('SELECT id, to_id FROM edges WHERE from_id = ? AND type = ?').get(toolId, 'writes') as { id: string; to_id: string }

        expect(srcNode).toBeTruthy()
        expect(testNode).toBeTruthy()
        expect(newSrcFileId).not.toBe(newTestFileId)
        expect(JSON.parse(event.node_ids)).toEqual(expect.arrayContaining([newSrcFileId, newTestFileId]))
        expect(rewrittenEdge.to_id).toBe(newSrcFileId)

        db.close()
        rmSync(dir, { recursive: true, force: true })
    })
})
