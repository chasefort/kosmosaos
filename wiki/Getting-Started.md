# Getting Started

## Quickest Path

```bash
npx kosmos-aos
```

Point at a specific project:

```bash
npx kosmos-aos ./path/to/project
```

Kosmos opens in your browser at `http://localhost:5588`. No install required. Node.js 18+ is the only prerequisite.

## What Happens On First Launch

1. Kosmos scans the workspace and builds a graph of detected nodes (agents, prompts, tools, models, APIs, files).
2. The graph is available immediately — no runtime connection needed to explore static architecture.
3. Runtime events (if a supported integration is connected) start populating Runs and the live overlays.
4. All data is stored locally at `~/.kosmos/kosmos.db`.

## Your First Ten Minutes

1. Open a workspace that actually contains prompts, tools, agents, or AI-heavy code. The graph will be sparse if the project has none.
2. Start on the **Dashboard** — confirm the graph detected nodes and note any connected runtimes.
3. Move to **Universe Map** or **Flow View** to see the architecture visually.
4. Run a task in your connected runtime (Claude Code, etc.) and watch **Runs** for the session to appear.
5. Open the trace inspector on the completed run and review the span tree.
6. Open a prompt file in **Files**, make a change, save a version, and confirm it shows up in prompt history.

## What Makes A Good Workspace

Kosmos looks most useful when the project contains:

- Prompt or instruction files (`.md`, `.txt`, system prompt files)
- Agent or workflow source code
- Tool call references
- Model or API references
- Active runtime that emits events

If the graph looks sparse after a scan, the workspace may not have much AI-specific structure — try a different directory or check [Troubleshooting](Troubleshooting.md).

## Electron Desktop App

If you prefer a native app:

```bash
git clone https://github.com/chasefort/kosmosaos.git
cd kosmos
npm install
npm run dev
```

Or build a DMG:

```bash
npm run package
```

## Verifying A Good Setup

After your first real run, check:

- [ ] Run appears in `Runs`
- [ ] Trace inspector shows spans and tool calls
- [ ] Touched file is visible in the file explorer or graph
- [ ] Dashboard updated after the run
- [ ] Saved prompt version stays linked to the run

## Next Steps

- [Product Tour](Product-Tour.md) — what each screen does
- [Integrations And Ingest](Integrations-and-Ingest.md) — connect Claude Code or a custom runtime
- [Troubleshooting](Troubleshooting.md) — empty graph or missing live activity
- [Full docs hub](../docs/README.md) — deeper guides on every feature
