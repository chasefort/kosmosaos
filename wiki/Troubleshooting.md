# Troubleshooting

## Graph Is Empty

The graph scanner found nothing to show.

- Confirm you opened the right directory. Check the workspace path in `Settings`.
- Make sure the workspace actually contains AI-related files: prompts, tools, agents, model references.
- Run a rescan from `Settings`.
- The scanner skips `node_modules`, `.git`, `dist`, and other build folders by design.
- Try a project with clearer AI-specific structure. A generic Node.js app with no prompts or agent code will produce a sparse graph.

## Live Activity Is Not Appearing

Runtime is connected but nothing shows up in the live views.

- Confirm the integration is connected in `Settings`.
- Confirm Kosmos and the runtime are pointed at the same workspace directory — this is the most common cause.
- Check `Runs` to see whether the session arrived even if live overlays look quiet.
- Restart the task once to rule out a stale session.
- For custom ingest: verify the endpoint is reachable with `curl http://localhost:41414/ingest`.

## Runs Appear But Look Incomplete

Sessions are visible but spans or events seem missing.

- Inspect the trace inspector to see whether the missing detail landed under a different span branch.
- Compare the span types — some events normalize as `agent_activity` rather than the specific call type you expected.
- Keep the task focused and short while validating so the expected span count is known.

## Prompt History Is Missing

You edited a file but no new version appeared.

- Make sure you're editing a file Kosmos recognizes as a prompt or instruction file (`.md`, `.txt`, common system prompt paths).
- Save a real versioned change — opening and closing without content changes does not create a version.
- Reopen the file in the Files screen if the UI still looks stale after saving.

## Port Conflict

Kosmos won't start because a port is already in use.

- Default UI port: `5588`. Custom port: `npx kosmos-aos --port 8080`.
- Default ingest port: `41414`. This port must be free for integrations to work.
- Kill the conflicting process: `lsof -i :5588` or `lsof -i :41414`.

## Workspace Scan Is Slow

- Large monorepos with many directories can take a moment on first scan. The scanner walks up to 5 levels deep.
- Subsequent scans reuse cached data.

## Electron App Won't Open

- Run `npm run dev` from the repo root and check the terminal for errors.
- Make sure `npm install` completed successfully (node-pty rebuild is required: `npm run postinstall`).
- Node.js 18+ required.

## When To Open An Issue

Open an issue at https://github.com/chasefort/kosmosaos/issues when you can describe:
- What workspace you opened
- What you expected to see
- What actually happened
- Whether the problem reproduced with `npx kosmos-aos`
