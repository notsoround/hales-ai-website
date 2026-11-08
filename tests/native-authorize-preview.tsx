import { createRoot } from 'react-dom/client';
import { AccountSessionGate } from '../src/components/cupcake/AccountSessionGate';
import { NativeInstallationControls } from '../src/components/cupcake/NativeInstallationControls';
import '../src/index.css';
import '../src/components/cupcake/studio.css';
import '../src/components/cupcake/design/tokens.css';
import '../src/components/cupcake/design/cupcake-theme.css';
import '../src/components/cupcake/assistant-appearance.css';
if (!import.meta.env.DEV) throw Error('Local synthetic preview only.');
const fixture = { requests: [] as { route: string; body: Record<string, unknown>; headers: Record<string, string> }[], mode: 'normal', release: () => {}, wrongOwner: false };
(window as unknown as { nativeFixture: typeof fixture }).nativeFixture = fixture;
const identity = { account_id: 'acc_native_test_a', name: 'Synthetic Client', email: 'client@example.invalid' };
const nativeFetch = window.fetch.bind(window);
let revoked = false;
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin) return nativeFetch(input, init);
  if (!url.href.startsWith('https://automate.hales.ai/api/account/')) throw Error('No nonlocal requests in this fixture.');
  const route = url.pathname.split('/api/account/')[1], body = JSON.parse(String(init?.body || '{}'));
  fixture.requests.push({ route, body, headers: Object.fromEntries(new Headers(init?.headers)) });
  if (route === 'sign-in') sessionStorage.setItem('synthetic-native-signed-in', '1');
  if (!sessionStorage.getItem('synthetic-native-signed-in')) return Response.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (route === 'native/authorize') {
    if (fixture.mode === 'hold') await new Promise<void>(resolve => { fixture.release = resolve; });
    if (fixture.mode === 'lost') throw TypeError('Synthetic response lost after approval');
    return Response.json({ ok: true, code: 'nc_' + 'C'.repeat(43), state: body.state, redirect_uri: fixture.mode === 'wrong-uri' ? 'https://example.invalid/steal' : body.redirect_uri, expires_in: 120, identity: fixture.wrongOwner ? { ...identity, account_id: 'acc_native_test_b' } : identity });
  }
  if (route === 'native/installations/list') return Response.json({ ok: true, identity, installations: [{ installation_id: '00000000-0000-4000-8000-000000000123', client_id: 'cupcake-android-health-preview-v1', scope: 'native:profile', epoch: 1, created: 1794140000, refreshed: 1794140000, idle_expires: 1794744800, absolute_expires: 1796732000, revoked: revoked ? 1794141000 : null, status: revoked ? 'revoked' : 'active' }] });
  if (route === 'native/installations/revoke') { if (fixture.mode === 'lost-revoke') { revoked = true; throw TypeError('Synthetic lost revoke response'); } revoked = true; return Response.json({ ok: true, identity, installation_id: body.installation_id, revoked: true }); }
  return Response.json({ ok: true, identity });
};
createRoot(document.getElementById('root')!).render(<AccountSessionGate>{account => <div className="cc-app"><h1>Web account: {account.name}</h1><NativeInstallationControls/></div>}</AccountSessionGate>);
