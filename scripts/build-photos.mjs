// Re-encode the Wikimedia Commons photographs to WebP.
// The offline pack is downloaded before departure over rural connectivity, so
// decorative photography has to stay small. Source JPEGs are removed after
// conversion; re-run scripts/fetch-photos.mjs to restore them.
import { readdir, unlink, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const DIR = 'public/assets/photos';
const WIDTH = 1200;
const QUALITY = 70;

const files = (await readdir(DIR)).filter((f) => /\.jpe?g$/i.test(f));
if (!files.length) {
  console.log('No JPEG sources found; nothing to convert.');
  process.exit(0);
}

let before = 0;
let after = 0;

for (const file of files) {
  const input = `${DIR}/${file}`;
  const name = file.replace(/\.jpe?g$/i, '');
  const output = `${DIR}/${name}.webp`;

  const source = await readFile(input);
  before += source.length;

  await sharp(source)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(output);

  const out = await readFile(output);
  after += out.length;
  await unlink(input);

  console.log(`${name.padEnd(16)} ${(source.length / 1024).toFixed(0).padStart(5)} KB -> ${(out.length / 1024).toFixed(0).padStart(4)} KB`);
}

// Keep the credits manifest pointing at what actually ships.
const creditsPath = 'public/assets/photo-credits.json';
const credits = JSON.parse(await readFile(creditsPath, 'utf8'));
for (const photo of credits.photos) photo.file = photo.file.replace(/\.jpe?g$/i, '.webp');
await writeFile(creditsPath, JSON.stringify(credits, null, 2) + '\n');

console.log(`\nTOTAL ${(before / 1024 / 1024).toFixed(2)} MB -> ${(after / 1024 / 1024).toFixed(2)} MB`);
