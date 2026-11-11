/* eslint-disable react-refresh/only-export-components -- Local synthetic acceptance fixture. */
import { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import CupcakeStudio from '../src/components/cupcake/CupcakeStudio';
import { restoreSession, sessionSnapshot, subscribeSession } from '../src/components/cupcake/accountSession';
import { personalStorage, personalNamespace } from '../src/components/cupcake/personalStorage';
import { ACCOUNT_SESSIONS } from '../src/components/cupcake/accountMode';
import type { VoiceSession } from '../src/components/cupcake/accountVoice';
import '../src/index.css';
import '../src/components/cupcake/assistant-appearance.css';

if (!import.meta.env.DEV || !ACCOUNT_SESSIONS) throw Error('Local account voice test build required.');
const owners = { A: { account_id: 'acc_voice_a', email: 'a@example.invalid', name: 'Synthetic A' }, B: { account_id: 'acc_voice_b', email: 'b@example.invalid', name: 'Synthetic B' } };
const SERVER = 'synthetic-voice-server-v1', OWNER = 'synthetic-voice-owner';
const HIST = '10000000-0000-4000-8000-000000000001', LIVE = '20000000-0000-4000-8000-000000000002', CALL = '30000000-0000-4000-8000-000000000003';
const requestId = '40000000-0000-4000-8000-000000000004';
type RecordRow = { owner: string; requestId: string; session: VoiceSession };
type SyntheticCall = { emit: (name: string, value: unknown) => void; options: Record<string, unknown> };
const params = new URLSearchParams(location.search);
const fixture = {
  requests: [] as { route: string; body: Record<string, unknown>; owner: string; headers: Record<string, string>; credentials?: RequestCredentials; recovery: unknown }[],
  blocked: [] as string[], calls: [] as SyntheticCall[], joins: [] as string[], leaves: 0, destroys: 0,
  micRequests: 0, tracksCreated: 0, tracksStopped: 0, activeTracks: 0, micRecovery: [] as unknown[], recorderStops: 0,
  behavior: params.get('behavior') || 'normal', available: !params.has('off'), micMode: 'normal', holdJoin: false, holdLeave: false,
  held: false, release: () => {}, releaseMic: () => {}, releaseJoin: () => {},
  recovery() { return JSON.parse(personalStorage('localStorage').getItem('live-voice-v1') || 'null'); },
  records(): RecordRow[] { return JSON.parse(localStorage.getItem(SERVER) || '[]'); },
  persist(rows: RecordRow[]) { localStorage.setItem(SERVER, JSON.stringify(rows)); },
  namespace: personalNamespace,
  async switchOwner(next: 'A' | 'B') { localStorage.setItem(OWNER, next); await restoreSession(); },
  statusCalls: 0,
  confirmEnd() { const rows = this.records(); for (const row of rows) if (row.session.state !== 'ended') row.session = { ...publicSession(row.session), ...saved(), sessionId: row.session.sessionId, createdAt: Date.now() / 1000 }; this.persist(rows); },
  remote(name: string, value: unknown) { this.calls.at(-1)?.emit(name, value); },
  emit(text: string) { this.calls.at(-1)?.emit('app-message', { data: { type: 'transcript', transcriptType: 'final', role: 'assistant', transcript: text, id: text } }); },
};
(window as unknown as { voiceFixture: typeof fixture }).voiceFixture = fixture;
const currentOwner = () => localStorage.getItem(OWNER) === 'B' ? owners.B : owners.A;
const saved = (): VoiceSession => ({ sessionId: HIST, state: 'ended', expiresAt: Date.now() / 1000 + 100, maxSeconds: 180, createdAt: Date.now() / 1000 - 3600,
  documentId: 'doc_' + 'a'.repeat(32), result: { source: 'vapi_authenticated_call_read', evidenceType: 'speech-to-text estimate', providerCallId: CALL,
    startedAt: '2026-11-08T15:00:00Z', endedAt: '2026-11-08T15:01:00Z', transcript: 'Owned saved estimate.',
    messages: [{ role: 'assistant', message: 'Owned saved estimate.' }], billing: 'provider-reported', billingReport: { cost: 0.01 } } });
const publicSession = (value: VoiceSession) => { const plain = { ...value }; delete plain.webCallUrl; delete plain.callId; return plain; };
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin || url.protocol === 'data:') return nativeFetch(input, init);
  if (!url.href.startsWith('https://automate.hales.ai/api/account/')) { fixture.blocked.push(url.href); throw Error('External requests forbidden by synthetic voice fixture.'); }
  const route = url.pathname.split('/api/account/')[1], identity = currentOwner(), body = JSON.parse(String(init?.body || '{}'));
  const headers = Object.fromEntries(new Headers(init?.headers));
  const response = (status: number, value: object, wrong = false) => Response.json({ ok: status < 400, ...value, identity: wrong ? owners.B : identity }, { status });
  if (route === 'session') return response(200, {});
  if (headers['x-cupcake-account-context'] !== identity.account_id) return response(409, { error: 'account_context_changed' });
  fixture.requests.push({ route, body, owner: identity.account_id, headers, credentials: init?.credentials, recovery: fixture.recovery() });
  if (route === 'data') {
    if (body.action === 'list') return response(200, { documents: [], projects: [], browseTotal: 0, libraryTotal: 0, hasMore: false, nextCursor: null });
    if (body.action === 'projects') return response(200, { projects: [] });
    if (body.action === 'analysis_list') return response(200, { analyses: [] });
    if (body.action === 'decision_list') return response(200, { decisions: [] });
    throw Error('Unexpected synthetic data action ' + String(body.action));
  }
  if (route === 'recordings/list') return response(200, { recordings: [], total: 0, hasMore: false, nextCursor: null });
  if (route === 'voice/config') return response(200, { available: fixture.available, maxSeconds: 180, reservedMicros: 750000 });
  if (route === 'voice/list') return response(200, { sessions: [saved(), ...fixture.records().filter(row => row.owner === identity.account_id && row.session.state === 'ended').map(row => publicSession(row.session))] });
  const rows = fixture.records();
  if (route === 'voice/start') {
    if (fixture.recovery()?.requestId !== body.request_id) throw Error('Paid POST preceded durable UUID.');
    let row = rows.find(row => row.owner === identity.account_id && row.requestId === body.request_id);
    if (!row) { row = { owner: identity.account_id, requestId: String(body.request_id), session: { sessionId: LIVE, state: 'live', maxSeconds: 180, expiresAt: Date.now() / 1000 + (fixture.behavior === 'deadline' ? 1.1 : 175), webCallUrl: 'https://vapi.daily.co/synthetic-room', callId: CALL } }; rows.push(row); fixture.persist(rows); }
    if (fixture.behavior === 'holdStart') { fixture.held = true; await new Promise<void>(resolve => { fixture.release = resolve; }); fixture.held = false; }
    if (fixture.behavior === 'lostStart') { fixture.behavior = 'normal'; throw TypeError('Synthetic start response lost after commit.'); }
    return response(200, fixture.behavior === 'badRoom' ? { ...row.session, webCallUrl: 'https://attacker.example.invalid/room' } : row.session, fixture.behavior === 'wrongEcho');
  }
  if (route === 'voice/recover') {
    const row = rows.find(row => row.owner === identity.account_id && row.requestId === body.request_id);
    return row ? response(200, row.session) : response(404, { error: 'voice_session_not_found' });
  }
  if (route === 'voice/status') {
    if (body.session_id === HIST) return response(200, saved());
    const row = rows.find(row => row.owner === identity.account_id && row.session.sessionId === body.session_id);
    if (!row) return response(404, { error: 'voice_session_not_found' });
    if (fixture.behavior === 'slowEnd' && row.session.state === 'ending' && ++fixture.statusCalls >= 3) fixture.confirmEnd();
    if (fixture.behavior === 'holdStatus') { fixture.held = true; await new Promise<void>(resolve => { fixture.release = resolve; }); fixture.held = false; }
    return response(200, publicSession(row.session));
  }
  if (route === 'voice/end') {
    const row = rows.find(row => row.owner === identity.account_id && row.session.sessionId === body.session_id);
    if (!row) return response(404, { error: 'voice_session_not_found' });
    if (row.session.state === 'ended') return response(200, row.session);
    if (fixture.behavior === 'slowEnd') { row.session = { ...publicSession(row.session), state: 'ending', reason: 'voice_end_requested' }; fixture.persist(rows); return response(200, row.session); }
    if (fixture.behavior === 'endUncertain') { row.session.state = 'uncertain'; row.session.reason = 'voice_dispatch_uncertain'; fixture.persist(rows); return response(200, publicSession(row.session)); }
    row.session = { ...publicSession(row.session), ...saved(), sessionId: LIVE, createdAt: Date.now() / 1000 };
    if (fixture.behavior === 'emptyResult') row.session.result = { ...row.session.result!, transcript: null, messages: [] };
    fixture.persist(rows); return response(200, row.session);
  }
  fixture.blocked.push(route); throw Error('Unexpected local fixture route ' + route);
};

