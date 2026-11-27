// Real Library/Planning/Conversation components and transports; fictional local data.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const cacheDir = mkdtempSync(path.join(tmpdir(), 'cupcake-library-usability-'));
const server = await createServer({ cacheDir, plugins: [{ name: 'synthetic-library-usability', configureServer(server) {
  server.middlewares.use((req, _res, next) => {
    const [route, query = ''] = (req.url || '').split('?');
    if (['/cupcake', '/cupcake/account'].includes(route)) req.url = '/tests/library-navigation-preview.html?' + query;
    next();
  });
} }], define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' }, server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } } });
await server.listen();
const base = server.resolvedUrls.local[0];
const forbidden = new Set(['import', 'tag', 'project_save', 'ask', 'ask_start', 'ask_jobs', 'triage', 'closeout_preview', 'closeout_generate', 'decision_save', 'connector_list', 'connector_create', 'connector_revoke']);
async function downloadText(page, trigger) {
  const result = page.waitForEvent('download');
  await trigger.click();
  return readFileSync(await (await result).path(), 'utf8');
}
let cases = 0;
try {
  for (const browserName of ['chromium', 'webkit']) {
    const browser = await playwright[browserName].launch({ headless: true });
    try {
      for (const width of [390, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
        const outside = [], errors = [];
        await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : (outside.push(route.request().url()), route.abort()));
        const page = await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}cupcake/account?theme=${width === 390 ? 'caribbean' : 'rose'}`);
        const tab = name => page.getByRole('tab', { name, exact: true });
        await page.locator('.cc-library-item').first().waitFor();
        assert.deepEqual(await page.getByRole('tab').allTextContents(), ['All Content','Review My Day','Receipts','Messages','Phone calls','Saved audio']);
        assert.equal(await page.getByRole('button', { name:'Bring a conversation' }).count(), 0);
        await page.getByLabel('Search library', { exact: true }).fill('Synthetic');
        await page.getByRole('button', { name: 'Search', exact: true }).click();
        await page.locator('.cc-search-result').first().click();
        const details = page.getByRole('dialog', { name: 'Conversation details', exact: true });
        assert.equal(await details.getByRole('button', { name: 'Organize', exact: true }).isDisabled(), true);
        assert.equal(await details.getByLabel('Question about this conversation', { exact: true }).isDisabled(), true);
        assert.equal(await details.getByRole('button', { name: 'Ask Cupcake', exact: true }).isDisabled(), true);
        assert.match(await downloadText(page, details.getByRole('button', { name: 'Markdown', exact: true })), /Synthetic source text/);
        await details.getByRole('button', { name: 'PDF / Print', exact: true }).waitFor();
        await details.getByRole('button', { name: 'Back to library', exact: true }).click();
        await tab('Messages').click();
        const projects = page.locator('.cc-library-projects-fold');
        await projects.locator('summary').click();
        await projects.getByRole('button', {name:'Explore context'}).click();
        assert.equal(await tab('All Content').getAttribute('aria-selected'), 'true');
        await tab('Messages').click();
        await page.getByText('Synthetic captured message.').waitFor();
        await tab('Phone calls').click();
        assert.equal(new URL(page.url()).searchParams.get('view'), 'calls');
        const history = page.getByRole('region', { name:'Saved phone calls' });
        // The device voice is in place before the recap opens: the control checks for one when it appears.
        await page.evaluate(() => {
          const local = {lang:'en-US', localService:true};
          window.fixturePlayback = [];
          Object.defineProperty(window, 'speechSynthesis', { configurable: true, value:{
            getVoices:()=>[{lang:'en-US',localService:false},local], cancel:()=>window.fixturePlayback.push('stop'),
            resume:()=>{}, speak:u=>window.fixturePlayback.push([u.text,u.voice === local]),
          }});
          Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable:true, value:class { constructor(text){this.text=text;} }});
        });
        await history.getByRole('button', {name:/Synthetic phone call.*Missed · voicemail.*Recap/}).click();
        await history.getByText('Synthetic voicemail recap.', {exact:true}).last().waitFor();
        await history.getByRole('button', {name:'Listen to recap'}).click();
        await history.getByRole('button', {name:'Stop',exact:true}).click();
        assert.deepEqual(await page.evaluate(()=>window.fixturePlayback.filter(Array.isArray)), [['Synthetic voicemail recap.',true]]);
        await history.getByRole('button', {name:'Open full transcript'}).click();
        const callDetails = page.getByRole('dialog', { name: 'Phone call details', exact: true });
        await callDetails.getByRole('heading', {name:'Synthetic phone call'}).waitFor();
        await callDetails.getByRole('button', {name:'Back to library'}).click();
        await history.getByRole('button', {name:'Earlier calls'}).click();
        await history.getByText('Ended after silence').waitFor();
        await page.goBack();
        assert.equal(await tab('Messages').getAttribute('aria-selected'), 'true');
        await tab('Review My Day').click();
        await page.getByText('Synthetic retained decision.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Save decision', exact: true }).isDisabled(), true);
        assert.equal(await page.getByRole('button', { name: 'Done', exact: true }).isDisabled(), true);
        await page.getByRole('button', { name: /2026-11-07.*Synthetic retained closeout evidence/ }).click();
        const result = page.locator('.cc-planning-result');
        await result.getByText('Synthetic retained closeout evidence.', { exact: true }).waitFor();
        await result.getByRole('button', { name: 'Play closeout', exact: true }).waitFor();
        await result.getByRole('link', { name: 'Synthetic original', exact: true }).waitFor();
        assert.match(await downloadText(page, result.getByRole('button', { name: 'Download', exact: true })), /Synthetic retained closeout evidence/);
        // One failed supported read must not suppress the other or claim emptiness.
        await page.evaluate(() => { window.libraryNavigationFixture.failDecisions = true; });
        await page.getByRole('button', { name: 'Refresh today review', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'Saved decisions could not be loaded.' }).waitFor();
        await page.getByRole('button', { name: /2026-11-07.*Synthetic retained closeout evidence/ }).waitFor();
        assert.equal(await page.getByText('No saved decisions yet.', { exact: true }).count(), 0);
        await page.evaluate(() => { window.libraryNavigationFixture.failDecisions = false; window.libraryNavigationFixture.failAnalyses = true; });
        await page.getByRole('button', { name: 'Refresh today review', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'Saved closeouts could not be loaded.' }).waitFor();
        await page.getByText('Synthetic retained decision.', { exact: true }).waitFor();
        const requests = await page.evaluate(() => window.libraryNavigationFixture.requests);
        assert.deepEqual(requests.filter(row => forbidden.has(row.action)), []);
        assert.ok(requests.some(row => row.action === 'analysis_get'));
        assert.ok(requests.every(row => row.action === 'session' || (row.route === '/api/account/data' && row.context === 'acc_navigation_fixture')));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.deepEqual(outside, []); assert.deepEqual(errors, []);
        assert.deepEqual(await page.evaluate(() => window.libraryNavigationFixture.blocked), []);
        await context.close(); cases++;
        console.log(`PASS ${browserName} account ${width}: truthful capabilities, source/search/exports, independently saved review reads and failure isolation`);
      }
      // Legacy keeps its existing forms and connector controls.
      const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
      await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      const page = await context.newPage(); page.setDefaultTimeout(8000); await page.goto(`${base}cupcake`);
      await page.getByRole('button', { name: 'Bring a conversation', exact: true }).click(); await page.getByLabel('Title', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Close import', exact: true }).click();
      await page.getByRole('tab', { name: 'Projects', exact: true }).click(); await page.getByRole('button', { name: 'Edit project', exact: true }).click();
      assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), 'Synthetic project');
      await page.getByRole('tab', { name: 'Saved thinking', exact: true }).click();
      await page.getByRole('button', { name: 'Save a decision', exact: true }).click(); await page.getByLabel('What have you decided?', { exact: true }).waitFor();
      await page.getByRole('tab', { name: 'Review your day', exact: true }).click();
      await page.getByLabel('Decision, commitment, question, or priority', { exact: true }).fill('Synthetic draft only');
      await page.getByRole('button', { name: 'Save decision', exact: true }).and(page.locator(':enabled')).waitFor();
      await page.getByRole('tab', { name: 'Connections', exact: true }).click();
      await page.getByLabel('Application name', { exact: true }).fill('Synthetic connector draft');
      await page.getByRole('button', { name: 'Create 90-day access', exact: true }).and(page.locator(':enabled')).waitFor();
      assert.deepEqual(await page.evaluate(() => window.libraryNavigationFixture.blocked), []);
      await context.close(); cases++; console.log(`PASS ${browserName} legacy: retained import/project/decision/connector controls; no writes`);
    } finally { await browser.close(); }
  }
  console.log(`PASS ${cases} actual React browser cases; all data fictional, zero provider or production actions.`);
} finally { await server.close(); rmSync(cacheDir, { recursive: true, force: true }); }
