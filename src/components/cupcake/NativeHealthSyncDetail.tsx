import { useState, useSyncExternalStore } from 'react';
import { accountNativeHealth, sessionSnapshot, subscribeSession } from './accountSession';
import './native-health.css';

type HealthType = 'sleep' | 'heart_rate' | 'steps';
type HealthStatus = 'complete' | 'no_data' | 'not_selected' | 'permission_required' | 'unavailable' | 'failed' | 'incomplete';
export type NativeHealthReceipt = {
  ok: true; format: 'cupcake.health.native-receipt.v1'; request_id: string; connection_id: string; connection_epoch: number;
  installation_id: string; epoch: number; body_sha256: string; received_at: string; observed_at: string | null;
  types: { type: HealthType; status: HealthStatus; record_count: number }[];
  record_count: number; upserted: number; deleted: number; coverage: 'requested_window_only';
  source: 'android_health_connect'; estimated_sleep: boolean | null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TYPES = ['sleep', 'heart_rate', 'steps'];
const STATUSES = ['complete', 'no_data', 'not_selected', 'permission_required', 'unavailable', 'failed', 'incomplete'];
const RECEIPT_FIELDS = ['ok','format','request_id','connection_id','connection_epoch','installation_id','epoch','body_sha256','received_at','observed_at','types','record_count','upserted','deleted','coverage','source','estimated_sleep'];
const TYPE_LABELS: Record<HealthType, string> = { sleep:'Sleep', heart_rate:'Heart rate', steps:'Steps' };
const STATUS_LABELS: Record<HealthStatus, string> = { complete:'Complete', no_data:'No data returned', not_selected:'Not selected', permission_required:'Android permission required', unavailable:'Unavailable', failed:'Read failed', incomplete:'Incomplete read' };
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function count(value: unknown, maximum = 150000): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum; }
function instant(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,19) === value.slice(0,19);
}
function text(value: unknown): value is string { return typeof value === 'string' && !!value.trim() && value.length <= 1024 && !value.includes('\0'); }
function sameReceipt(a: NativeHealthReceipt, b: NativeHealthReceipt): boolean { return RECEIPT_FIELDS.every(key => JSON.stringify(a[key as keyof NativeHealthReceipt]) === JSON.stringify(b[key as keyof NativeHealthReceipt])); }
function when(value: string): string { return new Date(value).toLocaleString(); }

// Shared validation keeps connection history and feed detail on the same receipt contract.
// eslint-disable-next-line react-refresh/only-export-components
export function nativeHealthReceipt(value: unknown): NativeHealthReceipt {
  if (!object(value) || Object.keys(value).length !== RECEIPT_FIELDS.length || RECEIPT_FIELDS.some(key => !(key in value))
      || value.ok !== true || value.format !== 'cupcake.health.native-receipt.v1'
      || !['request_id','connection_id','installation_id'].every(key => typeof value[key] === 'string' && UUID.test(value[key] as string))
      || value.connection_epoch !== 1 || !count(value.epoch, Number.MAX_SAFE_INTEGER) || value.epoch < 1
      || typeof value.body_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(value.body_sha256)
      || !instant(value.received_at) || (value.observed_at !== null && !instant(value.observed_at))
      || value.source !== 'android_health_connect' || value.coverage !== 'requested_window_only'
      || (value.estimated_sleep !== null && typeof value.estimated_sleep !== 'boolean')
      || !count(value.record_count) || !count(value.upserted) || value.upserted > value.record_count || !count(value.deleted)
      || !Array.isArray(value.types) || !value.types.length || value.types.length > 3) throw Error('Unconfirmed sync receipt');
  const seen = new Set<string>(); let total = 0, sleep = 0;
  for (const row of value.types) {
    if (!object(row) || Object.keys(row).length !== 3 || typeof row.type !== 'string' || !TYPES.includes(row.type)
        || seen.has(row.type) || typeof row.status !== 'string' || !STATUSES.includes(row.status) || !count(row.record_count,50000)
        || (row.status !== 'complete' && row.record_count !== 0)) throw Error('Unconfirmed sync receipt');
    seen.add(row.type); total += row.record_count; if (row.type === 'sleep') sleep = row.record_count;
  }
  if (total !== value.record_count || (total === 0) !== (value.observed_at === null) || (!sleep && value.estimated_sleep !== null)) throw Error('Unconfirmed sync receipt');
  return value as NativeHealthReceipt;
}

