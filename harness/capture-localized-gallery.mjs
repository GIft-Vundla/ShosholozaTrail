import { chromium } from '@playwright/test';
import path from 'node:path';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:4173'}/animations/gallery.html`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => [...document.images].every(image => image.complete));
await page.waitForTimeout(1200);
await page.screenshot({ path: path.resolve('evidence/animation-upgraded-gallery.png'), fullPage: true });
if (errors.length) throw new Error(errors.join(' | '));
await browser.close();
console.log('Captured evidence/animation-upgraded-gallery.png');
