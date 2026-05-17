# Contributing To Kosmos

Thanks for helping improve Kosmos.

## Development Setup

```bash
npm install
npm test
npm run typecheck
npm run build
npm run build:npx
```

For website work:

```bash
npm --prefix website-v2 install
npm run website:build
```

## What Makes A Strong Contribution

- a clear problem statement
- a focused change set
- validation notes when behavior changes
- updated docs when the user-facing workflow changes
- screenshots or visual artifacts for UI changes when possible

## Docs And GitHub Surface Changes

If you change the public-facing product story, update the relevant surfaces together:

- `README.md`
- `docs/`
- `wiki/`
- screenshot references in `docs/screenshots.md`
- issue templates or release docs if the contributor workflow changed

## Public Vs Local Files

Only commit files that are part of the Kosmos product, docs, examples, tests, website, or release tooling.

Do not commit local operator files or personal workspace instructions, including root-level `AGENTS.md`, `CLAUDE.md`, `design.md`, `.env*`, `.claude/`, local databases, caches, build outputs, or machine-specific notes. Those files can live in your working folder, but they must stay ignored and untracked.

Before committing, prefer staging explicit paths:

```bash
git add README.md docs/ src/ package.json package-lock.json
```

Use `git add -A` only after reviewing `git status --short` and confirming every new file belongs in the public repo.

## Pull Request Checklist

- run the standard validation commands before opening the PR
- keep changes local-first and repo-aware
- add or update tests when behavior changes
- update docs when the product surface changes
- include screenshots for visible UI changes
- confirm `git status --short` does not include local-only instruction files, secrets, databases, build outputs, or personal notes

## Good First Contribution Areas

- runtime adapters and trace normalization
- live graph and file activity UX
- prompt/versioning and experiment loops
- docs, onboarding, screenshots, and release materials

## Reporting Bugs

Open an issue with:

- what you were doing
- what you expected
- what happened instead
- logs or screenshots if relevant
- whether the problem reproduced with `npx kosmos-aos`
