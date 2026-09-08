import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = process.env.EVIDENCE_BASE_URL || 'http://127.0.0.1:4177';
const browser = await chromium.launch({ headless: true });
await mkdir('evidence', { recursive: true });

async function mount(page, reducedMotion = false) {
  await page.goto(baseURL + '/credits', { waitUntil: 'networkidle' });
  await page.evaluate(async ({ reducedMotion }) => {
    const evidence = document.createElement('section');
    evidence.id = 'kimberley-evidence';
    evidence.style.cssText = 'position:fixed;inset:0;z-index:99999;padding:56px 70px;background:#f8f2e8';
    evidence.innerHTML = '<div id="kimberley-scene" style="width:min(960px,100%);margin:auto"></div>';
    document.body.append(evidence);
    const { mountLocalizedAnimation } = await import('/animations/localized-scenes.js');
    window.__kimberleyScene = mountLocalizedAnimation('#kimberley-scene', 'kimberley', {
      durationSeconds: 4,
      controls: !reducedMotion,
      reducedMotion,
    });
  }, { reducedMotion });
  const scene = page.locator('.st-local-scene--kimberley');
  await scene.locator('img').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('.st-local-scene--kimberley img')?.complete);
  await page.waitForTimeout(160);
  return scene;
}

function matrixMetrics(value) {
  const numbers = String(value).match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.map(Number) || [];
  const [a = 1, b = 0] = numbers;
  return {
    matrix: value,
    scale: Number(Math.hypot(a, b).toFixed(3)),
    rotationDegrees: Number((Math.atan2(b, a) * 180 / Math.PI).toFixed(3)),
  };
}

async function meanLuminance(path, crop) {
  const { data, info } = await sharp(path).extract(crop).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    sum += .2126 * data[offset] + .7152 * data[offset + 1] + .0722 * data[offset + 2];
  }
  return sum / (data.length / info.channels);
}

const context = await browser.newContext({ viewport: { width: 1100, height: 760 }, reducedMotion: 'no-preference' });
const page = await context.newPage();
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));
const scene = await mount(page);
const photo = scene.locator('.st-local-scene__photo');
const initialTransform = matrixMetrics(await photo.evaluate(node => getComputedStyle(node).transform));
await scene.screenshot({ path: 'evidence/animation-kimberley-crater-start.png' });
await page.waitForTimeout(3350);
const pushedTransform = matrixMetrics(await photo.evaluate(node => getComputedStyle(node).transform));
await scene.screenshot({ path: 'evidence/animation-kimberley-crater-push.png' });

