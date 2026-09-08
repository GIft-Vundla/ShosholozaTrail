import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('evidence', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
const imageryZooms = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  const match = response.url().match(/World_Imagery\/MapServer\/tile\/(\d+)\//);
  if (match && response.ok()) imageryZooms.push(Number(match[1]));
});
await page.goto('http://127.0.0.1:4177/app', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Use Satellite map' }).click();
await page.getByRole('button', { name: 'Open Kimberley story' }).click({ force: true });
await page.waitForTimeout(2600);
const bigHole = page.getByRole('button', { name: 'Open The Big Hole' });
const bigHoleBox = await bigHole.boundingBox();
if (!bigHoleBox) throw new Error('Big Hole map marker is not visible');
await page.locator('.immersive-attraction[data-attraction="big-hole"]').dispatchEvent('click');
await page.waitForTimeout(1400);
if (!(await page.locator('#map-story-card').innerText()).toLowerCase().includes('nearby attraction')) throw new Error('Big Hole attraction camera did not activate');
for (let i = 0; i < 6; i += 1) {
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForTimeout(350);
}
await page.waitForTimeout(2800);
await page.screenshot({ path: 'evidence/satellite-kimberley-z17.png', fullPage: true });

await page.locator('#close-story-preview').click();
await page.getByRole('button', { name: 'Fit whole route' }).click();
await page.waitForTimeout(1600);
await page.getByRole('button', { name: 'Open Matjiesfontein story' }).evaluate(element => element.click());
await page.waitForTimeout(2600);
if (!(await page.locator('#map-story-card').innerText()).includes('Matjiesfontein')) throw new Error('Matjiesfontein camera did not activate');
const hotel = page.getByRole('button', { name: 'Open Lord Milner Hotel' });
const hotelBox = await hotel.boundingBox();
if (!hotelBox) throw new Error('Lord Milner Hotel map marker is not visible');
for (let i = 0; i < 5; i += 1) {
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForTimeout(350);
}
await page.waitForTimeout(2800);
await page.screenshot({ path: 'evidence/satellite-matjiesfontein-z18.png', fullPage: true });

const attribution = await page.locator('.maplibregl-ctrl-attrib').innerText();
console.log(JSON.stringify({ attribution, imageryZooms: [...new Set(imageryZooms)].sort((a, b) => a - b), errors }));
await browser.close();
