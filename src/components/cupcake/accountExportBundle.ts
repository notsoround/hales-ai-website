import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccountRequestError, accountExport, accountExportDownload, assertGeneration, sessionSnapshot, subscribeSession } from './accountSession';

export const exportSectionCodes = ['profile','health','activity','food','plans','phone','apple_health','chat','preferences','finance','library','recordings','voice'] as const;
export type ExportSection = typeof exportSectionCodes[number];
const tables:Record<ExportSection,readonly string[]> = {
  profile:['accounts'],health:['weight_batches','weight_versions','weight_clients','weight_adjustments','weight_manual_requests','health_manual_observations','body_checkins'],activity:['personal_outcomes','exercise_entries'],
  food:['food_meals','food_items','food_nutrition_settings'],plans:['coach_plan'],phone:['phone_daily_uploads','phone_daily_heads','ringconn_night_snapshots','ringconn_night_heads'],
  apple_health:['health_device_grants','health_auto_export_batches','health_auto_export_points'],chat:['quick_chat_threads','quick_chat_turns','quick_chat_attempts'],preferences:['account_personas'],
  finance:['receipts','receipt_candidate_sets','receipt_matches','recon_events','recon_links','recon_coverage'],library:['documents','overlays','analyses','decisions','projects'],
  recordings:['recordings','account_audio_transcription_requests','documents'],voice:['account_voice_sessions','documents'],
};
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/, SHA = /^[a-f0-9]{64}$/;
const storageKey = (owner:string) => 'cupcake-account-export-intent-v1:' + encodeURIComponent(owner);
export type ExportIntent = {request_id:string;sections:ExportSection[]};
type Chunk = {member:string;rowCount:number;bytes:number;sha256:string};
type Source = {code:'library'|'recordings';source:string;status:'included'|'unavailable';consistentSnapshot:boolean;readAt:string|null};
export type BundleCoverage = {scope:'owned-local-structured-data';consistentSnapshot:boolean;consistency:'per-database'|'single-database';sourceSnapshots:Source[];selectedSections:ExportSection[];
  sections:Partial<Record<ExportSection,{status:'included'|'unavailable';reason?:string;tables:Record<string,{rowCount:number;columns:string[];jsonColumns:string[];chunks:Chunk[]}>}>>;
  excluded:{section:string;reason:string;note:string}[];notes:string[];noRowTruncation:true};
export type BundleManifest = {format:'cupcake.account.structured-bundle.v1';generatedAt:string;accountId:string;completePrivacyExport:false;recordBytes:number;coverage:BundleCoverage};
export type BundleStatus = {id:string;requestId:string;state:'building'|'ready'|'failed'|'expired';createdAt:string;expiresAt:string;selectedSections:ExportSection[];error:string|null;filename:string;mimeType:'application/zip';bytes:number|null;sha256:string|null;manifest:BundleManifest|null;ok:true};
const validSections = (value:unknown):value is ExportSection[] => Array.isArray(value) && value.length > 0 && value.length <= exportSectionCodes.length && new Set(value).size === value.length && value.every(code => exportSectionCodes.includes(code));
const sameSections = (a:ExportSection[],b:ExportSection[]) => a.length === b.length && a.every(section => b.includes(section));
const plain = (value:unknown):value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const count = (value:unknown):value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const instant = (value:unknown):value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const invalid = () => Error('The ZIP coverage could not be verified. No file was created. Check its status before trying again.');

