// Real CupcakeGPT + real child components. Synthetic API/media; remote requests blocked.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-assistant-vite-'));
const server = await createServer({ cacheDir, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = server.resolvedUrls.local[0], checks = [], screenshots = [];
const fixture = page => page.evaluate(() => ({ ...window.assistantFixture, releaseMicrophone: undefined }));
const tick = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const nav = page => page.getByRole('navigation', { name: 'Cupcake', exact: true });
const panel = page => page.locator('#cupcake-assistant');
async function measure(page, label, width) {
  await page.evaluate(() => document.fonts.ready);
  await tick(page);
  const value = await page.evaluate(() => {
    const rect = el => { if (!el || !el.getClientRects().length) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, scroll: el.scrollWidth, client: el.clientWidth }; };
    const shell = document.querySelector('#cupcake-assistant'), edge = shell?.getBoundingClientRect().right;
    return { width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, inner: innerWidth,
      panel: rect(document.querySelector('#cupcake-assistant')), composer: rect(document.querySelector('.cc-chat-composer')),
      overflow: [...(shell?.querySelectorAll('*') || [])].filter(el => el.getClientRects().length && el.getBoundingClientRect().right > edge + 1).slice(0, 6).map(el => ({ tag: el.tagName, class: el.className, ...rect(el) })),
      innerOverflow: [...(shell?.querySelectorAll('*') || [])].filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1).slice(0, 6).map(el => ({ tag: el.tagName, class: el.className, overflow: getComputedStyle(el).overflowX, ...rect(el) })),
      policy: document.querySelector('meta[name="viewport"]')?.content };
  });
  assert.equal(value.width, width, `${label}: layout viewport`);
  assert.ok(value.scroll <= width, `${label}: document overflow ${value.scroll}>${width}`);
  assert.ok(value.inner <= width, `${label}: expanded innerWidth`);
  assert.match(value.policy, /maximum-scale=1/);
  if (value.panel) {
    assert.ok(value.panel.left >= -1 && value.panel.right <= width + 1, `${label}: panel outside viewport`);
    assert.ok(value.panel.scroll <= value.panel.client + 1, `${label}: panel has horizontal overflow ${JSON.stringify(value)}`);
  }
  if (value.composer) {
    assert.ok(value.panel, `${label}: composer without panel`);
    assert.ok(value.composer.left >= value.panel.left - 1 && value.composer.right <= value.panel.right + 1, `${label}: composer escapes panel`);
    assert.ok(value.composer.top >= value.panel.top - 1 && value.composer.bottom <= value.panel.bottom + 1, `${label}: composer outside panel height`);
  }
  checks.push({ label, width, ...value });
}
async function visit(page, mode) {
  await page.goto(`${base}tests/assistant-integration-preview.html?tab=${mode}`);
  await nav(page).getByRole('button', { name: 'Assistant', exact: true }).waitFor();
  await panel(page).waitFor();
}