const visualMetrics = await scene.evaluate(root => {
  const photo = root.querySelector('.st-local-scene__photo');
  const shade = root.querySelector('.st-local-scene__shade');
  const svg = root.querySelector('svg');
  const svgRect = svg.getBoundingClientRect();
  const boxes = [...svg.children]
    .filter(node => typeof node.getBoundingClientRect === 'function')
    .map(node => node.getBoundingClientRect())
    .filter(box => box.width > 0 && box.height > 0)
    .map(box => ({ x: box.left - svgRect.left, y: box.top - svgRect.top, width: box.width, height: box.height }));
  const union = boxes.reduce((acc, box) => ({
    left: Math.min(acc.left, box.x), top: Math.min(acc.top, box.y),
    right: Math.max(acc.right, box.x + box.width), bottom: Math.max(acc.bottom, box.y + box.height),
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const overlayArea = boxes.reduce((sum, box) => sum + box.width * box.height, 0);
  const unionArea = (union.right - union.left) * (union.bottom - union.top);
  return {
    photoOpacity: Number(getComputedStyle(photo).opacity),
    photoFilter: getComputedStyle(photo).filter,
    shade: getComputedStyle(shade).backgroundImage,
    overlayElementCoverage: Number((overlayArea / (svgRect.width * svgRect.height)).toFixed(3)),
    overlayUnionSpan: Number((unionArea / (svgRect.width * svgRect.height)).toFixed(3)),
    overlayUnion: union,
  };
});

await page.evaluate(() => window.__kimberleyScene.setWaiting(true));
const waitingStart = await photo.evaluate(node => getComputedStyle(node).transform);
await page.waitForTimeout(350);
const waitingEnd = await photo.evaluate(node => getComputedStyle(node).transform);
await page.evaluate(() => window.__kimberleyScene.setWaiting(false));

await scene.screenshot({ path: 'evidence/.kimberley-treated.png' });
await page.addStyleTag({ content: '.st-local-scene--kimberley .st-local-scene__shade,.st-local-scene--kimberley svg,.st-local-scene--kimberley figcaption{display:none!important}' });
await scene.screenshot({ path: 'evidence/.kimberley-reference.png' });
const dimensions = await sharp('evidence/.kimberley-treated.png').metadata();
const brightnessCrop = { left: 0, top: 0, width: dimensions.width, height: Math.floor(dimensions.height * .68) };
const treatedLuminance = await meanLuminance('evidence/.kimberley-treated.png', brightnessCrop);
const referenceLuminance = await meanLuminance('evidence/.kimberley-reference.png', brightnessCrop);
const brightnessRatio = Number((treatedLuminance / referenceLuminance).toFixed(3));
await context.close();

const reducedContext = await browser.newContext({ viewport: { width: 1100, height: 760 }, reducedMotion: 'reduce' });
const reducedPage = await reducedContext.newPage();
const reducedScene = await mount(reducedPage, true);
await reducedScene.screenshot({ path: 'evidence/animation-kimberley-crater-reduced.png' });
const reduced = await reducedScene.evaluate(root => ({
  staticState: root.dataset.static,
  animationName: getComputedStyle(root.querySelector('.st-local-scene__photo')).animationName,
  transform: getComputedStyle(root.querySelector('.st-local-scene__photo')).transform,
}));
await reducedContext.close();

// Performance is measured in a separate context with no screenshot or video recording.
const performanceContext = await browser.newContext({ viewport: { width: 1100, height: 760 }, reducedMotion: 'no-preference' });
const performancePage = await performanceContext.newPage();
await mount(performancePage);
const frameStats = await performancePage.evaluate(async () => {
  const intervals = [];
  let prior;
  await new Promise(resolve => {
    const start = performance.now();
    const step = now => {
      if (prior !== undefined) intervals.push(now - prior);
      prior = now;
      if (now - start < 3000) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
  const duration = intervals.reduce((sum, value) => sum + value, 0);
  intervals.sort((a, b) => a - b);
  return {
    frames: intervals.length,
    measuredMs: Math.round(duration),
    approximateFps: Number((intervals.length / duration * 1000).toFixed(1)),
    p95FrameMs: Number(intervals[Math.floor(intervals.length * .95)].toFixed(2)),
  };
});
await performanceContext.close();
await browser.close();

const proof = {
  capturedAt: new Date().toISOString(),
  scene: 'kimberley',
  errors,
  initialTransform,
  pushedTransform,
  visualMetrics: { ...visualMetrics, treatedLuminance: Number(treatedLuminance.toFixed(2)), referenceLuminance: Number(referenceLuminance.toFixed(2)), brightnessRatio },
  waitingPauseStable: waitingStart === waitingEnd,
  reducedMotion: reduced,
  performance: { environment: 'separate Playwright Chromium context; no screenshots or video during RAF sample', ...frameStats },
  acceptance: {
    brightnessAtLeastSixtyPercent: brightnessRatio >= .6,
    overlayAtMostOneThird: visualMetrics.overlayElementCoverage <= 1 / 3,
    photographicPushVisible: pushedTransform.scale - initialTransform.scale >= .12 && Math.abs(pushedTransform.rotationDegrees - initialTransform.rotationDegrees) >= .5,
    reducedMotionCompleteStill: reduced.staticState === 'true' && reduced.animationName === 'none' && reduced.transform !== 'none',
    waitingPause: waitingStart === waitingEnd,
    noRuntimeErrors: errors.length === 0,
  },
};
await writeFile('evidence/animation-kimberley-visual-proof.json', JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof, null, 2));
