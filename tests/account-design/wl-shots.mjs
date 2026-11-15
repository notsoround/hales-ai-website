// Wins & losses screenshots with the rich synthetic fixture (?rich=1). Synthetic data only; outside traffic blocked by lib.mjs.
import { readFileSync } from 'node:fs';
import { open, nav, base, browser, server } from './lib.mjs';
// AXE=/path/to/axe.min.js also runs axe-core (WCAG 2.1 A/AA, serious+critical) on the section in each state.
const out = process.env.ASSESS_OUT, tag = process.env.TAG || 'shot';
const hide = '.cc-nav,.cc-topbar,.cc-mobile-header,.cc-preview-banner,[class*=companion],[class*=floating]{visibility:hidden!important}';
try {
  for (const [width, assistant] of [[390, 'cupcake'], [390, 'matthieu'], [320, 'cupcake']]) {
    const { c, p, errors } = await open(width, 'account-browser-preview');
    try {
      await p.goto(base + '/cupcake/account?rich=1&assistant=' + assistant);
      await p.getByLabel('Email', { exact: true }).fill('a@example.invalid');
      await p.getByLabel('Password', { exact: true }).fill('Synthetic password 123!');
      await p.getByRole('button', { name: 'Sign in', exact: true }).click();
      await nav(p, 'Today');
      await p.getByRole('button', { name: 'All signals', exact: true }).click();
      const wl = p.getByRole('region', { name: 'Personal wins and losses' });
      await wl.waitFor(); await wl.locator('.nx-wl-list li').first().waitFor();
      await p.addStyleTag({ content: hide });
      await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
      const axe = async state => { if (!process.env.AXE) return; await p.addScriptTag({ content: readFileSync(process.env.AXE, 'utf8') }).catch(() => {}); const r = await p.evaluate(async () => (await window.axe.run(document.querySelector('.nx-wl'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).join(', '))); console.log('axe', assistant, width, state, r.length ? r : 'clean'); };
      const name = `${out}/${tag}-${assistant}-${width}`, shot = s => wl.screenshot({ path: `${name}${s}.png` });
      await shot(''); await axe('default');
      if (width === 390 && assistant === 'cupcake') {
        const losses = wl.getByRole('group', { name: 'Filter outcomes' }).getByRole('button', { name: /Losses/ });
        await losses.click(); await p.waitForTimeout(200); await shot('-filter'); await losses.click();
        await wl.locator('.nx-wl-list li > button').nth(1).click(); await p.waitForTimeout(200); await shot('-open'); await axe('open');
        const day = wl.locator('.nx-wl-tally button');
        if (await day.count()) { await day.nth(11).click(); await p.waitForTimeout(200); await shot('-day'); await axe('day'); await day.nth(11).click(); }
        const all = wl.getByRole('button', { name: /^Show all/ });
        if (await all.count()) { await all.click(); await p.waitForTimeout(200); await shot('-all'); await axe('all'); }
      }
      console.log(name, 'scrollWidth', await p.evaluate(() => document.documentElement.scrollWidth), 'errors', errors.join('|') || 0);
    } finally { await c.close(); }
  }
} finally { await browser.close(); await server.close(); }
