# FAQ

## Does Kosmos require a cloud account?

No. Kosmos is fully local-first. Everything is stored in `~/.kosmos/kosmos.db` on your machine. No account, no cloud sync, no telemetry.

## Where does Kosmos store data?

`~/.kosmos/kosmos.db` — a local SQLite database. Runs, traces, prompt versions, and workspace metadata all live here.

## How do I run Kosmos?

```bash
npx kosmos-aos
```

Or open a specific project:

```bash
npx kosmos-aos ./path/to/project
```

Node.js 18+ required. No global install needed.

## What kinds of projects fit best?

Projects with prompts, agent logic, tool usage, file-heavy workflows, or live runtime events. The more AI-specific structure the workspace has, the more useful the graph and traces become.

## Is Kosmos framework-specific?

No. It works with any project that exposes prompts, tools, agents, models, and runtime events clearly. It has native integrations for Claude Code and OpenClaw, plus a generic HTTP ingest endpoint for anything else.

## My graph looks empty. Why?

- The workspace may not have much AI-specific structure (prompts, tools, agents). Try a project with clearer AI files.
- You may have opened the wrong directory. Confirm the path in `Settings` and try a rescan.
- Files deeply nested under `node_modules`, `.git`, or `dist` are skipped by the scanner.

## Do I have to use live integrations?

No. The static architecture views (Universe Map, Flow View, Health) are useful on their own. Live integrations make Kosmos significantly more valuable but are not required to get started.

## Can I use Kosmos as a desktop app?

Yes. Download the DMG from the releases page or build it yourself:

```bash
npm install && npm run package
```

## How do I connect a custom runtime?

POST `KosmosEvent` objects to `http://localhost:41414/ingest`. See [Integrations And Ingest](Integrations-and-Ingest.md) for the full setup.

## Where can I get help or report a bug?

Open an issue at https://github.com/chasefort/kosmosaos/issues. Include what workspace you opened, what you expected, what actually happened, and whether it reproduced with `npx kosmos-aos`.
