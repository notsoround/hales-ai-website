// Phone call rows, outcomes, transcript labels, the call in the address and on-device listening, with fictional calls only.
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-call-outcomes-'));
const server = await createServer({
  cacheDir, envDir: cacheDir,
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  optimizeDeps: { entries: ['tests/account-call-outcomes-preview.ts'] },
  plugins: [{
    name: 'fictional-call-outcomes',
    configureServer(s) {
      s.middlewares.use((req, _res, next) => {
        if (req.url?.split('?')[0] === '/cupcake/account') req.url = '/tests/account-browser-preview.html';
        next();
      });
    },
    transformIndexHtml(html, context) {
      return context.filename.endsWith('/tests/account-browser-preview.html')
        ? html.replace('/tests/account-browser-preview.tsx', '/tests/account-call-outcomes-preview.ts') : html;
    },
  }],
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});

// What a person should be able to name from the list alone. `length` and `summary` are only what each fixture carries.
const expected = [
  { id: 'fixture-call-answered', title: 'Dinner plan check-in', chips: ['Answered'], icon: 'phone-call', length: '4 min 12 sec', summary: 'Taylor chose the lentil soup' },
  { id: 'fixture-call-voicemail', title: 'Grocery check-in', chips: ['Missed · voicemail'], icon: 'voicemail', length: '38 sec', summary: 'Voicemail left' },
  { id: 'fixture-call-no-message', title: 'Evening walk reminder', chips: ['Missed · no message'], icon: 'phone-missed', summary: 'Nobody picked up' },
  { id: 'fixture-call-unclear', title: 'Weekly review call', chips: ['Unclear outcome'], icon: 'help', length: '12 sec', summary: 'The line opened and closed', reason: 'Ended after silence' },
  { id: 'fixture-call-pending', title: 'Coach follow-up', chips: ['Answered', 'Summary pending'], icon: 'phone-call', length: '1 min 35 sec', caller: 'Coach' },
  { id: 'fixture-call-no-summary', title: 'Unlabelled call', chips: ['Unclear outcome', 'No summary saved'], icon: 'help', reason: 'Outcome not recorded' },
];
const deadEnd = /not available for account sign-in/i;
const callsUrl = '/cupcake/account?tab=library&view=calls&rich=1';