type Window = { start: string; end: string; queryZoneId: string; historyCoverage: 'requested_window_only' };
function observationWindow(value: unknown): Window {
  if (!object(value) || !instant(value.start) || !instant(value.end) || Date.parse(value.start) >= Date.parse(value.end)
      || !text(value.queryZoneId) || value.historyCoverage !== 'requested_window_only') throw Error('Unconfirmed observation window');
  try { new Intl.DateTimeFormat('en', { timeZone:value.queryZoneId }); } catch { throw Error('Unconfirmed observation window'); }
  return value as Window;
}
type Detail = { receipt: NativeHealthReceipt; sourcePackages?: string[]; recordingMethods?: string[]; observationWindow?: Window; sleepLabel?: string | null };
function detail(value: unknown): Detail {
  if (!object(value)) throw Error('Unconfirmed sync detail');
  const receipt = nativeHealthReceipt(value.receipt);
  const hasMetadata = ['sourcePackages','coverage','observationWindow','recordingMethods','sleepLabel'].some(key => key in value);
  if (!hasMetadata) return { receipt };
  if (value.coverage !== 'requested_window_only' || !Array.isArray(value.sourcePackages) || value.sourcePackages.length > 150000
      || !value.sourcePackages.every(text) || new Set(value.sourcePackages).size !== value.sourcePackages.length
      || (receipt.record_count > 0 && !value.sourcePackages.length)
      || !Array.isArray(value.recordingMethods) || value.recordingMethods.length > 4
      || !value.recordingMethods.every(method => ['automatic','manual_entry','actively_recorded','unknown'].includes(method))
      || new Set(value.recordingMethods).size !== value.recordingMethods.length
      || ![null,'Source-reported sleep estimate','Manually entered sleep','Sleep basis unknown'].includes(value.sleepLabel as string | null)) throw Error('Unconfirmed sync detail');
  if ((receipt.estimated_sleep === true && value.sleepLabel !== 'Source-reported sleep estimate')
      || (receipt.estimated_sleep === false && value.sleepLabel !== 'Manually entered sleep')
      || (!receipt.types.some(row => row.type === 'sleep' && row.record_count > 0) && value.sleepLabel !== null)) throw Error('Unconfirmed sleep label');
  return { receipt, sourcePackages:value.sourcePackages, recordingMethods:value.recordingMethods,
           observationWindow:observationWindow(value.observationWindow), sleepLabel:value.sleepLabel as string | null };
}
function savedBatch(result: unknown, expected: NativeHealthReceipt): Record<string, unknown> {
  if (!object(result) || result.ok !== true || !sameReceipt(nativeHealthReceipt(result.receipt),expected) || !object(result.batch)) throw Error('Unconfirmed saved batch');
  const batch = result.batch;
  const fields = ['format','request_id','connection_id','connection_epoch','installation_id','epoch','platform','capturedAt','window','stepTotal','stepTotalStatus','types','deletions'];
  if (Object.keys(batch).length !== fields.length || fields.some(key => !(key in batch))
      || batch.format !== 'cupcake.health.native-batch.v1' || batch.platform !== 'android_health_connect'
      || !['request_id','connection_id','connection_epoch','installation_id','epoch'].every(key => batch[key] === expected[key as keyof NativeHealthReceipt])
      || !instant(batch.capturedAt) || batch.stepTotal !== null || batch.stepTotalStatus !== 'not_aggregated_multiple_sources_may_overlap'
      || !Array.isArray(batch.types) || batch.types.length !== expected.types.length || !Array.isArray(batch.deletions)) throw Error('Unconfirmed saved batch');
  observationWindow(batch.window);
  const seen = new Set<string>();
  for (const row of batch.types) {
    if (!object(row) || Object.keys(row).length !== 4 || typeof row.type !== 'string' || seen.has(row.type)
        || (row.reason !== null && (typeof row.reason !== 'string' || row.reason.length > 4096)) || !Array.isArray(row.records)) throw Error('Unconfirmed saved batch');
    const summary = expected.types.find(type => type.type === row.type);
    if (!summary || row.status !== summary.status || row.records.length !== summary.record_count
        || row.records.some(record => !object(record) || !object(record.metadata) || !text(record.metadata.recordId)
          || !text(record.metadata.sourcePackage) || !instant(record.startTime) || !instant(record.endTime))) throw Error('Unconfirmed saved batch');
    seen.add(row.type);
  }
  if (JSON.stringify(batch).length > 4 * 1024 * 1024) throw Error('Saved batch exceeds the readback limit');
  return batch;
}

