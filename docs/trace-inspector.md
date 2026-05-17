# Trace Inspector Guide

The trace inspector is the main debugging surface in Kosmos. It turns a session from a pile of events into a navigable explanation of what happened.

## What It Shows

- run status and timing
- span tree and parent-child structure
- model calls, tool calls, and agent branches
- token and cost totals
- touched nodes and files
- linked prompt versions
- saved feedback and dataset examples

## A Good Default Review Flow

1. Open the newest relevant run in `Runs`.
2. Read the top-level status and timing first.
3. Find the branch where the behavior changed.
4. inspect the event details for that span
5. follow the touched file or prompt if the issue is content-related
6. compare the active prompt version if the behavior changed after an instruction edit

## Questions The Trace Inspector Should Help You Answer

- Which tool touched this file?
- Which prompt version produced this output?
- Did the failure happen in a model call, tool call, or branching agent step?
- How much cost or token usage came from this run?
- Was this behavior new, or is it part of a recurring pattern?

## What To Look At First

- the root span status
- the first failing or suspicious child span
- usage and cost totals
- file writes
- the prompt version section
- replay controls if you need the story in order

## When It Is Most Valuable

- a run failed but the logs are too noisy
- the output is technically successful but obviously wrong
- prompt changes improved one case and hurt another
- a teammate needs a shareable explanation of the runtime path

## Best Practices

- review the whole run before making a prompt change
- save a dataset example when a run is especially representative
- score the run close to the time you inspect it
- link fixes back to a concrete span or file, not just a vague intuition
