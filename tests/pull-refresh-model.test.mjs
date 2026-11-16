// Pull to refresh on Today: the pure rules (synthetic inputs only, no DOM, no account data).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PULL_MAX, PULL_TRIGGER, PULL_SLOP, pullDistance, pullPhase, judgeGesture, canPull, openLayerPresent, OPEN_LAYER_SELECTOR, pullLabel } from '../src/components/cupcake/pullRefreshModel.ts';

// Distance: weighted, never negative, capped.
assert.equal(pullDistance(0), 0); assert.equal(pullDistance(-40), 0); assert.equal(pullDistance(Number.NaN), 0);
assert.equal(pullDistance(100), 50); assert.equal(pullDistance(1000), PULL_MAX);
assert.ok(PULL_TRIGGER < PULL_MAX, 'the trigger is reachable');
// Phase follows distance; refreshing wins.
assert.equal(pullPhase(0, false), 'idle'); assert.equal(pullPhase(PULL_TRIGGER - 1, false), 'pull');
assert.equal(pullPhase(PULL_TRIGGER, false), 'armed'); assert.equal(pullPhase(0, true), 'refreshing');
assert.equal(pullLabel('pull'), 'Pull to refresh'); assert.equal(pullLabel('armed'), 'Release to refresh'); assert.equal(pullLabel('refreshing'), 'Refreshing…');
// Gesture: only a clearly downward, mostly vertical move is a pull; a sideways chart scrub or an upward scroll is not.
assert.equal(judgeGesture(2, PULL_SLOP - 3), 'pending');
assert.equal(judgeGesture(0, 30), 'pull'); assert.equal(judgeGesture(10, 30), 'pull');
assert.equal(judgeGesture(30, 30), 'other'); assert.equal(judgeGesture(40, 5), 'other'); assert.equal(judgeGesture(0, -30), 'other');
// Gate: account app, installed, at the top, nothing open, not already refreshing. Every single failure blocks it.
const ok = { accountSessions: true, standalone: true, layerOpen: false, atTop: true, refreshing: false };
assert.equal(canPull(ok), true);
for (const [key, bad] of [['accountSessions', false], ['standalone', false], ['layerOpen', true], ['atTop', false], ['refreshing', true]])
  assert.equal(canPull({ ...ok, [key]: bad }), false, key + ' must block a pull');
// Open layers: a useBackClose layer counts, as does any open modal dialog (camera, meal details, confirm sheet) or aria-modal (Settings).
const root = match => ({ querySelector: sel => { assert.equal(sel, OPEN_LAYER_SELECTOR); return match ? {} : null; } });
assert.equal(openLayerPresent(root(false), 0), false);
assert.equal(openLayerPresent(root(true), 0), true);
assert.equal(openLayerPresent(root(false), 1), true);
assert.equal(openLayerPresent(null, 0), false);
assert.equal(openLayerPresent({ querySelector: () => { throw new Error('detached'); } }, 0), false);
assert.match(OPEN_LAYER_SELECTOR, /dialog\[open\]/); assert.match(OPEN_LAYER_SELECTOR, /aria-modal="true"/);

// Wiring, read from source: account-only, installed-only, reuses useBackClose's layer count, refreshes through
// notifyAllDataChanged, inline styles with tokens only, reduced motion handled, and the visual layer is untouched.
const src = readFileSync(new URL('../src/components/cupcake/PullRefresh.tsx', import.meta.url), 'utf8');
assert.match(src, /if \(!ACCOUNT_SESSIONS \|\| !el\) return;/);
assert.match(src, /matchMedia\?\.\('\(display-mode: standalone\)'\)/);
assert.match(src, /openLayerCount\(\)/); assert.match(src, /notifyAllDataChanged\(\);/);
assert.equal((src.match(/^\s+notifyAllDataChanged\(\);/gm) || []).length, 1, 'one refresh call site');
const feel = readFileSync(new URL('../src/components/cupcake/nativeFeel.ts', import.meta.url), 'utf8');
assert.match(feel, /openLayers\+\+/); assert.match(feel, /export function openLayerCount/);
// Styles: inline, tokens only, no colour literals, no Cupcake stylesheet; reduced motion turns off follow and spin.
assert.doesNotMatch(src, /import '\.\/.*\.css'/, 'no stylesheet import');
const styles = src.slice(src.indexOf('const box: CSSProperties'));
assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, 'no colour literals');
for (const v of styles.match(/var\(--[a-z0-9-]+/g)) assert.match(v, /var\(--nx-/, 'tokens only: ' + v);
assert.match(src, /prefers-reduced-motion: reduce/); assert.match(src, /reducedMotion\(\) \|\| typeof el\.animate/);
const today = readFileSync(new URL('../src/components/cupcake/noir/TodayDashboard.tsx', import.meta.url), 'utf8');
assert.match(today, /<PullRefresh target=\{pullArea\} \/>/);
console.log('pull refresh model ok');
