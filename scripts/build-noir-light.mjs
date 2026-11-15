// Generates src/components/cupcake/noir/noir-light.generated.css: the light-theme counterpart of every hard-coded
// dark-theme colour in the Cupcake stylesheets. Re-run after any Cupcake CSS change (it is deterministic):
//   node scripts/build-noir-light.mjs          (writes the file)
//   node scripts/build-noir-light.mjs --check  (exits 1 if the committed file is stale)
// Each rule that names a colour literal is re-emitted under :root[data-cc-scheme=light] with only its colour
// declarations, mapped by role: text becomes ink of the same hue (AA-minded), white washes and hairlines become ink
// washes, near-black grounds become porcelain, shadows soften. Saturated mid-tone fills (chart colours, accents) stay.
// The prefix adds (0,2,0) specificity, so every light rule outranks the dark rule it replaces in any load order and the
// cascade among the originals is preserved. Hand-tuned tokens and exceptions live in noir-light.css (loaded after).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';

const ROOT = fileURLToPath(new URL('../src/components/cupcake/', import.meta.url));
const OUT = join(ROOT, 'noir/noir-light.generated.css');
// Separate pages, the generated output and the hand-tuned layer. The live camera stays dark, like a camera app.
const SKIP = [/^robyn\//, /^assessment\//, /noir-light/, /^account-scheme\.css$/]; // the last is theme-aware itself
const DARK_FILE = /^account-camera\.css$/;
// Selectors whose colours sit over photos, video or portrait art; those keep their dark treatment.
const KEEP_DARK = /\.cc-cam\b|cc-photo-viewer|\.cc-portrait|cc-portrait-shade|cc-assistant-portrait|video\b|::backdrop/;
const COLOR_PROPS = /^(color|background(-color|-image)?|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|box-shadow|text-shadow|fill|stroke|caret-color|text-decoration(-color)?|accent-color|column-rule(-color)?|-webkit-text-fill-color|stop-color|filter|-webkit-text-stroke(-color)?|scrollbar-color|--[\w-]+)$/;

// Equal-specificity ties between files are settled by load order, so the light rules must keep the order in which the
// app loads the stylesheets: walk the static import graph from the page the way ES modules evaluate (each import in
// source order, depth first). Stylesheets the page never reaches follow in path order.
const ENTRY = fileURLToPath(new URL('../src/pages/cupcake/sandbox/cupcakegpt/page.tsx', import.meta.url));
const files = [], seen = new Set();
const resolve = (from, spec) => { if (!spec.startsWith('.')) return null; const base = join(dirname(from), spec); for (const c of [base, base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')]) { try { if (statSync(c).isFile()) return c; } catch { /* next */ } } return null; };
(function crawl(file) {
  if (seen.has(file)) return; seen.add(file);
  if (file.endsWith('.css')) { if (file.startsWith(ROOT)) files.push(file); return; }
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/^\s*import\s+(?:type\s)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) { if (/^\s*import\s+type\s/.test(m[0])) continue; const r = resolve(file, m[1]); if (r) crawl(r); }
})(ENTRY);
(function walk(dir) { for (const name of readdirSync(dir).sort()) { const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (name.endsWith('.css') && !files.includes(p)) files.push(p); } })(ROOT);

// ---------- colour maths ----------
const hex = h => { h = h.slice(1); if (h.length <= 4) h = [...h].map(c => c + c).join(''); const n = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return { r: n[0], g: n[1], b: n[2], a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 }; };
const NAMED = { white: '#ffffff', black: '#000000' };
function parseColor(node) {
  if (node.type === 'word') { const w = node.value.toLowerCase(); if (NAMED[w]) return hex(NAMED[w]); if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(w)) return hex(w); return null; }
  if (node.type === 'function' && /^rgba?$/i.test(node.value)) {
    const nums = node.nodes.filter(n => n.type === 'word').map(n => n.value);
    if (nums.length < 3 || nums.some(v => !/^[\d.]+%?$/.test(v))) return null;
    const v = nums.map((x, i) => x.endsWith('%') ? (i < 3 ? parseFloat(x) * 2.55 : parseFloat(x) / 100) : parseFloat(x));
    return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 };
  }
  return null;
}
const toHsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2; let h = 0, s = 0; if (max !== min) { const d = max - min; s = l > .5 ? d / (2 - max - min) : d / (max + min); h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return { h, s, l }; };
const fromHsl = ({ h, s, l }) => { const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }; };
const fmt = (c, a) => { a = Math.round(a * 1000) / 1000; return a >= 1 ? '#' + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('') : `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`; };
const INK = { r: 12, g: 24, b: 28 }; // neutral cool ink; the theme's own hue comes in through tokens