let browser;
try {
  await server.listen();
  const base = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch();
  const outside = [];
  async function open(width, voices, url = callsUrl) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
    page.setDefaultTimeout(15000);
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === base) return route.continue();
      outside.push(route.request().url()); return route.abort();
    });
    await page.addInitScript(kind => {
      localStorage.setItem('synthetic-account-server', 'acc_synthetic_a');
      if (!kind) return;
      // A stand-in speech engine: nothing is spoken and nothing leaves the page.
      window.fixtureSpoken = [];
      const list = kind === 'local'
        ? [{ name: 'Fictional network voice', lang: 'en-US', localService: false }, { name: 'Fictional device voice', lang: 'en-US', localService: true }]
        : [{ name: 'Fictional network voice', lang: 'en-US', localService: false }];
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
        getVoices: () => list, cancel() {}, resume() {}, addEventListener() {}, removeEventListener() {},
        speak(utterance) { window.fixtureSpoken.push({ text: utterance.text, voice: utterance.voice?.name, local: utterance.voice?.localService }); },
      } });
    }, voices);
    await page.goto(base + url);
    return page;
  }
  const row = (page, title) => page.locator('.cc-call-row').filter({ has: page.getByText(title, { exact: true }) });

  // 1. The list: every row names its call and outcome in words with an icon, at phone widths, with no sideways scroll.
  for (const width of [390, 320]) {
    const page = await open(width);
    await row(page, expected[0].title).waitFor();
    assert.equal(await page.locator('.cc-call-row').count(), expected.length);
    for (const call of expected) {
      const item = row(page, call.title);
      const text = (await item.innerText()).replace(/\s+/g, ' ');
      const chips = await item.locator('.cc-call-chip').evaluateAll(nodes => nodes.map(node => ({ text: node.textContent, icon: node.querySelector('svg')?.getAttribute('class') || '' })));
      assert.deepEqual(chips.map(chip => chip.text), call.chips, call.title + ' outcome wording');
      assert.ok(chips.every(chip => chip.icon), call.title + ' chips each carry an icon');
      assert.ok(chips[0].icon.includes(call.icon), `${call.title} outcome icon (${chips[0].icon})`);
      if (call.summary) assert.ok(text.includes(call.summary), call.title + ' shows a line of its summary');
      else assert.equal(await item.locator('.cc-call-row-summary').count(), 0, call.title + ' invents no summary');
      if (call.length) assert.ok(text.includes(call.length), call.title + ' shows its length');
      else assert.ok(!/\d+ (?:min|sec)\b/.test(text), call.title + ' invents no length');
      assert.equal(/Coach/.test(text), !!call.caller, call.title + ' names a caller only when the record does');
      if (call.reason) assert.ok(text.includes(call.reason), call.title + ' keeps the recorded reason');
    }
    // Outcome icons differ between the four outcomes, so they are not told apart by colour.
    const icons = await page.locator('.cc-call-chip:first-child svg').evaluateAll(nodes => nodes.map(node => node.getAttribute('class')));
    assert.equal(new Set(icons).size, 4);
    const colours = await page.locator('.cc-call-chip').evaluateAll(nodes => [...new Set(nodes.map(node => getComputedStyle(node).color))]);
    assert.equal(colours.length, 1, 'chips share one colour: wording and icon carry the meaning');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll at ${width}px`);
    // No empty band above the heading: it starts where the card's padding ends.
    const band = await page.evaluate(() => {
      const card = document.querySelector('.cc-call-archive');
      return card.querySelector('.cc-heading-row').getBoundingClientRect().top - card.getBoundingClientRect().top - parseFloat(getComputedStyle(card).paddingTop);
    });
    assert.ok(band <= 2, `heading sits at the top of the calls card (${band}px)`);
    await page.close();
  }

  // 2. Missed filter keeps the two missed kinds apart.
  {
    const page = await open(390, undefined, callsUrl + '&callFilter=missed');
    await row(page, 'Grocery check-in').waitFor();
    assert.deepEqual(await page.locator('.cc-call-chip').allInnerTexts(), ['Missed · voicemail', 'Missed · no message']);
    await page.close();
  }

  // 3. Recap, neutral Close, transcript labels, and the open call in the address.
  {
    const page = await open(390);
    const item = row(page, 'Grocery check-in');
    await item.click();
    await page.getByText('Voicemail left: check the grocery list before shopping.', { exact: true }).last().waitFor();
    const action = item.locator('.cc-call-row-action');
    assert.equal(await action.innerText(), 'Close');
    const [r, g, b] = (await action.evaluate(node => getComputedStyle(node).color)).match(/[\d.]+/g).map(Number);
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) < 30, `Close is neutral, not pink (${r},${g},${b})`);
    await page.getByRole('button', { name: 'Open full transcript' }).click();
    const sheet = page.getByRole('dialog', { name: 'Phone call details' });
    await sheet.waitFor();
    assert.equal(new URL(page.url()).searchParams.get('call'), 'fixture-call-voicemail');
    const words = await sheet.innerText();
    assert.ok(words.includes('Phone call · transcript') && words.includes('This is a fictional voicemail.'));
    assert.ok(!/Imported conversation|Unfiled|Organize|Think this through/.test(words), 'call transcript has no import or filing labels');
    assert.ok(!deadEnd.test(words));
    assert.equal(await sheet.locator(':disabled').count(), 0, 'no disabled controls on the call transcript');
    // Back closes the transcript and leaves the recap open; Forward opens it again.
    await page.goBack();
    await sheet.waitFor({ state: 'detached' });
    assert.equal(new URL(page.url()).searchParams.get('call'), null);
    assert.equal(await item.getAttribute('aria-expanded'), 'true');
    await page.goForward();
    await sheet.waitFor();
    // The on-screen control does the same as Back, without leaving the calls list.
    await sheet.getByRole('button', { name: 'Back to library' }).click();
    await sheet.waitFor({ state: 'detached' });
    assert.equal(new URL(page.url()).searchParams.get('call'), null);
    assert.equal(new URL(page.url()).searchParams.get('view'), 'calls');
    await page.close();
  }

  // 4. A link to each call opens its transcript, and none shows a "not available for account sign-in" dead end.
  for (const call of expected) {
    const page = await open(390, undefined, `${callsUrl}&call=${call.id}`);
    const sheet = page.getByRole('dialog', { name: 'Phone call details' });
    await sheet.getByRole('heading', { name: call.title }).waitFor();
    const words = await sheet.innerText();
    assert.ok(!deadEnd.test(words), call.title + ' transcript shows no unavailable-feature notice');
    assert.ok(!/Imported conversation|Unfiled/.test(words));
    if (call.id === 'fixture-call-answered') assert.ok(words.includes('Saved questions and answers') && words.includes('Fictional saved answer'), 'saved answers stay readable');
    if (call.id === 'fixture-call-no-message') assert.ok(words.includes('Phone call · saved record'), 'a record without a transcript is not called one');
    await sheet.getByRole('button', { name: 'Back to library' }).click();
    await sheet.waitFor({ state: 'detached' });
    assert.equal(new URL(page.url()).searchParams.get('call'), null);
    await row(page, call.title).waitFor();
    await page.close();
  }

  // 5. Listening: a device voice is used when there is one; with only network voices the control says so and stays off.
  {
    const page = await open(390, 'local');
    await row(page, 'Grocery check-in').click();
    const listen = page.getByRole('button', { name: 'Listen to recap' });
    await listen.click();
    await page.getByRole('button', { name: 'Stop' }).waitFor();
    const spoken = await page.evaluate(() => window.fixtureSpoken);
    assert.deepEqual(spoken, [{ text: 'Voicemail left: check the grocery list before shopping.', voice: 'Fictional device voice', local: true }]);
    await page.close();
  }
  {
    const page = await open(390, 'network');
    await row(page, 'Grocery check-in').click();
    const listen = page.getByRole('button', { name: 'Listen to recap' });
    await listen.waitFor();
    assert.ok(await listen.isDisabled(), 'listening is off without a device voice');
    await page.getByText('No on-device reading voice is available in this browser, so listening is off. The recap is shown here.').waitFor();
    assert.deepEqual(await page.evaluate(() => window.fixtureSpoken), []);
    // A call without a summary offers nothing to listen to and says which kind of gap it is.
    await row(page, 'Coach follow-up').click();
    await page.getByText('The summary for this call is not ready yet.').waitFor();
    await row(page, 'Unlabelled call').click();
    await page.getByText('This call has no saved summary.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Listen to recap' }).count(), 0);
    await page.close();
  }
  assert.deepEqual(outside, [], 'nothing left the local preview');
  console.log('Passed phone call rows (6 fictional calls, 390 and 320 px), outcomes by wording and icon, neutral Close, call transcript labels with no unavailable-feature notices, &call= link with Back and Forward, and on-device-only listening.');
} finally {
  await browser?.close();
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}
