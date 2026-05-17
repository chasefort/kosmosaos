# NPM Release Checklist

Use this when you want to publish the runnable Kosmos package to npm.

## What Becomes Public

- Anything inside the published npm tarball is public and downloadable.
- Old npm versions stay downloadable unless you explicitly remove or deprecate them.
- npm does not show your git diff history, but it does keep each published package version.

## Safe Release Flow

1. Build the npm runtime package:

```bash
npm run build:npx
```

2. Run the package safety audit:

```bash
npm run npm:check
```

3. Read the printed file list.
   The package should only contain:
   - `LICENSE`
   - `README.md`
   - `package.json`
   - `dist/server/`
   - `dist/main/`
   - `dist/shared/`
   - `out/browser/`
   - `out/main/index.js`

4. If the audit passes, publish:

```bash
npm publish
```

## What The Audit Protects Against

- unexpected folders like `.claude`, `website-v2`, `docs`, `scripts`, or `.github`
- internal doc filenames like `KOSMOS.md` or `KOSMOS_V1_IMPLEMENTATION_BRIEF.md`
- obvious leaked credential patterns such as GitHub tokens, npm tokens, OpenAI keys, AWS keys, and private key blocks

## Rules To Keep In Mind

- Treat every npm publish as public forever.
- Do not rely on `.gitignore` for npm safety.
- Keep the `files` allowlist in `package.json` narrow.
- Always run `npm run npm:check` before `npm publish`.
- If you are unsure, stop and inspect the printed package file list first.
