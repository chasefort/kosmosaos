import { KosmosNode, KosmosEdge } from '../../../../shared/types'

// ─── Demo Graph ───────────────────────────────────────────────────────────────
// A realistic multi-agent coding assistant used to showcase Kosmos features
// on first launch (before user opens a real workspace).

export const DEMO_WORKSPACE_ID = '__demo__'

const _t = Date.now()
const _base = { workspaceId: DEMO_WORKSPACE_ID, createdAt: _t, updatedAt: _t }

export const DEMO_NODES: KosmosNode[] = [
    // Agents
    { ..._base, id: 'demo-agent-orchestrator', name: 'OrchestratorAgent', type: 'agent',
      description: 'Top-level coordinator. Routes tasks to specialist agents and synthesizes results.',
      source: 'static', confidence: 1.0, tags: ['orchestrator', 'core'],
      paths: ['src/agents/orchestrator.py'], meta: {} },

    { ..._base, id: 'demo-agent-coder', name: 'CodeAgent', type: 'agent',
      description: 'Writes, edits, and reviews code. Uses file tools and Bash.',
      source: 'static', confidence: 1.0, tags: ['coding', 'core'],
      paths: ['src/agents/coder.py'], meta: {} },

    { ..._base, id: 'demo-agent-researcher', name: 'ResearchAgent', type: 'agent',
      description: 'Searches the web, reads docs, and summarizes findings.',
      source: 'static', confidence: 1.0, tags: ['research'],
      paths: ['src/agents/researcher.py'], meta: {} },

    { ..._base, id: 'demo-agent-reviewer', name: 'ReviewAgent', type: 'agent',
      description: 'Reviews PRs and code for correctness, style, and security issues.',
      source: 'static', confidence: 0.9, tags: ['review'],
      paths: ['src/agents/reviewer.py'], meta: {} },

    { ..._base, id: 'demo-agent-planner', name: 'PlannerAgent', type: 'agent',
      description: 'Breaks down complex tasks into steps and creates execution plans.',
      source: 'static', confidence: 0.95, tags: ['planning'],
      paths: ['src/agents/planner.py'], meta: {} },

    // Models
    { ..._base, id: 'demo-model-opus', name: 'claude-opus-4', type: 'model',
      description: 'Highest capability model. Used for orchestration and complex reasoning.',
      source: 'static', confidence: 1.0, tags: ['anthropic', 'frontier'],
      paths: [], meta: { provider: 'anthropic' } },

    { ..._base, id: 'demo-model-sonnet', name: 'claude-sonnet-4', type: 'model',
      description: 'Balanced speed/capability. Used for coding and research tasks.',
      source: 'static', confidence: 1.0, tags: ['anthropic'],
      paths: [], meta: { provider: 'anthropic' } },

    { ..._base, id: 'demo-model-haiku', name: 'claude-haiku-4', type: 'model',
      description: 'Fast and cheap. Used for simple classification and routing.',
      source: 'static', confidence: 1.0, tags: ['anthropic', 'fast'],
      paths: [], meta: { provider: 'anthropic' } },

    // Tools
    { ..._base, id: 'demo-tool-readfile', name: 'ReadFile', type: 'tool',
      description: 'Reads contents of a file at a given path.',
      source: 'static', confidence: 1.0, tags: ['filesystem'],
      paths: ['src/tools/filesystem.py'], meta: {} },

    { ..._base, id: 'demo-tool-writefile', name: 'WriteFile', type: 'tool',
      description: 'Writes or overwrites a file at a given path.',
      source: 'static', confidence: 1.0, tags: ['filesystem'],
      paths: ['src/tools/filesystem.py'], meta: {} },

    { ..._base, id: 'demo-tool-bash', name: 'Bash', type: 'tool',
      description: 'Executes shell commands. Returns stdout and stderr.',
      source: 'static', confidence: 1.0, tags: ['shell', 'dangerous'],
      paths: ['src/tools/shell.py'], meta: {} },

    { ..._base, id: 'demo-tool-search', name: 'WebSearch', type: 'tool',
      description: 'Queries a search engine and returns results with snippets.',
      source: 'static', confidence: 1.0, tags: ['web'],
      paths: ['src/tools/search.py'], meta: {} },

    { ..._base, id: 'demo-tool-github', name: 'GitHubTool', type: 'tool',
      description: 'Creates PRs, reads issues, and manages repos via GitHub API.',
      source: 'static', confidence: 0.95, tags: ['github', 'web'],
      paths: ['src/tools/github.py'], meta: {} },

    { ..._base, id: 'demo-tool-memread', name: 'MemoryRead', type: 'tool',
      description: 'Queries the vector store for semantically similar past context.',
      source: 'static', confidence: 1.0, tags: ['memory'],
      paths: ['src/tools/memory.py'], meta: {} },

    { ..._base, id: 'demo-tool-memwrite', name: 'MemoryWrite', type: 'tool',
      description: 'Stores new information in the vector store for future recall.',
      source: 'static', confidence: 1.0, tags: ['memory'],
      paths: ['src/tools/memory.py'], meta: {} },

    // Prompts
    { ..._base, id: 'demo-prompt-system', name: 'SystemPrompt', type: 'prompt',
      description: 'Top-level system instruction for all agents. Defines persona and rules.',
      source: 'static', confidence: 1.0, tags: ['system'],
      paths: ['prompts/system.md'], meta: {} },

    { ..._base, id: 'demo-prompt-codereview', name: 'CodeReviewPrompt', type: 'prompt',
      description: 'Detailed instruction set for code review. Covers security, style, and correctness.',
      source: 'static', confidence: 0.95, tags: ['code'],
      paths: ['prompts/code_review.md'], meta: {} },

    { ..._base, id: 'demo-prompt-plan', name: 'PlannerPrompt', type: 'prompt',
      description: 'Chain-of-thought template that guides the planner toward structured task breakdown.',
      source: 'static', confidence: 0.95, tags: ['planning'],
      paths: ['prompts/planner.md'], meta: {} },

    // Memory Stores
    { ..._base, id: 'demo-memory-chroma', name: 'ChromaDB', type: 'memory_store',
      description: 'Local vector database for long-term semantic memory.',
      source: 'static', confidence: 1.0, tags: ['vector', 'persistent'],
      paths: ['memory/chroma/'], meta: { provider: 'chroma' } },

    { ..._base, id: 'demo-memory-session', name: 'SessionMemory', type: 'memory_store',
      description: 'In-memory conversation history for the current session.',
      source: 'static', confidence: 1.0, tags: ['ephemeral'],
      paths: ['src/memory/session.py'], meta: {} },

    // APIs
    { ..._base, id: 'demo-api-github', name: 'GitHubAPI', type: 'api',
      description: 'GitHub REST API v3. Manages repos, PRs, issues, and reviews.',
      source: 'static', confidence: 1.0, tags: ['external', 'github'],
      paths: [], meta: { baseUrl: 'https://api.github.com' } },

    { ..._base, id: 'demo-api-search', name: 'BraveSearchAPI', type: 'api',
      description: 'Brave Search API. Returns web results, news, and discussions.',
      source: 'static', confidence: 1.0, tags: ['external', 'web'],
      paths: [], meta: {} },

    { ..._base, id: 'demo-api-slack', name: 'SlackAPI', type: 'api',
      description: 'Slack webhooks for sending task completion notifications.',
      source: 'static', confidence: 0.85, tags: ['external', 'notification'],
      paths: [], meta: {} },
]

