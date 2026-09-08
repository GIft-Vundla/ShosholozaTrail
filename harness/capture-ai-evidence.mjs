import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('evidence', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));

await page.goto('http://127.0.0.1:4177/journey', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
if (await page.locator('.context-card .primary-btn').count() === 0) {
  throw new Error(`Journey UI did not mount: ${(await page.locator('body').innerText()).slice(0, 180)}; ${errors.join(' | ')}`);
}
await page.locator('.context-card .primary-btn').click();
await page.locator('.destination-panel').waitFor({ state: 'visible' });
await page.getByRole('button', { name: 'Explain this place' }).click();
await page.waitForFunction(() => {
  const text = document.querySelector('.ai-answer')?.textContent?.trim() || '';
  return text.length > 0 && !text.includes('Finding a grounded excerpt');
}, null, { timeout: 30000 });
await page.locator('.destination-panel').evaluate(element => { element.scrollTop = element.scrollHeight; });
await page.waitForTimeout(500);
await page.screenshot({ path: 'evidence/ai-react-grounded-excerpt.png', fullPage: false });

const summary = {
  statusText: await page.locator('.ai-answer').innerText(),
  sourceLockedLabelVisible: await page.getByText('Source-locked AI').isVisible(),
  errors,
};
console.log(JSON.stringify(summary));
await browser.close();
