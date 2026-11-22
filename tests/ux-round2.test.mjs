import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildGroceryAiTriagePrompt,
  parseAiTriagedGroceries,
  mergeRemotePantry,
} from '../src/components/cupcake/groceryChecklist.ts';
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

test('AI grocery triage prompt builder and Markdown reply parser handle categories and preamble chatter cleanly', () => {
  const prompt = buildGroceryAiTriagePrompt(
    'chicken, eggs, avocados, remind me to check olive oil',
    ['Olive Oil', 'Oats'],
    ['Spinach'],
  );
  assert.match(prompt, /Already in household pantry: Olive Oil, Oats/);
  assert.match(prompt, /Already on active shopping list: Spinach/);
  assert.match(prompt, /# Produce, # Protein, # Dairy, # Pantry, # Household/);

  const parsed = parseAiTriagedGroceries([
    "Sure! Here's your organized grocery checklist:",
    '',
    '# Produce',
    '- [ ] 2 Avocados',
    '# Protein',
    '- [ ] Chicken breast (2 lb)',
    '- [ ] Eggs',
    'Notes: Olive oil is already stocked in your pantry.',
    'Let me know if you want changes!',
  ].join('\n'));
  assert.deepEqual(
    parsed.items.map(({ category, label }) => [category, label]),
    [
      ['Produce', '2 Avocados'],
      ['Protein', 'Chicken breast (2 lb)'],
      ['Protein', 'Eggs'],
      ['Notes', 'Notes: Olive oil is already stocked in your pantry.'],
    ],
  );
  assert.deepEqual(parsed.pantryNotes, ['Notes: Olive oil is already stocked in your pantry.']);
});

test('mergeRemotePantry tolerates non-array inputs safely in Node environment', () => {
  assert.deepEqual(mergeRemotePantry(null), []);
  assert.deepEqual(mergeRemotePantry({ items: [] }), []);
});
