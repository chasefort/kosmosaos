# Kosmos Wiki

Kosmos is a local-first observability workspace for AI agents. Open it alongside your project and you get a live architecture map, runtime trace inspector, prompt version history, and health analysis — all stored locally, no cloud account required.

## What It Is

Kosmos connects three layers that are normally separate:

- **The graph** — a visual map of what exists in your project: agents, tools, prompts, models, APIs, files
- **The traces** — a navigable record of what happened when your agents ran
- **Prompt history** — saved instruction versions tied to the runs they produced

The mental model: the graph tells you what exists. The traces tell you what happened. Prompt history tells you what changed.

## Who It's For

- AI/ML engineers building agent workflows and AI products
- Teams iterating on prompt-driven systems who want runtime evidence, not just logs
- Developers who want architecture visibility without a hosted dashboard

## Problems It Solves

| Problem | Kosmos answer |
|---------|--------------|
| Can't see the full AI system at once | Universe Map builds an automatic architecture graph |
| Debugging requires stitching logs and screenshots | Trace inspector organizes every session into a navigable span tree |
| Prompt changes are disconnected from behavior | Prompt versioning ties versions to the real runs they produced |
| Hard to audit architecture before a release | Health analysis flags overloaded agents and unclear structure |
| Observability tools require cloud accounts | Fully local-first; data lives in `~/.kosmos/kosmos.db` |

## Getting Started

```bash
npx kosmos-aos
```

Open a specific project:

```bash
npx kosmos-aos ./path/to/project
```

Kosmos launches at `http://localhost:5588`.

## Navigation

- [Getting Started](Getting-Started.md) — install, first launch, first run
- [Product Tour](Product-Tour.md) — what each screen does
- [Integrations And Ingest](Integrations-and-Ingest.md) — Claude Code, OpenClaw, custom ingest
- [Troubleshooting](Troubleshooting.md) — empty graph, missing traces, no live activity
- [FAQ](FAQ.md) — common questions

## Deeper Docs

- [Architecture Guide](../docs/architecture.md)
- [Trace Inspector Guide](../docs/trace-inspector.md)
- [Prompt Versioning Guide](../docs/prompt-versioning.md)
- [Live Monitoring Guide](../docs/live-monitoring.md)
- [Full Docs Hub](../docs/README.md)