try {
  // WebKit's runner rejects even an isolated synthetic Blob put in IndexedDB;
  // media persistence is exercised in Chromium, with Safari layout kept separate.
  for (const config of [{ name: 'chromium', width: 320 }, { name: 'webkit', width: 390 }, { name: 'chromium', width: 390, mediaOnly: true }, { name: 'chromium', width: 1280 }].filter(config => !process.env.ASSISTANT_WIDTH || config.width === Number(process.env.ASSISTANT_WIDTH))) {
    const browser = await playwright[config.name].launch({ headless: true });
    try {
      const device = config.width < 600 ? playwright.devices[config.name === 'webkit' ? 'iPhone 13' : 'Pixel 7'] : {};
      const context = await browser.newContext({ ...device, viewport: { width: config.width, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      const external = [], errors = [];
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === new URL(base).origin) return route.continue();
        external.push(route.request().url()); return route.abort();
      });
      const page = await context.newPage(); page.setDefaultTimeout(12000);
      page.on('pageerror', error => errors.push(error.message));
      for (const mode of config.mediaOnly ? [] : ['chat', 'talk', 'record', 'library']) {
        await visit(page, mode);
        assert.equal(new URL(page.url()).searchParams.get('tab'), mode, `${mode}: legacy deep link preserved`);
        assert.deepEqual(await nav(page).getByRole('button').allTextContents(), ['Today', 'Food', 'Library', 'Assistant']);
        if (mode === 'library') {
          assert.equal(await panel(page).getAttribute('aria-label'), 'Private Library');
          await panel(page).getByRole('tab', { name: 'All context', exact: true }).waitFor();
        } else {
          const label = { chat: 'Text', talk: 'Live voice', record: 'Record' }[mode];
          assert.equal(await panel(page).getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed'), 'true');
        }
        assert.equal((await fixture(page)).micRequests, 0, `${mode}: opening never requests microphone`);
        assert.equal((await fixture(page)).recorderStarts, 0);
        await measure(page, `${config.name}/${mode}`, config.width);
        assert.deepEqual((await fixture(page)).unknown, [], `${mode}: fixture handles every requested API action`);
        assert.equal(await page.locator('.cc-section-failed').count(), 0, `${mode}: no failed real-component section`);
      }

      if (config.width === 320) {
        await visit(page, 'chat');
        const draft = 'Synthetic draft preserved across all assistant surfaces 🧁';
        await page.getByRole('textbox', { name: 'Message Cupcake' }).fill(draft);
        await panel(page).getByRole('button', { name: 'Minimize assistant' }).click();
        await nav(page).getByRole('button', { name: 'Assistant', exact: true }).click();
        assert.equal(await page.getByRole('textbox', { name: 'Message Cupcake' }).inputValue(), draft);
        await panel(page).getByRole('button', { name: 'Live voice', exact: true }).click();
        await panel(page).getByRole('button', { name: 'Record', exact: true }).click();
        await panel(page).getByRole('button', { name: 'Text', exact: true }).click();
        assert.equal(await page.getByRole('textbox', { name: 'Message Cupcake' }).inputValue(), draft);
        assert.equal((await fixture(page)).micRequests, 0);
        await page.goBack();
        await page.waitForFunction(() => new URL(location.href).searchParams.get('tab') === 'record');
        assert.equal(await panel(page).getByRole('button', { name: 'Record', exact: true }).getAttribute('aria-pressed'), 'true');
        await page.goForward();
        await page.getByRole('textbox', { name: 'Message Cupcake' }).waitFor();
        assert.equal(await page.getByRole('textbox', { name: 'Message Cupcake' }).inputValue(), draft);
        await page.getByRole('button', { name: 'Send', exact: true }).click();
        await page.getByText('Synthetic saved assistant response. No provider was contacted.', { exact: true }).waitFor();
        const thread = new URL(page.url()).searchParams.get('thread'); assert.ok(thread);
        await panel(page).getByRole('button', { name: 'Private Library & originals', exact: true }).click();
        await nav(page).getByRole('button', { name: 'Assistant', exact: true }).click();
        await page.locator('.cc-chat p').filter({ hasText: draft }).waitFor();
        await visit(page, 'chat');
        await page.getByText('Synthetic saved assistant response. No provider was contacted.', { exact: true }).waitFor();
        assert.equal(new URL(page.url()).searchParams.get('thread'), thread);
        assert.ok((await fixture(page)).actions.includes('quick_chat_get'), 'reopen loads the synthetic saved thread');
        await measure(page, 'chromium/saved-chat-reopened', config.width);
      }

      if (config.width === 390 && config.name === 'chromium') {
        await visit(page, 'record');
        await page.getByRole('checkbox', { name: 'Automatically transcribe recordings and files I choose' }).uncheck();
        await page.evaluate(() => { window.assistantFixture.deferMicrophone = true; });
        await page.getByRole('button', { name: 'Start microphone recording', exact: true }).click();
        try { await page.getByRole('button', { name: 'Cancel startup', exact: true }).waitFor({ timeout: 4000 }); }
        catch (error) { console.log(JSON.stringify({ recordingStartup: await fixture(page), alerts: await page.getByRole('alert').allTextContents(), status: await page.locator('.cc-live-bar').allTextContents() })); throw error; }
        await panel(page).getByRole('button', { name: 'Minimize assistant' }).click();
        await nav(page).getByRole('button', { name: 'Library', exact: true }).click();
        assert.equal((await fixture(page)).micRequests, 1);
        assert.equal((await fixture(page)).recorderStarts, 0);
        await page.evaluate(() => window.assistantFixture.releaseMicrophone());
        await page.getByRole('button', { name: 'Stop', exact: true }).waitFor();
        assert.equal((await fixture(page)).recorderStarts, 1, 'pending startup survived minimize and Library');
        await measure(page, 'chromium/recording-in-library', config.width);
        await nav(page).getByRole('button', { name: 'Today', exact: true }).click();
        assert.equal((await fixture(page)).recorderStops, 0, 'navigation does not stop active recording');
        await page.getByRole('button', { name: /Recording.*Open controls/ }).click();
        await page.getByRole('button', { name: 'Stop recording', exact: true }).waitFor();
        await panel(page).getByRole('button', { name: 'Text', exact: true }).click();
        assert.equal(await page.getByRole('textbox', { name: 'Message Cupcake' }).isDisabled(), true, 'active recording pauses text send');
        await panel(page).getByRole('button', { name: 'Record', exact: true }).click();
        await measure(page, 'chromium/active-recording-reopened', config.width);
        await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
        try { await page.getByText('Ready to transcribe', { exact: true }).waitFor(); }
        catch (error) { console.log(JSON.stringify({ recordingStopped: await fixture(page), alerts: await page.getByRole('alert').allTextContents(), cards: await page.locator('.cc-record .cc-card').allTextContents(), errors })); throw error; }
        const media = await fixture(page);
        assert.equal(media.recorderStops, 1); assert.equal(media.tracksStopped, 1);
        assert.ok(!media.actions.some(action => /upload|voice-session/.test(action)), 'no provider/upload path reached');
      }

      if (config.width === 1280) {
        await page.locator('.cc-settings > summary').click();
        await page.locator('.cc-settings-group > summary').filter({ hasText: /^Appearance$/ }).click();
        const appearance = page.getByRole('combobox', { name: 'Assistant appearance' });
        assert.equal(await appearance.inputValue(), 'caribbean');
        await appearance.selectOption('rose');
        assert.equal(await page.locator('.cc-app').getAttribute('data-appearance'), 'rose');
        await page.locator('.cc-assistant-persona-options button').filter({ hasText: 'Matthieu' }).click();
        assert.equal(await appearance.inputValue(), 'rose', 'character choice preserves appearance');
        assert.equal(await page.getByRole('textbox', { name: 'Assistant name', exact: true }).inputValue(), 'Matthieu');
        await page.getByRole('textbox', { name: 'Assistant name', exact: true }).fill('Local companion');
        await appearance.selectOption('caribbean');
        assert.equal(await page.getByRole('textbox', { name: 'Assistant name', exact: true }).inputValue(), 'Local companion', 'appearance preserves custom name');
        assert.equal(await page.locator('.cc-assistant-persona-options button').filter({ hasText: 'Matthieu' }).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.evaluate(() => localStorage.getItem('cupcake-private-access')), 'synthetic-assistant-fixture-only', 'appearance never changes access');
        await page.getByRole('button', { name: 'Close settings', exact: true }).click();
        await visit(page, 'chat');
        await panel(page).getByRole('heading', { name: 'Local companion', exact: true }).waitFor();
        assert.equal(await page.locator('.cc-app').getAttribute('data-appearance'), 'caribbean');
        await page.getByRole('button', { name: 'Minimize assistant', exact: true }).click();
        await page.locator('.cc-settings > summary').click();
        await page.locator('.cc-settings-group > summary').filter({ hasText: /^Appearance$/ }).click();
        await page.locator('.cc-assistant-persona-options button').filter({ hasText: 'Cupcake' }).click();
        await page.getByRole('textbox', { name: 'Assistant name', exact: true }).fill('Cupcake');
        await page.getByRole('button', { name: 'Close settings', exact: true }).click();
        await nav(page).getByRole('button', { name: 'Today', exact: true }).click();
        const bubble = page.getByRole('button', { name: /^Open .* assistant\. Drag to move/ });
        await bubble.waitFor();
        const box = await bubble.boundingBox(); assert.ok(box);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down(); await page.mouse.move(240, 300, { steps: 12 }); await page.mouse.up();
        assert.equal(await panel(page).isVisible(), false, 'drag does not open assistant');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('cupcake-assistant-position-v1') || '{}').side === 'left');
        const position = await page.evaluate(() => localStorage.getItem('cupcake-assistant-position-v1'));
        await page.getByRole('button', { name: 'Hide floating companion' }).click();
        assert.equal(await bubble.count(), 0);
        assert.equal(await page.evaluate(() => localStorage.getItem('cupcake-assistant-hidden-v1')), '1');
        await nav(page).getByRole('button', { name: 'Assistant', exact: true }).click();
        await page.getByRole('button', { name: 'Show floating companion', exact: true }).click();
        await page.getByRole('button', { name: 'Minimize assistant' }).click();
        await bubble.waitFor(); await bubble.press('End');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('cupcake-assistant-position-v1') || '{}').side === 'right');
        await visit(page, 'chat');
        await page.getByRole('button', { name: 'Minimize assistant' }).click();
        await bubble.waitFor();
        assert.equal(JSON.parse(position).side, 'left');
        assert.equal(await bubble.evaluate(el => getComputedStyle(el).animationName), 'none', 'reduced motion stops launcher animation');
        await measure(page, 'chromium/launcher-restored', config.width);
      }

      assert.deepEqual((await fixture(page)).unknown, [], 'all fixture actions explicitly handled');
      assert.deepEqual(external, [], 'no remote request attempted');
      assert.deepEqual(errors, [], 'no uncaught browser errors');
      if ([390, 1280].includes(config.width)) {
        if (!await panel(page).isVisible() || !await panel(page).evaluate(el => el.classList.contains('is-panel'))) {
          await nav(page).getByRole('button', { name: 'Assistant', exact: true }).click();
        }
        await panel(page).getByRole('button', { name: 'Text', exact: true }).click();
        await measure(page, `${config.name}/integrated-preview`, config.width);
        screenshots.push({ width: config.width, image: await page.screenshot({ fullPage: false, scale: 'css' }) });
      }
      await context.close();
    } finally { await browser.close(); }
  }
  mkdirSync('output/assistant-preview', { recursive: true });
  for (const shot of screenshots) writeFileSync(`output/assistant-preview/assistant-${shot.width}.png`, shot.image);
  console.log(JSON.stringify({ checks: checks.length, modes: ['chat', 'talk', 'record', 'library'], widths: [...new Set(checks.map(check => check.width))], syntheticOnly: true }));
  console.log('PASS selected real-root integration cases. Full run covers legacy links, draft/saved-chat recovery, persistent mocked recording/startup, persona/appearance independence, launcher controls, reduced motion and viewport/composer bounds. No live networking or physical microphone.');
} finally { await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
