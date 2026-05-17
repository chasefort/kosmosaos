import { CONTACT_EMAIL, DOWNLOAD_URL, RELEASES_URL, REPO_URL, SITE_URL } from '../config'

// ─── Type colors — exact match to app's NodeLayer.tsx ────────────────────────
export const TYPE_COLORS: Record<string, string> = {
  agent:           '#fbbf24',
  tool:            '#a78bfa',
  prompt:          '#f472b6',
  model:           '#60a5fa',
  memory_store:    '#34d399',
  api:             '#f87171',
  module:          '#64748b',
  file:            '#94a3b8',
}

// Edge type colors — exact match to app's EdgeLayer.tsx
export const EDGE_COLORS: Record<string, string> = {
  defines:  '#60a5fa',
  uses:     '#fbbf24',
  calls:    '#34d399',
  reads:    '#a78bfa',
  writes:   '#f87171',
  imports:  '#94a3b8',
  emits:    '#f472b6',
}

export interface SiteNode {
  id: string
  label: string
  type: string
  radius: number
  parent: string | null   // null = root kosmos; 'features' = child of features
  expandable: boolean
  description: string
  tags: string[]
}

export interface SiteEdge {
  id: string
  from: string
  to: string
  type: string
}

export const NODES: SiteNode[] = [
  // ── Root ──────────────────────────────────────────────────────────────────
  {
    id: 'kosmos',
    label: 'Kosmos',
    type: 'agent',
    radius: 20,
    parent: null,
    expandable: false,
    description: 'The Operating System for AI Agents',
    tags: ['Local-first', 'Runtime visibility', 'Free beta'],
  },
  // ── Level 1 ───────────────────────────────────────────────────────────────
  {
    id: 'features',
    label: 'Features',
    type: 'module',
    radius: 14,
    parent: 'kosmos',
    expandable: true,
    description: '6 capabilities for total agent visibility',
    tags: ['3D Graph', 'Replay', 'Health', 'Terminal'],
  },
  {
    id: 'about',
    label: 'About',
    type: 'prompt',
    radius: 13,
    parent: 'kosmos',
    expandable: false,
    description: 'Why Kosmos exists and the problems it solves',
    tags: ['Mission', 'Story'],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    type: 'api',
    radius: 13,
    parent: 'kosmos',
    expandable: false,
    description: 'Session logs, live streams, HTTP ingest',
    tags: ['Session Logs', 'WebSocket', 'REST'],
  },
  {
    id: 'download',
    label: 'Get Kosmos',
    type: 'model',
    radius: 14,
    parent: 'kosmos',
    expandable: false,
    description: 'Install locally with npx · Free',
    tags: ['npx', 'macOS', 'Free', 'v0.3.0', 'kosmos-aos'],
  },
  {
    id: 'changelog',
    label: 'Changelog',
    type: 'memory_store',
    radius: 11,
    parent: 'kosmos',
    expandable: false,
    description: 'Release history and version notes',
    tags: ['v0.3.0', 'Live Control Plane'],
  },
  {
    id: 'contact',
    label: 'Contact',
    type: 'agent',
    radius: 11,
    parent: 'kosmos',
    expandable: false,
    description: 'GitHub · email · releases',
    tags: ['GitHub', 'Email', 'Releases'],
  },
  {
    id: 'blog',
    label: 'Blog',
    type: 'prompt',
    radius: 11,
    parent: 'kosmos',
    expandable: false,
    description: 'Updates, deep dives, and engineering notes',
    tags: ['Updates', 'Engineering', 'Roadmap'],
  },
  {
    id: 'privacy',
    label: 'Privacy',
    type: 'file',
    radius: 9,
    parent: 'kosmos',
    expandable: false,
    description: 'Local-first — no data leaves your machine',
    tags: ['Legal', 'Privacy'],
  },
  {
    id: 'terms',
    label: 'Terms',
    type: 'file',
    radius: 9,
    parent: 'kosmos',
    expandable: false,
    description: 'Terms of service',
    tags: ['Legal', 'Terms'],
  },
  // ── Feature children (hidden until Features expanded) ─────────────────────
  {
    id: 'universe-map',
    label: 'Universe Map',
    type: 'model',
    radius: 11,
    parent: 'features',
    expandable: false,
    description: 'Interactive 3D force-directed graph of your agent system',
    tags: ['Three.js', 'Force Graph', 'Real-time'],
  },
  {
    id: 'session-replay',
    label: 'Session Replay',
    type: 'agent',
    radius: 11,
    parent: 'features',
    expandable: false,
    description: 'Frame-by-frame replay with glowing particle flow',
    tags: ['Time Travel', 'Particles', 'Timeline'],
  },
  {
    id: 'health-analysis',
    label: 'Health Analysis',
    type: 'api',
    radius: 11,
    parent: 'features',
    expandable: false,
    description: 'God agents, orphaned nodes, over-permissioned scopes',
    tags: ['Static Analysis', 'Health Score'],
  },
  {
    id: 'flow-chart',
    label: 'Flow Chart',
    type: 'module',
    radius: 11,
    parent: 'features',
    expandable: false,
    description: 'Hierarchical 2D flowchart with Dagre auto-layout',
    tags: ['React Flow', 'Dagre', '2D'],
  },
  {
    id: 'live-streaming',
    label: 'Live Streaming',
    type: 'memory_store',
    radius: 11,
    parent: 'features',
    expandable: false,
    description: 'Embedded terminal with real-time graph updates',
    tags: ['Terminal', 'Live', 'xterm.js'],
  },
]

export const EDGES: SiteEdge[] = [
  { id: 'e-kosmos-features',     from: 'kosmos',    to: 'features',        type: 'uses'    },
  { id: 'e-kosmos-about',        from: 'kosmos',    to: 'about',           type: 'defines' },
  { id: 'e-kosmos-integrations', from: 'kosmos',    to: 'integrations',    type: 'calls'   },
  { id: 'e-kosmos-download',     from: 'kosmos',    to: 'download',        type: 'uses'    },
  { id: 'e-kosmos-changelog',    from: 'kosmos',    to: 'changelog',       type: 'reads'   },
  { id: 'e-kosmos-contact',      from: 'kosmos',    to: 'contact',         type: 'calls'   },
  { id: 'e-kosmos-blog',         from: 'kosmos',    to: 'blog',            type: 'reads'   },
  { id: 'e-kosmos-privacy',      from: 'kosmos',    to: 'privacy',         type: 'imports' },
  { id: 'e-kosmos-terms',        from: 'kosmos',    to: 'terms',           type: 'imports' },
  { id: 'e-features-universe',   from: 'features',  to: 'universe-map',    type: 'uses'    },
  { id: 'e-features-replay',     from: 'features',  to: 'session-replay',  type: 'uses'    },
  { id: 'e-features-health',     from: 'features',  to: 'health-analysis', type: 'uses'    },
  { id: 'e-features-flow',       from: 'features',  to: 'flow-chart',      type: 'uses'    },
  { id: 'e-features-live',       from: 'features',  to: 'live-streaming',  type: 'uses'    },
]

