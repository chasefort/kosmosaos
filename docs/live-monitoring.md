# Live Monitoring Guide

Live monitoring is where Kosmos stops being a static architecture viewer and starts behaving like an operating console for a real local AI product.

## Goal

Use Kosmos while an agent is still running so you can answer questions like:

- what is the active agent doing right now?
- which tool was called most recently?
- which file was just read or written?
- is the runtime attached to the same workspace I am reviewing?

## Supported Live Sources

- Claude Code sessions
- OpenClaw events
- custom local ingest clients pointed at the Kosmos HTTP endpoint

See [Integrations Guide](integrations.md) for setup details.

## Recommended Workflow

1. Launch Kosmos and open the correct workspace.
2. Confirm the integration status in `Settings`.
3. Start the task in your runtime.
4. Keep `Dashboard`, `Universe Map`, or `Runs` open while the task is active.
5. Follow the active tool, current file, and recent events as the runtime progresses.
6. When the task ends, move into the trace inspector for a deeper review.

## What To Watch

- whether the session stays `running` until the runtime actually stops
- whether the active agent, tool, and file update in a believable order
- whether repeated tasks deduplicate cleanly instead of creating confusing noise
- whether touched files become visible even if file nodes are hidden by default
- whether imported history and live activity land in the same run family

## Manual Validation Checklist

1. Start Kosmos with `npm run dev` or `npx kosmos-aos ./your-project`.
2. Open a workspace that contains files the agent can touch.
3. Run one task that reads a file, writes a file, and finishes.
4. Confirm:
   - the run stays live until the session actually ends
   - the active agent, tool, and file appear in the UI
   - reads and writes correlate to the right file path
   - the run is inspectable in `Runs` after it completes

## If Live Activity Does Not Appear

- confirm that the workspace in Kosmos matches the workspace the runtime is touching
- confirm the runtime is actually connected in `Settings`
- check whether the session arrives in `Runs` even if the live overlays look quiet
- use [Troubleshooting](troubleshooting.md) for workspace mismatch, stale scans, and ingest problems
