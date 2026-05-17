# Integrations Guide

Kosmos becomes much more useful when the workspace graph and the runtime activity land in the same place.

## Supported Sources

- Claude Code
- OpenClaw
- custom local ingest clients

## Local Ingest Endpoint

Kosmos exposes a local HTTP ingest endpoint from `Settings`.

The default endpoint is:

```text
http://localhost:41414/ingest
```

Use it when you want to send normalized local runtime events from another SDK or internal tool.

## Best Practices

- keep the workspace in Kosmos aligned with the workspace the runtime is touching
- prefer one canonical local workspace per product area
- verify connection status in `Settings` before assuming the graph is stale
- check `Runs` first if you think events are arriving but not rendering the way you expect

## When To Use Custom Ingest

Custom ingest is useful when:

- you have a local tool runner that is not natively supported
- you want Kosmos to visualize a proprietary internal runtime
- you want a single observability surface for multiple local agent systems
