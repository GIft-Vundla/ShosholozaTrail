import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = (process.env.SHOSHOLOZA_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
let bearer = '';
if (process.env.SHOSHOLOZA_USE_ROOM === '1') {
  const roomResponse = await fetch(`${baseUrl}/api/rooms/create`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000),
  });
  const room = await roomResponse.json();
  if (!roomResponse.ok || typeof room.token !== 'string') throw new Error('Could not create an isolated AI smoke-test session.');
  bearer = room.token;
}
const cases = [
  { name: 'explain', body: { action: 'explain', question: 'What is Freedom Park?' } },
  { name: 'hint', body: { action: 'hint', question: 'Give me a hint about the Big Hole.' } },
  { name: 'icebreaker', body: { action: 'icebreaker', question: 'Select one exact source passage about Pretoria; the interface will place it beside a local conversation prompt.' } },
  { name: 'draft', body: { action: 'draft', question: 'Select one exact source passage about Pretoria; the interface will place it beside a local postcard prompt.' } },
  { name: 'unanswerable', body: { action: 'explain', question: 'What did the stationmaster eat for breakfast in Pretoria on 3 June 1902?' } },
];

const results = [];
for (const item of cases) {
  try {
    const response = await fetch(`${baseUrl}/api/ai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(item.body),
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { invalidJson: text.slice(0, 160) }; }
    results.push({ name: item.name, statusCode: response.status, body });
  } catch (error) {
    results.push({ name: item.name, statusCode: 0, body: { error: error.message } });
  }
}

await mkdir('evidence', { recursive: true });
await writeFile('evidence/ai-live-smoke.json', `${JSON.stringify({ baseUrl, testedAt: new Date().toISOString(), authenticatedSession: Boolean(bearer), results }, null, 2)}\n`);
console.log(JSON.stringify(results));
