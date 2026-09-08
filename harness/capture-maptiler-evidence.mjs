import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('evidence', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
const tileStatuses = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (new URL(response.url()).hostname === 'api.maptiler.com') tileStatuses.push(response.status());
});

await page.goto('http://127.0.0.1:4177/app', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Use Satellite map' }).click();
await page.getByRole('button', { name: 'Open Kimberley story' }).click({ force: true });
await page.waitForTimeout(1800);
const bigHoleMarker = page.locator('.immersive-attraction[data-attraction="big-hole"]');
await bigHoleMarker.dispatchEvent('click');
await page.waitForTimeout(1400);
if (!(await page.locator('#map-story-card').innerText()).toLowerCase().includes('nearby attraction')) {
  throw new Error(`Big Hole attraction camera did not activate (markers: ${await bigHoleMarker.count()}, card: ${(await page.locator('#map-story-card').innerText()).slice(0, 80)}, errors: ${errors.join(' | ')})`);
}
for (let index = 0; index < 6; index += 1) {
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForTimeout(250);
}
await page.waitForTimeout(2200);
await page.screenshot({ path: 'evidence/maptiler-satellite-kimberley-z17.png', fullPage: true });

await page.getByRole('button', { name: 'Use Hybrid map' }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: 'evidence/maptiler-hybrid-kimberley-z17.png', fullPage: true });

const provider = await page.locator('#map').getAttribute('data-map-provider');
const attribution = await page.locator('.maplibregl-ctrl-attrib').innerText();
const summary = {
  provider,
  attribution,
  mapTilerResponses: tileStatuses.length,
  responseStatuses: [...new Set(tileStatuses)].sort((a, b) => a - b),
  errors,
};
console.log(JSON.stringify(summary));
await browser.close();
