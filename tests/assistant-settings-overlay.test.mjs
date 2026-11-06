// Real root, synthetic APIs/media. Verify painting order, not selectOption actionability.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-settings-vite-'));
const server = await createServer({ cacheDir, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = server.resolvedUrls.local[0];
let checks = 0;

async function topmost(control) {
  await control.scrollIntoViewIfNeeded();
  const result = await control.evaluate(el => {
    const r = el.getBoundingClientRect();
    const points = [[.5, .5], [.15, .15], [.85, .15], [.15, .85], [.85, .85]];
    return points.map(([x, y]) => {
      const hit = document.elementFromPoint(r.left + r.width * x, r.top + r.height * y);
      return { topmost: !!hit && (hit === el || el.contains(hit)), hit: hit?.className?.baseVal ?? hit?.className ?? null };
    });
  });
  assert.ok(result.every(point => point.topmost), `Settings control is occluded: ${JSON.stringify(result)}`);
}

try {
  for (const config of [{ browser: 'chromium', width: 1280 }, { browser: 'chromium', width: 390 }, { browser: 'webkit', width: 390 }]) {
    const browser = await playwright[config.browser].launch({ headless: true });
    try {
      const device = config.width < 600 ? playwright.devices[config.browser === 'webkit' ? 'iPhone 13' : 'Pixel 7'] : {};
      const context = await browser.newContext({ ...device, viewport: { width: config.width, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      const external = [], errors = [];
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === new URL(base).origin) return route.continue();
        external.push(route.request().url()); return route.abort();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}tests/assistant-integration-preview.html?tab=chat`);
      const assistant = page.locator('#cupcake-assistant');
      await assistant.waitFor();
      const draft = page.getByRole('textbox', { name: 'Message Cupcake' });
      await draft.fill('Synthetic draft stays open behind Settings');
      const settings = page.locator('.cc-settings');
      const summary = page.locator('.cc-settings > summary');
      const open = async () => {
        // Phone assistant fills the viewport; keyboard activation also covers this layout.
        if (config.width < 600) await summary.press('Enter');
        else await summary.click();
        await page.waitForFunction(() => document.querySelector('.cc-settings')?.open);
        await topmost(page.getByRole('combobox', { name: 'Assistant appearance' }));
        await topmost(page.getByRole('button', { name: 'Close settings', exact: true }));
        assert.equal(await assistant.isVisible(), true, 'Settings must keep the assistant mounted and open');
      };
      await open();
      await page.getByRole('combobox', { name: 'Assistant appearance' }).selectOption('rose');
      await page.getByRole('button', { name: 'Close settings', exact: true }).click();
      assert.equal(await settings.getAttribute('open'), null);
      assert.equal(await draft.inputValue(), 'Synthetic draft stays open behind Settings');
      await open();
      await page.getByRole('combobox', { name: 'Assistant appearance' }).press('Escape');
      assert.equal(await settings.getAttribute('open'), null, 'Escape closes Settings');
      assert.equal(await assistant.isVisible(), true, 'Escape must leave the assistant open');
      checks++;

      if (config.browser === 'chromium') {
        await assistant.getByRole('button', { name: 'Record', exact: true }).click();
        await page.getByRole('checkbox', { name: 'Automatically transcribe recordings and files I choose' }).uncheck();
        await page.getByRole('button', { name: 'Start microphone recording', exact: true }).click();
        await page.getByRole('button', { name: 'Stop recording', exact: true }).waitFor();
        await open();
        await page.getByRole('button', { name: 'Close settings', exact: true }).press('Escape');
        const state = await page.evaluate(() => ({ starts: window.assistantFixture.recorderStarts, stops: window.assistantFixture.recorderStops, tracks: window.assistantFixture.tracksStopped }));
        assert.deepEqual(state, { starts: 1, stops: 0, tracks: 0 }, 'Settings must preserve active media');
        await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
        await page.getByText('Ready to transcribe', { exact: true }).waitFor();
        checks++;
      }
      assert.deepEqual(external, [], 'No remote requests');
      assert.deepEqual(errors, [], 'No browser errors');
      assert.deepEqual(await page.evaluate(() => window.assistantFixture.unknown), []);
      await context.close();
    } finally { await browser.close(); }
  }
  console.log(`PASS ${checks} Settings overlay cases: desktop/phone hit testing, click/Escape dismissal, retained draft and active synthetic recording.`);
} finally { await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
