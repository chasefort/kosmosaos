# Architecture Guide

Kosmos combines static workspace understanding with live runtime evidence.

## The Main Building Blocks

- **Workspace scan**: discovers prompts, agents, tools, models, APIs, modules, and files
- **Runtime ingest**: normalizes live or imported runtime activity into canonical events
- **Runs and traces**: organizes runtime activity into sessions, threads, traces, and spans
- **Prompt history**: keeps prompt versions visible and tied to behavior
- **Local storage**: persists the graph and runtime evidence locally in SQLite

## The Mental Model

The graph tells you what exists.

The traces tell you what happened.

Prompt history tells you what changed.

Health analysis tells you what may become a problem next.

## Why The Combination Matters

A graph alone is too static.

Raw runtime events alone are too noisy.

Prompt history alone is too disconnected from outcomes.

Kosmos is useful because those three layers stay connected in one workspace.

## Key Screens And Their Jobs

- `Dashboard`: summarize the current state
- `Universe Map`: inspect the whole graph as a visual system
- `Flow View`: review structure in a cleaner 2D layout
- `Runs`: debug actual behavior
- `Health`: review architecture and prompt hygiene
- `Files`: edit instruction files without leaving the product

## Storage

Kosmos is local-first. The primary database lives at `~/.kosmos/kosmos.db`.

That matters for two reasons:

- you can use it without sending project structure or runtime evidence to a hosted dashboard
- the tool stays useful for local prototypes and internal workflows, not just production-scale systems