// ─── Panel content HTML for each node ─────────────────────────────────────────
export function getPanelContent(id: string): string {
  switch (id) {

    case 'kosmos': return `
      <div class="ps">
        <div class="ps-label">About</div>
        <div class="ps-text">The Operating System for AI Agents. Kosmos maps your workspace, traces runtime activity, and turns the whole system into a living 3D graph. Replay runs frame&#8209;by&#8209;frame, inspect architecture, and watch the graph light up in real time — all from one window.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Why it matters</div>
        <div class="ps-text">AI products move fast, but visibility usually lags behind. When prompts, tools, files, models, and workflows all interact at once, it becomes hard to see what happened and why. Kosmos gives you the cockpit.</div>
      </div>
      <div class="ps-stats">
        <div class="ps-stat"><div class="ps-stat-val">9</div><div class="ps-stat-lbl">Node Types</div></div>
        <div class="ps-stat"><div class="ps-stat-val">6</div><div class="ps-stat-lbl">Core Features</div></div>
        <div class="ps-stat"><div class="ps-stat-val">Free</div><div class="ps-stat-lbl">Beta Pricing</div></div>
      </div>
      <div class="ps">
        <div class="ps-label">Core capabilities</div>
        <div class="ps-connections">
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#60a5fa"></span><span class="ps-conn-name">3D Universe Map</span><span class="ps-conn-badge" style="--c:#60a5fa">visualize</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#fbbf24"></span><span class="ps-conn-name">Session Replay</span><span class="ps-conn-badge" style="--c:#fbbf24">debug</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#f87171"></span><span class="ps-conn-name">Health Analysis</span><span class="ps-conn-badge" style="--c:#f87171">monitor</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#34d399"></span><span class="ps-conn-name">Live Streaming</span><span class="ps-conn-badge" style="--c:#34d399">observe</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#64748b"></span><span class="ps-conn-name">2D Flow Chart</span><span class="ps-conn-badge" style="--c:#64748b">share</span></div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Trust</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#34d399">Built for local agent workflows</span>
          <span class="ps-tag" style="--c:#60a5fa">Local-first, no cloud</span>
          <span class="ps-tag" style="--c:#fbbf24">Free during beta</span>
          <span class="ps-tag" style="--c:#f472b6">Open Source</span>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">How to use this explorer</div>
        <div class="ps-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          Click any node in the graph to inspect it. Click <strong>Features</strong> to expand sub&#8209;nodes. Click empty space to deselect.
        </div>
      </div>
      <div class="ps-actions">
        <button class="ps-btn ps-btn-primary" id="panel-get-kosmos-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          Get Kosmos — Free
        </button>
        <a href="${REPO_URL}" target="_blank" rel="noreferrer" class="ps-btn ps-btn-ghost">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
          View on GitHub
        </a>
      </div>`

    case 'features': return `
      <div class="ps">
        <div class="ps-label">About</div>
        <div class="ps-text">Six capabilities that give you total visibility into your AI agent systems — from a living 3D map to frame&#8209;by&#8209;frame session replay. Each feature is designed to solve a specific pain point of working with AI coding agents.</div>
      </div>
      <div class="ps">
        <div class="ps-label">The challenge</div>
        <div class="ps-text">When a runtime kicks off a real task, it can trigger dozens of tool calls, model requests, and file operations. Without observability, debugging becomes log archaeology. Kosmos turns that chaos into clarity.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Capabilities · 6</div>
        <div class="ps-connections">
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#60a5fa"></span><span class="ps-conn-name">Universe Map</span><span class="ps-conn-badge" style="--c:#60a5fa">model</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#fbbf24"></span><span class="ps-conn-name">Session Replay</span><span class="ps-conn-badge" style="--c:#fbbf24">agent</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#f87171"></span><span class="ps-conn-name">Health Analysis</span><span class="ps-conn-badge" style="--c:#f87171">api</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#64748b"></span><span class="ps-conn-name">Flow Chart</span><span class="ps-conn-badge" style="--c:#64748b">module</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#34d399"></span><span class="ps-conn-name">Live Streaming</span><span class="ps-conn-badge" style="--c:#34d399">memory</span></div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Tags</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#60a5fa">3D Graph</span>
          <span class="ps-tag" style="--c:#fbbf24">Replay</span>
          <span class="ps-tag" style="--c:#f87171">Health Checks</span>
          <span class="ps-tag" style="--c:#34d399">Terminal</span>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Tip</div>
        <div class="ps-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          Click the <strong>Features</strong> node again to toggle child nodes in the graph.
        </div>
      </div>`

    case 'universe-map': return `
      <div class="ps">
        <div class="ps-label">About</div>
        <div class="ps-text">Explore your entire agent architecture in an interactive 3D force&#8209;directed graph. Every agent, tool, model, and API becomes a node. Every relationship becomes an edge. Fly through your system like navigating a galaxy.</div>
      </div>
      <div class="ps-feature-visual">
        <div class="ps-mini-graph">
          <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="g1" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#60a5fa" stop-opacity="0.2"/><stop offset="100%" stop-color="#60a5fa" stop-opacity="0"/></radialGradient>
              <radialGradient id="g2" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.2"/><stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/></radialGradient>
            </defs>
            <!-- Edges with pulse animation -->
            <line x1="160" y1="100" x2="60" y2="40" stroke="#fbbf24" stroke-opacity="0.25" stroke-width="1" class="ps-anim-edge"/>
            <line x1="160" y1="100" x2="260" y2="40" stroke="#a78bfa" stroke-opacity="0.25" stroke-width="1" class="ps-anim-edge" style="animation-delay:0.5s"/>
            <line x1="160" y1="100" x2="80" y2="160" stroke="#34d399" stroke-opacity="0.25" stroke-width="1" class="ps-anim-edge" style="animation-delay:1s"/>
            <line x1="160" y1="100" x2="240" y2="160" stroke="#f87171" stroke-opacity="0.25" stroke-width="1" class="ps-anim-edge" style="animation-delay:1.5s"/>
            <line x1="60" y1="40" x2="260" y2="40" stroke="#60a5fa" stroke-opacity="0.1" stroke-width="1" class="ps-anim-edge" style="animation-delay:2s"/>
            <line x1="80" y1="160" x2="240" y2="160" stroke="#94a3b8" stroke-opacity="0.1" stroke-width="1"/>
            <!-- Glows -->
            <circle cx="160" cy="100" r="30" fill="url(#g1)" class="ps-anim-glow"/>
            <circle cx="60" cy="40" r="18" fill="url(#g2)" class="ps-anim-glow" style="animation-delay:0.3s"/>
            <!-- Nodes -->
            <circle cx="160" cy="100" r="10" fill="#60a5fa" fill-opacity="0.9" class="ps-anim-node"/>
            <circle cx="60" cy="40" r="6" fill="#fbbf24" fill-opacity="0.9" class="ps-anim-node" style="animation-delay:0.2s"/>
            <circle cx="260" cy="40" r="6" fill="#a78bfa" fill-opacity="0.9" class="ps-anim-node" style="animation-delay:0.4s"/>
            <circle cx="80" cy="160" r="6" fill="#34d399" fill-opacity="0.9" class="ps-anim-node" style="animation-delay:0.6s"/>
            <circle cx="240" cy="160" r="6" fill="#f87171" fill-opacity="0.9" class="ps-anim-node" style="animation-delay:0.8s"/>
            <!-- Labels -->
            <text x="160" y="122" text-anchor="middle" fill="#60a5fa" font-size="9" font-family="monospace" font-weight="600">Runtime</text>
            <text x="60" y="58" text-anchor="middle" fill="#fbbf24" font-size="7" font-family="monospace">Agent</text>
            <text x="260" y="58" text-anchor="middle" fill="#a78bfa" font-size="7" font-family="monospace">Tool</text>
            <text x="80" y="178" text-anchor="middle" fill="#34d399" font-size="7" font-family="monospace">Memory</text>
            <text x="240" y="178" text-anchor="middle" fill="#f87171" font-size="7" font-family="monospace">API</text>
            <!-- Particle animation -->
            <circle r="2" fill="#ffffff" opacity="0.8">
              <animateMotion dur="3s" repeatCount="indefinite" path="M160,100 L60,40" />
            </circle>
            <circle r="2" fill="#ffffff" opacity="0.8">
              <animateMotion dur="3.5s" repeatCount="indefinite" path="M160,100 L260,40" begin="1s" />
            </circle>
            <circle r="2" fill="#ffffff" opacity="0.6">
              <animateMotion dur="4s" repeatCount="indefinite" path="M160,100 L80,160" begin="2s" />
            </circle>
          </svg>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">How it works</div>
        <div class="ps-text">Kosmos scans your codebase and available session history to automatically detect agents, tools, models, and their relationships. No manual config — just open your project and the graph appears.</div>
      </div>
      <div class="ps-stats">
        <div class="ps-stat"><div class="ps-stat-val">9</div><div class="ps-stat-lbl">Node Types</div></div>
        <div class="ps-stat"><div class="ps-stat-val">10</div><div class="ps-stat-lbl">Edge Types</div></div>
        <div class="ps-stat"><div class="ps-stat-val">60fps</div><div class="ps-stat-lbl">Render</div></div>
      </div>
      <div class="ps">
        <div class="ps-label">Capabilities</div>
        <div class="ps-connections">
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#60a5fa"></span><span class="ps-conn-name">Orbit, zoom, fly through</span><span class="ps-conn-badge" style="--c:#60a5fa">camera</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#fbbf24"></span><span class="ps-conn-name">Highlight neighbors on hover</span><span class="ps-conn-badge" style="--c:#fbbf24">select</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#34d399"></span><span class="ps-conn-name">Auto&#8209;layout with force physics</span><span class="ps-conn-badge" style="--c:#34d399">layout</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#a78bfa"></span><span class="ps-conn-name">Export as PNG snapshot</span><span class="ps-conn-badge" style="--c:#a78bfa">export</span></div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Tags</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#60a5fa">Three.js</span>
          <span class="ps-tag" style="--c:#60a5fa">Force Graph</span>
          <span class="ps-tag" style="--c:#60a5fa">Real-time</span>
          <span class="ps-tag" style="--c:#60a5fa">WebGL</span>
        </div>
      </div>`

    case 'session-replay': return `
      <div class="ps">
        <div class="ps-label">About</div>
        <div class="ps-text">Scrub through agent execution traces like a video timeline. Watch glowing particles flow through the 3D graph showing exactly which nodes were active at each frame. Find exactly where a session went wrong in seconds, not hours.</div>
      </div>
      <div class="ps-replay-preview ps-anim-replay">
        <div class="ps-replay-track">
          <div class="ps-replay-bar"></div>
          <div class="ps-replay-head"></div>
        </div>
        <div class="ps-replay-events">
          <span class="ps-replay-dot" style="--c:#60a5fa; --l:8%"></span>
          <span class="ps-replay-dot" style="--c:#fbbf24; --l:18%"></span>
          <span class="ps-replay-dot" style="--c:#a78bfa; --l:32%"></span>
          <span class="ps-replay-dot" style="--c:#f87171; --l:48%"></span>
          <span class="ps-replay-dot" style="--c:#34d399; --l:62%"></span>
          <span class="ps-replay-dot" style="--c:#fbbf24; --l:75%"></span>
          <span class="ps-replay-dot" style="--c:#60a5fa; --l:88%"></span>
        </div>
        <div class="ps-replay-meta">
          <span class="ps-mono">00:00</span>
          <span class="ps-mono ps-replay-speed">1.0×</span>
          <span class="ps-mono">02:34</span>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">How it works</div>
        <div class="ps-text">Import a saved session log and Kosmos places every event — tool calls, model responses, errors, and file activity — on a timeline. Hit play and watch particles trace the execution path on the 3D graph.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Event types captured</div>
        <div class="ps-connections">
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#60a5fa"></span><span class="ps-conn-name">model_call</span><span class="ps-conn-badge" style="--c:#60a5fa">model</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#a78bfa"></span><span class="ps-conn-name">tool_call</span><span class="ps-conn-badge" style="--c:#a78bfa">tool</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#fbbf24"></span><span class="ps-conn-name">agent_response</span><span class="ps-conn-badge" style="--c:#fbbf24">agent</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#f87171"></span><span class="ps-conn-name">error</span><span class="ps-conn-badge" style="--c:#f87171">error</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#34d399"></span><span class="ps-conn-name">tool_result</span><span class="ps-conn-badge" style="--c:#34d399">result</span></div>
        </div>
      </div>
      <div class="ps-stats">
        <div class="ps-stat"><div class="ps-stat-val">0.25×</div><div class="ps-stat-lbl">Min speed</div></div>
        <div class="ps-stat"><div class="ps-stat-val">2×</div><div class="ps-stat-lbl">Max speed</div></div>
        <div class="ps-stat"><div class="ps-stat-val">∞</div><div class="ps-stat-lbl">Events</div></div>
      </div>
      <div class="ps">
        <div class="ps-label">Tags</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#fbbf24">Time Travel</span>
          <span class="ps-tag" style="--c:#fbbf24">Particles</span>
          <span class="ps-tag" style="--c:#fbbf24">JSONL Import</span>
          <span class="ps-tag" style="--c:#fbbf24">Frame-by-Frame</span>
        </div>
      </div>`

    case 'health-analysis': return `
      <div class="ps">
        <div class="ps-label">About</div>
        <div class="ps-text">Automatic static analysis surfaces problems before they become incidents. Kosmos scans for god agents, orphaned nodes, over&#8209;permissioned scopes, and more — each finding with a severity and a suggested fix.</div>
      </div>
      <div class="ps-health">
        <div class="ps-health-score">
          <svg viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="5"/>
            <circle cx="40" cy="40" r="32" fill="none" stroke="#10b981" stroke-width="5"
              stroke-dasharray="151 50" stroke-dashoffset="50" stroke-linecap="round"
              transform="rotate(-90 40 40)" class="ps-anim-ring"/>
          </svg>
          <span class="ps-health-num">78</span>
        </div>
        <div class="ps-findings">
          <div class="ps-finding ps-finding--error"><span class="ps-finding-dot"></span>God Agent: MainOrchestrator<span class="ps-finding-badge">Critical</span></div>
          <div class="ps-finding ps-finding--warn"><span class="ps-finding-dot"></span>Orphaned: LegacyTool<span class="ps-finding-badge">Warning</span></div>
          <div class="ps-finding ps-finding--info"><span class="ps-finding-dot"></span>Broad scope: admin/*<span class="ps-finding-badge">Info</span></div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">How it works</div>
        <div class="ps-text">Every time you open a workspace, Kosmos runs a set of heuristic checks against your agent graph. It looks for structural anti&#8209;patterns — one agent that does everything (god agent), tools that nothing calls (orphaned), and scopes that are too broad.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Checks performed</div>
        <div class="ps-connections">
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#ef4444"></span><span class="ps-conn-name">God Agent detection</span><span class="ps-conn-badge" style="--c:#ef4444">critical</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#f59e0b"></span><span class="ps-conn-name">Orphaned node scan</span><span class="ps-conn-badge" style="--c:#f59e0b">warning</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#f59e0b"></span><span class="ps-conn-name">Circular dependency check</span><span class="ps-conn-badge" style="--c:#f59e0b">warning</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#60a5fa"></span><span class="ps-conn-name">Scope breadth analysis</span><span class="ps-conn-badge" style="--c:#60a5fa">info</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#60a5fa"></span><span class="ps-conn-name">Error rate tracking</span><span class="ps-conn-badge" style="--c:#60a5fa">info</span></div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Tags</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#f87171">Static Analysis</span>
          <span class="ps-tag" style="--c:#f87171">Health Score</span>
          <span class="ps-tag" style="--c:#f87171">Auto Findings</span>
          <span class="ps-tag" style="--c:#f87171">Suggested Fixes</span>
        </div>
      </div>`

    case 'flow-chart': return `
      <div class="ps">
        <div class="ps-label">About</div>
        <div class="ps-text">Switch from the 3D graph to a clean 2D hierarchical flowchart using Dagre auto&#8209;layout. Perfect for sharing with teammates, adding to documentation, or understanding call hierarchies at a glance.</div>
      </div>
      <div class="ps-flow-preview ps-anim-flow">
        <div class="ps-flow-node ps-flow-agent ps-anim-flow-node" style="animation-delay:0s">CodeAgent</div>
        <div style="color:var(--k-text-dim);font-size:10px">↓ calls ↓</div>
        <div class="ps-flow-row">
          <div class="ps-flow-node ps-flow-tool ps-anim-flow-node" style="animation-delay:0.2s">ReadFile</div>
          <div class="ps-flow-node ps-flow-tool ps-anim-flow-node" style="animation-delay:0.4s">WriteFile</div>
          <div class="ps-flow-node ps-flow-tool ps-anim-flow-node" style="animation-delay:0.6s">Bash</div>
        </div>
        <div style="color:var(--k-text-dim);font-size:10px">↓ uses ↓</div>
        <div class="ps-flow-node ps-flow-model ps-anim-flow-node" style="animation-delay:0.8s">Primary Model</div>
      </div>
      <div class="ps">
        <div class="ps-label">How it works</div>
        <div class="ps-text">One click toggles between the immersive 3D Universe Map and the structured 2D Flow Chart. The same data, two different perspectives. Export the flowchart as a PNG to share with your team.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Capabilities</div>
        <div class="ps-connections">
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#64748b"></span><span class="ps-conn-name">Automatic Dagre layout</span><span class="ps-conn-badge" style="--c:#64748b">layout</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#64748b"></span><span class="ps-conn-name">Color&#8209;coded by node type</span><span class="ps-conn-badge" style="--c:#64748b">visual</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#64748b"></span><span class="ps-conn-name">Edge labels show relationship</span><span class="ps-conn-badge" style="--c:#64748b">edges</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#64748b"></span><span class="ps-conn-name">PNG snapshot export</span><span class="ps-conn-badge" style="--c:#64748b">export</span></div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Tags</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#64748b">React Flow</span>
          <span class="ps-tag" style="--c:#64748b">Dagre Layout</span>
          <span class="ps-tag" style="--c:#64748b">PNG Export</span>
          <span class="ps-tag" style="--c:#64748b">2D View</span>
        </div>
      </div>`

    case 'live-streaming': return `
      <div class="ps">
        <div class="ps-label">About</div>
        <div class="ps-text">Run your workflow in a built&#8209;in terminal pane. Every tool call, model response, and error fires a particle on the 3D graph in real&#8209;time. Watch your agent system light up as it works — without switching windows.</div>
      </div>
      <div class="ps-terminal ps-anim-terminal">
        <div class="ps-term-bar">
          <span style="background:#ef4444"></span>
          <span style="background:#f59e0b"></span>
          <span style="background:#10b981"></span>
          <span class="ps-term-title">bash — Kosmos</span>
        </div>
        <div class="ps-term-body">
          <div class="ps-term-line"><span class="ps-term-prompt">~</span> <span class="ps-term-cmd">npx kosmos-aos ./my-project</span></div>
          <div class="ps-term-line ps-term-out">Kosmos running at http://localhost:5588</div>
          <div class="ps-term-line ps-term-out">Workspace: /Users/dev/my-project</div>
          <div class="ps-term-line"><span class="ps-term-prompt">~</span> <span class="ps-term-cmd">agent run</span></div>
          <div class="ps-term-line ps-term-out">Runtime connected — ready</div>
          <div class="ps-term-line ps-term-flash ps-anim-term-line" style="animation-delay:0s"><span class="ps-term-ev">⬡</span> tool_call: ReadFile → src/index.ts</div>
          <div class="ps-term-line ps-term-flash ps-anim-term-line" style="animation-delay:0.8s"><span class="ps-term-ev">⬡</span> model_call: primary-model</div>
          <div class="ps-term-line ps-term-flash ps-anim-term-line" style="animation-delay:1.6s"><span class="ps-term-ev">⬡</span> tool_call: WriteFile → src/utils.ts</div>
          <div class="ps-term-line ps-term-flash ps-anim-term-line" style="animation-delay:2.4s"><span class="ps-term-ev">⬡</span> tool_call: Bash → npm test</div>
          <div class="ps-term-line"><span class="ps-term-prompt">~</span> <span class="ps-term-cursor">▋</span></div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">How it works</div>
        <div class="ps-text">Kosmos watches for new runtime events and imported session history. When a new tool call or model call appears, it fires a glowing particle along the matching edge in the 3D graph. Events can also stream in through HTTP or WebSocket integrations.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Event pipeline</div>
        <div class="ps-connections">
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#34d399"></span><span class="ps-conn-name">Imported session logs</span><span class="ps-conn-badge" style="--c:#34d399">source</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#a78bfa"></span><span class="ps-conn-name">Live event stream</span><span class="ps-conn-badge" style="--c:#a78bfa">stream</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#38bdf8"></span><span class="ps-conn-name">HTTP Ingest endpoint</span><span class="ps-conn-badge" style="--c:#38bdf8">rest</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#60a5fa"></span><span class="ps-conn-name">Graph particle renderer</span><span class="ps-conn-badge" style="--c:#60a5fa">render</span></div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Tags</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#34d399">xterm.js</span>
          <span class="ps-tag" style="--c:#34d399">Live Events</span>
          <span class="ps-tag" style="--c:#34d399">Real-time Graph</span>
          <span class="ps-tag" style="--c:#34d399">node-pty</span>
        </div>
      </div>`

    case 'about': return `
      <div class="ps">
        <div class="ps-label">The Problem</div>
        <div class="ps-problems">
          <div class="ps-problem"><span class="ps-problem-num" style="--c:#f87171">01</span><div><strong>You can't see what's calling what.</strong> Your runtime is reading files, calling tools, and hitting APIs — but you have no map. One bad prompt or hidden dependency and the whole workflow breaks silently.</div></div>
          <div class="ps-problem"><span class="ps-problem-num" style="--c:#60a5fa">02</span><div><strong>Debugging means grepping JSONL.</strong> When a session fails, your only option is digging through raw log files. No timeline, no replay, no clarity.</div></div>
          <div class="ps-problem"><span class="ps-problem-num" style="--c:#34d399">03</span><div><strong>Your architecture lives only in your head.</strong> No diagram, no shared map. Explaining it to a collaborator means a long voice call and a whiteboard.</div></div>
          <div class="ps-problem"><span class="ps-problem-num" style="--c:#fbbf24">04</span><div><strong>You can't tell if agents are healthy.</strong> God agents, orphaned tools, circular dependencies — structural problems compound silently until everything breaks at once.</div></div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">The Solution</div>
        <div class="ps-text">Kosmos connects to your codebase and runtime history to build a complete, living picture of your agent system — automatically. No cloud setup, no instrumentation maze, no extra dashboards. Just run <code style="color:#34d399;background:rgba(52,211,153,0.1);padding:1px 5px;border-radius:3px;font-size:11px">npx kosmos-aos</code> and you have full visibility in under 30 seconds.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Who is this for?</div>
        <div class="ps-connections">
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#60a5fa"></span><span class="ps-conn-name">Developers building AI products</span><span class="ps-conn-badge" style="--c:#60a5fa">primary</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#fbbf24"></span><span class="ps-conn-name">Teams running AI agent pipelines</span><span class="ps-conn-badge" style="--c:#fbbf24">teams</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#a78bfa"></span><span class="ps-conn-name">Anyone debugging agent sessions</span><span class="ps-conn-badge" style="--c:#a78bfa">debug</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#34d399"></span><span class="ps-conn-name">Engineers operating custom runtimes</span><span class="ps-conn-badge" style="--c:#34d399">infra</span></div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">How it works</div>
        <div class="ps-text">1. Point Kosmos at your project directory<br/>2. It scans your codebase and detects agents, tools, models, and APIs<br/>3. It imports available session history or listens for live runtime events<br/>4. The 3D graph renders your entire system as an interactive map<br/>5. Click play to watch activity stream through the graph</div>
      </div>
      <div class="ps">
        <div class="ps-label">Design principles</div>
        <div class="ps-connections">
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#34d399"></span><span class="ps-conn-name">Local-first: your data never leaves your machine</span><span class="ps-conn-badge" style="--c:#34d399">privacy</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#60a5fa"></span><span class="ps-conn-name">Zero config: auto-detect everything</span><span class="ps-conn-badge" style="--c:#60a5fa">ux</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#fbbf24"></span><span class="ps-conn-name">Open source: MIT licensed</span><span class="ps-conn-badge" style="--c:#fbbf24">oss</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#f472b6"></span><span class="ps-conn-name">Beautiful by default: immersive 3D interface</span><span class="ps-conn-badge" style="--c:#f472b6">design</span></div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Tags</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#f472b6">Open Source</span>
          <span class="ps-tag" style="--c:#f472b6">Local-first</span>
          <span class="ps-tag" style="--c:#f472b6">MIT License</span>
          <span class="ps-tag" style="--c:#f472b6">TypeScript</span>
        </div>
      </div>`

    case 'integrations': return `
      <div class="ps">
        <div class="ps-label">About</div>
        <div class="ps-text">Zero configuration. Open your workspace and Kosmos connects to the runtime signals already around your product. Three integration channels, one window. Every event — tool calls, model requests, errors — flows into the same graph.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Integrations · 3</div>
        <div class="ps-integrations">
          <div class="ps-integration">
            <div class="ps-integ-icon" style="--c:#f59e0b">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div class="ps-integ-body">
              <div class="ps-integ-name">Imported Session Logs</div>
              <div class="ps-integ-desc">Bring in saved runtime logs and turn each session into a replayable run with traces, files, and usage details.</div>
            </div>
            <span class="ps-integ-badge" style="--c:#10b981">Auto-detected</span>
          </div>
          <div class="ps-integration">
            <div class="ps-integ-icon" style="--c:#a78bfa">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
            </div>
            <div class="ps-integ-body">
              <div class="ps-integ-name">Live Event Stream</div>
              <div class="ps-integ-desc">Real&#8209;time WebSocket event stream for live graph updates. Connect any compatible local runtime.</div>
            </div>
            <span class="ps-integ-badge" style="--c:#60a5fa">WebSocket</span>
          </div>
          <div class="ps-integration">
            <div class="ps-integ-icon" style="--c:#38bdf8">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 14a1 1 0 01-.78-1.63l9.9-10.2a.5.5 0 01.86.46l-1.92 6.02A1 1 0 0013 10h7a1 1 0 01.78 1.63l-9.9 10.2a.5.5 0 01-.86-.46l1.92-6.02A1 1 0 0011 14H4z"/></svg>
            </div>
            <div class="ps-integ-body">
              <div class="ps-integ-name">HTTP Ingest</div>
              <div class="ps-integ-desc">POST events from any framework — Python, Go, Rust, anything with an HTTP client. One endpoint, universal compatibility.</div>
            </div>
            <span class="ps-integ-badge" style="--c:#38bdf8">REST API</span>
          </div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">How integrations work</div>
        <div class="ps-text">When Kosmos starts, it looks for available runtime history and live activity sources tied to your workspace. New events are automatically rendered on the graph. For custom systems, POST events to the ingest endpoint and they appear as nodes and edges in real time.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Supported event types</div>
        <div class="ps-connections">
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#60a5fa"></span><span class="ps-conn-name">model_call — LLM inference requests</span><span class="ps-conn-badge" style="--c:#60a5fa">model</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#a78bfa"></span><span class="ps-conn-name">tool_call — tool invocations</span><span class="ps-conn-badge" style="--c:#a78bfa">tool</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#fbbf24"></span><span class="ps-conn-name">agent_response — agent outputs</span><span class="ps-conn-badge" style="--c:#fbbf24">agent</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#f87171"></span><span class="ps-conn-name">error — failures and exceptions</span><span class="ps-conn-badge" style="--c:#f87171">error</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#34d399"></span><span class="ps-conn-name">tool_result — tool responses</span><span class="ps-conn-badge" style="--c:#34d399">result</span></div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Example</div>
        <div class="ps-code">
          <div class="ps-code-bar"><span>ingest.py</span></div>
          <pre class="ps-code-body">requests.post(<span class="c-str">"http://localhost:41414/ingest"</span>, json={
    <span class="c-str">"type"</span>: <span class="c-str">"tool_call"</span>,
    <span class="c-str">"agent"</span>: <span class="c-str">"CodeAgent"</span>,
    <span class="c-str">"tool"</span>: <span class="c-str">"ReadFile"</span>
})</pre>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Tags</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#f59e0b">Session Logs</span>
          <span class="ps-tag" style="--c:#a78bfa">WebSocket</span>
          <span class="ps-tag" style="--c:#38bdf8">REST API</span>
          <span class="ps-tag" style="--c:#34d399">Auto-detect</span>
        </div>
      </div>`

    case 'download': return `
      <div class="ps">
        <div class="ps-label">Run locally with npx</div>
        <div class="ps-text">One command. No signup, no cloud, no config. Kosmos opens in your browser at <strong>localhost:5588</strong>.</div>
      </div>
      <div class="ps-install-block">
        <div class="ps-install-bar"><span>Terminal</span><button class="ps-copy-btn" id="panel-copy-btn">Copy</button></div>
        <pre class="ps-install-body">npx kosmos-aos</pre>
      </div>
      <div class="ps">
        <div class="ps-label">Options</div>
        <div class="ps-install-option"><code>npx kosmos-aos</code><span>Open without a workspace</span></div>
        <div class="ps-install-option"><code>npx kosmos-aos --port 8080</code><span>Custom port</span></div>
        <div class="ps-install-option"><code>npx kosmos-aos ./project --no-open</code><span>Don't open browser</span></div>
      </div>
      <div class="ps">
        <div class="ps-label">Requirements</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#34d399">Node.js 18+</span>
          <span class="ps-tag" style="--c:#60a5fa">Runtime logs (optional)</span>
        </div>
      </div>
      <div class="ps-stats">
        <div class="ps-stat"><div class="ps-stat-val">v0.3.0</div><div class="ps-stat-lbl">Version</div></div>
        <div class="ps-stat"><div class="ps-stat-val">Free</div><div class="ps-stat-lbl">Pricing</div></div>
        <div class="ps-stat"><div class="ps-stat-val">30s</div><div class="ps-stat-lbl">Setup</div></div>
      </div>
      <div class="ps-actions">
        <a href="${DOWNLOAD_URL}" target="_blank" rel="noreferrer" class="ps-btn ps-btn-primary js-download-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          Get Kosmos
        </a>
        <a href="${REPO_URL}" target="_blank" rel="noreferrer" class="ps-btn ps-btn-ghost">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
          Star on GitHub
        </a>
      </div>`

    case 'changelog': return `
      <div class="ps">
        <div class="ps-label">Current beta highlights</div>
        <div class="ps-text" style="color: var(--k-text-dim); font-size: 11px; margin-bottom: 10px;">Local-first runtime visibility for AI products, agent workflows, and custom systems.</div>
        <div class="ps-changelog">
          <div class="ps-cl-section">
            <div class="ps-cl-head" style="--c:#10b981">Added</div>
            <div class="ps-cl-item">3D Universe Map — interactive force&#8209;directed graph</div>
            <div class="ps-cl-item">Trace / Thread inspector with span details</div>
            <div class="ps-cl-item">Prompt version history and local comparisons</div>
            <div class="ps-cl-item">Feedback scoring and saved evaluation examples</div>
            <div class="ps-cl-item">Usage and cost metrics across traces and models</div>
            <div class="ps-cl-item">Health Analysis — automatic static analysis findings</div>
            <div class="ps-cl-item">Live file reads and writes shown directly on the graph</div>
            <div class="ps-cl-item">Imported session logs plus live stream and HTTP ingest support</div>
          </div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Roadmap</div>
        <div class="ps-connections">
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#fbbf24"></span><span class="ps-conn-name">Multi&#8209;agent session comparison</span><span class="ps-conn-badge" style="--c:#fbbf24">planned</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#fbbf24"></span><span class="ps-conn-name">Cost tracking per session</span><span class="ps-conn-badge" style="--c:#fbbf24">planned</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#fbbf24"></span><span class="ps-conn-name">Custom node type plugins</span><span class="ps-conn-badge" style="--c:#fbbf24">planned</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#a78bfa"></span><span class="ps-conn-name">Team sharing (shared graph links)</span><span class="ps-conn-badge" style="--c:#a78bfa">exploring</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#10b981"></span><span class="ps-conn-name">macOS native desktop app</span><span class="ps-conn-badge" style="--c:#10b981">shipped</span></div>
        </div>
      </div>
      <div class="ps-actions">
        <a href="${RELEASES_URL}" target="_blank" rel="noreferrer" class="ps-btn ps-btn-ghost">
          View all releases on GitHub
        </a>
      </div>`

    case 'contact': return `
      <div class="ps">
        <div class="ps-label">About</div>
        <div class="ps-text">Kosmos is built by an independent developer. Questions, feedback, feature requests, or just want to say hi? Reach out through the channels below — all messages are read.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Channels</div>
        <div class="ps-contacts">
          <a href="${REPO_URL}" target="_blank" rel="noreferrer" class="ps-contact-row">
            <div class="ps-contact-icon" style="--c:#94a3b8">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
            </div>
            <div class="ps-contact-body">
              <div class="ps-contact-name">GitHub</div>
              <div class="ps-contact-sub">Issues, PRs, and discussions</div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--k-text-dim)"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
          </a>
          <a href="mailto:${CONTACT_EMAIL}" class="ps-contact-row">
            <div class="ps-contact-icon" style="--c:#60a5fa">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M22 6l-10 7L2 6"/></svg>
            </div>
            <div class="ps-contact-body">
              <div class="ps-contact-name">Email</div>
              <div class="ps-contact-sub">${CONTACT_EMAIL}</div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--k-text-dim)"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
          </a>
          <a href="${RELEASES_URL}" target="_blank" rel="noreferrer" class="ps-contact-row">
            <div class="ps-contact-icon" style="--c:#38bdf8">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l11.733 16h4.267l-11.733-16zM4 20l6.768-6.768M20 4l-6.768 6.768"/></svg>
            </div>
            <div class="ps-contact-body">
              <div class="ps-contact-name">Releases</div>
              <div class="ps-contact-sub">Download updates and follow release notes</div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--k-text-dim)"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
          </a>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Contributing</div>
        <div class="ps-text">Kosmos is open source and welcomes contributions. Start with the guides on the website or the GitHub repo, then open an issue or PR if you want to improve the product.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Tags</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#94a3b8">GitHub</span>
          <span class="ps-tag" style="--c:#38bdf8">Releases</span>
          <span class="ps-tag" style="--c:#34d399">Open Source</span>
        </div>
      </div>`

    case 'blog': return `
      <div class="ps">
        <div class="ps-label">About</div>
        <div class="ps-text">Engineering deep dives, product updates, and the thinking behind Kosmos. Follow along as we build the operating system for AI agents.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Latest Posts</div>
        <div class="ps-blog-posts">
          <div class="ps-blog-post">
            <div class="ps-blog-date">Mar 2026</div>
            <div class="ps-blog-title">Introducing Kosmos: The OS for AI Agents</div>
            <div class="ps-blog-excerpt">Why we built a 3D graph explorer for AI products. The problem with invisible agent architectures, and how Kosmos gives you a cockpit for your systems.</div>
            <div class="ps-tags" style="margin-top:8px">
              <span class="ps-tag" style="--c:#f472b6">Launch</span>
              <span class="ps-tag" style="--c:#f472b6">Product</span>
            </div>
          </div>
          <div class="ps-blog-post">
            <div class="ps-blog-date">Mar 2026</div>
            <div class="ps-blog-title">How We Parse Runtime Sessions</div>
            <div class="ps-blog-excerpt">A technical deep dive into our JSONL parser — how we turn raw session logs into a typed event stream, detect node types, and build the graph in under 200ms.</div>
            <div class="ps-tags" style="margin-top:8px">
              <span class="ps-tag" style="--c:#a78bfa">Engineering</span>
              <span class="ps-tag" style="--c:#a78bfa">Parser</span>
            </div>
          </div>
          <div class="ps-blog-post">
            <div class="ps-blog-date">Mar 2026</div>
            <div class="ps-blog-title">Building a 3D Force Graph with Three.js</div>
            <div class="ps-blog-excerpt">How we render 500+ nodes at 60fps using instanced meshes, spatial partitioning, and custom GLSL shaders for the glow effects.</div>
            <div class="ps-tags" style="margin-top:8px">
              <span class="ps-tag" style="--c:#60a5fa">Three.js</span>
              <span class="ps-tag" style="--c:#60a5fa">WebGL</span>
            </div>
          </div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Follow for updates</div>
        <div class="ps-contacts">
          <a href="${RELEASES_URL}" target="_blank" rel="noreferrer" class="ps-contact-row">
            <div class="ps-contact-icon" style="--c:#38bdf8">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l11.733 16h4.267l-11.733-16zM4 20l6.768-6.768M20 4l-6.768 6.768"/></svg>
            </div>
            <div class="ps-contact-body">
              <div class="ps-contact-name">GitHub Releases</div>
              <div class="ps-contact-sub">Product updates, release notes, and downloads</div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--k-text-dim)"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
          </a>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Tags</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#f472b6">Updates</span>
          <span class="ps-tag" style="--c:#a78bfa">Engineering</span>
          <span class="ps-tag" style="--c:#60a5fa">Deep Dives</span>
          <span class="ps-tag" style="--c:#fbbf24">Roadmap</span>
        </div>
      </div>`

    case 'privacy': return `
      <div class="ps">
        <div class="ps-label">Privacy Policy</div>
        <div class="ps-text">Kosmos is a local&#8209;first application. Your data never leaves your machine. This policy explains what data Kosmos accesses and how it is handled.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Data we access</div>
        <div class="ps-connections">
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#34d399"></span><span class="ps-conn-name">Runtime session logs (JSONL files)</span><span class="ps-conn-badge" style="--c:#34d399">read-only</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#34d399"></span><span class="ps-conn-name">Project files (for agent detection)</span><span class="ps-conn-badge" style="--c:#34d399">read-only</span></div>
          <div class="ps-conn"><span class="ps-conn-dot" style="--c:#60a5fa"></span><span class="ps-conn-name">Local SQLite database (graph data)</span><span class="ps-conn-badge" style="--c:#60a5fa">local</span></div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Data we DO NOT collect</div>
        <div class="ps-changelog">
          <div class="ps-cl-section">
            <div class="ps-cl-item">No application telemetry or workspace data sent to any server</div>
            <div class="ps-cl-item">No cloud sync or remote storage</div>
            <div class="ps-cl-item">No cookies or browser fingerprinting</div>
            <div class="ps-cl-item">No auto-update phone&#8209;home (manual GitHub releases only)</div>
            <div class="ps-cl-item">Website-only anonymous analytics via Vercel Analytics</div>
          </div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">Data storage</div>
        <div class="ps-text">All data is stored in a local SQLite database on your machine. The database file is located in the Kosmos application data directory. You can delete it at any time to remove all stored data. No data is ever transmitted over the network.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Network requests</div>
        <div class="ps-text">The Kosmos app is local-first and does not send your workspace data to a cloud service. The app's primary network activity is local (<code style="font-size:11px;color:#a78bfa">localhost</code>) traffic between the UI and backend. The public marketing site uses Vercel Analytics for anonymous aggregate traffic measurement.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Open Source</div>
        <div class="ps-text">Kosmos is fully open source under the MIT license. You can audit the codebase on GitHub and follow releases from ${SITE_URL}.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Tags</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#34d399">Local-first</span>
          <span class="ps-tag" style="--c:#34d399">Zero telemetry</span>
          <span class="ps-tag" style="--c:#34d399">No cloud</span>
          <span class="ps-tag" style="--c:#34d399">Open Source</span>
        </div>
      </div>`

    case 'terms': return `
      <div class="ps">
        <div class="ps-label">Terms of Service</div>
        <div class="ps-text">By using Kosmos, you agree to the following terms. Kosmos is provided free of charge during the beta period. These terms are effective as of March 2026.</div>
      </div>
      <div class="ps">
        <div class="ps-label">1. License</div>
        <div class="ps-text">Kosmos is open&#8209;source software distributed under the MIT License. You may use, modify, and distribute the software in accordance with the license terms. The full license text is available in the GitHub repository.</div>
      </div>
      <div class="ps">
        <div class="ps-label">2. Beta disclaimer</div>
        <div class="ps-text">Kosmos is currently in beta. The software is provided "as&#8209;is" without warranty of any kind, express or implied. We do not guarantee uptime, data integrity, or compatibility with future versions. Use at your own discretion.</div>
      </div>
      <div class="ps">
        <div class="ps-label">3. Your data</div>
        <div class="ps-text">Kosmos runs entirely on your local machine. We do not access, collect, store, or transmit any of your data. You retain full ownership and control of all data processed by Kosmos. See our Privacy node for details.</div>
      </div>
      <div class="ps">
        <div class="ps-label">4. Acceptable use</div>
        <div class="ps-changelog">
          <div class="ps-cl-section">
            <div class="ps-cl-item">Use Kosmos for lawful purposes only</div>
            <div class="ps-cl-item">Do not attempt to reverse&#8209;engineer proprietary integrations</div>
            <div class="ps-cl-item">Do not misrepresent Kosmos as your own product</div>
            <div class="ps-cl-item">Contributions must follow the project's code of conduct</div>
          </div>
        </div>
      </div>
      <div class="ps">
        <div class="ps-label">5. Pricing</div>
        <div class="ps-text">Kosmos is free during the beta period. Pricing and plan structure may be introduced in future versions. Existing beta users will receive advance notice of any pricing changes through the GitHub repository, release notes, and the public website.</div>
      </div>
      <div class="ps">
        <div class="ps-label">6. Limitation of liability</div>
        <div class="ps-text">To the maximum extent permitted by law, the authors and contributors of Kosmos shall not be liable for any direct, indirect, incidental, special, or consequential damages arising from the use of the software.</div>
      </div>
      <div class="ps">
        <div class="ps-label">Tags</div>
        <div class="ps-tags">
          <span class="ps-tag" style="--c:#94a3b8">MIT License</span>
          <span class="ps-tag" style="--c:#94a3b8">Beta</span>
          <span class="ps-tag" style="--c:#94a3b8">Free</span>
          <span class="ps-tag" style="--c:#94a3b8">Open Source</span>
        </div>
      </div>`

    default: return `<div class="ps"><div class="ps-text">No content available.</div></div>`
  }
}
