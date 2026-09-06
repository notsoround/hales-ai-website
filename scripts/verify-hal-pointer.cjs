// Offline checks execute the real pointer handlers without React, WebGL, or voice calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const parentSource = fs.readFileSync(path.join(root, 'src/components/experience/HalesExperience.tsx'), 'utf8');
const childSource = fs.readFileSync(path.join(root, 'public/lab/hal/index.html'), 'utf8');
function between(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `Missing source marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `Missing source marker: ${end}`);
  return source.slice(from + start.length, to);
}
const effect = between(parentSource.slice(parentSource.indexOf('function SentinelLab()')), '  useEffect(() => {', '  }, []);');
const parentCode = ts.transpileModule(`exports.run = () => {${effect}\n};`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const scene = between(childSource, '<script type="module" id="sentinel-scene">', '</script>');
const pointerHandlers = `const setPointer=${between(scene, 'const setPointer=', " canvas.addEventListener('pointerdown'")}`;
const receiveHandler = `const receive=${between(scene, 'const receive=', ' const audio=')}`;
const requestFrame = `function requestFrame()${between(scene, 'function requestFrame()', ' function render(')}`;

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, fn, options) {
      const entries = listeners.get(name) || [];
      entries.push({ fn, options }); listeners.set(name, entries);
    },
    removeEventListener(name, fn) {
      const entries = listeners.get(name) || [];
      assert.ok(entries.some(entry => entry.fn === fn), `Removing unregistered ${name} listener`);
      const remaining = entries.filter(entry => entry.fn !== fn);
      if (remaining.length) listeners.set(name, remaining); else listeners.delete(name);
    },
    emit(name, event = {}) { for (const { fn } of [...(listeners.get(name) || [])]) fn(event); },
    passive(name) { return listeners.get(name)?.every(entry => entry.options?.passive === true) === true; },
  };
}
function animationFrames() {
  let id = 0;
  const pending = new Map();
  return {
    pending,
    request: fn => { pending.set(++id, fn); return id; },
    cancel: key => pending.delete(key),
    flush() { for (const [key, fn] of [...pending]) { pending.delete(key); fn(16); } },
  };
}
const plain = value => JSON.parse(JSON.stringify(value));
const point = (clientX, clientY, pointerType = 'mouse') => ({ clientX, clientY, pointerType, isPrimary: true });
function parentSetup({ reduced = false } = {}) {
  const frames = animationFrames(), messages = [], sizes = [];
  const preference = Object.assign(eventTarget(), { matches: reduced });
  const document = Object.assign(eventTarget(), { hidden: false, documentElement: eventTarget() });
  const window = Object.assign(eventTarget(), {
    location: { origin: 'https://hales.ai' }, innerWidth: 1000, innerHeight: 800,
    matchMedia: () => preference, requestAnimationFrame: frames.request, cancelAnimationFrame: frames.cancel,
  });
  const childWindow = { postMessage: (data, origin) => messages.push(plain({ data, origin })) };
  let observe, disconnected = false;
  const context = {
    exports: {}, window, document, iframe: { current: { contentWindow: childWindow } },
    host: { current: {} }, visible: { current: false }, setSceneHeight: height => sizes.push(height),
    IntersectionObserver: class {
      constructor(callback) { observe = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    },
  };
  vm.runInNewContext(parentCode, context, { filename: 'HAL parent effect' });
  const cleanup = context.exports.run();
  return {
    frames, messages, sizes, preference, document, window, childWindow, cleanup,
    visible: value => observe([{ isIntersecting: value }]),
    get disconnected() { return disconnected; },
    last: () => messages.at(-1)?.data,
  };
}
function childSetup({ paused = false, embedded = true, intersecting = true } = {}) {
  const frames = animationFrames(), parent = {};
  const document = Object.assign(eventTarget(), { hidden: false });
  const window = eventTarget();
  const context = {
    exports: {}, window, document, parent, location: { origin: 'https://hales.ai' },
    innerWidth: 1000, innerHeight: 800, paused, embedded, intersecting,
    requestAnimationFrame: frames.request, cancelAnimationFrame: frames.cancel,
  };
  vm.runInNewContext(`
    const pointer={x:0,y:0}; let pointerActive=false;
    let alive=true,frame=0,lastTime=0,parentVisible=true;
    function render(){frame=0;}
    ${requestFrame}
    ${pointerHandlers}
    ${receiveHandler}
    exports.receive=receive;
    exports.state=()=>({x:pointer.x,y:pointer.y,active:pointerActive});
  `, context, { filename: 'HAL child pointer handlers' });
  return {
    frames, document, window, context,
    state: () => plain(context.exports.state()),
    receive: event => context.exports.receive(event),
    message: data => context.exports.receive({ source: parent, origin: context.location.origin, data }),
  };
}

let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
test('parent forwards the latest viewport coordinates once per frame and clamps edges', () => {
  const s = parentSetup(); s.visible(true); s.messages.length = 0;
  s.window.emit('pointermove', point(500, 400));
  s.window.emit('pointermove', point(1000, 0));
  assert.equal(s.frames.pending.size, 1); assert.equal(s.messages.length, 0);
  s.frames.flush();
  assert.deepEqual(s.messages[0], { data: { type: 'hales:pointer', x: 1, y: 1, active: true }, origin: 'https://hales.ai' });
  s.window.emit('pointermove', point(-100, 900)); s.frames.flush();
  assert.deepEqual(s.last(), { type: 'hales:pointer', x: -1, y: -1, active: true });
  s.window.emit('pointermove', point(500, 400)); s.frames.flush();
  assert.deepEqual(s.last(), { type: 'hales:pointer', x: 0, y: 0, active: true });
  s.cleanup();
});
test('parent touch tracking is passive and touch release cancels pending motion', () => {
  const s = parentSetup(); s.visible(true);
  for (const name of ['pointermove', 'pointerdown', 'pointerup', 'pointercancel']) assert.ok(s.window.passive(name));
  const touch = { ...point(750, 200, 'touch'), preventDefault() { assert.fail('Touch scrolling must remain available'); } };
  s.window.emit('pointerdown', touch); s.frames.flush();
  assert.deepEqual(s.last(), { type: 'hales:pointer', x: .5, y: .5, active: true });
  s.window.emit('pointermove', touch); s.window.emit('pointerup', touch);
  assert.equal(s.frames.pending.size, 0);
  assert.deepEqual(s.last(), { type: 'hales:pointer', x: 0, y: 0, active: false });
  const count = s.messages.length;
  s.window.emit('pointermove', { ...touch, isPrimary: false });
  assert.equal(s.frames.pending.size, 0); assert.equal(s.messages.length, count);
  s.cleanup();
});
for (const condition of ['offscreen', 'hidden', 'reduced motion']) {
  test(`parent cancels and suppresses pointer forwarding while ${condition}`, () => {
    const s = parentSetup(); s.visible(true); s.window.emit('pointermove', point(900, 100));
    if (condition === 'offscreen') s.visible(false);
    if (condition === 'hidden') { s.document.hidden = true; s.document.emit('visibilitychange'); }
    if (condition === 'reduced motion') { s.preference.matches = true; s.preference.emit('change'); }
    assert.equal(s.frames.pending.size, 0); assert.equal(s.last().active, false);
    const count = s.messages.length;
    s.window.emit('pointermove', point(100, 100)); s.window.emit('pointerdown', point(100, 100, 'touch')); s.frames.flush();
    assert.equal(s.frames.pending.size, 0); assert.equal(s.messages.length, count);
    s.cleanup();
  });
}
test('parent trusts only the current same-origin child and cleans up all listeners', () => {
  const s = parentSetup(); s.visible(true); s.messages.length = 0;
  const ready = { source: s.childWindow, origin: 'https://hales.ai', data: { type: 'hales:sentinel-ready' } };
  s.window.emit('message', { ...ready, origin: 'https://example.org' });
  s.window.emit('message', { ...ready, source: {} });
  assert.equal(s.messages.length, 0);
  s.window.emit('message', ready); assert.equal(s.messages[0].data.type, 'hales:visibility');
  s.window.emit('pointermove', point(200, 300)); assert.equal(s.frames.pending.size, 1);
  s.cleanup(); assert.equal(s.frames.pending.size, 0); assert.ok(s.disconnected);
  for (const target of [s.window, s.document, s.document.documentElement, s.preference]) assert.equal(target.listeners.size, 0);
  const count = s.messages.length; s.window.emit('pointermove', point(1000, 0)); s.frames.flush();
  assert.equal(s.messages.length, count);
});
test('child document tracking uses the full viewport with positive Y at the top', () => {
  const s = childSetup({ embedded: false });
  for (const [x, y, expected] of [[0, 0, { x: -1, y: 1, active: true }], [1000, 800, { x: 1, y: -1, active: true }], [750, 200, { x: .5, y: .5, active: true }]]) {
    s.document.emit('pointermove', point(x, y)); assert.deepEqual(s.state(), expected); s.frames.flush();
  }
  s.document.emit('pointermove', { ...point(0, 0), isPrimary: false });
  assert.deepEqual(s.state(), { x: .5, y: .5, active: true });
  s.document.emit('pointerout', { relatedTarget: {} }); assert.equal(s.state().active, true);
  s.document.emit('pointerout', { relatedTarget: null }); assert.deepEqual(s.state(), { x: 0, y: 0, active: false });
});
test('child clamps excessive coordinates and neutralizes nonnumeric values and inactive messages', () => {
  const s = childSetup();
  s.message({ type: 'hales:pointer', x: 99, y: -99, active: true });
  assert.deepEqual(s.state(), { x: 1, y: -1, active: true });
  for (const value of [NaN, Infinity, -Infinity, '1', null, undefined, {}]) {
    s.message({ type: 'hales:pointer', x: value, y: value, active: true });
    assert.deepEqual(s.state(), { x: 0, y: 0, active: true });
  }
  for (const active of [false, 'true', 1, undefined]) {
    s.message({ type: 'hales:pointer', x: 1, y: -1, active });
    assert.deepEqual(s.state(), { x: 0, y: 0, active: false });
  }
});
test('child ignores local and forwarded pointer input while motion is paused', () => {
  const s = childSetup({ paused: true });
  s.document.emit('pointermove', point(1000, 0));
  s.document.emit('touchmove', { touches: [point(1000, 0)] });
  s.message({ type: 'hales:pointer', x: 1, y: 1, active: true });
  assert.deepEqual(s.state(), { x: 0, y: 0, active: false }); assert.equal(s.frames.pending.size, 0);
});
test('child requires both trusted parent identity and origin for forwarded input', () => {
  const s = childSetup();
  const event = { source: s.context.parent, origin: s.context.location.origin, data: { type: 'hales:pointer', x: .5, y: -.5, active: true } };
  for (const invalid of [{ ...event, source: {} }, { ...event, origin: 'https://example.org' }, { ...event, data: null }, { ...event, data: 'hales:pointer' }]) s.receive(invalid);
  assert.deepEqual(s.state(), { x: 0, y: 0, active: false }); assert.equal(s.frames.pending.size, 0);
  s.receive(event); assert.deepEqual(s.state(), { x: .5, y: -.5, active: true });
  const standalone = childSetup({ embedded: false }); standalone.message(event.data);
  assert.deepEqual(standalone.state(), { x: 0, y: 0, active: false }); assert.equal(standalone.frames.pending.size, 0);
});
test('child supports passive touch motion without cancelling scrolling', () => {
  const s = childSetup({ embedded: false });
  for (const name of ['pointermove', 'pointerdown', 'touchmove', 'touchend', 'pointerout']) assert.ok(s.document.passive(name));
  s.document.emit('touchmove', { touches: [point(250, 600)], preventDefault() { assert.fail('Touch scrolling must remain available'); } });
  assert.deepEqual(s.state(), { x: -.5, y: -.5, active: true });
  s.document.emit('touchend'); assert.deepEqual(s.state(), { x: 0, y: 0, active: false });
});
test('child does not schedule rendering while offscreen or hidden', () => {
  const s = childSetup({ intersecting: false });
  s.document.emit('pointermove', point(1000, 0)); assert.equal(s.frames.pending.size, 0);
  s.context.intersecting = true; s.document.hidden = true;
  s.document.emit('pointermove', point(0, 800)); assert.equal(s.frames.pending.size, 0);
  s.document.hidden = false; s.message({ type: 'hales:visibility', visible: false });
  s.message({ type: 'hales:pointer', x: 1, y: 1, active: true }); assert.equal(s.frames.pending.size, 0);
  s.message({ type: 'hales:visibility', visible: true }); assert.equal(s.frames.pending.size, 1);
});
test('parent forwarding and child receiving preserve direction and release to neutral', () => {
  const parent = parentSetup(), child = childSetup(); parent.visible(true);
  for (const position of [point(1000, 0), point(0, 800)]) {
    parent.window.emit('pointermove', position); parent.frames.flush();
    child.message(parent.last());
    assert.deepEqual(child.state(), { x: parent.last().x, y: parent.last().y, active: true });
  }
  parent.window.emit('blur'); child.message(parent.last());
  assert.deepEqual(child.state(), { x: 0, y: 0, active: false }); parent.cleanup();
});
console.log(`${passed} offline HAL pointer checks passed. No browser, rendering, or voice calls were used.`);