// Generated browser tracks never use the microphone or display picker. The real
// acquireMicrophone helper owns cancellation/late-resolution cleanup.
Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
  fixture.micRequests++; fixture.micRecovery.push(fixture.recovery());
  if (fixture.micMode === 'deny') throw new DOMException('Synthetic permission denied', 'NotAllowedError');
  if (fixture.micMode === 'hold') await new Promise<void>(resolve => { fixture.releaseMic = resolve; });
  const audio = new AudioContext(), source = audio.createOscillator(), output = audio.createMediaStreamDestination(); source.connect(output); source.start();
  output.stream.getTracks().forEach(track => { fixture.tracksCreated++; fixture.activeTracks++; const stop = track.stop.bind(track); let stopped = false; track.stop = () => { if (!stopped) { stopped = true; fixture.tracksStopped++; fixture.activeTracks--; stop(); void audio.close(); } }; });
  return output.stream;
} });
Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { value: async () => { throw Error('Synthetic test forbids display picker'); } });
Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: async () => [] });
class SyntheticRecorder {
  static isTypeSupported() { return true; }
  state = 'inactive'; ondataavailable: ((event: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null;
  start() { this.state = 'recording'; }
  stop() { if (this.state === 'inactive') return; this.state = 'inactive'; fixture.recorderStops++; this.ondataavailable?.({ data: new Blob(['synthetic audio'], { type: 'audio/webm' }) }); setTimeout(() => this.onstop?.(), 5); }
}
Object.defineProperty(window, 'MediaRecorder', { value: SyntheticRecorder });
await restoreSession();
if (params.has('unknown')) personalStorage('localStorage').setItem('live-voice-v1', JSON.stringify({ requestId }));
function Preview() {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot), [mode, setMode] = useState<'talk' | 'record'>('talk'), [visible, setVisible] = useState(true);
  return <div className="cc-app" data-appearance={params.get('theme') === 'rose' ? 'rose' : 'caribbean'}><main style={{ maxWidth: 900, margin: 'auto', padding: 12 }}>
    <p>Local simulated voice, accounts and audio. No real calls or providers.</p>
    <nav aria-label="Synthetic studio modes"><button onClick={() => setMode('talk')}>Talk preview</button><button onClick={() => setMode('record')}>Record preview</button><button onClick={() => setVisible(value => !value)}>{visible ? 'Hide studio' : 'Show studio'}</button></nav>
    {visible && session.identity ? <CupcakeStudio key={session.generation} mode={mode} assistantName={params.get('theme') === 'rose' ? 'Matthieu' : 'Cupcake'} active onBusy={() => {}} /> : <p role="status">Synthetic studio locked or closed.</p>}
  </main></div>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
