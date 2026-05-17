# Public Release Checklist

Use this checklist when preparing the public `chasefort/kosmosaos` repository and the `kosmos-aos` npm package.

## Repo Model

- Public repo: full Kosmos source, docs, wiki source, examples, tests, release automation, and install guidance.
- npm package: runnable browser/server distribution with a narrow package allowlist.
- Local-only data: root-level `AGENTS.md`, `CLAUDE.md`, `design.md`, `.env*`, `.claude/`, `node_modules/`, build outputs, local databases, credentials, and machine-specific notes stay in the working folder only. They must not be tracked or pushed.

## Safety Rules

- Run a secret scan before pushing the full source repo.
- Keep npm packaging constrained by the `files` allowlist in `package.json`.
- Run `npm run npm:check` before publishing.
- Stage intentionally. Prefer `git add <paths>` for the exact product/docs files being released. Use `git add -A` only after reviewing every untracked file.
- Do not store GitHub, npm, OpenAI, cloud, or database tokens in remotes, docs, fixtures, screenshots, or examples.
- Treat public GitHub history and npm versions as durable public artifacts.

## Standard Public Repo Flow

1. Update product-facing docs, screenshots, examples, and website links.
2. Bump `package.json` and `package-lock.json`.
3. Run local validation:

```bash
npm test
npm run typecheck
npm run build:npx
npm run npm:check
```

4. Inspect `git status --short` and confirm there are no root-level `AGENTS.md`, `CLAUDE.md`, `design.md`, `.env*`, local databases, build outputs, caches, or personal notes staged.
5. Inspect `git diff --cached --stat`.
6. Run a repo-wide secret and local-path scan.
7. Push `main` to `https://github.com/chasefort/kosmosaos.git`.
8. Create and push a release tag such as `v0.3.0`.
9. Confirm GitHub Actions creates the release and npm publishes when `NPM_TOKEN` is configured.

## Manual npm Publish Fallback

If GitHub Actions does not publish because `NPM_TOKEN` is not configured:

```bash
npm publish
```

Then verify:

```bash
npx kosmos-aos --help
```

## Final Checks

- README screenshots render on GitHub.
- GitHub repo links point to `chasefort/kosmosaos`.
- npm metadata points to `chasefort/kosmosaos`.
- The package audit prints only the expected runtime files.
- No local database, secret, cache, or build-only folder is tracked.
- `git ls-files` does not include root-level `AGENTS.md`, `CLAUDE.md`, or `design.md`.
