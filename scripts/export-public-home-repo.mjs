#!/usr/bin/env node

import { spawnSync } from 'child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { dirname, join, relative, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const allowlist = [
  'README.md',
  'docs',
  'wiki'
]

const docsAllowlist = new Set([
  'README.md',
  'architecture.md',
  'cli-and-install.md',
  'faq.md',
  'getting-started.md',
  'integrations.md',
  'live-monitoring.md',
  'prompt-versioning.md',
  'releasing.md',
  'screenshots.md',
  'trace-inspector.md',
  'troubleshooting.md',
  join('screenshots', 'overview.png'),
  join('screenshots', 'trace-inspector.png'),
  join('screenshots', 'architecture-map.svg'),
  join('screenshots', 'prompt-workbench.svg'),
  join('screenshots', 'health-overview.svg'),
  join('screenshots', 'integrations-panel.svg')
])

const secretPatterns = [
  /ghp_[A-Za-z0-9]+/g,
  /github_pat_[A-Za-z0-9_]+/g,
  /npm_[A-Za-z0-9]{20,}/g,
  /_authToken/gi,
  /Authorization:\s*token\s+/gi,
  /NPM_TOKEN=/g,
  /GITHUB_TOKEN=/g,
  /AKIA[0-9A-Z]{16}/g
]

function usage() {
  console.log(`Usage:
  node scripts/export-public-home-repo.mjs --public-url <https-url> [options]

Options:
  --out <dir>         Export into this directory instead of a temp dir
  --tag <tag>         Optional tag to create in the public snapshot
  --message <msg>     Commit message (default: "docs: publish public project home")
  --push              Push the exported docs snapshot to --public-url
  --force             Force-push the exported docs snapshot and matching tag
  --help              Show this help
`)
}

function parseArgs(argv) {
  const parsed = { push: false, force: false }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help') parsed.help = true
    else if (arg === '--public-url') parsed.publicUrl = argv[++i]
    else if (arg === '--out') parsed.outDir = argv[++i]
    else if (arg === '--tag') parsed.tag = argv[++i]
    else if (arg === '--message') parsed.message = argv[++i]
    else if (arg === '--push') parsed.push = true
    else if (arg === '--force') parsed.force = true
    else throw new Error(`Unknown argument: ${arg}`)
  }

  return parsed
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    const suffix = options.capture
      ? `\n${result.stderr || result.stdout || ''}`.trimEnd()
      : ''
    throw new Error(`Command failed: ${command} ${args.join(' ')}${suffix ? `\n${suffix}` : ''}`)
  }

  return options.capture ? (result.stdout ?? '').trim() : ''
}

