# Kosmos Live Context Observability Pivot Plan

## Executive Summary

Kosmos should not become a narrow static wiki linter, and it should not abandon its existing identity as a live agent observability tool. The stronger direction is to make Kosmos the **live observability layer for agents working inside local knowledge systems**.

The product should answer four questions:

1. What is my agent doing right now?
2. Which files, wiki pages, prompts, tools, sources, and outputs is it touching?
3. How are those things connected?
4. Is this context system healthy enough to trust?

This keeps the original Kosmos DNA:

- live sessions
- runtime traces
- graph visualization
- local ingest
- file interactions
- replay
- no cloud dependency

But it gives the product a sharper and more current wedge:

- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules`
- Obsidian vaults
- LLM-maintained Markdown wikis
- raw/wiki/outputs knowledge systems
- agent memory
- local knowledge graphs

The new product sentence should be:

> Kosmos is a live graph debugger for AI agents and their context. Watch agents move through files, wiki pages, prompts, tools, and outputs in real time, then audit the context graph for broken links, missing sources, stale instructions, and drift.

This is more relevant than broad "AI agent observability" and more exciting than a static wiki health checker.

## The Strategic Bet

The current AI developer workflow is moving toward local context systems:

- People maintain `AGENTS.md`, `CLAUDE.md`, Cursor rules, and project-specific instructions.
- People are building Karpathy-style LLM wikis with raw sources, structured Markdown pages, and generated outputs.
- Obsidian is becoming a local command center for AI work.
- Claude Code, Codex, Cursor, OpenHands, and similar tools are all using local files as the memory/control layer.
- The problem is no longer only "what did my agent call?" It is also "what context did my agent read, trust, mutate, and propagate?"

Kosmos can own the observability layer beneath this trend.

The strongest wedge is not:

> Another Obsidian plugin.

The strongest wedge is:

> A local app that lets you watch your AI agent move through your context graph live.

The static scan gets people in the door. The live graph gives the product soul.

## Product Identity

### Keep

Keep these existing Kosmos pillars:

- Universe Map / graph viewer
- Runs and trace inspector
- local ingest endpoint
- browser/server `npx` mode
- Electron app mode
- file explorer
- Markdown editor
- local SQLite storage
- no hosted account
- no required API key

These are not legacy baggage. They are the foundation.

### Reframe

Reframe the visible product surfaces:

| Current Surface | New Emphasis |
| --- | --- |
| Dashboard | Live Context Overview |
| Universe Map | Live Knowledge Graph |
| Runs | Sessions and Replay |
| Health | Context Health |
| Flow | Optional graph layout / flow view |
| Settings | Local integrations and scan settings |

The product should feel like a command center for agent context, not a generic system dashboard.

### Add

Add first-class support for:

- wiki pages
- source documents
- generated outputs
- instruction files
- index files
- unresolved links
- raw/wiki/output folder conventions
- Obsidian wikilinks
- Markdown links
- source coverage
- scan history
- drift between scans
- live wiki traversal

## North Star Demo

The north star demo should be something like this:

```bash
npx kosmos-aos scan ./path/to/your-vault
```

Kosmos opens and shows:

- a graph of raw sources, wiki pages, outputs, instructions, tools, agents, and sessions
- a health summary with broken links, orphan pages, missing sources, stale instructions, and raw/wiki/output gaps
- live runtime activity if an agent is connected

Then the user starts Claude Code, Codex, OpenClaw, or another agent.

Kosmos lights up in real time:

```text
Claude Code is reading:
- AGENTS.md
- wiki/projects/kosmos/architecture.md
- wiki/concepts/llm-wikis.md
- raw/2026-05-16-video-transcript.md

Claude Code is writing:
- outputs/kosmos-live-context-plan.md

Context warning:
- outputs/kosmos-live-context-plan.md is derived from 2 wiki pages with missing sources.
```

The graph animates:

```text
raw/video-transcript.md
  -> wiki/concepts/llm-wikis.md
  -> wiki/projects/kosmos/strategy.md
  -> outputs/kosmos-plan.md
