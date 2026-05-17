# Integrations And Ingest

Kosmos becomes most useful when the workspace graph and runtime activity live in the same place. Integrations are how runtime events get into Kosmos.

## Supported Sources

### Claude Code (native)
Claude Code has a native integration. Kosmos auto-detects Claude Code sessions when the workspace matches. No additional configuration required — check connection status in `Settings`.

### OpenClaw (native)
OpenClaw is natively supported. Same setup as Claude Code: confirm the workspace paths match and check `Settings` for connection status.

### Custom Local Ingest (HTTP)
Any runtime can send events to Kosmos via the local HTTP ingest endpoint:

```
http://localhost:41414/ingest
```

POST normalized `KosmosEvent` objects to this endpoint. Use this when:
- Your tool runner is not natively supported
- You want to visualize a proprietary internal runtime
- You want a single observability surface for multiple local agent systems

The event schema is defined in `src/shared/types.ts` in the repo. Key event types:

```
session_start | session_end | agent_activity | user_prompt |
assistant_response | tool_call | model_call | memory_read | error
```

## Setup Steps

1. Launch Kosmos with `npx kosmos-aos ./your-project` (or open the Electron app).
2. Open `Settings` and verify integration status.
3. Confirm the workspace in Kosmos matches the workspace the runtime is touching — this is the most common source of missing data.
4. Start your task in the connected runtime.
5. Watch `Dashboard`, `Universe Map`, or `Runs` for live activity.

## Best Practices

- Keep the workspace path consistent across Kosmos and the runtime
- Use one canonical workspace per product area when possible
- Check `Settings` for connection status before assuming the graph is stale
- If events seem to be arriving but the live surfaces look quiet, check `Runs` first — the session may be arriving under a different path

## Troubleshooting Integrations

See [Troubleshooting](Troubleshooting.md) for the full checklist. Quick checks:
- Runtime and Kosmos must point at the same workspace directory
- Restart the runtime task once to rule out a stale session
- Rescan from `Settings` if the static graph looks wrong
- Verify the ingest endpoint is reachable: `curl http://localhost:41414/ingest`
