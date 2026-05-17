# Product Positioning

Kosmos is the local trust layer for AI working inside Obsidian-style vaults, repos, prompts, and knowledge bases.

It should not compete with Obsidian as a writing app. Obsidian is where people write, link, and navigate their notes. Kosmos should sit beside it and answer the question Obsidian does not answer on its own:

> Can I trust what my AI just did to this workspace?

## One-Sentence Pitch

Kosmos shows what AI agents read, changed, cited, missed, or broke in your local vault or repo.

## Audience

- Obsidian users letting AI assistants operate on their vaults
- developers using Claude Code, Codex, Cursor, OpenClaw, or local agents against a repo
- researchers and builders turning raw notes into generated outputs
- prompt and agent builders who need replay, provenance, and context health without a hosted dashboard

## The Problem

AI tools are increasingly allowed to read, edit, summarize, reorganize, and generate from local context. Once that happens, users lose track of:

- which files the agent actually read
- which notes, prompts, and instruction files shaped the answer
- which outputs are grounded in sources
- which links, citations, or assumptions broke
- which generated artifacts are stale
- which changes came from a human versus an AI session

The pain is not "I need another markdown editor." The pain is "I need evidence before I trust this AI-assisted workspace."

## What Kosmos Owns

Kosmos should own agent accountability over local context:

- context graph: notes, sources, outputs, prompts, instructions, tools, and files
- live activity: what an AI tool is reading, writing, calling, and producing
- replay: what happened in a session, in order, with file evidence
- provenance: what sources support this output
- context health: broken links, missing sources, orphan notes, stale outputs, risky instructions

## What Kosmos Does Not Own

Kosmos should not try to replace:

- Obsidian as the primary writing and note navigation environment
- VS Code or other editors as the primary coding environment
- hosted production observability platforms for large SaaS telemetry
- full project management, CRM, or document management workflows

## Product Language

Prefer:

- Trust Overview
- Context Map
- AI Sessions
- Context Audit
- Source Coverage
- Unsupported Outputs
- Agent-Touched Files
- Broken Links
- Missing Sources

Avoid leading with:

- generic dashboard
- universe map as the main promise
- architecture observability
- AI operating system
- markdown editor
- note-taking app

## GitHub Star Wedge

The star-worthy wedge should be fast, local, and easy to demo:

```bash
npx kosmos-aos ~/Obsidian/MyVault
npx kosmos-aos ./path/to/your-vault
npx kosmos-aos ./examples/ai-context-vault
```

Then Kosmos should immediately show:

- AI readiness score for the vault or repo
- prioritized review queue for the worst context issues
- broken wikilinks
- pages missing sources
- orphan notes
- generated outputs without provenance
- instruction files that shape AI behavior
- recent AI sessions and touched files when live ingest is connected

The emotional payoff should be:

> I can let AI work in my vault without losing the plot.

## Product Changes Needed

### 1. Make Obsidian-style vaults first-class

- detect `.obsidian/`
- parse wikilinks, aliases, tags, frontmatter, and source fields
- show an explicit vault badge in the first screen
- add launch examples for Obsidian vaults
- avoid presenting Kosmos as a replacement editor

### 2. Rebuild the first screen around trust

- lead with "Can I trust this workspace?"
- prioritize health score, missing sources, broken links, unsupported outputs, stale outputs, and recent AI activity
- make "what needs review" more important than generic event volume

### 3. Make AI activity obvious

- create a prominent "AI changed this" workflow
- show agent-touched files by session
- distinguish reads, writes, generated outputs, and prompt/instruction changes
- alert when a session introduces broken links or unsupported outputs

### 4. Make provenance the core interaction

- every output should show what it derives from
- every note should show incoming and outgoing context evidence
- every session should show the context path the agent traversed

### 5. Ship an Obsidian companion path

- start with docs and CLI examples
- later add an Obsidian plugin with commands like "Open in Kosmos" and "Run Context Audit"
- keep the full graph, replay, and audit views in Kosmos instead of trying to rebuild them inside Obsidian

## Product Test

Before adding a feature, ask:

Does this help a user understand what AI read, changed, cited, missed, or broke?

If yes, it belongs.

If no, it is probably a distraction until the core trust workflow is unmistakable.
