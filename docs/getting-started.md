# Getting Started

This guide is the fastest path from "I just heard about Kosmos" to "I can tell whether my AI-assisted workspace is trustworthy."

## Quickstart

```bash
npx kosmos-aos
```

To open a specific project:

```bash
npx kosmos-aos ./path/to/project
```

To audit an Obsidian-style vault or Markdown knowledge base:

```bash
npx kosmos-aos ~/Obsidian/MyVault
```

Kosmos launches locally by default at `http://localhost:5588`.

## What To Expect On First Launch

- Kosmos scans the workspace and builds a context graph of notes, sources, outputs, prompts, instruction files, and code.
- prompt, instruction, wiki, source, and output files show up as first-class objects, not just raw files.
- the trust overview highlights broken links, missing sources, unsupported outputs, and other context gaps.
- runtime events are stored locally in `~/.kosmos/kosmos.db`.
- if no live runtime is connected yet, you can still audit static context health immediately.

## Your First Ten Minutes

1. Open a workspace that contains a Markdown vault, prompts, sources, generated outputs, tools, agents, or AI-heavy automation code.
2. Start on `Trust Overview` to see whether the workspace is healthy enough to trust.
3. Move to `Context Map` or `Flow View` to understand how notes, sources, outputs, instructions, and runtime objects connect.
4. Open `AI Sessions` and inspect the newest session, even if it is still running.
5. Edit a prompt file, save a new version, and confirm the prompt history is visible.
6. Check `Context Audit` for broken links, missing sources, unsupported outputs, and instruction risks.

## Core Screens

- `Trust Overview`: context health, source coverage, recent AI activity, and trust gaps
- `Context Map`: visual graph of the workspace plus live runtime signals
- `Flow View`: a cleaner 2D architecture layout for review and presentations
- `AI Sessions`: sessions list, replay controls, event list, and trace inspector
- `Context Audit`: broken links, missing sources, unsupported outputs, drift, and instruction quality checks
- `Files`: prompt and instruction editing inside the same workspace
- `Settings`: integration status, ingest endpoint, workspace controls, and app details

## What Makes A Good Demo Workspace

Kosmos looks best when the workspace includes some combination of:

- Obsidian-style Markdown notes or wiki pages
- raw source documents
- generated outputs or deliverables
- prompt or instruction files
- agent or workflow source code
- tool references such as file I/O or search
- model and API references
- real runs that touch files and emit events

If the graph looks sparse, the problem is usually the workspace, not the UI.

## Good First Checks

After your first successful run, verify that:

- the run appears in `AI Sessions`
- the trace inspector shows spans and tool calls
- the touched file is visible in the file explorer or graph
- the trust overview updates after the run
- a saved prompt version stays linked to the run you just executed

## Next Steps

- Use [CLI And Install Guide](cli-and-install.md) if you want launch flags or alternate startup patterns.
- Use [Product Positioning](product-positioning.md) to understand the Obsidian-adjacent trust-layer direction.
- Use [Architecture Guide](architecture.md) to understand what Kosmos is inferring.
- Use [Live Monitoring Guide](live-monitoring.md) once you have an active runtime connected.
- Use [Troubleshooting](troubleshooting.md) if your graph is empty or live activity does not appear.