export function verifyBundleStatus(input:unknown, owner:string, intent:ExportIntent):BundleStatus {
  const job = input as BundleStatus;
  if (!plain(job) || job.ok !== true || job.id !== intent.request_id || job.requestId !== intent.request_id || !UUID.test(job.id)
      || !['building','ready','failed','expired'].includes(job.state) || !instant(job.createdAt) || !instant(job.expiresAt)
      || !validSections(job.selectedSections) || !sameSections(job.selectedSections,intent.sections)
      || job.filename !== 'cupcake-structured-data-' + intent.request_id + '.zip' || job.mimeType !== 'application/zip'
      || (job.error !== null && typeof job.error !== 'string')) throw invalid();
  if (job.state !== 'ready') {
    if (job.bytes !== null || job.sha256 !== null || job.manifest !== null || (job.state === 'building' ? job.error !== null : !job.error)) throw invalid();
    return job;
  }
  if (!count(job.bytes) || job.bytes === 0 || job.bytes > 128 * 1024 * 1024 || typeof job.sha256 !== 'string' || !SHA.test(job.sha256) || job.error !== null) throw invalid();
  const manifest = job.manifest;
  if (!plain(manifest) || manifest.format !== 'cupcake.account.structured-bundle.v1' || manifest.accountId !== owner || manifest.completePrivacyExport !== false || !instant(manifest.generatedAt) || !count(manifest.recordBytes) || manifest.recordBytes > 512 * 1024 * 1024) throw invalid();
  const coverage = manifest.coverage;
  if (!plain(coverage) || coverage.scope !== 'owned-local-structured-data' || coverage.noRowTruncation !== true || !validSections(coverage.selectedSections)
      || !sameSections(coverage.selectedSections,intent.sections) || !plain(coverage.sections) || Object.keys(coverage.sections).length !== intent.sections.length
      || Object.keys(coverage.sections).some(section => !intent.sections.includes(section as ExportSection))
      || !Array.isArray(coverage.excluded) || !coverage.excluded.every(entry => plain(entry) && typeof entry.section === 'string' && typeof entry.reason === 'string' && typeof entry.note === 'string')
      || !['binary_originals','external_sources','auxiliary_history','authentication_and_operations','other_accounts_and_shared_reports'].every(code => coverage.excluded.some(entry => entry.section === code))
      || !Array.isArray(coverage.notes) || coverage.notes.some(note => typeof note !== 'string')) throw invalid();
  const multi = intent.sections.includes('recordings'), snapshots = coverage.sourceSnapshots;
  if (coverage.consistentSnapshot !== !multi || coverage.consistency !== (multi ? 'per-database' : 'single-database') || !Array.isArray(snapshots) || snapshots.length !== (multi ? 2 : 1)
      || new Set(snapshots.map(source => source?.code)).size !== snapshots.length
      || snapshots.some(source => !plain(source) || !['library','recordings'].includes(source.code) || (!multi && source.code !== 'library') || typeof source.source !== 'string' || !source.source.trim()
        || (source.status === 'included' ? source.consistentSnapshot !== true || !instant(source.readAt) : source.status !== 'unavailable' || source.consistentSnapshot !== false || source.readAt !== null))
      || snapshots.find(source => source.code === 'library')?.status !== 'included') throw invalid();
  const members = new Set<string>();let rawBytes = 0;
  for (const section of intent.sections) {
    const entry = coverage.sections[section];
    if (!plain(entry) || !['included','unavailable'].includes(entry.status) || !plain(entry.tables)) throw invalid();
    if (entry.status === 'unavailable') { if (typeof entry.reason !== 'string' || Object.keys(entry.tables).length) throw invalid();continue; }
    if (Object.keys(entry.tables).length !== tables[section].length || Object.keys(entry.tables).some(table => !tables[section].includes(table))) throw invalid();
    for (const [table, info] of Object.entries(entry.tables)) {
      if (!plain(info) || !count(info.rowCount) || !Array.isArray(info.columns) || !info.columns.length || new Set(info.columns).size !== info.columns.length || info.columns.some(column => typeof column !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(column))
          || !Array.isArray(info.jsonColumns) || info.jsonColumns.some(column => !info.columns.includes(column)) || !Array.isArray(info.chunks)) throw invalid();
      let rows = 0;
      for (const [index, chunk] of info.chunks.entries()) {
        if (!plain(chunk) || chunk.member !== `data/${section}/${table}/${String(index + 1).padStart(6,'0')}.ndjson` || !count(chunk.rowCount) || !chunk.rowCount || !count(chunk.bytes) || !chunk.bytes || chunk.bytes > 4 * 1024 * 1024 || typeof chunk.sha256 !== 'string' || !SHA.test(chunk.sha256) || members.has(chunk.member)) throw invalid();
        members.add(chunk.member);rows += chunk.rowCount;rawBytes += chunk.bytes;
      }
      if (rows !== info.rowCount) throw invalid();
    }
  }
  if (members.size >= 2048 || rawBytes !== manifest.recordBytes) throw invalid();
  return job;
}

