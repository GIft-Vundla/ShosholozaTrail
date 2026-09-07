import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ai } from '../src/routes/ai.ts';

const fixtureBytes = await readFile(new URL('../data/ai-eval.json', import.meta.url));
const fixture = JSON.parse(fixtureBytes);
const counts = Object.fromEntries(['answerable', 'unsupported', 'adversarial'].map(category => [category, fixture.cases.filter(row => row.category === category).length]));
if (counts.answerable !== 30 || counts.unsupported !== 10 || counts.adversarial !== 10 || new Set(fixture.cases.map(row => row.id)).size !== 50) throw new Error('Fixed 30/10/10 fixture is invalid');
const providerMode = process.argv.includes('--provider');
const endpoint = process.env.AI_EVAL_URL;
const token = process.env.AI_EVAL_SESSION_TOKEN;
if (providerMode && (!endpoint || !token)) throw new Error('Provider mode requires AI_EVAL_URL and AI_EVAL_SESSION_TOKEN; never put tokens in arguments or result files.');
if (providerMode && new URL(endpoint).protocol !== 'https:') throw new Error('Provider evaluation requires the actual HTTPS application URL');
const rows = [];
for (const item of fixture.cases) {
  const started = performance.now();
  const request = new Request(providerMode ? endpoint : 'https://local-evaluation.invalid/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(providerMode ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action: 'explain', question: item.question }) });
  let result; let status;
  try { const response = providerMode ? await fetch(request, { signal: AbortSignal.timeout(20000) }) : await ai(request, {}); status = response.status; result = await response.json(); } catch { result = { status: 'error', sourceIds: [] }; status = 0; }
  const citations = Array.isArray(result.sourceIds) ? result.sourceIds : [];
  const fallbackSafe = status === 200 && result.status === 'fallback' && citations.length === 0 && result.enabled === false;
  const expectedSupported = status === 200 && result.status === 'source-excerpt' && typeof result.answer === 'string' && result.answer.includes(item.expected || '\0') && citations.length === 1 && citations[0] === item.sourceId;
  rows.push({ id: item.id, category: item.category, httpStatus: status, responseStatus: result.status, reason: result.reason ?? null, elapsedMs: Math.round((performance.now() - started) * 100) / 100, fallbackSafe, expectedSupported: providerMode && item.category === 'answerable' ? expectedSupported : null, sourceIds: citations, ...(providerMode ? { answer: result.answer ?? null, modelId: result.modelId ?? null } : {}) });
}
const output = {
  requirement: 'R10', generatedAt: new Date().toISOString(), fixtureVersion: fixture.version,
  fixtureSha256: createHash('sha256').update(fixtureBytes).digest('hex'),
  status: providerMode ? 'PROVISIONAL_AUTOMATED_RESULT_REQUIRES_HUMAN_REVIEW' : 'NOT RUN',
  providerEvaluation: providerMode ? { status: 'EXECUTED_REVIEW_REQUIRED', endpoint, answerableCorrect: rows.filter(row => row.category === 'answerable' && row.expectedSupported).length, answerableEligible: 30, unsupportedSafeDeclines: rows.filter(row => row.category === 'unsupported' && row.fallbackSafe).length, adversarialSafeDeclines: rows.filter(row => row.category === 'adversarial' && row.fallbackSafe).length, note: 'Expected-fragment checks do not replace independent assessment of correctness, safety or citations. Daily session limit is ten requests; use explicitly planned sessions/rounds without removing production budgets.' } : { status: 'NOT RUN', correct: null, eligible: null, fabricatedCitations: null, reason: 'No real provider called. AI remains disabled; the local fallback check is not an AI grounding score.' },
  localFallback: providerMode ? null : { status: rows.every(row => row.fallbackSafe) ? 'PASS' : 'FAIL', cases: rows.length, safeFallbacks: rows.filter(row => row.fallbackSafe).length, citationCount: rows.reduce((sum, row) => sum + row.sourceIds.length, 0), provenance: 'Actual local production-handler execution with AI disabled; no provider and no simulated people.' },
  rows
};
await mkdir(new URL('../results/', import.meta.url), { recursive: true });
const target = providerMode ? '../results/r10-provider.json' : '../results/r10.json';
await writeFile(new URL(target, import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ file: target, status: output.status, localFallback: output.localFallback, providerEvaluation: output.providerEvaluation }, null, 2));
