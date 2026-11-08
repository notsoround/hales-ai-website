import { createRoot } from 'react-dom/client';
import LibraryWorkspace from '../src/components/cupcake/LibraryWorkspace';
import { ACCOUNT_SESSIONS } from '../src/components/cupcake/accountMode';
import { restoreSession } from '../src/components/cupcake/accountSession';
import '../src/index.css';
import '../src/components/cupcake/studio.css';
import '../src/components/cupcake/assistant-appearance.css';
if (!import.meta.env.DEV) throw Error('Local fixture only.');
const identity = { account_id: 'acc_navigation_fixture', name: 'Navigation fixture', email: 'navigation@example.invalid' };
const fixture = { requests: [] as { route: string; action: string; context: string | null }[], recordings: [] as string[], blocked: [] as string[], failDecisions: false, failAnalyses: false };
(window as unknown as { libraryNavigationFixture: typeof fixture }).libraryNavigationFixture = fixture;
const nativeFetch = window.fetch;
const documents = Array.from({ length: 34 }, (_, n) => ({ id: 'fixture_' + n, title: 'Synthetic source ' + (n + 1), status: 'ready', createdAt: '2026-11-08T06:00:00Z', kind: 'note', sourceApp: 'Local fixture', text: 'Synthetic source text.' }));
const project = { id: 'fixture_project', name: 'Synthetic project', description: 'Existing project context', status: 'active' };
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin) return nativeFetch(input, init);
  if (url.hostname !== 'automate.hales.ai') { fixture.blocked.push(url.href); throw Error('External networking blocked.'); }
  const body = JSON.parse(String(init?.body || '{}'));
  const route = url.pathname, action = String(body.action || route.split('/').pop());
  const context = new Headers(init?.headers).get('X-Cupcake-Account-Context');
  fixture.requests.push({ route, action, context });
  const ok = (value: object) => Response.json({ ok: true, ...value, ...(ACCOUNT_SESSIONS ? { identity } : {}) });
  if (route === '/api/account/session') return ok({ identity });
  if (ACCOUNT_SESSIONS ? route !== '/api/account/data' || context !== identity.account_id : route !== '/cupcake-library') throw Error('Incorrect transport or account context.');
  if (action === 'list') return ok(body.sourceFilter === 'channel-messages'
    ? { documents: [{ ...documents[0], id: 'fixture_message', speakerRole: 'assistant', sourceApp: 'Telegram', excerpt: 'Synthetic captured message.' }], browseTotal: 1, nextCursor: null }
    : { documents, projects: [project], browseTotal: 34, libraryTotal: 35, hasMore: false });
  if (action === 'fetch') return ok({ document: documents.find(d => d.id === body.id) || documents[0] });
  if (action === 'search') return ok({ results: [{ ...documents[0], documentId: documents[0].id, text: 'Synthetic search result.' }] });
  if (action === 'analysis_list' && fixture.failAnalyses) throw Error('Synthetic saved-analysis read failed.');
  if (action === 'analysis_list' && ACCOUNT_SESSIONS && 'mode' in body) throw Error('Account analysis reads reject extra mode fields.');
  if (action === 'analysis_get') { if (ACCOUNT_SESSIONS && 'mode' in body) throw Error('Account analysis reads reject extra mode fields.'); return ok({analysis:{id:'fixture_closeout',date:'2026-11-07',mode:'closeout',reply:'Synthetic retained closeout evidence.',model:'Synthetic',sources:[{documentId:'fixture_0',title:'Synthetic original'}]}}); }
  if (action === 'analysis_list' && ACCOUNT_SESSIONS) return ok({analyses:[{id:'fixture_closeout',date:'2026-11-07',mode:'closeout',reply:'Synthetic retained closeout evidence.',model:'Synthetic',sources:[{documentId:'fixture_0',title:'Synthetic original'}]},{id:'fixture_analysis',reply:'Synthetic saved analysis.',message:'Existing thinking',sources:[]}]});
  if (action === 'analysis_list') return ok({ analyses: [{ id: 'fixture_analysis', reply: 'Synthetic saved analysis.', message: 'Existing thinking', sources: [] }] });
  if (action === 'connector_list') return ok({ connectors: [] });
  if (action === 'closeout_preview') return ok({ candidates: [], date: '2026-11-07' });
  if (action === 'decision_list' && fixture.failDecisions) throw Error('Synthetic saved-decision read failed.');
  if (action === 'decision_list') return ok({ decisions: ACCOUNT_SESSIONS ? [{id:'fixture_decision',text:'Synthetic retained decision.',type:'decision',status:'open'}] : [] });
  if (action === 'receipt_list') return ok({ receipts: [] });
  if (action === 'ask_jobs') return ok({ jobs: [] });
  fixture.blocked.push(action); throw Error('Mutation/provider action blocked: ' + action);
};
async function mount() {
  if (ACCOUNT_SESSIONS) await restoreSession();
  const params = new URLSearchParams(location.search), appearance = params.get('theme') === 'rose' ? 'rose' : 'caribbean';
  const workspace = <LibraryWorkspace active onOpenRecording={id => fixture.recordings.push(id)} onWork={() => {}} />;
  createRoot(document.getElementById('root')!).render(<div className="cc-app" data-appearance={appearance}><main className="cc-shell"><section className="cc-studio">{workspace}{params.has('two') && <LibraryWorkspace active onOpenRecording={() => {}} onWork={() => {}} />}</section></main></div>);
}
void mount();
