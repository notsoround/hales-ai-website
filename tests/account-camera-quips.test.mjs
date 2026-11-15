// Labs camera comments: scene rules, line rules, and the live camera with the switch off and on.
// Synthetic only: the browser part uses Chrome's generated test pattern as the camera.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-camera-quips-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-photo-account', configureServer(server) { server.middlewares.use((req, _res, next) => { if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-photo-meal-preview.html'; next(); }); } }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
let browser;
try {
  const { sceneFor, groupOf } = await server.ssrLoadModule('/src/components/cupcake/camera/sceneGuess.ts');
  const { QUIPS, pickQuip } = await server.ssrLoadModule('/src/components/cupcake/camera/quipLines.ts');
  const g = (index, score) => ({ index, score });
  assert.deepEqual(sceneFor([g(954, .99)], 0), { scene: 'food', food: 'a banana' });
  assert.deepEqual(sceneFor([g(923, .36), g(937, .25), g(924, .08)], 0), { scene: 'food' }, 'a salad on a plate is food, not named');
  assert.deepEqual(sceneFor([g(285, .5), g(282, .24), g(281, .13)], 0), { scene: 'cat' }, 'cat breeds add up');
  assert.deepEqual(sceneFor([g(922, .54), g(458, .13)], 0), { scene: 'paper' }, 'a receipt reads as a menu');
  assert.deepEqual(sceneFor([g(620, .6)], 0), { scene: 'screen' });
  assert.deepEqual(sceneFor([g(967, .75), g(968, .14)], 0), { scene: 'coffee' });
  assert.deepEqual(sceneFor([g(409, .62)], 0), { scene: 'notfood' }, 'a confident clock is not food');
  assert.equal(sceneFor([g(409, .4)], 0), null, 'an unsure guess says nothing');
  assert.equal(sceneFor([g(933, .2)], 0)?.scene, undefined, 'a weak burger guess says nothing');
  assert.deepEqual(sceneFor([g(933, .83)], 1), { scene: 'person' }, 'a face in frame wins');
  assert.equal(groupOf(208), 'dog');
  for (const voice of ['cupcake', 'calm']) {
    for (const [scene, lines] of Object.entries(QUIPS[voice])) for (const line of lines) {
      assert.ok(line.length <= 42, `${voice}.${scene} line is short: ${line}`);
      assert.doesNotMatch(line, /\b(fat|thin|skinny|weight|body|pretty|ugly|handsome|beautiful|old|young|man|woman|guy|girl)\b/i, `no comments on people: ${line}`);
    }
    assert.notEqual(pickQuip(voice, { scene: 'notfood' }, pickQuip(voice, { scene: 'notfood' }, '', () => 0), () => 0), pickQuip(voice, { scene: 'notfood' }, '', () => 0), 'never the same line twice in a row');
  }
  assert.equal(pickQuip('cupcake', { scene: 'food', food: 'a burger' }, '', () => .3), 'Burger? I’m listening.');
  // The copied runtime must match the installed library, or a dependency bump breaks the camera silently.
  for (const file of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) assert.ok(readFileSync(`public/cupcake-vision/0.10.17/${file}`).equals(readFileSync(`node_modules/@mediapipe/tasks-vision/wasm/${file}`)), `${file} matches @mediapipe/tasks-vision`);
  assert.equal(JSON.parse(readFileSync('node_modules/@mediapipe/tasks-vision/package.json', 'utf8')).version, '0.10.17', 'move public/cupcake-vision with the library version');
  console.log('PASS: scene rules (food wins, breeds add up, unsure stays quiet, faces only say cheese) and line rules');

  browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  for (const on of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const vision = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => { const url = route.request().url(); if (url.includes('/cupcake-vision/')) vision.push(new URL(url).pathname); return new URL(url).origin === base || url.startsWith('data:') ? route.continue() : route.abort(); });
    await page.goto(base + '/cupcake/account'); await page.getByRole('button', { name: 'Take meal photo', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('button')?.disabled);
    if (on) await page.evaluate(() => import('/src/components/cupcake/labsFlags.ts').then(m => m.writeLab('camera-quips', true)));
    await page.getByRole('button', { name: 'Take meal photo', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.cc-cam-feed')?.videoWidth > 0);
    if (on) {
      assert.ok(await page.locator('.cc-cam-quip[role=status]').count(), 'comment line present with the switch on');
      for (let i = 0; i < 100 && new Set(vision).size < 4; i++) await page.waitForTimeout(200);
      await page.waitForFunction(() => document.querySelector('.cc-cam-quip')?.dataset.lookMs !== undefined || !!document.querySelector('.cc-cam-quip span'), null, { timeout: 15000 }).catch(() => undefined);
      assert.deepEqual([...new Set(vision)].sort(), ['/cupcake-vision/0.10.17/blaze_face_short_range.tflite', '/cupcake-vision/0.10.17/efficientnet_lite0_int8.tflite', '/cupcake-vision/0.10.17/vision_wasm_internal.js', '/cupcake-vision/0.10.17/vision_wasm_internal.wasm']);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    } else {
      await page.waitForTimeout(1500);
      assert.equal(await page.locator('.cc-cam-quip').count(), 0, 'no comment line with the switch off');
      assert.deepEqual(vision, [], 'no model download with the switch off');
    }
    // The shutter still hands one photo to the account flow.
    await page.getByRole('dialog', { name: 'Meal camera' }).getByRole('button', { name: 'Take meal photo' }).click();
    await page.waitForFunction(() => window.photoFixture.requests.some(row => row.route.endsWith('/food/photo/analyze')));
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: switch off downloads nothing and shows nothing; switch on loads the four local model files and the shutter still works');
} finally { await browser?.close(); await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