```

Then the user opens the session replay and watches the agent traverse the graph.

That is the product.

## Core Principles

### 1. No Required API Key

The default product must work with zero model keys.

Default capabilities should be deterministic and local:

- parse files
- parse Markdown
- parse links
- parse frontmatter
- detect folder structure
- detect instruction files
- build graph edges
- ingest runtime events
- map file reads/writes to nodes
- show live graph activity
- persist sessions
- compute health findings
- compare scan drift

Optional AI review can come later, but it must be explicitly optional.

Default setup:

```bash
npx kosmos-aos scan .
```

No account. No cloud. No key. No setup ceremony.

### 2. BYOK Only For Semantic Review

If LLM features are added, make them opt-in and bring-your-own-key.

Possible future AI review features:

- detect unsupported claims
- suggest missing cross-links
- identify duplicate concepts
- summarize drift
- recommend `AGENTS.md` improvements
- compare an output against its cited sources
- suggest source pages for unsourced wiki pages

But none of those should block the core live graph experience.

Recommended provider setup:

- no stored key by default
- support environment variables first
- then local encrypted settings if needed
- support OpenAI and Anthropic only when there is enough demand
- maybe support local Ollama later

### 3. Preserve Live Observability

The static scan is the onboarding hook. The live session graph is the differentiator.

Kosmos should continue to:

- accept live ingest events
- show active sessions
- show tool calls
- show model calls
- show files read and written
- show session replay
- show runtime traces
- import Claude Code sessions where possible

The pivot should make those features more useful by connecting them to the knowledge graph.

### 4. Make File Interaction Obvious

The user should be able to click any file/page and immediately understand:

- what it links to
- what links to it
- what sources support it
- what outputs depend on it
- which agents read it
- which agents wrote it
- which sessions touched it
- what health findings apply

This is a major differentiator from Obsidian's graph. Obsidian shows links. Kosmos should show **context flow and runtime evidence**.

### 5. Be Pretty Because Pretty Is Part Of The Product

For GitHub stars, the screenshot matters.

Kosmos should feel:

- alive
- local
- technical
- inspectable
- cinematic but still useful
- more like an observability surface than a note app

The visual identity should keep the constellation mood but make comprehension dominant:

- nodes must be legible
- active reads/writes must be obvious
- unhealthy nodes should be visually distinct
- labels should not become noise
- the graph should show "movement" when sessions are live

## Product Architecture After The Pivot

### Layer 1: Static Context Scan

This layer builds the baseline graph.

Inputs:

- repo source files
- Markdown files
- Obsidian vault files
- instruction files
- raw source folders
- output folders
- config files
- package files
- existing agent/tool/model patterns

Outputs:

- nodes
- edges
- health findings
- scan snapshot
- source coverage summary
- instruction audit

This layer must work offline.

### Layer 2: Live Runtime Ingest

This layer shows what agents are doing right now.

Inputs:

- local ingest events
- Claude Code imports
- custom SDK events
- OpenClaw events
- future Codex events if available
- file read/write events from tool calls

Outputs:

- active session
- active trace
- active spans
- live node pulses
- read/write edges
- touched files
- live activity rail

This layer should map runtime file paths to static graph nodes whenever possible.

### Layer 3: Session Replay

This layer lets users understand what happened after the fact.

Inputs:

- persisted runs
- persisted events
- spans
- touched node ids
- scan state at time of run, if available

Outputs:

- timeline
- replay on graph
- files touched
- tools called
- models used
- wiki pages read
- outputs written
- instruction files referenced

The replay should feel like watching the agent move through the workspace.

### Layer 4: Context Health

This layer evaluates whether the workspace context is usable and trustworthy.

Inputs:

- static graph
- scan metadata
- runtime touch history
- instruction analysis
- source coverage
- link graph

Outputs:

- health score
- findings
- source gaps
- stale paths
- orphan nodes
- broken links
- risky outputs
- instruction problems
- drift warnings

This is the practical value layer.

## New Graph Model

The current graph already supports:

- agent
- tool
- prompt
- model
- memory_store
- api
- file
- module
- permission_scope

Add these node types:

```ts
export type NodeType =
  | 'agent'
  | 'tool'
  | 'prompt'
  | 'model'
  | 'memory_store'
  | 'api'
  | 'file'
  | 'module'
  | 'permission_scope'
  | 'wiki_page'
  | 'source_doc'
  | 'output_artifact'
  | 'instruction_file'
  | 'index_file'
  | 'unresolved_link'
