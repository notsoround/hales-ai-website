/* eslint-disable react-refresh/only-export-components -- Isolated development-only synthetic saved-recording fixture. */
import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import AccountRecordingArchive from '../src/components/cupcake/AccountRecordingArchive';
import LibraryWorkspace from '../src/components/cupcake/LibraryWorkspace';
import { restoreSession, sessionSnapshot, subscribeSession } from '../src/components/cupcake/accountSession';
import '../src/index.css';
import '../src/components/cupcake/studio.css';
import '../src/components/cupcake/design/tokens.css';
import '../src/components/cupcake/assistant-appearance.css';

if (!import.meta.env.DEV) throw Error('Synthetic recording summary preview is development only.');

const owners = {
  A: { account_id: 'acc_summary_a', email: 'a@example.invalid', name: 'Synthetic A' },
  B: { account_id: 'acc_summary_b', email: 'b@example.invalid', name: 'Synthetic B' },
};
type Owner = keyof typeof owners;
type Appearance = 'rose' | 'caribbean';
type SyntheticResponse = { status: number; value: Record<string, unknown> };
type SyntheticServer = (owner: Owner, route: string, body: Record<string, unknown>) => Promise<SyntheticResponse>;
let owner: Owner = 'A';
let preview = { visible: true, version: 0, appearance: 'rose' as Appearance };
const previewListeners = new Set<() => void>();
const notifyPreview = () => { for (const listener of previewListeners) listener(); };
const fixture = {
  requests: [] as { owner: Owner; route: string; body: Record<string, unknown>; headers: Record<string, string> }[],
  blocked: [] as string[],
  behavior: 'normal',
  async switchOwner(next: Owner) { owner = next; await restoreSession(); },
  appearance(next: Appearance) { preview = { ...preview, appearance: next }; notifyPreview(); },
  show(visible: boolean) { preview = { ...preview, visible }; notifyPreview(); },
  refresh() { preview = { ...preview, version: preview.version + 1 }; notifyPreview(); },
  storage() {
    const prefix = 'cupcake-account-v1:';
    return Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
      .filter((key): key is string => key !== null && key.startsWith(prefix))
      .map(key => [key, localStorage.getItem(key)]));
  },
};
(window as unknown as { summaryFixture: typeof fixture }).summaryFixture = fixture;

const nativeFetch = window.fetch.bind(window);
const routes = new Set(['recordings/list', 'recordings/get', 'recordings/original-link', 'recordings/transcription-status']);
const actions = new Set(['recording_summary_get', 'recording_summary_begin', 'list', 'fetch', 'projects', 'analysis_list', 'decision_list']);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin) return nativeFetch(input, init);
  if (url.origin !== 'https://automate.hales.ai' || !url.pathname.startsWith('/api/account/')) {
    fixture.blocked.push(url.href); throw Error('External network forbidden.');
  }
  const route = url.pathname.slice('/api/account/'.length), captured = owner, identity = owners[captured];
  if (route === 'session') return Response.json({ ok: true, identity });
  const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
  if (!routes.has(route) && !(route === 'data' && typeof body.action === 'string' && actions.has(body.action))) {
    fixture.blocked.push(url.href); throw Error('Unexpected synthetic account action.');
  }
  const headers = Object.fromEntries(new Headers(init?.headers));
  if (headers['x-cupcake-request'] !== 'account' || headers['x-cupcake-account-context'] !== identity.account_id) {
    return Response.json({ ok: false, error: 'account_context_changed' }, { status: 409 });
  }
  fixture.requests.push({ owner: captured, route, body, headers });
  if (route === 'data' && body.action === 'recording_summary_begin') {
    const key = 'cupcake-account-v1:' + encodeURIComponent(identity.account_id) + ':audio-summary-v1:' + body.recordingId + ':' + body.transcriptSha256;
    const saved = JSON.parse(localStorage.getItem(key) || 'null') as Record<string, unknown> | null;
    const fields = ['requestId', 'recordingId', 'originalSha256', 'transcriptSha256'];
    if (!saved || fields.some(field => saved[field] !== body[field]) || Object.keys(saved).sort().join(',') !== fields.sort().join(',')) {
      throw Error('Synthetic summary request was not saved with its exact source before sending.');
    }
  }
  const echo = fixture.behavior === 'wrongEcho' ? owners[captured === 'A' ? 'B' : 'A'] : identity;
  if (route === 'recordings/original-link') return Response.json({ ok: true, identity: echo,
    url: 'https://automate.hales.ai/api/account/recordings/original?token=' + 't'.repeat(43), expiresAt: Date.now() / 1000 + 300 });
  const remote = (window as unknown as { syntheticSummaryServer: SyntheticServer }).syntheticSummaryServer;
  const result = await remote(captured, route, body);
  return Response.json({ ...result.value, identity: echo }, { status: result.status });
};

await restoreSession();
function Preview() {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
  const view = useSyncExternalStore(listener => { previewListeners.add(listener); return () => { previewListeners.delete(listener); }; }, () => preview);
  return <div className="cc-app" data-appearance={view.appearance}>
    <main className="cc-studio" style={{ padding: 12 }}>
      <p className="cc-muted">Synthetic saved audio only. No provider or live account.</p>
      {view.visible && session.identity && (new URLSearchParams(location.search).has('document')
        ? <LibraryWorkspace key={session.generation} active onOpenRecording={id => fixture.blocked.push('legacy-recording:' + id)} onWork={() => {}} />
        : <AccountRecordingArchive key={session.generation} active version={view.version} requested={null} />)}
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
