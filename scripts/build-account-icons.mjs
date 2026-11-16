// Generates the installed-app icons for the account app (Cupcake and Matthieu): 192 and 512 "any" plus a 512 maskable
// with the art inside Android's safe zone. Deterministic; re-run only when a portrait changes:
//   PLAYWRIGHT=/path/to/node_modules/playwright node scripts/build-account-icons.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const pub = fileURLToPath(new URL('../public/', import.meta.url));
const uri = (file, type) => `data:${type};base64,${readFileSync(pub + file).toString('base64')}`;
const people = [
  // crop: the square of the source that shows inside the ring, as fractions of the source edge.
  { key: 'cupcake', src: uri('cupcake-avatar.jpg', 'image/jpeg'), crop: { x: .14, y: .03, s: .66 }, ground: ['#0b1a1f', '#04070b'], ring: ['#5ff2e2', '#16b8c9'] },
  { key: 'matthieu', src: uri('matthieu-avatar.svg', 'image/svg+xml'), crop: { x: .06, y: .04, s: .88 }, ground: ['#17112a', '#07050d'], ring: ['#c4a8ff', '#7c4dff'] },
];
const html = (p, size, maskable) => { const d = Math.round(size * (maskable ? .6 : .76)), ring = Math.max(2, Math.round(size * .022)), img = d / p.crop.s;
  return `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;background:transparent"><div style="width:${size}px;height:${size}px;display:grid;place-items:center;border-radius:${maskable ? 0 : Math.round(size * .225)}px;background:radial-gradient(120% 120% at 30% 15%,${p.ground[0]},${p.ground[1]} 70%)">
  <div style="width:${d + ring * 2}px;height:${d + ring * 2}px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(140deg,${p.ring[0]},${p.ring[1]});box-shadow:0 0 ${Math.round(size * .09)}px ${p.ring[1]}66">
  <div style="width:${d}px;height:${d}px;border-radius:50%;overflow:hidden;position:relative;background:${p.ground[1]}"><img src="${p.src}" style="position:absolute;width:${img}px;height:${img}px;left:${-p.crop.x * img}px;top:${-p.crop.y * img}px"></div></div></div></body></html>`; };
const browser = await chromium.launch();
for (const p of people) for (const [size, maskable] of [[192, false], [512, false], [512, true], ...(p.key === 'cupcake' ? [[180, true]] : [])]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(html(p, size, maskable)); await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  const name = size === 180 ? `${p.key}-app-touch-180.png` : `${p.key}-app-${maskable ? 'maskable-' : ''}${size}.png`;
  await page.screenshot({ path: pub + name, omitBackground: true }); await page.close(); console.log(name);
}
await browser.close();
