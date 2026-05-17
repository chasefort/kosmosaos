# Product Tour

A walkthrough of the six main screens in Kosmos.

---

## Dashboard

The dashboard is your orientation screen. Open it first when you want a fast snapshot of the workspace state.

**What it shows:**
- Graph size — how many nodes and edges were detected
- Recent activity — last run time and session recency
- Tool usage — which tools have been called most
- Model usage — which models are active
- Connected runtimes — what is currently plugged in

**When to use it:** At the start of a session to confirm the workspace was scanned correctly and a runtime is connected.

---

## Universe Map

The Universe Map is a 3D (and 2D) interactive graph of everything Kosmos detected in the workspace: agents, tools, prompts, models, APIs, files, and the connections between them.

**What it shows:**
- All detected nodes positioned by relationship
- Live runtime activity overlaid on the graph as events arrive
- Node details on click (type, connections, linked runs)
- Active tool, current file, and running agent highlighted during live sessions

**When to use it:** To understand the shape of the system before diving into a specific run. Also useful for spotting structural problems (islands, overloaded nodes, missing connections).

---

## Flow View

The Flow View renders the same graph in a clean 2D flowchart layout using Dagre. Better for reviews, documentation, and presentations.

**When to use it:** When you want a stable readable layout — sharing with a teammate, reviewing architecture before a release, or just preferring 2D navigation.

---

## Runs

The Runs screen is where you debug real behavior. Every session that Kosmos receives from a connected runtime gets stored here.

**What it shows:**
- Session list sorted by recency
- Per-run status (running, complete, error)
- Trace inspector: the full span tree for a session
  - Model calls, tool calls, agent branches
  - Token and cost totals
  - Touched files and nodes
  - Linked prompt version active during the run
- Replay controls for stepping through the event sequence
- Feedback and dataset example saving

**When to use it:** After a run completes to understand what happened. Also useful mid-run for live inspection. See the [Trace Inspector Guide](../docs/trace-inspector.md) for the full debugging workflow.

---

## Health

The Health screen audits the static architecture for issues before you ship.

**What it checks:**
- Overloaded agents (too many responsibilities)
- Unclear structural coupling between components
- Prompt file hygiene (bloat, TODOs in runtime instructions, duplicate instructions)
- Missing connections that suggest incomplete architecture

**When to use it:** Before a significant release or when the architecture has grown in unexpected ways.

---

## Files

The Files screen is an integrated editor for prompt and instruction files detected in the workspace.

**What it does:**
- Browse workspace files without leaving Kosmos
- Edit prompt/instruction files with syntax support
- Save a new version (creates a versioned snapshot tied to future runs)
- View prompt version history inline

**When to use it:** When iterating on prompts and you want versions tied to run evidence rather than disconnected git commits. See the [Prompt Versioning Guide](../docs/prompt-versioning.md).

---

## Settings

Settings is where you configure the workspace and integrations.

**What it controls:**
- Current workspace path
- Integration status (Claude Code, OpenClaw)
- Ingest endpoint (default: `http://localhost:41414/ingest`)
- Rescan workspace
- App version and diagnostics
