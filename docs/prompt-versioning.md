# Prompt Versioning Guide

Prompt changes are often the fastest way to improve an agent workflow, but they are also the easiest changes to lose in normal file history. Kosmos keeps prompt work tied to the runs it produced.

## What Kosmos Tracks

- prompt and instruction files discovered in the workspace
- saved versions over time
- trace links back to the prompt version active during a run
- saved examples and feedback connected to those versions

## Recommended Loop

1. Open a prompt or instruction file in Kosmos.
2. Make one meaningful change.
3. Save the new version.
4. Re-run the same task or dataset example.
5. Inspect the new trace.
6. Record feedback while the comparison is fresh.

## What Makes This Better Than Plain Git History

- the version is tied to a real run, not just a commit
- you can review the runtime evidence without leaving the workspace
- prompt work stays close to costs, files, and touched nodes
- the comparison stays grounded in behavior, not just text differences

## Good Versioning Habits

- make one intent change at a time
- keep example tasks around so you can compare like-for-like
- save dataset examples for runs you care about
- do not bundle architecture changes and prompt changes into the same experiment if you can avoid it

## Common Mistakes

- changing multiple instructions at once and calling the result a prompt experiment
- forgetting to score the run before context fades
- comparing two versions against different tasks and assuming the result is meaningful
- letting TODO or release-only notes live inside runtime prompts
