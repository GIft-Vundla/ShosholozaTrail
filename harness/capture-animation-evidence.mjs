import { chromium } from '@playwright/test';
import { mkdir, rename, writeFile } from 'node:fs/promises';

const baseURL = process.env.EVIDENCE_BASE_URL || 'http://127.0.0.1:4177';
const browser = await chromium.launch({ headless: true });
await mkdir('evidence', { recursive: true });

async function capture(hubId, reducedMotion = false) {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 760 },
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
    recordVideo: reducedMotion ? undefined : { dir: 'evidence/.animation-video', size: { width: 1100, height: 760 } },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL + '/credits', { waitUntil: 'networkidle' });
  await page.evaluate(async ({ hubId, reducedMotion }) => {
    const evidence = document.createElement('section');
    evidence.style.cssText = 'position:fixed;inset:0;z-index:99999;padding:90px 70px;background:#f8f2e8';
    evidence.innerHTML = '<div id="scene-evidence" style="width:960px;margin:auto"></div>';
    document.body.append(evidence);
    const { mountLocalizedAnimation } = await import('/animations/localized-scenes.js');
    window.__evidenceScene = mountLocalizedAnimation('#scene-evidence', hubId, {
      durationSeconds: 5,
      controls: !reducedMotion,
      reducedMotion,
    });
  }, { hubId, reducedMotion });
  const scene = page.locator('.st-local-scene');
  await scene.locator('img').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('.st-local-scene img')?.complete);
  await scene.screenshot({ path: `evidence/animation-${hubId}${reducedMotion ? '-reduced' : ''}.png` });
  if (!reducedMotion) await page.waitForTimeout(2200);
  const video = page.video();
  await context.close();
  if (video) await rename(await video.path(), `evidence/animation-${hubId}.webm`);
  return { hubId, reducedMotion, errors };
}

async function measureScene(hubId) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 760 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL + '/credits', { waitUntil: 'networkidle' });
  await page.evaluate(async (selectedHubId) => {
    const host = document.createElement('div');
    host.id = 'performance-scene';
    host.style.cssText = 'position:fixed;inset:80px;z-index:99999;background:#f8f2e8';
    document.body.append(host);
    const { mountLocalizedAnimation } = await import('/animations/localized-scenes.js');
    window.__performanceScene = mountLocalizedAnimation(host, selectedHubId, { durationSeconds: 5, controls: false });
  }, hubId);
  await page.locator('#performance-scene img').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  const frameStats = await page.evaluate(async () => {
    const intervals = [];
    let prior;
    await new Promise((resolve) => {
      const start = performance.now();
      const step = (now) => {
        if (prior !== undefined) intervals.push(now - prior);
        prior = now;
        if (now - start < 3000) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
    const duration = intervals.reduce((sum, value) => sum + value, 0);
    return {
      frames: intervals.length,
      measuredMs: Math.round(duration),
      approximateFps: Number((intervals.length / duration * 1000).toFixed(1)),
      p95FrameMs: Number(intervals.sort((a, b) => a - b)[Math.floor(intervals.length * .95)].toFixed(2)),
    };
  });
  await context.close();
  return { hubId, frameStats, errors };
}

const captures = [];
for (const hubId of ['kimberley', 'matjiesfontein', 'johannesburg']) captures.push(await capture(hubId));
captures.push(await capture('kimberley', true));
const performance = [];
for (const hubId of ['kimberley', 'matjiesfontein', 'johannesburg']) performance.push(await measureScene(hubId));
await browser.close();
await writeFile('evidence/animation-performance.json', JSON.stringify({ capturedAt: new Date().toISOString(), environment: 'Playwright headless Chromium requestAnimationFrame sample in a separate no-video context; not a DevTools Performance-panel recording', captures, performance }, null, 2));
console.log(JSON.stringify({ captures, performance }));