export function NativeHealthSyncDetail({ value }: { value: unknown }) {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot);
  let saved: Detail;
  try { saved = detail(value); } catch { return <p className="cc-native-health-note" role="alert">This saved health sync detail could not be confirmed. Reload your account history.</p>; }
  return <HealthSyncDetail key={`${session.generation}:${saved.receipt.request_id}`} saved={saved} signedIn={!!session.identity} />;
}

function HealthSyncDetail({ saved, signedIn }: { saved: Detail; signedIn: boolean }) {
  const [batch, setBatch] = useState<Record<string,unknown> | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const receipt = saved.receipt;
  const load = async () => {
    if (busy || !signedIn) return; setBusy(true); setError('');
    try { setBatch(savedBatch(await accountNativeHealth('batch',{request_id:receipt.request_id}),receipt)); }
    catch { setBatch(null); setError('The saved original batch is unavailable or changed. No new sync was requested.'); }
    finally { setBusy(false); }
  };
  const sleepLabel = saved.sleepLabel ?? (receipt.estimated_sleep === true ? 'Source-reported sleep estimate' : receipt.estimated_sleep === false ? 'Manually entered sleep' : receipt.types.some(type => type.type === 'sleep' && type.record_count) ? 'Sleep basis unknown' : null);
  return <section className="cc-native-health-detail" aria-label="Saved Android health sync">
    <p><strong>Saved Health Connect upload</strong> · requested window only</p>
    <dl className="cc-native-health-facts"><div><dt>Server received</dt><dd><time dateTime={receipt.received_at} title={receipt.received_at}>{when(receipt.received_at)}</time></dd></div>
      <div><dt>Latest source observation</dt><dd>{receipt.observed_at ? <time dateTime={receipt.observed_at} title={receipt.observed_at}>{when(receipt.observed_at)}</time> : 'No records in this batch'}</dd></div></dl>
    <ul className="cc-native-health-type-results">{receipt.types.map(type => <li key={type.type}><strong>{TYPE_LABELS[type.type]}</strong><span>{type.record_count} source {type.record_count === 1 ? 'record' : 'records'} · {STATUS_LABELS[type.status]}</span></li>)}</ul>
    <p className="cc-native-health-note">Record counts describe this saved upload. They are not daily step totals, time asleep or resting heart rate. Missing or denied data is not a zero measurement.</p>
    {sleepLabel && <p><strong>{sleepLabel}</strong>. Sleep is not verified measured sleep.</p>}
    {saved.observationWindow && <dl className="cc-native-health-facts"><div><dt>Requested observation window</dt><dd>{when(saved.observationWindow.start)} – {when(saved.observationWindow.end)}<br />Query time zone: {saved.observationWindow.queryZoneId}</dd></div></dl>}
    {saved.sourcePackages && <div className="cc-native-health-sources"><strong>Source apps</strong>{saved.sourcePackages.length ? <ul>{saved.sourcePackages.map(source => <li key={source}><code>{source}</code></li>)}</ul> : <p>No source records returned.</p>}</div>}
    {saved.recordingMethods && saved.recordingMethods.length > 0 && <p className="cc-native-health-note">Recording methods: {saved.recordingMethods.map(method => method.replace(/_/g,' ')).join(', ')}.</p>}
    <details className="cc-native-health-proof"><summary>Upload receipt identifiers</summary><dl className="cc-native-health-facts"><div><dt>Request</dt><dd><code>{receipt.request_id}</code></dd></div><div><dt>Connection</dt><dd><code>{receipt.connection_id}</code> · version {receipt.connection_epoch}</dd></div><div><dt>Android installation</dt><dd><code>{receipt.installation_id}</code> · version {receipt.epoch}</dd></div><div><dt>Original upload SHA-256</dt><dd><code>{receipt.body_sha256}</code></dd></div><div><dt>Saved record changes</dt><dd>{receipt.upserted} upserted · {receipt.deleted} deleted</dd></div></dl></details>
    <button type="button" className="cc-secondary" disabled={busy || !signedIn} onClick={() => void load()}>{busy ? 'Loading saved batch…' : batch ? 'Reload saved original batch' : 'Load saved original batch'}</button>
    {!signedIn && <p className="cc-native-health-note">Sign in to load the saved original batch.</p>}
    {error && <p role="alert">{error}</p>}
    {batch && <details className="cc-native-health-raw"><summary>Saved original batch (JSON)</summary><p className="cc-native-health-note">Saved source records only. Loading this batch does not contact Android or request another upload.</p><pre tabIndex={0} aria-label="Saved original health batch JSON">{JSON.stringify(batch,null,2)}</pre></details>}
  </section>;
}
