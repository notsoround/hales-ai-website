import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test("Matt's weight card uses the same headline as Robyn's page, with the scale as detail", () => {
  const page = src('src/pages/cupcake/sandbox/cupcakegpt/page.tsx');
  assert.match(page, /action:'body_headline_get'/);
  assert.match(page, /body\.weight\.source!=='scale'/, 'a non-scale headline (assessment / check-in) wins when it is the latest dated reading');
  assert.match(page, /Other readings: /);
  assert.doesNotMatch(page, /Averages stay separate from scale readings/);
});

test('Robyn dashboard: top changes first, chart scale with units and targets, view-only footer', () => {
  const d = src('src/components/cupcake/robyn/RobynDashboard.tsx');
  assert.match(d, /data\.top_changes\?\.length/);
  assert.match(d, /target=\{coach\?\.targets\?\.kcal\}/);
  assert.match(d, /target=\{coach\?\.targets\?\.steps\}/);
  assert.match(d, /View-only data · notes go to Matt/);
  assert.doesNotMatch(src('src/components/cupcake/TodayEnergy.tsx'), /Living burn/);
});

test('Robyn route does not statically import the public site', () => {
  const main = src('src/main.tsx');
  assert.doesNotMatch(main, /^import App /m);
  assert.match(main, /lazy\(\(\) => import\('\.\/App\.tsx'\)\)/);
});
