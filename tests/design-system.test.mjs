import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('both Cupcake surfaces load the shared design tokens', () => {
  assert.match(read('src/pages/cupcake/sandbox/cupcakegpt/page.tsx'), /design\/tokens\.css';\nimport '[^']*design\/cupcake-theme\.css'/);
  assert.match(read('src/components/cupcake/robyn/RobynDashboard.tsx'), /import '\.\.\/design\/tokens\.css';/);
  const tokens = read('src/components/cupcake/design/tokens.css');
  for (const c of ['food', 'steps', 'exercise', 'sleep', 'body', 'wins', 'glucose', 'summary']) assert.match(tokens, new RegExp(`--ds-${c}-ink:`));
  assert.match(read('src/components/cupcake/robyn/robyn.css'), /\.rv-s-food \{ --c-ink: var\(--ds-food-ink\)/);
});

test('spending card: celebrates a $0 week, compares weeks with bars, top 3 merchants', () => {
  const src = read('src/components/cupcake/robyn/RobynDashboard.tsx');
  assert.match(src, /No card purchases this week 🎉/);
  assert.match(src, /rv-spend-bars/);
  assert.match(src, /top_merchants\.slice\(0, 3\)/);
});
