import { createRoot } from 'react-dom/client';
import { AccountSessionGate } from '../src/components/cupcake/AccountSessionGate';
import { NativeHealthSyncDetail } from '../src/components/cupcake/NativeHealthSyncDetail';
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
const ios = new URLSearchParams(location.search).get('ios') === '1';
const partial = ios && new URLSearchParams(location.search).get('partial') === '1';
let revoked = false, healthRevoked = false;
const receipt = {ok:true,format:'cupcake.health.native-receipt.v1',request_id:'00000000-0000-4000-8000-000000000789',connection_id:'00000000-0000-4000-8000-000000000456',connection_epoch:1,installation_id:'00000000-0000-4000-8000-000000000123',epoch:1,body_sha256:'a'.repeat(64),received_at:'2026-11-08T13:00:00Z',observed_at:'2026-11-08T12:00:00Z',types:[{type:'sleep',status:'complete',record_count:1},{type:'heart_rate',status:'permission_required',record_count:0},{type:'steps',status:'complete',record_count:1}],record_count:2,upserted:2,deleted:0,coverage:'requested_window_only',source:'android_health_connect',estimated_sleep:true as boolean | null};
const observationWindow={start:'2026-11-07T18:00:00Z',end:'2026-11-08T13:00:00Z',queryZoneId:'America/Chicago',historyCoverage:'requested_window_only'};
if (ios) {
  receipt.source = 'ios_healthkit'; receipt.estimated_sleep = null; receipt.observed_at = '2026-11-08T12:00:00.123456789Z';
  receipt.types[1].status = 'no_readable_data';
  if (partial) receipt.types[2].status = 'incomplete';
}
const detail={receipt,...(ios?{sourceBundleIdentifiers:['test.synthetic.watch']}:{sourcePackages:['test.synthetic.ring']}),coverage:'requested_window_only',observationWindow,recordingMethods:ios?['not_user_entered']:['automatic'],sleepLabel:ios?'HealthKit sleep categories; not verified measured sleep':'Source-reported sleep estimate'};
const batch={format:'cupcake.health.native-batch.v1',request_id:receipt.request_id,connection_id:receipt.connection_id,connection_epoch:1,installation_id:receipt.installation_id,epoch:1,platform:receipt.source,capturedAt:'2026-11-08T12:30:00Z',window:observationWindow,stepTotal:null,stepTotalStatus:'not_aggregated_multiple_sources_may_overlap',types:receipt.types.map(row=>({...row,record_count:undefined,reason:row.status==='incomplete'?'Synthetic bounded query':null,records:row.record_count?[ios?{id:'00000000-0000-4000-8000-000000000888',source:{bundleIdentifier:'test.synthetic.watch',name:'Fictional watch'},start:'2026-11-08T11:00:00.123456789Z',end:'2026-11-08T12:00:00.123456789Z',wasUserEntered:false,value:row.type==='sleep'?{sleep:{rawStage:3}}:{steps:{count:123}}}:{metadata:{recordId:'test-'+row.type,sourcePackage:'test.synthetic.ring'},startTime:'2026-11-08T11:00:00Z',endTime:'2026-11-08T12:00:00Z'}]:[]})),deletions:[]};
const connection=()=>({connection_id:receipt.connection_id,connection_epoch:1,installation_id:receipt.installation_id,epoch:1,...(ios?{source:'ios_healthkit'}:{}),types:['sleep','steps'],created:Date.now()/1000-3600,expires:Date.now()/1000+86400,revoked:healthRevoked?Date.now()/1000:null,status:healthRevoked?'revoked':'active',last_received_at:Date.parse(receipt.received_at)/1000,last_observed_at:receipt.observed_at});
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin) return nativeFetch(input, init);
  if (!url.href.startsWith('https://automate.hales.ai/api/account/')) throw Error('No nonlocal requests in this fixture.');
  const route = url.pathname.split('/api/account/')[1], body = JSON.parse(String(init?.body || '{}'));
  fixture.requests.push({ route, body, headers: Object.fromEntries(new Headers(init?.headers)) });
  if (route === 'sign-in') sessionStorage.setItem('synthetic-native-signed-in', '1');
  if (!sessionStorage.getItem('synthetic-native-signed-in')) return Response.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if(route.startsWith('native/health/')) {
    if (fixture.mode === 'health-hold') await new Promise<void>(resolve => { fixture.release = resolve; });
    if (fixture.mode === 'health-lost' && route === 'native/health/authorize') throw TypeError('Synthetic lost approval response');
    const own=fixture.wrongOwner?{...identity,account_id:'acc_native_test_b'}:identity;
    if(route==='native/health/authorize')return Response.json({ok:true,identity:own,code:'nhc_'+'C'.repeat(43),state:body.state,redirect_uri:fixture.mode==='health-wrong-uri'?'https://example.invalid':body.redirect_uri,expires_in:120});
    if(route==='native/health/connections/list')return Response.json({ok:true,identity:own,connections:[connection()]});
    if(route==='native/health/connections/revoke') {healthRevoked=fixture.mode!=='health-unconfirmed-revoke';if(fixture.mode==='health-lost-revoke')throw TypeError('Synthetic lost revoke response');return Response.json({ok:true,identity:own,revoked:true,connection_id:body.connection_id});}
    if(route==='native/health/sync')return Response.json({ok:true,identity:own,connections:[connection()],receipts:[fixture.mode==='health-malformed'?{...receipt,record_count:9}:receipt],coverage:{available:true,scope:'owned_native_health',historyCoverage:'requested_window_only',truncated:false,localComplete:true,limit:30,recordCountsAreNotDailyTotals:true}});
    if(route==='native/health/batch')return Response.json({ok:true,identity:own,receipt:fixture.mode==='health-changed-batch'?{...receipt,body_sha256:'b'.repeat(64)}:receipt,batch});
    throw Error('Unexpected synthetic health route');
  }
  if (route === 'native/authorize') {
    if (fixture.mode === 'hold') await new Promise<void>(resolve => { fixture.release = resolve; });
    if (fixture.mode === 'lost') throw TypeError('Synthetic response lost after approval');
    return Response.json({ ok: true, code: 'nc_' + 'C'.repeat(43), state: body.state, redirect_uri: fixture.mode === 'wrong-uri' ? 'https://example.invalid/steal' : body.redirect_uri, expires_in: 120, identity: fixture.wrongOwner ? { ...identity, account_id: 'acc_native_test_b' } : identity });
  }
  if (route === 'native/installations/list') return Response.json({ ok: true, identity, installations: [{ installation_id: '00000000-0000-4000-8000-000000000123', client_id: ios?'cupcake-ios-health-preview-v1':'cupcake-android-health-preview-v1', scope: 'native:profile', epoch: 1, created: 1794140000, refreshed: 1794140000, idle_expires: 1794744800, absolute_expires: 1796732000, revoked: revoked ? 1794141000 : null, status: revoked ? 'revoked' : 'active' }] });
  if (route === 'native/installations/revoke') { if (fixture.mode === 'lost-revoke') { revoked = true; throw TypeError('Synthetic lost revoke response'); } revoked = true; return Response.json({ ok: true, identity, installation_id: body.installation_id, revoked: true }); }
  return Response.json({ ok: true, identity });
};
createRoot(document.getElementById('root')!).render(<AccountSessionGate>{account => <div className="cc-app"><h1>Web account: {account.name}</h1><NativeInstallationControls/><NativeHealthSyncDetail value={detail}/></div>}</AccountSessionGate>);
