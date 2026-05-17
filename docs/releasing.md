# Releasing And Publishing

Use this checklist when you want the product, docs, screenshots, public repo, and npm package to feel polished at the same time.

## Preflight

Run the full local validation set:

```bash
npm test
npm run typecheck
npm run build
npm run build:npx
npm run website:build
```

## Documentation And Media Pass

Before publishing, make sure you have updated:

- `README.md`
- `docs/`
- `wiki/`
- the screenshot gallery in `docs/screenshots.md`
- release-facing website copy if the public positioning changed
- repository metadata and links that point at `chasefort/kosmosaos`

## Package Dry Run

```bash
npm run pack:dry
```

This repo currently works best with an isolated cache path during packaging so local cache ownership does not get in the way.

## Publishing `kosmos-aos`

1. Bump the version in `package.json` and `package-lock.json`.
2. Run the full preflight checks.
3. Dry-run the package with `npm run pack:dry`.
4. Publish with `npm publish`.
5. Verify the package starts with `npx kosmos-aos`.

## GitHub Release Flow

1. Create a version tag such as `v0.3.0`.
2. Push the tag.
3. Let CI and release automation complete.
4. Review the generated release notes.
5. Make sure the public repo README, docs, wiki pages, and screenshots match the release.

## Public Repo Polish

Kosmos is intended to be public source. Before pushing, run the release checklist in [../scripts/public-release-checklist.md](../scripts/public-release-checklist.md), scan for secrets, and confirm that build outputs, local databases, caches, and environment files are not tracked.

## Final Sanity Check

Before you call the release done, confirm:

- the install command in the README still works
- the screenshots still reflect the current product
- the docs do not describe removed screens or old routes
- the issue templates and PR template still match the workflow you expect contributors to follow