function mapColor(c, role) {
  const { h, s, l } = toHsl(c), a = c.a, neutral = s < .18 || (l > .9 && s < .6);
  if (role === 'shadow') {
    if (l < .5) return fmt(c, a * .3);                     // dark drop shadows: much softer on light
    return fmt(INK, Math.min(.12, a * .6));                 // white glows / insets become faint ink
  }
  if (role === 'text') {
    if (l > .55) { // light text (the common case): ink of the same hue, alpha kept readable
      const alpha = a >= 1 ? 1 : Math.min(1, .25 + a * .75);
      if (neutral) return fmt(INK, alpha);
      return fmt(fromHsl({ h, s: Math.min(s, .85), l: .3 }), alpha);
    }
    if (l < .2) return fmt(neutral ? { r: 255, g: 255, b: 255 } : fromHsl({ h, s: Math.min(s, .4), l: .97 }), a); // dark text on a fill: now light
    if (s > .3) return fmt(fromHsl({ h, s, l: Math.min(l, .32) }), a);  // saturated mid-tone text: deepen to AA
    return fmt(fromHsl({ h, s, l: Math.max(.1, 1 - l - .15) }), a);
  }
  // surfaces, borders, strokes, fills
  if (l > .85 && a < 1) return fmt(INK, Math.min(1, a * 1.15));           // white wash / hairline → ink wash
  if (l > .85) return fmt(neutral ? { r: 18, g: 30, b: 34 } : fromHsl({ h, s, l: .22 }), a); // opaque white marks → ink
  if (l < .2) return fmt(fromHsl({ h, s: Math.min(s, .3), l: Math.min(.99, .975 - l * .25) }), a); // near-black ground → porcelain
  if (l < .35 && s < .5) return fmt(fromHsl({ h, s: Math.min(s, .35), l: .9 }), a); // dark tinted panels → pale tint
  return null; // saturated mid-tones (data colours, accents) read on light as they are
}

function roleOf(prop, varName) {
  if (prop === 'box-shadow' || prop === 'text-shadow' || prop === 'filter') return 'shadow';
  if (/^(color|caret-color|-webkit-text-fill-color|text-decoration-color)$/.test(prop)) return 'text';
  if (varName) return /(^-|-)(ink|text|muted|fg|label)(-|$)/.test(varName) && !/hair|line|border|glow|shadow|bg|surface|wash|track/.test(varName) ? 'text' : /shadow|glow/.test(varName) ? 'shadow' : 'surface';
  return 'surface';
}

function mapValue(value, prop, { knob = false } = {}) {
  const parsed = valueParser(value); let changed = false;
  const role = roleOf(prop, prop.startsWith('--') ? prop : null);
  const visit = (nodes, inMix) => { for (const node of nodes) {
    if (node.type === 'function' && /^var$/i.test(node.value)) continue; // fall-backs inside var() are left alone (tokens decide)
    if (node.type === 'function' && /^color-mix$/i.test(node.value)) { visit(node.nodes, true); continue; }
    const c = parseColor(node);
    if (!c) { if (node.nodes) visit(node.nodes, inMix); continue; }
    if (c.a === 0) continue;
    const { l } = toHsl(c);
    if (inMix && c.a >= 1 && (l > .95 || l < .05)) continue; // mixing with white or black is a tint or shade: keep it
    if (knob && role === 'surface' && c.a >= 1 && l > .85) continue; // switch knobs and white marks without text stay white
    const next = mapColor(c, role); if (!next) continue;
    if (node.type === 'function') { node.type = 'word'; node.nodes = []; }
    node.value = next; changed = true;
  } };
  visit(parsed.nodes, false);
  return changed ? parsed.toString() : null;
}