const _eb = { workspaceId: DEMO_WORKSPACE_ID }

export const DEMO_EDGES: KosmosEdge[] = [
    // Orchestrator calls sub-agents
    { ..._eb, id: 'de-1',  fromId: 'demo-agent-orchestrator', toId: 'demo-agent-coder',      type: 'calls',   weight: 1, meta: { reason: 'delegate coding tasks' } },
    { ..._eb, id: 'de-2',  fromId: 'demo-agent-orchestrator', toId: 'demo-agent-researcher', type: 'calls',   weight: 1, meta: { reason: 'delegate research' } },
    { ..._eb, id: 'de-3',  fromId: 'demo-agent-orchestrator', toId: 'demo-agent-reviewer',   type: 'calls',   weight: 1, meta: { reason: 'trigger code review' } },
    { ..._eb, id: 'de-4',  fromId: 'demo-agent-orchestrator', toId: 'demo-agent-planner',    type: 'calls',   weight: 1, meta: { reason: 'request task plan' } },

    // Agents use models
    { ..._eb, id: 'de-5',  fromId: 'demo-agent-orchestrator', toId: 'demo-model-opus',    type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-6',  fromId: 'demo-agent-coder',        toId: 'demo-model-sonnet',  type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-7',  fromId: 'demo-agent-researcher',   toId: 'demo-model-sonnet',  type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-8',  fromId: 'demo-agent-reviewer',     toId: 'demo-model-sonnet',  type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-9',  fromId: 'demo-agent-planner',      toId: 'demo-model-opus',    type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-10', fromId: 'demo-agent-orchestrator', toId: 'demo-model-haiku',   type: 'uses', weight: 0.5, meta: { reason: 'routing classification' } },

    // Agents use tools
    { ..._eb, id: 'de-11', fromId: 'demo-agent-coder',      toId: 'demo-tool-readfile',  type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-12', fromId: 'demo-agent-coder',      toId: 'demo-tool-writefile', type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-13', fromId: 'demo-agent-coder',      toId: 'demo-tool-bash',      type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-14', fromId: 'demo-agent-coder',      toId: 'demo-tool-github',    type: 'uses', weight: 0.8, meta: {} },
    { ..._eb, id: 'de-15', fromId: 'demo-agent-researcher', toId: 'demo-tool-search',    type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-16', fromId: 'demo-agent-researcher', toId: 'demo-tool-readfile',  type: 'uses', weight: 0.6, meta: {} },
    { ..._eb, id: 'de-17', fromId: 'demo-agent-reviewer',   toId: 'demo-tool-readfile',  type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-18', fromId: 'demo-agent-reviewer',   toId: 'demo-tool-github',    type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-19', fromId: 'demo-agent-planner',    toId: 'demo-tool-readfile',  type: 'uses', weight: 0.5, meta: {} },
    { ..._eb, id: 'de-20', fromId: 'demo-agent-orchestrator', toId: 'demo-tool-memread', type: 'reads', weight: 1, meta: {} },
    { ..._eb, id: 'de-21', fromId: 'demo-agent-orchestrator', toId: 'demo-tool-memwrite', type: 'writes', weight: 1, meta: {} },
    { ..._eb, id: 'de-22', fromId: 'demo-agent-coder',       toId: 'demo-tool-memread',  type: 'reads',  weight: 0.7, meta: {} },

    // Agents use prompts
    { ..._eb, id: 'de-23', fromId: 'demo-agent-orchestrator', toId: 'demo-prompt-system',    type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-24', fromId: 'demo-agent-coder',        toId: 'demo-prompt-system',    type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-25', fromId: 'demo-agent-reviewer',     toId: 'demo-prompt-codereview', type: 'uses', weight: 1, meta: {} },
    { ..._eb, id: 'de-26', fromId: 'demo-agent-planner',      toId: 'demo-prompt-plan',      type: 'uses', weight: 1, meta: {} },

    // Tools use APIs
    { ..._eb, id: 'de-27', fromId: 'demo-tool-github', toId: 'demo-api-github',  type: 'calls', weight: 1, meta: {} },
    { ..._eb, id: 'de-28', fromId: 'demo-tool-search', toId: 'demo-api-search',  type: 'calls', weight: 1, meta: {} },
    { ..._eb, id: 'de-29', fromId: 'demo-agent-orchestrator', toId: 'demo-api-slack', type: 'calls', weight: 0.6, meta: { reason: 'completion notifications' } },

    // Memory tools connect to stores
    { ..._eb, id: 'de-30', fromId: 'demo-tool-memread',  toId: 'demo-memory-chroma',   type: 'reads',  weight: 1, meta: {} },
    { ..._eb, id: 'de-31', fromId: 'demo-tool-memwrite', toId: 'demo-memory-chroma',   type: 'writes', weight: 1, meta: {} },
    { ..._eb, id: 'de-32', fromId: 'demo-tool-memread',  toId: 'demo-memory-session',  type: 'reads',  weight: 0.8, meta: {} },
    { ..._eb, id: 'de-33', fromId: 'demo-tool-memwrite', toId: 'demo-memory-session',  type: 'writes', weight: 0.8, meta: {} },
]
