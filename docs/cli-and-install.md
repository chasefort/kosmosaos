# CLI And Install Guide

Kosmos is designed to be easy to try and easy to point at a real workspace.

## Requirements

- Node.js 18 or newer
- a local project directory you want to inspect

## Fastest Launch

```bash
npx kosmos-aos
```

That starts Kosmos locally and opens the default browser experience.

## Common Launch Patterns

Open a specific project:

```bash
npx kosmos-aos ./path/to/project
```

Use a different port:

```bash
npx kosmos-aos --port 8080
```

Start without automatically opening a browser tab:

```bash
npx kosmos-aos ./project --no-open
```

## When To Use `npm run dev`

Use `npm run dev` when you are working on Kosmos itself and want the local development experience.

Use `npx kosmos-aos` when you want to run the packaged user-facing experience the way most people will install it.

## Launch Tips

- point Kosmos at the root of the project you actually care about
- use `--no-open` if you want to keep control of the browser session yourself
- if the wrong project appears in the UI, reopen with an explicit path instead of relying on your current working directory

## After Launch

Move to [Getting Started](getting-started.md) if you want a first-session walkthrough.
