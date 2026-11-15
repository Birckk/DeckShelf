// Renders public/share.jpg, the picture link previews show (Discord, Reddit, Bluesky, Slack,
// iMessage): the brand mark, one line and a fan of bundled commander cards, one per colour.
// Usage: node scripts/share-image.mjs [out.jpg] [width] [height]
// GitHub's social preview takes the same picture at 1280×640.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [out = 'public/share.jpg', width = 1200, height = 630] = process.argv.slice(2);
const file = path => pathToFileURL(path).href;
// Giada, Ghoulcaller Gisa, Jace, Lathliss, Ghalta: white, black, blue, red, green.
const cards = ['4ebc7622-08a1-4f43-92dd-8675d395e8f6', '909e62fa-4585-495e-812b-5df56af24610', '55cd03d9-2535-4cf3-a8b2-1418e1190f4a',
  '8a17ec4e-b508-41af-803b-32acd863e598', '5d9951d1-3228-4d69-8e63-6e6f0a893a86'];
const logo = readFileSync('docs/images/logo.svg', 'utf8').replace(/ width="\d+" height="\d+"/, '');
const font = (family, weight) => `@font-face { font-family: '${family}'; font-weight: ${weight};
  src: url(${file(`node_modules/@fontsource/${family.toLowerCase().replace(' ', '-')}/files/${family.toLowerCase().replace(' ', '-')}-latin-${weight}-normal.woff2`)}); }`;
const fan = cards.map((id, i) => `<img src="${file(`public/images/${id}-grid.webp`)}" alt="" style="transform:
  translateX(${(i - 2) * 86}px) translateY(${Math.abs(i - 2) * 12}px) rotate(${(i - 2) * 6}deg); z-index: ${5 - Math.abs(i - 2)}">`).join('');
const html = `<!doctype html><meta charset="utf-8"><style>
${font('Outfit', 600)} ${font('DM Sans', 400)}
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; color: #f3f1ec;
  background: radial-gradient(120% 90% at 75% 40%, #1d2220 0%, #111214 60%); }
.text { position: absolute; left: 72px; top: 0; bottom: 0; width: 480px; display: flex; flex-direction: column; justify-content: center; gap: 22px; }
.brand { display: flex; align-items: center; gap: 20px; } .brand svg { width: 96px; height: 96px; }
h1 { font: 600 68px/1 Outfit; margin: 0; letter-spacing: -1px; }
p { font: 400 27px/1.4 'DM Sans'; margin: 0; color: #d9d5cc; }
.url { font: 600 24px/1 Outfit; color: #f2ddb0; }
.fan { position: absolute; left: 915px; top: 315px; }
.fan img { position: absolute; width: 236px; left: -118px; top: -165px; border-radius: 12px; box-shadow: 0 18px 40px #0009; transform-origin: 50% 110%; }
</style><div class="text"><div class="brand">${logo}<h1>DeckShelf</h1></div>
<p>Your Magic decks on one shelf.<br>Filter them, or pick one at random.</p><div class="url">deckshelf.birckk.com</div></div>
<div class="fan">${fan}</div>`;

// Fonts and card images load from disk, so the page has to be a file too.
const dir = mkdtempSync(join(tmpdir(), 'deckshelf-share-'));
const browser = await chromium.launch();
try {
  writeFileSync(join(dir, 'share.html'), html);
  const scale = Number(width) / 1200;
  const page = await browser.newPage({ viewport: { width: 1200, height: Math.round(Number(height) / scale) }, deviceScaleFactor: scale });
  await page.goto(file(join(dir, 'share.html')), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, type: 'jpeg', quality: 84 });
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
}
