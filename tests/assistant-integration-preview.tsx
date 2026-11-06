// Actual application root. All data, chat replies and media are synthetic/local.
import { createRoot } from 'react-dom/client';
import CupcakeGPT from '../src/pages/cupcake/sandbox/cupcakegpt/page';
import '../src/index.css';

if (!import.meta.env.DEV) throw Error('Synthetic preview is development only.');
type Thread = { id: string; title: string; turns: { id: string; text: string; status: string; retryAfter: number; response?: { reply: string; model: string; sources: never[] } }[] };
const state = {
  actions: [] as string[], unknown: [] as string[], micRequests: 0, recorderStarts: 0,
  recorderStops: 0, tracksStopped: 0, deferMicrophone: false, releaseMicrophone: () => {},
};
(window as unknown as { assistantFixture: typeof state }).assistantFixture = state;
const params = new URLSearchParams(location.search);
history.replaceState({}, '', `/cupcake?${params}`);
localStorage.setItem('cupcake-private-access', 'synthetic-assistant-fixture-only');
const threads = (): Thread[] => JSON.parse(sessionStorage.getItem('synthetic-assistant-threads') || '[]');
const saveThreads = (value: Thread[]) => sessionStorage.setItem('synthetic-assistant-threads', JSON.stringify(value));
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  const body = JSON.parse(String(init?.body || '{}'));
  const action = String(body.action || url.pathname.split('/').pop());
  state.actions.push(action);
  const ok = (value: object) => Response.json({ ok: true, ...value });
  if (url.pathname.endsWith('/cupcake-feed')) return ok({ items: [], outcomes: {}, totals: {}, daily: [], nextCursor: null,
    coverage: { scope: url.searchParams.get('scope'), complete: true } });
  if (!url.pathname.endsWith('/cupcake-library')) {
    state.unknown.push(action); throw Error(`Synthetic fixture blocks networking: ${action}`);
  }
  if (action === 'quick_chat_list') return ok({ threads: threads().map(({ id, title }) => ({ id, title })) });
  if (action === 'quick_chat_create') {
    const thread = { id: String(body.threadId), title: String(body.title), turns: [] };
    saveThreads([...threads(), thread]); return ok({ thread });
  }
  if (action === 'quick_chat_get') return ok({ thread: threads().find(t => t.id === body.threadId) });
  if (action === 'quick_chat_begin') {
    const all = threads(), thread = all.find(t => t.id === body.threadId)!;
    thread.turns.push({ id: String(body.turnId), text: String(body.text), status: 'completed', retryAfter: 0,
      response: { reply: 'Synthetic saved assistant response. No provider was contacted.', model: 'synthetic-local-fixture', sources: [] } });
    saveThreads(all); return ok({ thread, acquired: true, execution: 'server' });
  }
  if (action === 'talk_list') return ok({ sessions: [] });
  if (action === 'list') return ok({ documents: [], projects: [], browseTotal: 0, libraryTotal: 0, hasMore: false });
  if (action === 'weight_list') return ok({ measurements: [], latestMeasurement: null, total: 0, nextCursor: null, coverage: {} });
  if (action === 'body_headline_get') return ok({ body: { latest: null, history: [] } });
  if (action === 'exercise_list') return ok({ entries: [] });
  if (['glucose_manual_list', 'ringconn_night_list', 'steps_list'].includes(action)) return ok({ entries: [] });
  if (action === 'body_assessment_get') return ok({ table: null });
  if (action === 'food_history') return ok({ meals: [], total: 0, complete: true, nextCursor: null, pendingCount: 0, undatedLoggedCount: 0 });
  if (action === 'food_settings_get') return ok({ settings: { calorieTarget: null, expenditureEstimate: null, effectiveFrom: null } });
  if (action === 'food_list') return ok({ meals: [] });
  if (['ask_jobs', 'strategy_list', 'analysis_list', 'connector_list'].includes(action)) return ok({ jobs: [], requests: [], analyses: [], connectors: [] });
  state.unknown.push(action); throw Error(`Unimplemented synthetic action: ${action}`);
};

// A generated oscillator stream supplies real browser MediaStream tracks without
// accessing a device. The fake recorder exercises the real IndexedDB draft path.
// Playback permission is outside this test; do not wait on an OS audio prompt.
AudioContext.prototype.resume = async () => {};
const syntheticStream = () => {
  const context = new AudioContext(), oscillator = context.createOscillator();
  const destination = context.createMediaStreamDestination(); oscillator.connect(destination); oscillator.start();
  const track = destination.stream.getAudioTracks()[0], stop = track.stop.bind(track);
  track.stop = () => { state.tracksStopped++; oscillator.stop(); void context.close(); stop(); };
  return destination.stream;
};
Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
  getUserMedia: async () => {
    state.micRequests++;
    if (!state.deferMicrophone) return syntheticStream();
    return new Promise<MediaStream>(resolve => { state.releaseMicrophone = () => resolve(syntheticStream()); });
  },
  getDisplayMedia: async () => { throw Error('This local preview does not capture a real screen.'); },
  enumerateDevices: async () => [], addEventListener() {}, removeEventListener() {},
} });
class SyntheticRecognition {
  lang = 'en-US';
  onresult?: () => void;
  onerror?: () => void;
  onend?: () => void;
  start() { queueMicrotask(() => { this.onerror?.(); this.onend?.(); }); }
  stop() { this.onend?.(); }
}
for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
  Object.defineProperty(window, name, { configurable: true, value: SyntheticRecognition });
}
class SyntheticRecorder {
  static isTypeSupported() { return true; }
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  onerror?: () => void;
  start() { this.state = 'recording'; state.recorderStarts++; }
  stop() {
    if (this.state !== 'recording') return;
    this.state = 'inactive'; state.recorderStops++;
    this.ondataavailable?.({ data: new Blob(['synthetic-local-audio'], { type: this.mimeType }) });
    queueMicrotask(() => this.onstop?.());
  }
}
Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: SyntheticRecorder });
createRoot(document.getElementById('root')!).render(<CupcakeGPT/>);
