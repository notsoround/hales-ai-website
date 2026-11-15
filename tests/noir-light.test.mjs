import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The light theme's generated layer must match the current Cupcake stylesheets: re-run the generator after CSS edits.
test('noir-light.generated.css is up to date', () => {
  const out = execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/build-noir-light.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  assert.match(out, /up to date/);
});

// Every light rule is scoped under the attribute only the account entry sets, so the original /cupcake app never changes.
test('every light rule is scoped to the account light scheme', () => {
  for (const f of ['../src/components/cupcake/noir/noir-light.generated.css', '../src/components/cupcake/noir/noir-light.css']) {
    const css = readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...css.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].map(m => m[2].trim()).filter(s => s && !/^(from|to|\d+%)$/.test(s));
    for (const sel of selectors) for (const part of sel.split(/,(?![^(]*\))/)) assert.match(part.trim(), /^(:root|html)\[data-cc-scheme=light\]/, `${f}: ${part.trim()}`);
  }
});
