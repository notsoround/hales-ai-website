import ts from 'typescript';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acquireMicrophone, microphoneConstraints, microphoneMessage } from '../src/components/cupcake/voiceInput.ts';
import { drainVoiceTransport, TalkLineDrain, VoiceEndingCoordinator } from '../src/components/cupcake/voiceHistory.ts';

const source = readFileSync('src/components/cupcake/CupcakeStudio.tsx', 'utf8');
const ast = ts.createSourceFile('studio.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const bodies = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && ['startVoice', 'startRecording'].includes(node.name?.text)) bodies.push(node.getText(ast));
  if (ts.isVariableDeclaration(node) && ['endVoice', 'cancelRecordingStart'].includes(node.name.getText(ast))) bodies.push(`var ${node.getText(ast)};`);
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') {
    const callback = node.arguments[0]?.getText(ast) || '';
    if (callback.includes("(!active||mode!=='record')")) bodies.push(`var routeEffect=${callback};`);
    if (callback.includes('mounted.current = false')) bodies.push(`var mountEffect=${callback};`);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
const js = ts.transpileModule(bodies.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function deferred() { let resolve,reject; const promise = new Promise((done,fail) => { resolve = done;reject=fail; }); return { promise, resolve,reject }; }
function stream() { const s = { stopped: 0 }; const track = { label: 'Synthetic input', stop: () => s.stopped++ }; return Object.assign(s, { getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] }); }
function scenario({ deadline = 1000, meeting = false } = {}) {
  const mic = deferred(), display = deferred(), events = [];
  const ref = current => ({ current });
  const scope = {
    recording: false, busy: false, micTesting: false, voice: 'idle', mode: 'talk', active: true, inputDevice: '', title: '', autoAnalyze: false,
    captureAcquisition: ref(null), captureGeneration: ref(0), voiceAcquisition: ref(null), voiceGeneration: ref(0), mounted: ref(true),
    stoppingVoice: ref(false), endingVoice: ref(new VoiceEndingCoordinator()), voiceMic: ref(null), call: ref(null), remoteId: ref(null),
    talkLocalId: ref(''), talkStarted: ref(''), lineDrain: ref(new TalkLineDrain()), linesRef: ref([]), players: ref(new Map()),
    finishing: ref(false), context: ref(null), recorder: ref(null), streams: ref([]), started: ref(0), meterFrame: ref(0),
    useCallback: f => f, acquireMicrophone: (fn, constraints, _deadline, signal) => acquireMicrophone(fn, constraints, deadline, signal),
    microphoneConstraints, mediaError: microphoneMessage, drainVoiceTransport, TalkLineDrain, VoiceEndingCoordinator, AbortController,
    crypto: { randomUUID: () => 'synthetic-id' }, Date,
    navigator: { mediaDevices: { getUserMedia: () => {events.push('permission-request');return mic.promise;}, getDisplayMedia: () => display.promise } },
    window: { MediaRecorder: true }, MediaRecorder: class { static isTypeSupported() { return true; } constructor() { events.push('recorder-created'); } },
    request: async () => { events.push('provider-request'); throw Error('Provider must never be reached by pending-permission tests'); },
    setVoice: value => { scope.voice = value; events.push(['voice', value]); }, setBusy: value => { scope.busy = value; events.push(['busy', value]); },
    setCaptureStarting: value => events.push(['starting', value]), setError: value => events.push(['error', value]), setNotice: value => events.push(['notice', value]),
    setRecording: value => { scope.recording = value; }, setPreview: () => {}, setOpenedTalk: () => {}, setLines: () => {}, setSpeaking: () => {}, setMuted: () => {}, setTalks: () => {},
    cleanupTracks: () => { for (const s of scope.streams.current) s.getTracks().forEach(t => t.stop()); scope.streams.current = []; },
    refreshDrafts: async () => {}, endRemote: async () => {}, syncTalk: async () => {},
    putDraft: async () => events.push('draft-created'), setHeardAudio: () => {}, setLevel: () => {}, setInputName: () => {},
    AudioContext:class {async resume(){} close(){} createMediaStreamSource(){return{connect(){}}}createAnalyser(){return {fftSize:512,getByteTimeDomainData(){}}}},
    requestAnimationFrame:()=>1,deleteDraft:async id=>events.push(['draft-deleted',id]),
  };
  vm.createContext(scope); vm.runInContext(js, scope);
  const start = () => meeting ? scope.startRecording(true) : scope.mode === 'record' ? scope.startRecording(false) : scope.startVoice();
  return { scope, events, mic, display, start };
}

for (const mode of ['talk', 'record']) {
  const t = scenario({ deadline: 5 }); t.scope.mode = mode;
  await t.start();
  assert.ok(t.events.some(e => e[0] === 'error' && /did not finish/.test(e[1])), `${mode} reports timeout`);
  assert.ok(!t.events.includes('provider-request')); assert.ok(!t.events.includes('recorder-created'));
  assert.equal(t.scope.busy, false); assert.equal(t.scope.voice, 'idle');
  const late = stream(); t.mic.resolve(late); await tick(); assert.equal(late.stopped, 1);
}
for (const mode of ['talk', 'record']) {
  for (const cancellation of ['button', 'route', 'unmount']) {
    const t = scenario(); t.scope.mode = mode;
    const cleanup = t.scope.mountEffect(); const pending = t.start(); await tick();
    if (cancellation === 'unmount') cleanup();
    else if (cancellation === 'route') { t.scope.active = false; t.scope.routeEffect(); }
    else if (mode === 'talk') await t.scope.endVoice(); else t.scope.cancelRecordingStart();
    await pending; await tick(); const late = stream(); t.mic.resolve(late); await tick();
    assert.equal(late.stopped, 1, `${mode}/${cancellation} releases late stream`);
    assert.ok(!t.events.includes('provider-request')); assert.ok(!t.events.includes('recorder-created')); assert.ok(!t.events.includes('draft-created'));
    assert.ok(!t.events.some(e => e[0] === 'error' && e[1]), `${mode}/${cancellation} is quiet`);
  }
}
const meeting = scenario({ meeting: true }); meeting.scope.mode = 'record';
const meetingPending = meeting.start(); await tick(); meeting.scope.cancelRecordingStart(); await meetingPending;
const lateDisplay = stream(); meeting.display.resolve(lateDisplay); await tick(); assert.equal(lateDisplay.stopped, 1);
const shared = scenario({ meeting: true }); shared.scope.mode = 'record';
const sharedPending = shared.start(); const screen = stream(); shared.display.resolve(screen); await tick(); shared.scope.cancelRecordingStart(); await sharedPending;
assert.equal(screen.stopped, 1, 'cancelling pending meeting microphone stops shared screen immediately');
const lateMeetingMic = stream(); shared.mic.resolve(lateMeetingMic); await tick(); assert.equal(lateMeetingMic.stopped, 1);
const live = scenario(); live.scope.voice = 'live'; live.scope.recording = true; live.scope.active = false;
live.scope.routeEffect(); assert.equal(live.scope.voice, 'live'); assert.equal(live.scope.recording, true);
const cancelled = new AbortController(); cancelled.abort(); let attempted = false;
await assert.rejects(acquireMicrophone(() => { attempted = true; return Promise.resolve(stream()); }, {}, 50, cancelled.signal), e => e.name === 'MicrophoneCancelledError'); assert.equal(attempted, false);
const rapid=scenario();rapid.scope.setVoice=value=>rapid.events.push(['voice',value]);
const first=rapid.start(),second=rapid.start();await tick();assert.equal(rapid.events.filter(e=>e==='permission-request').length,1,'same-render double start asks for only one microphone');await rapid.scope.endVoice();await Promise.all([first,second]);
for(const cancellation of ['button','unmount']){
  const t=scenario(),writing=deferred();t.scope.mode='record';const cleanup=t.scope.mountEffect();
  const drafts=new Map([['existing-recording',{audio:'preserve me'}]]);
  t.scope.putDraft=async draft=>{await writing.promise;drafts.set(draft.id,draft);};
  t.scope.deleteDraft=async id=>{t.events.push(['draft-deleted',id]);drafts.delete(id);};
  const pending=t.start();t.mic.resolve(stream());await tick();
  if(cancellation==='unmount')cleanup();else t.scope.cancelRecordingStart();
  writing.resolve();await pending;
  assert.deepEqual([...drafts.keys()],['existing-recording'],`only the new empty draft removed after ${cancellation}`);
  assert.equal(drafts.get('existing-recording').audio,'preserve me');assert.ok(!t.events.includes('recorder-created'));
}
const unhandled=[];const observe=error=>unhandled.push(error);process.on('unhandledRejection',observe);
try{
  for(const cancellation of ['timeout','abort']){
    const late=deferred(),controller=new AbortController();
    const pending=acquireMicrophone(()=>late.promise,{},cancellation==='timeout'?5:1000,controller.signal);
    const settled=assert.rejects(pending);if(cancellation==='abort')controller.abort();await settled;
    late.reject(Error('late browser rejection'));await tick();await tick();
  }
  assert.deepEqual(unhandled,[],'late permission rejections are consumed');
}finally{process.off('unhandledRejection',observe);}
console.log('PASS actual Talk/Record startup: timeout/cancel/route/unmount; late tracks and rejections; meeting cleanup; rapid-start guard; only new empty draft removed; zero provider sessions; live sessions and existing drafts preserved.');
