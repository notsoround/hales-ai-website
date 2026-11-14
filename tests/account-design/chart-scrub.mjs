// Synthetic account fixture only; lib.mjs blocks nonlocal requests.
// Run from the repository root with ASSESS_ROOT="$PWD" ASSESS_OUT=/tmp/chart-scrub.
import assert from 'node:assert/strict';

process.env.RICH = '1';
const { signedIn, nav, browser, server, grant } = await import('./lib.mjs');

const panelFor = (p, selector, title) =>
  p.locator(selector).filter({ has: p.getByRole('heading', { name: title, exact: true }) });
const scrubHeader = async (panel, control) => {
  const chart = panel.locator('.nx-chart');
  await chart.locator('.nx-readout').waitFor({ state: 'visible' });
  const value = await chart.locator('.nx-readout b').innerText();
  const title = await chart.locator('.nx-readout span').innerText();
  await panel.locator(`header ${control}`).filter({ hasText: `${title} · ${value}` }).waitFor();
  assert.match(await chart.getAttribute('aria-label'), /: /);
  assert.ok((await chart.getAttribute('aria-label')).endsWith(`${title}: ${value}`));
  return { title, value };
};

try {
  const { p, c, errors } = await signedIn(390, 'rose');
  try {
    const weight = panelFor(p, '.nx-panel', 'Weight');
    const weightChart = weight.locator('.nx-chart');
    await weightChart.waitFor();
    const latestWeight = await weight.locator('.nx-kpi').innerText();
    await weightChart.focus();
    await p.keyboard.press('Home');
    // The KPI uses a separate unit element with CSS spacing.
    await weightChart.locator('.nx-readout').waitFor();
    const weightTooltip = await weightChart.locator('.nx-readout b').innerText();
    await weight.locator('.nx-kpi').filter({ hasText: weightTooltip.replace(/\s/g, '') }).waitFor();
    assert.notEqual(await weight.locator('.nx-kpi').innerText(), latestWeight);
    assert.match(await weight.locator('header p').innerText(), /7-day average/);
    await p.keyboard.press('End');
    await weightChart.locator('.nx-readout b').filter({ hasNotText: weightTooltip }).waitFor();
    const smoothed = await weightChart.locator('.nx-readout b').innerText();
    await weight.locator('.nx-kpi').filter({ hasText: smoothed.replace(/\s/g, '') }).waitFor();
    await p.keyboard.press('Escape');
    await weightChart.locator('.nx-readout').waitFor({ state: 'hidden' });
    await weight.locator('.nx-kpi').filter({ hasText: latestWeight }).waitFor();

    const glucose = panelFor(p, '.nx-panel', 'Glucose');
    const glucoseChart = glucose.locator('.nx-chart');
    await glucoseChart.scrollIntoViewIfNeeded();
    const bounds = await glucoseChart.boundingBox();
    const cdp = await c.newCDPSession(p);
    const y = Math.round(bounds.y + bounds.height / 2);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(bounds.x + 38), y }] });
    const startTime = await glucoseChart.locator('.nx-readout span').innerText();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(bounds.x + bounds.width / 2), y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await glucoseChart.locator('.nx-readout span').filter({ hasNotText: startTime }).waitFor();
    const glucoseTooltip = await glucoseChart.locator('.nx-readout b').innerText();
    await glucose.locator('.nx-kpi').filter({ hasText: glucoseTooltip.replace(/\s/g, '') }).waitFor();
    assert.equal(await glucose.locator('header p').innerText(), await glucoseChart.locator('.nx-readout span').innerText());

    const intake = panelFor(p, '.nx-panel', 'Intake');
    const intakeChart = intake.locator('.nx-chart');
    await intakeChart.focus();
    await p.keyboard.press('End');
    const selected = await scrubHeader(intake, 'p');
    assert.equal(selected.title, 'Today so far');
    await p.keyboard.press('ArrowLeft');
    assert.notEqual((await scrubHeader(intake, 'p')).title, selected.title);
    await p.keyboard.press('Tab');
    await intakeChart.locator('.nx-readout').waitFor({ state: 'hidden' });
    await intake.locator('header p').filter({ hasText: /^Average .* logged days$/ }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await c.close();
  }

  const desktop = await signedIn(1280, 'caribbean');
  try {
    const { p, errors } = desktop;
    await nav(p, 'Reports');
    await p.locator(`[data-grant-id="${grant.id}"]`).click();
    const steps = panelFor(p, '.cc-rep-card', 'Steps');
    const chart = steps.locator('.nx-chart');
    const summary = steps.locator('header span');
    await chart.waitFor();
    const defaultText = await summary.innerText();
    const missing = chart.locator('.nx-bar-missing').first();
    await missing.scrollIntoViewIfNeeded();
    const box = await missing.boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal((await scrubHeader(steps, 'span')).value, 'Not logged');
    const logged = chart.locator('.nx-bar-g').first();
    await logged.scrollIntoViewIfNeeded();
    const bar = await logged.boundingBox();
    await p.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
    assert.match((await scrubHeader(steps, 'span')).value, /^\d[\d,]* steps$/);
    await p.mouse.move(0, 0);
    await chart.locator('.nx-readout').waitFor({ state: 'hidden' });
    await summary.filter({ hasText: defaultText }).waitFor();
    const weight = panelFor(p, '.cc-rep-card', 'Weight');
    await weight.locator('.nx-chart').focus();
    await p.keyboard.press('Home');
    assert.match((await scrubHeader(weight, 'span')).title, /daily mean/);
    assert.deepEqual(errors, []);
  } finally {
    await desktop.c.close();
  }
  console.log('PASS: touch, mouse and keyboard chart readouts; missing values and summary restoration.');
} finally {
  await browser.close();
  await server.close();
}
