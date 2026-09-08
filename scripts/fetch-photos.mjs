// Download the chosen Commons photographs at display size and record full
// attribution. CC BY / CC BY-SA require credit, so the credits file is part of
// the deliverable, not an afterthought.
import { mkdir, writeFile } from 'node:fs/promises';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = { 'User-Agent': 'ShosholozaTrail/0.1 (hackathon prototype; contact via repo)' };
const WIDTH = 1200;
const OUT = 'public/assets/photos';

const CHOSEN = {
  'hero-train': 'Shosholoza Meyl Trans Natal headed by 18-xxx and 18-422 near Balfour. (16993112398).jpg',
  pretoria: 'Jacaranda Trees, Becket Street Pretoria.jpg',
  johannesburg: "Johannesburg's inner city.jpg",
  kimberley: 'Big Hole Kimberley.jpg',
  'de-aar': 'De Aar, South Africa - panoramio.jpg',
  'beaufort-west': 'Karoo National Park 2014 05.jpg',
  matjiesfontein: 'Matjiesfontein 1.JPG',
  worcester: 'Hex River Valley - Western Cape, South Africa (3880658723).jpg',
  capetown: 'Cape Town - view from Table Mountain 2.jpg',
};

const strip = (h) => String(h ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

await mkdir(OUT, { recursive: true });
const credits = [];
let total = 0;

for (const [key, filename] of Object.entries(CHOSEN)) {
  const title = 'File:' + filename;
  const url =
    `${API}?action=query&format=json&titles=${encodeURIComponent(title)}` +
    `&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=${WIDTH}`;

  const res = await fetch(url, { headers: UA });
  const pages = Object.values((await res.json())?.query?.pages ?? {});
  const info = pages[0]?.imageinfo?.[0];
  if (!info) {
    console.error(`FAILED metadata: ${key} (${filename})`);
    process.exitCode = 1;
    continue;
  }

  const meta = info.extmetadata ?? {};
  const src = info.thumburl || info.url;
  const img = await fetch(src, { headers: UA });
  if (!img.ok) {
    console.error(`FAILED download: ${key} ${img.status}`);
    process.exitCode = 1;
    continue;
  }
  const buf = Buffer.from(await img.arrayBuffer());
  const file = `${OUT}/${key}.jpg`;
  await writeFile(file, buf);
  total += buf.length;

  credits.push({
    id: key,
    file: `/assets/photos/${key}.jpg`,
    title: filename,
    author: strip(meta.Artist?.value) || 'Unknown',
    licence: strip(meta.LicenseShortName?.value) || 'see source page',
    licenceUrl: strip(meta.LicenseUrl?.value) || '',
    source: info.descriptionurl,
    retrieved: new Date().toISOString().slice(0, 10),
  });

  console.log(`${key.padEnd(16)} ${(buf.length / 1024).toFixed(0).padStart(5)} KB  ${strip(meta.LicenseShortName?.value)}`);
}

await writeFile('public/assets/photo-credits.json', JSON.stringify({ source: 'Wikimedia Commons', photos: credits }, null, 2) + '\n');
console.log(`\nTOTAL ${(total / 1024 / 1024).toFixed(2)} MB across ${credits.length} photos`);