function persist(intent:ExportIntent|null, snapshot:ReturnType<typeof sessionSnapshot>) {
  assertGeneration(snapshot.generation);
  if (!snapshot.identity || sessionSnapshot().identity?.account_id !== snapshot.identity.account_id) throw new DOMException('The account changed.', 'AbortError');
  try { if (intent) sessionStorage.setItem(storageKey(snapshot.identity.account_id),JSON.stringify(intent));else sessionStorage.removeItem(storageKey(snapshot.identity.account_id)); }
  catch { throw Error('This browser could not keep the preparation request. Enable session storage and try again. No ZIP preparation was sent.'); }
}
function pause(milliseconds:number,signal:AbortSignal) {
  return new Promise<void>((resolve,reject) => {
    const abort = () => {clearTimeout(timer);reject(new DOMException('Cancelled.','AbortError'));};
    const timer = setTimeout(() => {signal.removeEventListener('abort',abort);resolve();},milliseconds);
    signal.addEventListener('abort',abort,{once:true});if (signal.aborted) abort();
  });
}

export function useAccountExportBundle(onRecoverSections:(sections:ExportSection[])=>void) {
  const session = useSyncExternalStore(subscribeSession,sessionSnapshot), owner = session.identity?.account_id, generation = session.generation;
  const [intent,setIntent] = useState<ExportIntent|null>(null), [job,setJob] = useState<BundleStatus|null>(null);
  const [phase,setPhase] = useState<'idle'|'preparing'|'checking'|'waiting'|'downloading'>('idle');
  const [error,setError] = useState(''), [notice,setNotice] = useState(''), [unavailable,setUnavailable] = useState(false);
  const operation = useRef(0), controller = useRef<AbortController|null>(null), flight = useRef(false), saved = useRef<ExportIntent|null>(null);
  const cancel = useCallback(() => {operation.current++;controller.current?.abort();flight.current = false;},[]);
  const run = useCallback(async (candidate:ExportIntent,prepare=false) => {
    const snapshot = sessionSnapshot();if (!snapshot.identity || flight.current) return;
    const token = ++operation.current, current = new AbortController();controller.current?.abort();controller.current = current;flight.current = true;
    const active = () => {assertGeneration(snapshot.generation);if (operation.current !== token || current.signal.aborted) throw new DOMException('Cancelled.','AbortError');};
    setPhase(prepare?'preparing':'checking');setJob(null);setError('');setNotice('');setUnavailable(false);
    try {
      let value = await accountExport<unknown>(prepare?'prepare':'status',prepare?{request_id:candidate.request_id,sections:candidate.sections}:{request_id:candidate.request_id},snapshot,current.signal);
      const deadline = Date.now() + 70000;let delay = 1000;
      while (true) {
        active();const verified = verifyBundleStatus(value,snapshot.identity.account_id,candidate);setJob(verified);
        if (verified.state !== 'building') break;
        if (Date.now() >= deadline) {setNotice('Preparation is still pending. Check the saved status shortly.');break;}
        setPhase('waiting');await pause(delay,current.signal);active();delay = Math.min(4000,delay+500);
        value = await accountExport<unknown>('status',{request_id:candidate.request_id},snapshot,current.signal);
      }
    } catch (cause) {
      if (operation.current === token && !current.signal.aborted && sessionSnapshot().generation === snapshot.generation) {
        setError(cause instanceof TypeError ? 'Preparation could not be confirmed. Check the saved status before starting another download.' : cause instanceof Error ? cause.message : 'The ZIP request could not be confirmed. Check its saved status.');
        if (cause instanceof AccountRequestError && ['export_not_found','export_expired','export_request_conflict'].includes(cause.code)) setUnavailable(true);
      }
    } finally {if (operation.current === token) {flight.current = false;setPhase('idle');}}
  },[]);
  useEffect(() => {
    cancel();saved.current = null;setIntent(null);setJob(null);setPhase('idle');setError('');setNotice('');setUnavailable(false);
    if (owner) {
      try {
        const raw = sessionStorage.getItem(storageKey(owner));if (raw && raw.length <= 4096) {
          const candidate = JSON.parse(raw) as ExportIntent;
          if (!plain(candidate) || Object.keys(candidate).sort().join(',') !== 'request_id,sections' || !UUID.test(candidate.request_id) || !validSections(candidate.sections)) throw invalid();
          saved.current = candidate;setIntent(candidate);onRecoverSections(candidate.sections);void run(candidate);
        }
      } catch {setError('The saved preparation request could not be read. You can prepare a new download.');}
    }
    return cancel;
  },[owner,generation,onRecoverSections,run,cancel]);
  const clear = () => {
    cancel();persist(null,sessionSnapshot());saved.current = null;
    setIntent(null);setJob(null);setPhase('idle');setError('');setNotice('');setUnavailable(false);
  };
  const start = async (sections:ExportSection[]) => {
    if (flight.current || saved.current) return;
    const snapshot = sessionSnapshot();if (!snapshot.identity) return;
    const candidate = {request_id:crypto.randomUUID(),sections:[...sections]};persist(candidate,snapshot);
    saved.current = candidate;setIntent(candidate);setJob(null);await run(candidate,true);
  };
  const download = async () => {
    if (!intent || !job || job.state !== 'ready' || flight.current) return;
    const snapshot = sessionSnapshot();if (!snapshot.identity) return;
    const token = ++operation.current, current = new AbortController();controller.current?.abort();controller.current = current;flight.current = true;setPhase('downloading');setError('');setNotice('');
    try {
      const status = verifyBundleStatus(await accountExport<unknown>('status',{request_id:intent.request_id},snapshot,current.signal),snapshot.identity.account_id,intent);
      if (status.state !== 'ready' || status.sha256 !== job.sha256 || status.bytes !== job.bytes || JSON.stringify(status.manifest) !== JSON.stringify(job.manifest)) throw Error('This preparation changed or expired. Check its status before downloading.');
      const blob = await accountExportDownload(intent.request_id,{bytes:status.bytes!,sha256:status.sha256!},snapshot,current.signal);
      assertGeneration(snapshot.generation);if (operation.current !== token || current.signal.aborted) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url;anchor.download = status.filename;anchor.click();setTimeout(() => URL.revokeObjectURL(url),1000);
      setNotice('ZIP download requested. Check your browser’s downloads. Keep the file private.');
    } catch (cause) {if (operation.current === token && !current.signal.aborted && sessionSnapshot().generation === snapshot.generation) setError(cause instanceof TypeError ? 'The ZIP transfer was interrupted. No file was created. Check status and retry the download.' : cause instanceof Error ? cause.message : 'The ZIP could not be downloaded. No file was created.');}
    finally {if (operation.current === token) {flight.current = false;setPhase('idle');}}
  };
  return {intent,job,phase,error,notice,busy:phase!=='idle',terminal:unavailable || job?.state==='failed' || job?.state==='expired',start,clear,download,check:() => saved.current ? run(saved.current) : Promise.resolve()};
}
