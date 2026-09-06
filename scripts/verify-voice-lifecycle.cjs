const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('src/hooks/use-vapi.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
function setup({ rejectStop = false, delayStop = false } = {}) {
  const effects = [], states = [], events = [], timers = new Map();
  let api, finish, finishStop, timerId = 0;
  class FakeVapi {
    constructor() { api = this; this.listeners = {}; this.stops = 0; this.starts = 0; this.rejectStop = rejectStop; }
    on(name, handler) { this.listeners[name] = handler; }
    emit(name, value) { this.listeners[name]?.(value); }
    start() { this.starts++; return new Promise(resolve => { finish = resolve; }); }
    stop() { this.stops++; return this.rejectStop ? Promise.reject(new Error('synthetic stop failure')) : delayStop ? new Promise(resolve => { finishStop = resolve; }) : Promise.resolve(); }
  }
  const react = {
    useState: initial => { const index = states.length; states.push(initial); return [initial, value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useRef: current => ({ current }), useCallback: fn => fn, useEffect: effect => effects.push(effect),
  };
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => name === 'react' ? react : FakeVapi,
    window: { dispatchEvent: event => events.push(event.detail), setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }, console,
  });
  const hook = exports.default();
  const cleanup = effects[0]();
  return { hook, api, states, events, timers, cleanup, finish: result => finish(result), finishStop: () => finishStop() };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  {
    const s = setup(), connection = s.hook.toggleCall();
    s.api.emit('call-start'); s.api.emit('volume-level', 4); s.finish({}); await connection;
    assert.equal(s.states[1], true); assert.equal(s.states[0], 1);
    await s.hook.toggleCall(); assert.equal(s.states[1], false); assert.equal(s.api.stops, 1);
    s.api.emit('volume-level', .8); assert.equal(s.states[0], 0);
  }
  {
    const s = setup(), connection = s.hook.toggleCall();
    s.finish(null); await connection;
    assert.match(s.states[3], /could not connect/); assert.equal(s.states[2], false); assert.ok(s.api.stops);
  }
  {
    const s = setup(), connection = s.hook.toggleCall();
    s.api.emit('call-start'); s.api.emit('error', new Error('synthetic transport failure'));
    assert.equal(s.states[1], false); assert.ok(s.api.stops); s.finish({}); await connection;
  }
  {
    const s = setup(), connection = s.hook.toggleCall(); s.cleanup();
    const before = JSON.stringify(s.states);
    s.api.emit('call-start'); s.api.emit('volume-level', 1); s.finish({}); await connection;
    assert.equal(JSON.stringify(s.states), before); assert.ok(s.api.stops >= 3);
  }
  {
    const s = setup(), connection = s.hook.toggleCall(); await s.hook.toggleCall();
    s.api.emit('call-start'); s.finish({}); await connection;
    assert.equal(s.states[1], false); assert.equal(s.states[2], false); assert.ok(s.api.stops >= 3);
  }
  {
    const s = setup(), connection = s.hook.toggleCall(); [...s.timers.values()][0]();
    assert.match(s.states[3], /taking too long/); s.finish({}); await connection;
    assert.equal(s.states[1], false); assert.ok(s.api.stops >= 2);
  }
  {
    const s = setup(), connection = s.hook.toggleCall();
    s.api.emit('call-start'); s.finish({}); await connection;
    for (const type of ['audio-processing-setup-error', 'audio-processor-recovery-error']) s.api.emit('error', { type });
    assert.equal(s.states[1], true); assert.equal(s.states[3], ''); assert.equal(s.api.stops, 0);
    s.api.emit('error', { type: 'audio-processing-error' }); await tick();
    assert.equal(s.states[1], false); assert.ok(s.api.stops); assert.match(s.states[3], /could not connect/);
  }
  {
    const s = setup({ delayStop: true }), connection = s.hook.toggleCall();
    s.api.emit('call-start'); s.finish({}); await connection;
    let finished = false;
    const stopping = s.hook.toggleCall().then(() => { finished = true; });
    const repeatedClick = s.hook.toggleCall(); await tick();
    assert.equal(finished, false); assert.equal(s.api.starts, 1); assert.equal(s.api.stops, 1);
    s.finishStop(); await Promise.all([stopping, repeatedClick]); assert.equal(finished, true);
  }
  {
    const s = setup({ rejectStop: true }), connection = s.hook.toggleCall();
    s.api.emit('call-start'); s.finish({}); await connection;
    await s.hook.toggleCall();
    assert.match(s.states[3], /retry ending the call/); assert.match(s.states[3], /close this tab/);
    s.api.rejectStop = false; await s.hook.toggleCall();
    assert.equal(s.api.starts, 1); assert.equal(s.api.stops, 2);
  }
  {
    const s = setup({ rejectStop: true }), connection = s.hook.toggleCall();
    s.api.emit('call-start'); s.api.emit('error', { type: 'daily-error' });
    s.finish({}); await connection; await tick();
    assert.match(s.states[3], /close this tab/); assert.equal(s.states[1], false);
  }
  {
    const s = setup({ rejectStop: true }), connection = s.hook.toggleCall();
    s.cleanup(); const before = JSON.stringify(s.states);
    s.api.emit('call-start'); s.finish({}); await connection; await tick();
    assert.equal(JSON.stringify(s.states), before); assert.ok(s.api.stops >= 3);
  }
  console.log('PASS: eleven synthetic voice lifecycle cases, including async stop, rejected stop, cleanup, and exact nonfatal errors; no network or microphone access.');
})().catch(error => { console.error(error); process.exitCode = 1; });
