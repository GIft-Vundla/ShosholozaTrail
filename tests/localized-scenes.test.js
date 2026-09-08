import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const expected = ['pretoria','johannesburg','kimberley','de-aar','beaufort-west','matjiesfontein','worcester','cape-town'];

test('localized scene manifest links eight destinations to licensed local photographs', async () => {
  const [manifest, credits] = await Promise.all([
    readFile('public/animations/scenes.v1.json', 'utf8').then(JSON.parse),
    readFile('public/assets/photo-credits.json', 'utf8').then(JSON.parse),
  ]);
  assert.deepEqual(manifest.scenes.map((scene) => scene.hubId), expected);
  const creditIds = new Set(credits.photos.map((photo) => photo.id));
  for (const scene of manifest.scenes) {
    assert.equal(scene.photoId, scene.hubId);
    assert.ok(creditIds.has(scene.photoId));
    assert.ok(scene.sourceIds.includes(`photo:${scene.photoId}`));
    assert.match(scene.interpretation, /interpretive|symbolic/i);
    const file = credits.photos.find((photo) => photo.id === scene.photoId).file.replace(/^\//, 'public/');
    assert.ok((await stat(file)).size > 0);
  }
});

test('localized motion CSS animates only transform and opacity', async () => {
  const css = await readFile('public/animations/localized-scenes.css', 'utf8');
  assert.doesNotMatch(css, /stroke-dashoffset|animation[^;{]*filter|@keyframes[\s\S]*?\b(?:width|height|top|left)\s*:/i);
  const blocks = [...css.matchAll(/@keyframes\s+[\w-]+\s*\{([^{}]*\{[^{}]*\})+\}/g)].map((match) => match[0]);
  assert.ok(blocks.length >= 8);
  for (const block of blocks) {
    const declarations = [...block.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]).filter((name) => !['from','to'].includes(name));
    for (const property of declarations) assert.ok(['transform','opacity'].includes(property), `${property} is not compositor-only`);
  }
});

test('Kimberley keeps the real crater dominant and moves the photographic camera', async () => {
  const [runtime, css] = await Promise.all([
    readFile('public/animations/localized-scenes.js', 'utf8'),
    readFile('public/animations/localized-scenes.css', 'utf8'),
  ]);
  const scenesStart = runtime.indexOf('const LOCALIZED_SCENES');
  const kimberleyStart = runtime.indexOf('  kimberley: {', scenesStart);
  const kimberley = runtime.slice(kimberleyStart, runtime.indexOf('  "de-aar": {', kimberleyStart));
  assert.doesNotMatch(kimberley, /<rect\s+width="800"\s+height="420"/i, 'a full-frame vector panel would hide the crater');
  assert.doesNotMatch(kimberley, /class="scene-orbit"/, 'the old abstract orange spiral must not return');
  assert.match(kimberley, /scene-kimberley-marker/);
  assert.match(css, /st-local-scene--kimberley \.st-local-scene__shade\{[^}]*\.14\)/);
  assert.match(css, /@keyframes st-kimberley-crater\{[^}]*scale\(1\.03\)[\s\S]*scale\(1\.25\)/);
  assert.match(css, /st-local-scene--kimberley \.st-local-scene__photo\{[^}]*opacity:1/);
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*st-local-scene--kimberley \.st-local-scene__photo/);
});