// Shorthands also carry widths, styles, sizes and positions that later rules may override; re-emitting them at a higher
// specificity would change layout. So only their colour longhands are emitted.
const GRADIENT_VARS = /^--lx-surface$/; // background tokens that hold an image, not a colour
const isColourNode = n => n.type === 'function' ? /^(var|color-mix|rgba?|hsla?|oklab|oklch|lab|lch|color)$/i.test(n.value) : n.type === 'word' && (/^#/.test(n.value) || /^(transparent|currentcolor|white|black|inherit)$/i.test(n.value));
const isImageNode = n => n.type === 'function' && /gradient$|^url$|^image-set$|^-webkit-image-set$/i.test(n.value);
function colourLonghands(prop, value) {
  const nodes = valueParser(value).nodes.filter(n => n.type !== 'space' && n.type !== 'comment');
  const border = prop.match(/^(border(?:-(?:top|right|bottom|left))?|outline|column-rule|-webkit-text-stroke)$/);
  if (border) {
    if (nodes.length === 1 && nodes[0].type === 'function' && /^var$/i.test(nodes[0].value) && !/^(border|outline)/.test(prop)) return [];
    const colour = nodes.find(isColourNode);
    if (!colour && nodes.some(n => n.type === 'word' && /^(none|0)$/i.test(n.value))) return []; // no border: nothing to colour
    return [[`${border[1]}-color`, colour ? valueParser.stringify(colour) : 'currentcolor']];
  }
  if (prop === 'background') {
    if (nodes.length === 1 && nodes[0].type === 'function' && /^var$/i.test(nodes[0].value)) {
      if (GRADIENT_VARS.test(nodes[0].nodes[0]?.value)) return [[prop, value]]; // a token that holds a gradient
      return [['background-image', 'none'], ['background-color', value]];
    }
    const layers = [[]]; for (const n of nodes) { if (n.type === 'div' && n.value === ',') layers.push([]); else layers.at(-1).push(n); }
    const images = layers.map(l => { const img = l.find(isImageNode); return img ? valueParser.stringify(img) : 'none'; });
    const colour = layers.at(-1).find(n => isColourNode(n) && !isImageNode(n));
    return [['background-image', images.join(', ')], ['background-color', colour ? valueParser.stringify(colour) : 'transparent']];
  }
  return [[prop, value]];
}

const prefixSelector = sel => sel.split(/,(?![^(]*\))/).map(s => {
  s = s.trim();
  if (/^:root\b/.test(s)) return s.replace(/^:root/, ':root[data-cc-scheme=light]');
  if (/^html\b/.test(s)) return s.replace(/^html/, 'html[data-cc-scheme=light]');
  return `:root[data-cc-scheme=light] ${s}`;
}).join(', ');

const out = postcss.root();
let rules = 0;
for (const file of files) {
  const rel = relative(ROOT, file); if (SKIP.some(r => r.test(rel))) continue;
  const css = postcss.parse(readFileSync(file, 'utf8'), { from: file });
  const header = postcss.comment({ text: ` ${rel} ` }); let wrote = false;
  css.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes/i.test(rule.parent.name)) return;
    if (/data-cc-scheme/.test(rule.selector)) return;
    // Every colour declaration is re-emitted (mapped when it holds a literal, verbatim otherwise) so the whole colour
    // cascade moves up by the same specificity and keeps its original order. Dark-kept selectors are copied verbatim.
    const keep = KEEP_DARK.test(rule.selector) || DARK_FILE.test(rel), decls = [];
    const hasText = rule.some(d => d.type === 'decl' && d.prop === 'color');
    rule.each(d => {
      if (d.type !== 'decl' || !COLOR_PROPS.test(d.prop)) return;
      for (const [prop, value] of colourLonghands(d.prop, d.value)) {
        const v = keep ? null : mapValue(value, prop, { knob: /^background/.test(prop) && (/::?(before|after)\b/.test(rule.selector) || !hasText) });
        decls.push(postcss.decl({ prop, value: v ?? value, important: d.important }));
      }
    });
    if (!decls.length) return;
    const copy = postcss.rule({ selector: prefixSelector(rule.selector) }); decls.forEach(d => copy.append(d));
    // Re-wrap in the original @media / @supports chain.
    let node = copy;
    for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) { const at = postcss.atRule({ name: p.name, params: p.params }); at.append(node); node = at; }
    if (!wrote) { out.append(header); wrote = true; }
    out.append(node); rules++;
  });
}
const banner = `/* GENERATED by scripts/build-noir-light.mjs from the Cupcake stylesheets. Do not edit; re-run the script.\n   Light-theme counterparts of hard-coded dark colours (${rules} rules). Hand-tuned layer: noir-light.css. */\n`;
const text = banner + out.toResult().css.replace(/\n{3,}/g, '\n\n') + '\n';
if (process.argv.includes('--check')) { const cur = (() => { try { return readFileSync(OUT, 'utf8'); } catch { return ''; } })(); if (cur !== text) { console.error('noir-light.generated.css is stale: run node scripts/build-noir-light.mjs'); process.exit(1); } console.log('noir-light.generated.css up to date'); }
else { writeFileSync(OUT, text); console.log(`wrote ${relative(process.cwd(), OUT)}: ${rules} rules`); }
