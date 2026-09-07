import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const excludedDirectories = new Set(['.git', 'node_modules', 'playwright-report', 'test-results']);
const forbiddenNames = new Set(['api keys.txt', '.dev.vars', '.env']);
const allowedExampleNames = new Set(['.env.example']);
const maxTextBytes = 8 * 1024 * 1024;

const prefix = (...parts) => parts.join('');
const signatures = [
  { name: 'Google API key', expression: new RegExp(`${prefix('AI', 'za')}[A-Za-z0-9_-]{35}`, 'g') },
  { name: 'OpenAI-style key', expression: new RegExp(`${prefix('s', 'k-')}[A-Za-z0-9_-]{20,}`, 'g') },
  { name: 'GitHub token', expression: new RegExp(`${prefix('gh', '[pousr]_')}[A-Za-z0-9]{20,}`, 'g') },
  { name: 'AWS access key', expression: new RegExp(`(?:${prefix('AK', 'IA')}|${prefix('AS', 'IA')})[A-Z0-9]{16}`, 'g') },
  { name: 'Slack token', expression: new RegExp(`${prefix('xo', 'x[baprs]-')}[A-Za-z0-9-]{20,}`, 'g') },
  { name: 'private key block', expression: new RegExp(prefix('-----BEGIN ', '(?:RSA |EC |OPENSSH )?', 'PRIVATE KEY-----'), 'g') },
  {
    name: 'assigned credential literal',
    expression: /(?:api[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|password)\s*[:=]\s*["'][A-Za-z0-9_./+=-]{20,}["']/gi
  },
  {
    name: 'credential in URL',
    expression: /[?&](?:key|api_key|access_token)=[A-Za-z0-9_./+=-]{20,}/gi
  }
];

const findings = [];
const skippedBinary = [];

function inspectText(text, label) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    for (const signature of signatures) {
      signature.expression.lastIndex = 0;
      if (signature.expression.test(lines[index])) findings.push(`${label}:${index + 1}: ${signature.name}`);
    }
  }
}

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    const label = relative(root, absolute).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      await walk(absolute);
      continue;
    }
    const lowerName = basename(entry.name).toLowerCase();
    if (!allowedExampleNames.has(lowerName) && (forbiddenNames.has(lowerName) || lowerName.startsWith('.dev.vars.'))) {
      findings.push(`${label}: forbidden credential filename`);
    }
    const size = (await stat(absolute)).size;
    if (size > maxTextBytes) {
      skippedBinary.push(`${label} (${size} bytes)`);
      continue;
    }
    const bytes = await readFile(absolute);
    if (bytes.includes(0) && extname(lowerName) !== '.svg') {
      skippedBinary.push(`${label} (${size} bytes)`);
      continue;
    }
    inspectText(bytes.toString('utf8'), label);
  }
}

await walk(root);

// Removed credentials remain findings because every committed patch is scanned too.
const history = spawnSync('git', ['log', '--all', '--format=commit:%H', '-p', '--no-ext-diff', '--no-textconv'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
});
if (history.status === 0) inspectText(history.stdout, 'git-history');
else findings.push(`git-history: scan failed (${history.stderr.trim() || `exit ${history.status}`})`);

if (!(await stat(resolve(root, 'dist')).catch(() => null))) {
  findings.push('dist: built Worker output missing; run npm run build before this acceptance scan');
}

if (findings.length) {
  console.error('Secret scan FAILED. Values are redacted; only locations and signature classes are shown.');
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log('Secret scan PASS: working tree, public assets, built Worker output and Git patch history contain no recognized credential signatures.');
}

if (skippedBinary.length) {
  console.log(`Binary/oversize files not content-scanned (${skippedBinary.length}); review release screenshots and archives manually:`);
  for (const item of skippedBinary) console.log(`- ${item}`);
}
