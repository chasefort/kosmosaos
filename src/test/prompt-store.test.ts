import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createTestDatabase } from './helpers/test-db'
import {
    linkTraceToPromptVersions,
    runPromptExperiment,
    saveTraceAsDatasetExample,
    syncPromptVersion,
} from '../main/runtime/prompt-store'

describe('prompt store', () => {
    it('versions prompt files, links traces, and generates an experiment report', () => {
        const handle = createTestDatabase()
        const { db, dir } = handle
        const workspacePath = join(dir, 'workspace')
        mkdirSync(workspacePath, { recursive: true })
        writeFileSync(join(workspacePath, 'CLAUDE.md'), '# Prompt\n\nVersion one', 'utf-8')

        db.prepare('INSERT INTO workspaces (id, name, path, opened_at) VALUES (?, ?, ?, ?)').run('ws_prompt', 'repo', workspacePath, Date.now())
        db.prepare(`
            INSERT INTO threads (id, workspace_id, source, title, started_at, trace_count, meta)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('thread-1', 'ws_prompt', 'claude_code', 'Claude Code', 1000, 1, '{}')
        db.prepare(`
            INSERT INTO traces (id, workspace_id, source, thread_id, session_id, root_agent_name, started_at, status, event_count, meta)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run('claude_code::trace-1', 'ws_prompt', 'claude_code', 'thread-1', 'trace-1', 'Claude Code', 1000, 'completed', 1, '{}')

        const first = syncPromptVersion(db, {
            workspaceId: 'ws_prompt',
            workspacePath,
            filePath: join(workspacePath, 'CLAUDE.md'),
            content: '# Prompt\n\nVersion one',
            createdAt: 900,
            source: 'scanner',
        })
        const second = syncPromptVersion(db, {
            workspaceId: 'ws_prompt',
            workspacePath,
            filePath: join(workspacePath, 'CLAUDE.md'),
            content: '# Prompt\n\nVersion two',
            createdAt: 1100,
            source: 'editor',
        })

        expect(first?.version).toBe(1)
        expect(second?.version).toBe(2)

        linkTraceToPromptVersions(db, 'claude_code::trace-1', 'ws_prompt', 1000)
        const links = db.prepare('SELECT version_id FROM trace_prompt_versions WHERE trace_id = ?').all('claude_code::trace-1') as { version_id: string }[]
        expect(links).toHaveLength(1)
        expect(links[0].version_id).toBe(first?.versionId)

        db.prepare(`
            INSERT INTO feedback_scores (id, workspace_id, trace_id, span_id, name, value, reason, source, created_at, updated_at, meta)
            VALUES (?, ?, ?, NULL, 'quality', 4, NULL, 'ui', ?, ?, '{}')
        `).run('feedback-1', 'ws_prompt', 'claude_code::trace-1', 1200, 1200)

        const saved = saveTraceAsDatasetExample(db, 'ws_prompt', 'claude_code::trace-1')
        expect(saved.dataset.name).toBe('Workspace Examples')

        const experiment = runPromptExperiment(db, 'ws_prompt', 'CLAUDE.md')
        expect(experiment).toBeTruthy()
        expect(experiment?.versionStats.length).toBeGreaterThan(0)
        expect(experiment?.versionStats[0].exampleCount).toBeGreaterThan(0)

        handle.dispose()
    })
})
