import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
await mkdir(path.join(root, 'evidence'), { recursive: true });
const browser = await chromium.launch({ headless: true });

async function waitForRide(page) {
  await page.waitForSelector('.ride[data-route-state="ready"]', { timeout: 30_000 });
  await page.waitForSelector('.maplibregl-canvas', { timeout: 15_000 });
  await page.waitForTimeout(6_000);
}

const arrivalPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const arrivalErrors = [];
arrivalPage.on('pageerror', error => arrivalErrors.push(error.message));
arrivalPage.on('console', message => { if (message.type() === 'error') arrivalErrors.push(message.text()); });
await arrivalPage.goto(`${baseUrl}/ride?hub=matjiesfontein`, { waitUntil: 'domcontentloaded' });
await waitForRide(arrivalPage);
await arrivalPage.waitForSelector('[aria-label="Matjiesfontein arrival"]');
await arrivalPage.screenshot({ path: path.join(root, 'evidence/ride-arrival-matjiesfontein.png') });
if (arrivalErrors.length) throw new Error(`Matjiesfontein capture errors: ${arrivalErrors.join(' | ')}`);
await arrivalPage.close();

const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: path.join(root, 'test-results', 'ride-video'), size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const errors = [];
const imageryResponses = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => {
  if (response.url().includes('World_Imagery/MapServer/tile/') && response.ok()) imageryResponses.push(response.url());
});
await page.goto(`${baseUrl}/ride?hub=de-aar`, { waitUntil: 'domcontentloaded' });
await waitForRide(page);
await page.getByRole('button', { name: 'Return to the track' }).click();
for (let index = 0; index < 6; index += 1) {
  await page.getByRole('button', { name: 'Step forward; hold for continuous ride' }).click();
  await page.waitForTimeout(1_550);
}
await page.screenshot({ path: path.join(root, 'evidence/ride-karoo-final.png') });
if (!imageryResponses.length) throw new Error('No successful Esri World Imagery tile was observed during the Karoo ride.');
if (errors.length) throw new Error(`Karoo capture errors: ${errors.join(' | ')}`);
const video = page.video();
await page.close();
await context.close();
if (!video) throw new Error('Playwright did not create the ride video.');
await video.saveAs(path.join(root, 'evidence/ride-karoo.webm'));
await browser.close();
console.log(JSON.stringify({
  arrival: 'evidence/ride-arrival-matjiesfontein.png',
  ride: 'evidence/ride-karoo.webm',
  finalFrame: 'evidence/ride-karoo-final.png',
  successfulImageryTiles: imageryResponses.length,
}));
