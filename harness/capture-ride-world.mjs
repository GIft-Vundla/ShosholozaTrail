import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
await mkdir(path.join(root, 'evidence'), { recursive: true });
const browser = await chromium.launch({ headless: true });

async function openRide(query) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  const vectorResponses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => {
    if (response.url().startsWith('https://tiles.openfreemap.org/') && response.ok()) vectorResponses.push(response.url());
  });
  await page.goto(`${baseUrl}/ride?${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ride[data-route-state="ready"]', { timeout: 30_000 });
  await page.waitForSelector('.maplibregl-canvas', { timeout: 15_000 });
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Step forward; hold for continuous ride"]')?.hasAttribute('disabled'), undefined, { timeout: 30_000 });
  const close = page.getByRole('button', { name: 'Return to the track' });
  if (await close.count()) await close.click();
  await page.waitForTimeout(7_000);
  if (errors.length) throw new Error(errors.join(' | '));
  return { page, vectorResponses };
}

const { page: dusk } = await openRide('hub=matjiesfontein&time=dusk');
const period = await dusk.locator('.ride').getAttribute('data-sky-period');
if (period !== 'dusk') throw new Error(`Dusk ride clock did not activate (received ${period} at ${await dusk.url()}).`);
await dusk.screenshot({ path: path.join(root, 'evidence/ride-sky-dusk.png') });
await dusk.close();

for (const hub of ['matjiesfontein', 'kimberley']) {
  const { page, vectorResponses } = await openRide(`hub=${hub}&time=midday`);
  if (!vectorResponses.length) throw new Error(`No OpenFreeMap vector response was observed at ${hub}.`);
  await page.screenshot({ path: path.join(root, `evidence/ride-buildings-${hub}.png`) });
  await page.close();
}

const videoContext = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: path.join(root, 'test-results', 'ride-world-video'), size: { width: 1280, height: 720 } },
});
const discovery = await videoContext.newPage();
const discoveryErrors = [];
discovery.on('pageerror', error => discoveryErrors.push(error.message));
discovery.on('console', message => { if (message.type() === 'error') discoveryErrors.push(message.text()); });
await discovery.goto(`${baseUrl}/ride?time=dawn`, { waitUntil: 'domcontentloaded' });
await discovery.waitForSelector('.ride[data-world-ready="true"]', { timeout: 30_000 });
const arrival = discovery.getByRole('button', { name: 'Return to the track' });
if (await arrival.count()) await arrival.click();
await discovery.getByRole('button', { name: '16×' }).click();
const recordingStarted = Date.now();
await discovery.getByRole('button', { name: 'Start auto ride' }).click();
await discovery.waitForFunction(() => Number(document.querySelector('.ride')?.getAttribute('data-discovered-billboards')) >= 5, undefined, { timeout: 25_000 });
await discovery.getByRole('button', { name: 'Pause auto ride' }).click();
const remaining = 20_000 - (Date.now() - recordingStarted);
if (remaining > 0) await discovery.waitForTimeout(remaining);
if (discoveryErrors.length) throw new Error(`Discovery run errors: ${discoveryErrors.join(' | ')}`);
const video = discovery.video();
await discovery.close();
await videoContext.close();
if (!video) throw new Error('Discovery run did not record video.');
await video.saveAs(path.join(root, 'evidence/ride-discovery-run.webm'));

async function verifyLookChallenge(lookLeft, expected) {
  const { page } = await openRide('s=1390000&time=midday');
  if (lookLeft) for (let turn = 0; turn < 8; turn += 1) await page.getByRole('button', { name: 'Look left' }).click();
  await page.getByRole('button', { name: '16×' }).click();
  await page.getByRole('button', { name: 'Start auto ride' }).click();
  await page.waitForSelector(`.ride[data-look-award="${expected}"]`, { timeout: 15_000 });
  await page.close();
}
await verifyLookChallenge(true, 'earned');
await verifyLookChallenge(false, 'missed');

await browser.close();
console.log('Captured ride sky, building, and discovery evidence; verified earnable and missable Hex challenge.');
