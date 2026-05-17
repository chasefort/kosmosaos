# Troubleshooting

## The Graph Is Empty

- confirm you opened the right directory
- make sure the workspace actually contains prompts, tools, agents, or model references
- rescan from `Settings`
- try a project with clearer AI-specific files before assuming the scanner is broken

## Live Activity Is Not Appearing

- confirm the runtime is connected in `Settings`
- confirm the runtime and Kosmos are pointed at the same workspace
- check whether the session appears in `Runs` even if the live overlays look quiet
- restart the task once to rule out a stale session

## Runs Are Appearing But They Look Incomplete

- inspect the trace inspector to see whether the missing detail was normalized under a different event branch
- compare an imported session and a live session to make sure they correlate the same way
- keep the runtime task focused while validating so you can reason about what should appear

## Prompt History Is Missing

- make sure you are editing a file Kosmos recognizes as a prompt or instruction file
- save a real versioned change, not just a temporary open-and-close
- reopen the file after saving if the UI still looks stale

## Public Repo Or Docs Feel Out Of Date

- update `README.md`, `docs/`, and `wiki/` together
- refresh the gallery in `docs/screenshots.md`
- run through the release checklist before publishing

## When To Open An Issue

Open an issue when you can describe:

- what workspace you opened
- what you expected to see
- what actually happened
- whether the same problem reproduced with `npx kosmos-aos`
