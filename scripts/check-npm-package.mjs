import { readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const tempCache = '/tmp/kosmos-npm-cache';

const allowedExactPaths = new Set([
  'LICENSE',
  'README.md',
  'package.json',
  'out/main/index.js'
]);

const allowedPrefixes = [
  'dist/server/',
  'dist/main/',
  'dist/shared/',
  'out/browser/'
];

const bannedPathPatterns = [
  /(^|\/)\.claude(\/|$)/i,
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)website(-v2)?(\/|$)/i,
  /(^|\/)docs\//i,
  /(^|\/)scripts\//i,
  /(^|\/)\.github\//i,
  /KOSMOS_V1_IMPLEMENTATION_BRIEF/i,
  /(^|\/)KOSMOS\.md$/i,
  /(^|\/)CONTRIBUTING\.md$/i,
  /(^|\/)SECURITY\.md$/i,
  /(^|\/)CODE_OF_CONDUCT\.md$/i
];

const textExtensions = new Set([
  '.js',
  '.cjs',
  '.mjs',
  '.json',
  '.md',
  '.txt',
  '.html',
  '.css',
  '.map'
]);

const secretPatterns = [
  { label: 'GitHub token', regex: /ghp_[A-Za-z0-9]{20,}/g },
  { label: 'GitHub fine-grained token', regex: /github_pat_[A-Za-z0-9_]{20,}/g },
  { label: 'npm token', regex: /npm_[A-Za-z0-9]{20,}/g },
  { label: 'OpenAI key', regex: /\bsk-(proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { label: 'AWS access key', regex: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { label: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { label: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { label: 'Private key block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { label: 'Internal implementation brief reference', regex: /KOSMOS_V1_IMPLEMENTATION_BRIEF|KOSMOS\.md/gi }
];

function fail(message, details = []) {
  console.error(`\n[npm:check] ${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function runNpmPackDryRun() {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: repoRoot,
    env: { ...process.env, npm_config_cache: tempCache },
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    fail('Unable to inspect npm package contents.', [
      result.stderr.trim() || result.stdout.trim() || 'npm pack --dry-run --json failed'
    ]);
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    fail('npm pack returned unreadable JSON output.', [String(error)]);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    fail('npm pack did not return any package metadata.');
  }

  return parsed[0];
}

function isAllowedPath(filePath) {
  if (allowedExactPaths.has(filePath)) {
    return true;
  }

  return allowedPrefixes.some((prefix) => filePath.startsWith(prefix));
}

function extensionFor(filePath) {
  const dotIndex = filePath.lastIndexOf('.');
  return dotIndex === -1 ? '' : filePath.slice(dotIndex);
}

function scanFileForSecrets(filePath) {
  const ext = extensionFor(filePath);
  if (!textExtensions.has(ext)) {
    return [];
  }

  const absolutePath = join(repoRoot, filePath);
  let contents = '';

  try {
    contents = readFileSync(absolutePath, 'utf8');
  } catch (error) {
    return [`Could not read ${filePath}: ${String(error)}`];
  }

  const findings = [];
  for (const pattern of secretPatterns) {
    const matches = contents.match(pattern.regex);
    if (matches && matches.length > 0) {
      findings.push(`${pattern.label} match in ${filePath}`);
    }
  }

  return findings;
}

const packInfo = runNpmPackDryRun();
const filePaths = packInfo.files.map((file) => file.path).sort();

const bannedPaths = filePaths.filter((filePath) =>
  bannedPathPatterns.some((pattern) => pattern.test(filePath))
);

if (bannedPaths.length > 0) {
  fail('Blocked publish because banned files would be shipped to npm.', bannedPaths);
}

const unexpectedPaths = filePaths.filter((filePath) => !isAllowedPath(filePath));
if (unexpectedPaths.length > 0) {
  fail('Blocked publish because npm would include files outside the approved allowlist.', unexpectedPaths);
}

const secretFindings = [];
for (const filePath of filePaths) {
  secretFindings.push(...scanFileForSecrets(filePath));
}

if (secretFindings.length > 0) {
  fail('Blocked publish because suspicious secret or internal-document patterns were found in packaged files.', secretFindings);
}

console.log('[npm:check] Package contents look safe.');
console.log(`[npm:check] Package: ${packInfo.name}@${packInfo.version}`);
console.log(`[npm:check] File count: ${filePaths.length}`);
for (const filePath of filePaths) {
  console.log(`- ${filePath}`);
}

rmSync(tempCache, { recursive: true, force: true });