```

Reasoning:

- `wiki_page` captures structured Markdown knowledge.
- `source_doc` captures raw inputs and provenance material.
- `output_artifact` captures deliverables generated from context.
- `instruction_file` captures agent control surfaces such as `AGENTS.md`.
- `index_file` captures navigation hubs.
- `unresolved_link` makes broken links visible in the graph without pretending they are valid files.

Add these edge types:

```ts
export type EdgeType =
  | 'defines'
  | 'uses'
  | 'calls'
  | 'reads'
  | 'writes'
  | 'imports'
  | 'permits'
  | 'denies'
  | 'emits'
  | 'correlates'
  | 'links_to'
  | 'cites'
  | 'derived_from'
  | 'indexes'
  | 'documents'
  | 'mentions'
```

Reasoning:

- `links_to` is for wiki and Markdown links.
- `cites` is for wiki/output to source provenance.
- `derived_from` is for outputs built from sources or wiki pages.
- `indexes` is for index pages that organize folders or collections.
- `documents` is for instruction files describing folders, workflows, or conventions.
- `mentions` is useful for lightweight non-link references.

## Scanner Changes

The existing scanner is the right place to start because it already feeds both Electron and browser/server mode.

### Markdown File Discovery

Treat these extensions as knowledge files:

```text
.md
.mdx
.markdown
.txt
.rst
```

Skip very large files using the existing max file size guard unless a future setting changes it.

### Folder Role Detection

Detect common knowledge-system folder roles:

```text
raw/
source/
sources/
clips/
transcripts/
inbox/
wiki/
notes/
concepts/
entities/
decisions/
projects/
outputs/
deliverables/
reports/
drafts/
```

Classification rules:

- files under `raw/`, `source/`, `sources/`, `clips/`, `transcripts/`, or `inbox/` become `source_doc`
- files under `wiki/`, `notes/`, `concepts/`, `entities/`, `decisions/`, or `projects/` become `wiki_page`
- files under `outputs/`, `deliverables/`, `reports/`, or `drafts/` become `output_artifact`
- `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*`, `.claude/*`, and skill instruction files become `instruction_file`
- `index.md`, `_index.md`, and folder-level `README.md` become `index_file`, possibly with a secondary role in metadata
- files that do not match a special role can remain `file`, unless the workspace looks like a Markdown vault, in which case root Markdown files can become `wiki_page`

### Vault Detection

Detect a Markdown/Obsidian/LLM-wiki workspace when any of these are true:

- `.obsidian/` exists
- high Markdown file ratio
- `raw/` and `wiki/` both exist
- `AGENTS.md` or `CLAUDE.md` references wiki/source/output conventions
- many wikilinks are present

Store on workspace or scan metadata:

```ts
{
  contextSystem: {
    isMarkdownVault: boolean
    isObsidianVault: boolean
    hasRawWikiOutputs: boolean
    instructionFiles: string[]
    detectedConventions: string[]
  }
}
```

### Wikilink Parsing

Parse Obsidian links:

```text
[[Page]]
[[Page|Alias]]
[[folder/Page]]
![[embedded-image.png]]
[[Page#Heading]]
```

Rules:

- `[[Page]]` should resolve to a Markdown file by title or path.
- `[[folder/Page]]` should resolve relative to vault root.
- aliases should not affect target identity.
- heading fragments should be stored in edge metadata.
- embeds should create a `links_to` edge with `meta.embed = true`.
- unresolved links should create an `unresolved_link` node and a finding.

### Markdown Link Parsing

Parse regular Markdown links:

```text
[label](path.md)
[label](../sources/source.md)
[label](https://example.com)
```

Rules:

- local Markdown links create `links_to`, `cites`, or `derived_from` depending on source/target roles.
- external URLs can be stored in metadata, but do not need first-class nodes in v1 unless they are in raw/source material.
- broken local links create unresolved nodes and findings.

### Frontmatter Parsing

Implement a lightweight YAML-ish frontmatter parser for common fields:

```yaml
---
title: Agent Memory
tags: [ai, memory]
aliases:
  - LLM Memory
source: raw/video.md
sources:
  - raw/article.md
updated: 2026-05-16
---
```

No need for a full YAML dependency at first unless the repo already uses one. A conservative parser is enough for:

- title
- tags
- aliases
- source
- sources
- created
- updated
- status

Use frontmatter for:

- better node names
- alias resolution
- source citation edges
- stale-page checks
- tags

### Source Coverage

Source coverage asks:

> Which wiki pages and outputs are grounded in raw source material?

Create `cites` or `derived_from` edges when:

- frontmatter `source` or `sources` points to a source doc
- Markdown links point into `raw/` or `sources/`
- a wiki page includes a local source reference section with links
- an output links to wiki/source pages

Do not use semantic guessing in v1. If there is no link or metadata evidence, mark it missing.

### Raw/Wiki/Output Flow

Detect chains:

```text
source_doc -> wiki_page -> output_artifact
```

Useful findings:

- source doc not cited by anything
- wiki page has no source
- output has no upstream wiki/source evidence
- output derived from weakly sourced wiki pages
- raw/wiki/output folders exist but no complete chains exist

## Runtime Mapping Changes

Kosmos already receives runtime events with file paths. The key change is to map those paths onto knowledge graph node types.

### File Path Resolution

When an event includes a file path:

1. normalize path
2. resolve relative to workspace
3. find existing node by path
4. if no exact match, create or update a runtime file node
5. if the path belongs to a known wiki/source/output/instruction file, use that specialized node

Examples:

```text
tool call reads wiki/concepts/llm-wiki.md
-> pulse wiki_page node
-> add live activity item
-> add span/node correlation

tool call writes outputs/strategy.md
-> pulse output_artifact node
-> create writes edge from active agent/session
-> mark output as recently agent-written
```

### Live Traversal

The graph should visualize these operations:

- file read: cool blue pulse
- file write: warm amber or green pulse
- error: red pulse
- model call: model node pulse
- tool call: tool node pulse
- instruction file read: purple pulse
- source doc read: cyan pulse
- output write: gold pulse

The important visual goal:

> The user should be able to watch the agent travel through the knowledge graph.

### Active Session Overlay

Add or improve a persistent live session overlay:

```text
Active Session
Claude Code

Reading
- AGENTS.md
- wiki/projects/kosmos/architecture.md

Writing
- outputs/new-plan.md

Tools
- Read
- Edit
- Bash
```

This should be visible from the graph screen.

### Agent Uses Instruction File

When a session reads `AGENTS.md`, `CLAUDE.md`, or rules files:

- pulse the instruction node
- show it in the session inspector
- attach it to the run as context evidence

This makes instruction files feel like live control surfaces, not static docs.

## Session Replay Changes

The current Runs screen should become more graph-connected.

### Session Summary

For each session, show:

- agent/source
- started/ended
- status
- event count
- tools used
- models used
- files read
- files written
- wiki pages read
- sources read
- outputs written
- instruction files touched
- health warnings created or related

### Replay On Graph

Replay should show:

- active node pulses over time
- animated read/write edges
- timeline scrubber
- event detail panel
- file path and node type
- tool/model spans

If the session read a wiki page and then wrote an output, that relationship should be visible.

### Session To Health Bridge

Add session-level warnings:

- session wrote an output with no source chain
- session repeatedly read orphan pages
- session relied on a stale instruction file
- session edited a page with broken outgoing links
- session wrote to wiki but did not update index pages

These can be deterministic and metadata-based.

## Context Health

The Health screen should evolve into a context-aware diagnostic center.

### Health Tabs

Recommended tabs:

```text
Overview
Instructions
Sources
Links
Drift
Runtime
```

Do not make this feel like six separate apps. It can be one screen with segmented tabs.

### Overview

Show:

- overall score
- critical findings
- total wiki pages
- raw sources
- outputs
- instruction files
- broken links
- missing source pages
- sessions today
- active runtime status

### Instructions

Analyze:

- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules`
- `.claude` files
- skill files
- repo instructions

Findings:

- too long
- no folder map
- missing test commands
- missing scan/run commands
- references missing paths
- duplicates another instruction file
- no durable knowledge guidance
- no raw/wiki/output convention
- no local-first constraints
- vague navigation rules

### Sources

Analyze:

- raw source docs
- cited source docs
- wiki pages without sources
- outputs without sources
- unused raw sources

Metrics:

- source docs total
- cited source docs
- uncited source docs
- sourced wiki pages
- unsourced wiki pages
- outputs with provenance
- outputs without provenance

### Links

Analyze:

- wikilinks
- Markdown links
- unresolved targets
- orphan pages
- weakly connected pages
- over-connected noisy hubs
- missing indexes

### Drift

Analyze scan-to-scan changes:

- new files
- deleted files
- changed files
- new broken links
- resolved broken links
- new unsourced pages
- source coverage improved/worsened
- instruction files changed
- pages changed without source changes

### Runtime

Analyze:

- sessions
- active agents
- touched files
- tool usage
- model usage
- file reads/writes
- recent errors
- runtime-discovered nodes

This preserves the old health/observability work.

## Health Finding Types

Add finding types:

```ts
type KosmosFindingType =
  | existing types
  | 'broken_link'
  | 'orphan_page'
  | 'missing_source'
  | 'unused_source'
  | 'thin_page'
  | 'missing_index'
  | 'instruction_missing_navigation'
  | 'instruction_path_missing'
  | 'instruction_too_long'
  | 'instruction_duplicate'
  | 'raw_wiki_output_gap'
  | 'weak_cross_links'
  | 'stale_page'
  | 'output_without_provenance'
  | 'runtime_used_weak_context'
```

### Severity Guidelines

Errors:

- broken link in instruction file
- output without provenance
- instruction file references missing critical paths
- source/wiki/output chain completely absent in a workspace that claims to use it

Warnings:

- wiki page missing source
- many orphan pages
- instruction too long
- missing index in major folder
- source coverage below threshold

Info:

- thin page
- weak cross-links
- unused source
- stale page

## Scan Snapshots And Drift

Add scan snapshots after the core scanner changes.

Reasoning:

- Static health is useful once.
- Drift makes Kosmos feel like observability.
- Users want to know what changed after agent work.

### Tables

Add a DB migration with:

```sql
CREATE TABLE workspace_scans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  node_count INTEGER DEFAULT 0,
  edge_count INTEGER DEFAULT 0,
  finding_count INTEGER DEFAULT 0,
  meta TEXT DEFAULT '{}'
);

CREATE TABLE workspace_scan_files (
  scan_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  path TEXT NOT NULL,
  kind TEXT NOT NULL,
  content_hash TEXT,
  mtime_ms INTEGER,
  size INTEGER,
  meta TEXT DEFAULT '{}',
  PRIMARY KEY (scan_id, path)
);

CREATE TABLE workspace_scan_findings (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  node_ids TEXT DEFAULT '[]',
  meta TEXT DEFAULT '{}'
);
```

Do not store full file contents in scan snapshot tables.

### Drift Output

Drift should return:

```ts
interface ContextDriftSummary {
  fromScanId?: string
  toScanId: string
  newFiles: string[]
  deletedFiles: string[]
  changedFiles: string[]
  newFindings: KosmosFinding[]
  resolvedFindings: KosmosFinding[]
  sourceCoverageDelta: number
  brokenLinkDelta: number
  instructionFilesChanged: string[]
}
```

## UI Changes

### Dashboard: Live Context Overview

Change the first screen after scanning to show:

- active session status
- context health score
- graph summary
- recent touched files
- recent sessions
- top findings
- source coverage
- quick actions

Quick actions:

- Open Live Graph
- View Sessions
- View Context Health
- Rescan

### Universe Map: Live Knowledge Graph

Keep this as the visual center.

Add:

- node type filters for knowledge/source/output/instructions/runtime
- active session overlay
- live read/write pulses
- legend for node types
- health markers on unhealthy nodes
- context flow layout
- vault structure layout

Node groups:

- Agents
- Instructions
- Sources
- Wiki
- Outputs
- Tools
- Models
- APIs
- Runtime

### Inspector Panel

For selected file/page nodes, show:

- path
- type
- role
- inbound links
- outbound links
- sources
- outputs depending on it
- sessions that touched it
- last read
- last written
- health findings
- open file button

For selected session/runtime nodes, show:

- timeline summary
- files read
- files written
- wiki pages touched
- outputs generated
- related findings

### Runs: Sessions And Replay

Keep the existing screen but improve context summaries.

Add:

- file/page touch summary
- graph replay button remains prominent
- filters by file path, wiki page, tool, status
- "show touched nodes on graph"

### Health: Context Health

Turn it into the practical audit center.

Important: this screen should be useful even if there are no live sessions.

### File Explorer

Add decorations:

- broken link indicator
- missing source indicator
- recently touched indicator
- output artifact indicator
- instruction file indicator
- source doc indicator

Do not overdo it. Make it subtle.

## CLI And Onboarding

Support:

```bash
npx kosmos-aos scan .
npx kosmos-aos scan ./wiki
npx kosmos-aos .
npx kosmos-aos ./wiki
```

`scan` is a friendly alias. Existing path behavior should continue.

On first scan, print a useful terminal summary:

```text
Kosmos scanned /path/to/wiki

Context graph
- 182 wiki pages
- 41 source docs
- 17 outputs
- 4 instruction files
- 612 links

Health
- 9 broken links
- 28 pages missing sources
- 14 orphan pages
- 3 stale instruction references

Opening http://localhost:5588
```

This makes the CLI itself more shareable.

## API / IPC Additions

Add handlers:

```ts
wiki:get-health(workspaceId)
wiki:get-scan-history(workspaceId)
wiki:get-drift(workspaceId, fromScanId?, toScanId?)
wiki:get-node-context(workspaceId, nodeId)
```

Better naming might be `context:*` instead of `wiki:*` because the product is larger than wikis:

```ts
context:get-health
context:get-scan-history
context:get-drift
context:get-node-detail
```

Recommended final choice:

Use `context:*`.

Reason:

- works for repos, vaults, and agent workspaces
- does not overcommit to Obsidian/wiki framing
- aligns with "agent context graph"

Add to:

- Electron preload API
- browser API shim
- renderer API declarations
- server IPC adapter registration

## Obsidian Plugin

Build this later, not first.

The plugin should be a companion, not the product.

### Plugin V1

Features:

- command: Open Kosmos Context Health
- detects current vault path
- launches or instructs:
  ```bash
  npx kosmos-aos scan "<vault-path>"
  ```
- status bar health indicator if Kosmos is running
- sidebar summary fetched from local Kosmos

### Plugin V2

Features:

- inline broken-link decoration
- missing-source decoration
- open current note in Kosmos
- show sessions that touched current note

Do not build the full graph inside Obsidian. Kosmos owns the graph.

## Optional AI Review

Do not include this in the core first implementation unless everything else is stable.

If added, keep it opt-in:

```text
Run AI Review
Requires your own OpenAI or Anthropic key.
No data is sent unless you click this.
```

Features:

- suggest cross-links
- detect duplicate pages
- compare output to sources
- summarize drift
- propose instruction-file cleanup

Key policy:

- no Kosmos account
- no hosted key
- no default network calls
- explicit user action

## Implementation Order

### Phase 1: Reframe Without Breaking Anything

Goal:

Make the existing app speak the new language while preserving all current behavior.

Changes:

- update README positioning
- update docs language
- update Dashboard labels
- update Health labels
- add CLI `scan` alias
- add keywords
- add a demo copy direction

Reasoning:

This makes the project legible immediately and creates a better frame for every later feature.

Acceptance:

- existing tests pass
- `npx kosmos-aos ./path` still works
- `npx kosmos-aos scan ./path` works
- app still opens in browser/server mode

### Phase 2: Add Context Node Types

Goal:

Teach the graph model about knowledge systems.

Changes:

- extend shared node/edge types
- update graph palettes
- update filters
- update inspector labels
- update demo graph if needed
- update any exhaustive type maps

Acceptance:

- typecheck passes
- graph renders new node types
- no blank/unknown node styling

### Phase 3: Add Markdown / Vault Scanner

Goal:

Make static scans useful for LLM wikis and Obsidian-style vaults.

Changes:

- detect Markdown vaults
- classify source/wiki/output/instruction/index files
- parse wikilinks
- parse Markdown links
- parse frontmatter
- resolve aliases
- create `links_to`, `cites`, `derived_from`, `indexes`, and unresolved-link nodes

Acceptance:

- fixture vault produces meaningful graph
- broken links are detected
- source coverage edges appear
- existing agent scanner behavior still works

### Phase 4: Add Context Health

Goal:

Turn the scan into actionable findings.

Changes:

- add finding types
- compute context health findings
- add Context Health sections
- add source coverage summary
- add instruction audit
- add structure audit

Acceptance:

- a fixture vault shows expected findings
- healthy fixture shows low/no findings
- findings link back to graph/file nodes

### Phase 5: Map Runtime Events To Context Nodes

Goal:

Make live sessions light up wiki/source/output/instruction nodes.

Changes:

- improve runtime path resolution
- prefer specialized node types when runtime touches known files
- pulse touched nodes by operation
- add live context activity labels
- show active reading/writing files in graph overlay

Acceptance:

- ingest event for `wiki/foo.md` pulses the wiki node
- ingest event for `outputs/bar.md` pulses output node
- session details show touched context files

### Phase 6: Improve Session Replay

Goal:

Make sessions explain how agents traversed context.

Changes:

- add touched context summary
- add replay markers for file/page nodes
- add filters by touched file/page
- add related findings on session detail

Acceptance:

- replay shows read/write node sequence
- user can jump from session to graph nodes

### Phase 7: Add Scan Snapshots And Drift

Goal:

Show how context changes over time.

Changes:

- add scan snapshot tables
- persist file hashes and finding snapshots
- compute drift
- show Drift tab

Acceptance:

- repeated scans create history
- changed files are detected
- new/resolved findings are shown

### Phase 8: Demo Vault And Launch Assets

Goal:

Make the GitHub page star-worthy.

Changes:

- add `examples/llm-wiki-vault`
- add intentional health issues
- add README GIF/screenshot
- add "what Kosmos found" section
- add quickstart

Acceptance:

- demo command works
- screenshot shows live graph/context health clearly
- README communicates value above the fold

### Phase 9: Obsidian Companion

Goal:

Give Obsidian users a low-friction entry point.

Changes:

- create companion plugin
- command opens Kosmos for current vault
- optional local status panel

Acceptance:

- plugin can launch Kosmos scan for vault
- no core app dependency on plugin

## Demo Fixture Design

Create:

```text
examples/llm-wiki-vault/
  AGENTS.md
  raw/
    2026-05-16-claude-obsidian-command-center.md
    agent-memory-paper.md
    uncited-source.md
  wiki/
    index.md
    concepts/
      llm-wiki.md
      agent-context.md
      orphan-page.md
      missing-source-page.md
    projects/
      kosmos.md
  outputs/
    kosmos-plan.md
    unsupported-output.md
```

Intentional issues:

- broken wikilink
- orphan page
- missing source page
- uncited raw source
- output without provenance
- instruction file with stale path
- folder without index

Good examples:

- one complete source -> wiki -> output chain
- one clean instruction section
- one well-linked concept page

This fixture powers tests, screenshots, and README examples.

## Marketing And GitHub Stars Strategy

The README should lead with the most concrete hook:

```text
Watch your AI agent move through your workspace.
```

Then:

```text
Kosmos builds a live graph of files, wiki pages, prompts, tools, sources, and outputs. It shows what your agent is reading and writing in real time, then audits the context graph for broken links, missing sources, stale instructions, and drift.
```

Quickstart:

```bash
npx kosmos-aos scan .
```

The first screenshot should show:

- graph
- active session
- highlighted wiki/source/output nodes
- health findings

Avoid leading with:

- "enterprise observability"
- "generic AI agents"
- "dashboard"
- "trace platform"

Lead with:

- live graph
- agent context
- local-first
- no key required
- LLM wiki / Obsidian / AGENTS.md support

## What Not To Build Yet

Do not build these first:

- hosted cloud sync
- required user accounts
- required model key
- full Obsidian replacement
- full Obsidian graph inside plugin
- semantic claim verification before deterministic checks are solid
- complex vector database
- multi-user/team features
- pricing/billing infrastructure

These distract from the star-worthy demo.

## Risks

### Risk: Product Becomes Too Broad

Mitigation:

Keep the core sentence tight:

> Live graph debugger for AI agents and their context.

Everything should map to live graph, sessions, context health, or replay.

### Risk: Static Wiki Health Feels Boring

Mitigation:

Lead with live traversal. Static scan is onboarding, not the whole product.

### Risk: Graph Gets Too Noisy

Mitigation:

Add strong filters and layouts:

- Runtime
- Instructions
- Sources
- Wiki
- Outputs
- Tools/Models
- Unhealthy Only
- Touched In Current Session

### Risk: Obsidian Users Expect Native Plugin UX

Mitigation:

Call the plugin a companion. Kosmos is the richer graph/replay surface.

### Risk: Runtime Integrations Are Hard

Mitigation:

Use the existing ingest endpoint. Make static scan valuable alone, then enrich with live events when available.

## Success Criteria

### Product Success

The user can:

- run `npx kosmos-aos scan .`
- see a useful graph without setup
- connect/live-ingest an agent session
- watch nodes light up as files are read/written
- inspect which wiki pages/sources/outputs were touched
- replay a session through the graph
- find broken links, missing sources, stale instructions, and drift

### GitHub Star Success

The repo earns stars because the README instantly communicates:

- this is timely
- this is local
- this is visual
- this works with agent context files and LLM wikis
- this does something Obsidian and raw terminal logs do not

### Technical Success

- no ingest protocol breakage
- no required cloud dependency
- npx mode remains primary
- Electron still works
- old agent scanning still works
- graph remains performant
- health checks are deterministic
- tests cover fixture vault behavior

## Final Recommendation

Do this pivot as an expansion, not a rewrite.

Keep Kosmos's live graph, sessions, replay, and runtime ingest. Add first-class understanding of agent context systems: `AGENTS.md`, `CLAUDE.md`, Obsidian/Markdown vaults, raw sources, wiki pages, outputs, and drift.

The product should feel like:

> Obsidian shows your notes. Claude/Codex edits your workspace. Kosmos shows what the agent is actually touching, how the context is connected, and whether the knowledge system is healthy.

That is the strongest version:

- useful immediately
- visually compelling
- aligned with the current developer trend
- differentiated from static wiki generators
- still true to what Kosmos already is