function normalizeRepoUrls(inputUrl) {
  const withoutGit = inputUrl.replace(/\.git$/, '')
  const withoutCreds = withoutGit.replace(/^https?:\/\/[^/@\s]+@github\.com\//, 'https://github.com/')
  return {
    publicWebUrl: withoutCreds,
    publicGitUrl: `${withoutCreds}.git`
  }
}

function copyAllowlist(outDir) {
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  for (const relPath of allowlist) {
    const from = join(repoRoot, relPath)
    const to = join(outDir, relPath)
    cpSync(from, to, { recursive: true })
  }

  const docsDir = join(outDir, 'docs')
  function pruneDocs(currentDir, relPrefix = '') {
    for (const entry of readdirSync(currentDir)) {
      const abs = join(currentDir, entry)
      const rel = relPrefix ? join(relPrefix, entry) : entry
      const stat = lstatSync(abs)
      if (stat.isDirectory()) {
        pruneDocs(abs, rel)
        if (readdirSync(abs).length === 0) rmSync(abs, { recursive: true, force: true })
        continue
      }
      if (!docsAllowlist.has(rel)) rmSync(abs, { force: true })
    }
  }

  pruneDocs(docsDir)
}

function rewriteReadme(outDir, publicWebUrl) {
  const readmePath = join(outDir, 'README.md')
  const readme = `# Kosmos

[![Website](https://img.shields.io/badge/site-getkosmos.xyz-0f172a.svg)](https://www.getkosmos.xyz)

**Kosmos gives you a live map of your AI product so you can see what is running, understand why it behaved that way, and improve it without leaving the codebase.**

Kosmos is a local-first desktop and browser experience for understanding agent systems. It brings architecture, runtime activity, traces, prompt history, and file context into one place so you can debug and improve your workflow faster.

![Kosmos Architecture Map](docs/screenshots/architecture-map.svg)

## Get Started

\`\`\`bash
npx kosmos-aos
\`\`\`

No install. No signup. No cloud. Opens locally in your browser at \`http://localhost:5588\`.

\`\`\`bash
npx kosmos-aos ./path/to/your/project
npx kosmos-aos --port 8080
npx kosmos-aos ./project --no-open
\`\`\`

**Requires Node.js 18+**

- Website: [www.getkosmos.xyz](https://www.getkosmos.xyz)
- Docs hub: [docs/README.md](docs/README.md)
- Wiki source: [wiki/Home.md](wiki/Home.md)
- Releases: [${publicWebUrl}/releases](${publicWebUrl}/releases)

## Product Tour

| Overview | Trace Inspector |
| --- | --- |
| ![Kosmos Overview](docs/screenshots/overview.png) | ![Trace Inspector](docs/screenshots/trace-inspector.png) |

| Prompt Workbench | Health Analysis |
| --- | --- |
| ![Prompt Workbench](docs/screenshots/prompt-workbench.svg) | ![Health Analysis](docs/screenshots/health-overview.svg) |

## Why Teams Use Kosmos

- **See the whole system**. Map agents, tools, prompts, models, APIs, files, and runtime edges in one visual workspace.
- **Debug with evidence**. Inspect traces, spans, file writes, prompt versions, and costs instead of hunting through raw logs.
- **Improve prompts in context**. Keep version history, feedback, and real runs close together.
- **Stay local-first**. Your data stays on your machine.

## Guides

- [Docs Hub](docs/README.md)
- [Getting Started](docs/getting-started.md)
- [CLI And Install Guide](docs/cli-and-install.md)
- [Architecture Guide](docs/architecture.md)
- [Live Monitoring Guide](docs/live-monitoring.md)
- [Trace Inspector Guide](docs/trace-inspector.md)
- [Prompt Versioning Guide](docs/prompt-versioning.md)
- [Integrations Guide](docs/integrations.md)
- [Troubleshooting](docs/troubleshooting.md)
- [FAQ](docs/faq.md)
- [Screenshots And Product Tour](docs/screenshots.md)
- [Wiki Home](wiki/Home.md)

## About This Repo

This generated repository is a docs-only Kosmos snapshot: README, docs, wiki pages, screenshots, release notes, and install guidance.

The normal public release flow now publishes the full source repository at https://github.com/chasefort/kosmosaos and the runnable product through npm. Use this exporter only when you intentionally need a constrained docs snapshot.
`

  writeFileSync(readmePath, readme)
}

function rewriteDocsIndex(outDir) {
  const docsIndexPath = join(outDir, 'docs/README.md')
  const docsIndex = `# Kosmos Docs

These guides are the fastest way to get productive with Kosmos.

- [Architecture Guide](architecture.md)
- [CLI And Install Guide](cli-and-install.md)
- [FAQ](faq.md)
- [Getting Started](getting-started.md)
- [Integrations Guide](integrations.md)
- [Live Monitoring Guide](live-monitoring.md)
- [Trace Inspector Guide](trace-inspector.md)
- [Prompt Versioning Guide](prompt-versioning.md)
- [Releasing And Publishing](releasing.md)
- [Screenshots And Product Tour](screenshots.md)
- [Troubleshooting](troubleshooting.md)

## Recommended Reading Order

1. Start with [Getting Started](getting-started.md)
2. Learn the product shape in [Architecture Guide](architecture.md)
3. Validate live activity with [Live Monitoring Guide](live-monitoring.md)
4. Learn run debugging with [Trace Inspector Guide](trace-inspector.md)
5. Learn iteration workflows with [Prompt Versioning Guide](prompt-versioning.md)
`

  writeFileSync(docsIndexPath, docsIndex)
}

function collectFiles(rootDir) {
  const collected = []

  function walk(currentDir) {
    for (const entry of readdirSync(currentDir)) {
      const abs = join(currentDir, entry)
      const rel = relative(rootDir, abs)
      const stat = lstatSync(abs)
      if (stat.isDirectory()) {
        collected.push({ rel, abs, isDirectory: true })
        walk(abs)
      } else {
        collected.push({ rel, abs, isDirectory: false })
      }
    }
  }

  walk(rootDir)
  return collected.sort((a, b) => a.rel.localeCompare(b.rel))
}

function ensureDocsOnly(outDir) {
  const allowedTopLevel = new Set(['README.md', 'docs', 'wiki', '.git'])
  const topLevelEntries = readdirSync(outDir)
  const unexpected = topLevelEntries.filter((entry) => !allowedTopLevel.has(entry))

  if (unexpected.length > 0) {
    throw new Error(`Public home export contains unexpected top-level paths:\n${unexpected.join('\n')}`)
  }
}

function ensureNoSecrets(outDir) {
  const matches = []
  for (const entry of collectFiles(outDir)) {
    if (entry.isDirectory) continue
    const content = readFileSync(entry.abs, 'utf8')
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        matches.push(entry.rel)
        break
      }
    }
  }

  if (matches.length > 0) {
    throw new Error(`Public home export contains secret-like content:\n${matches.join('\n')}`)
  }
}

function initGitSnapshot(outDir, message, tag, publicGitUrl, push, force) {
  run('git', ['init', '-b', 'main'], { cwd: outDir })
  run('git', ['add', '-A'], { cwd: outDir })
  run('git', ['commit', '-m', message], { cwd: outDir })

  if (tag) {
    run('git', ['tag', '-a', tag, '-m', message], { cwd: outDir })
  }

  if (push) {
    run('git', ['remote', 'add', 'origin', publicGitUrl], { cwd: outDir })
    const pushMainArgs = force ? ['push', '--force', '-u', 'origin', 'main'] : ['push', '-u', 'origin', 'main']
    run('git', pushMainArgs, { cwd: outDir })

    if (tag) {
      const pushTagArgs = force ? ['push', '--force', 'origin', `refs/tags/${tag}`] : ['push', 'origin', `refs/tags/${tag}`]
      run('git', pushTagArgs, { cwd: outDir })
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    usage()
    return
  }

  if (!args.publicUrl) {
    usage()
    throw new Error('--public-url is required')
  }

  const { publicWebUrl, publicGitUrl } = normalizeRepoUrls(args.publicUrl)
  const outDir = args.outDir ? resolve(args.outDir) : mkdtempSync(join(tmpdir(), 'kosmos-public-home-'))
  const message = args.message ?? 'docs: publish public project home'

  copyAllowlist(outDir)
  rewriteReadme(outDir, publicWebUrl)
  rewriteDocsIndex(outDir)
  ensureDocsOnly(outDir)
  ensureNoSecrets(outDir)
  initGitSnapshot(outDir, message, args.tag, publicGitUrl, args.push, args.force)
  console.log(`Public home export ready at: ${outDir}`)
}

try {
  main()
} catch (error) {
  console.error(`[public-home-export] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
