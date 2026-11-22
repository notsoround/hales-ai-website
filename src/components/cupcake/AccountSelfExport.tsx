import { useEffect, useRef, useState } from 'react';
import { AccountRequestError, accountData, assertGeneration, sessionSnapshot, subscribeSession } from './accountSession';
import { saveFile } from './library';
import { exportSectionCodes, useAccountExportBundle, validExportSources, validNativeHealthRows, type ExportSection, type ExportSourceSnapshot } from './accountExportBundle';
import { AccountOriginalDownloads } from './AccountOriginalDownloads';

const sections = {
  profile: 'Account profile', health: 'Health records', activity: 'Activity', food: 'Meals and food settings',
  plans: 'Plans and goals', phone: 'Phone activity', apple_health: 'Apple Health records', chat: 'Text conversations',
  preferences: 'Assistant preferences', finance: 'Financial records', library: 'Library records',
  recordings: 'Saved recordings and transcripts', voice: 'Saved voice conversations',
  sharing: 'Invitations and sharing',
  source_history: 'Saved source-event history',
  native_health: 'Android health history',
} as const;
type Section = ExportSection;
const sectionCodes = [...exportSectionCodes];
type Coverage = { scope: 'owned-local-structured-data'; consistentSnapshot: boolean; consistency?: 'per-database'; sourceSnapshots?: ExportSourceSnapshot[]; selectedSections: Section[];
  sections: Partial<Record<Section, { status: 'included' | 'unavailable'; reason?: string; tables: Record<string, { rowCount: number; columns: string[]; jsonColumns: string[] }> }>>;
  excluded: { section: string; reason: string; note: string }[]; notes: string[] };
type ExportFile = { format: 'cupcake.account.local-export.v1' | 'cupcake.account.local-export.v2' | 'cupcake.account.local-export.v3'; generatedAt: string; accountId: string; completePrivacyExport: false; coverage: Coverage; data: Record<string, Record<string, Record<string, unknown>[]>> };
type Result = { export: ExportFile; filename: string; mimeType: string };
type Prepared = { file: ExportFile; filename: string; generation: number };
async function verifiedExport(result: Result, accountId: string, requested: Section[]): Promise<Prepared['file']> {
  const file = result.export;
  if (!file || !['cupcake.account.local-export.v1', 'cupcake.account.local-export.v2', 'cupcake.account.local-export.v3'].includes(file.format) || file.accountId !== accountId || file.completePrivacyExport !== false || !Number.isFinite(Date.parse(file.generatedAt)) || result.mimeType !== 'application/json' || !/^cupcake-local-data-[A-Za-z0-9_-]+\.json$/.test(result.filename) || file.coverage?.scope !== 'owned-local-structured-data' || !Array.isArray(file.coverage.selectedSections) || !Array.isArray(file.coverage.excluded) || !Array.isArray(file.coverage.notes) || !file.data || typeof file.data !== 'object') throw Error('The download could not be verified. No file was created. Try again.');
  if (file.format === 'cupcake.account.local-export.v1') {
    if (file.coverage.consistentSnapshot !== true || requested.includes('recordings') || requested.includes('source_history') || file.coverage.consistency !== undefined || file.coverage.sourceSnapshots !== undefined) throw Error('The download consistency could not be verified. No file was created.');
  } else {
    if ((file.format === 'cupcake.account.local-export.v3' ? !requested.includes('source_history') : requested.includes('source_history') || !requested.includes('recordings')) || !validExportSources(file.coverage,requested)) throw Error('The download consistency could not be verified. No file was created.');
  }
  const selected = file.coverage.selectedSections;
  if (selected.length !== requested.length || new Set(selected).size !== selected.length || selected.some(section => !requested.includes(section)) || Object.keys(file.coverage.sections || {}).some(section => !requested.includes(section as Section)) || Object.keys(file.data).some(section => !requested.includes(section as Section))) throw Error('The download coverage does not match your selection. No file was created.');
  for (const section of selected) {
    const entry = file.coverage.sections?.[section];
    if (!entry || !['included', 'unavailable'].includes(entry.status) || !entry.tables || typeof entry.tables !== 'object' || Array.isArray(entry.tables) || Object.values(entry.tables).some(table => !Number.isSafeInteger(table.rowCount) || table.rowCount < 0)) throw Error('The download coverage could not be verified. No file was created.');
    if (section === 'source_history') {
      const data = file.data[section], tables = ['source_event_receipts','source_event_versions','source_event_heads','source_event_indexed'];
      if (entry.status === 'unavailable' ? Object.keys(entry.tables).length !== 0 || data !== undefined
        : !data || Array.isArray(data) || Object.keys(data).length !== tables.length || Object.keys(entry.tables).length !== tables.length
          || tables.some(table => !entry.tables[table] || !Array.isArray(data[table]) || data[table].length !== entry.tables[table].rowCount)
          || Object.keys(data).some(table => !tables.includes(table))) throw Error('The download coverage could not be verified. No file was created.');
    }
    if (section === 'native_health' && (entry.status === 'unavailable'
      ? typeof entry.reason !== 'string' || !entry.reason.trim() || Object.keys(entry.tables).length !== 0 || file.data[section] !== undefined
      : !await validNativeHealthRows(entry.tables,file.data[section]))) throw Error('The Android health download could not be verified. No file was created.');
  }
  return file;
}

function formatExportSize(bytes: number) {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`;
  if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
  return `${bytes.toLocaleString()} B`;
}

export function AccountSelfExport() {
  const [selected, setSelected] = useState<Section[]>(sectionCodes);
  const [includeOriginals, setIncludeOriginals] = useState(false);
  const bundle = useAccountExportBundle(setSelected,setIncludeOriginals);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const picker = useRef<HTMLDetailsElement>(null);
  const mounted = useRef(true), inFlight = useRef(false), requestAbort = useRef<AbortController|null>(null);
  useEffect(() => {
    mounted.current = true;
    const stop = subscribeSession(() => {requestAbort.current?.abort();inFlight.current = false;setPrepared(null);setBusy(false);setError('');setNotice('');});
    return () => { mounted.current = false;requestAbort.current?.abort();stop(); };
  }, []);
  const pending = !!bundle.intent && !bundle.terminal && bundle.job?.state !== 'ready';
  const locked = busy || bundle.busy || pending;
  const choose = (next: Section[]) => {
    if (inFlight.current || locked) return;
    if (bundle.intent) bundle.clear();
    setSelected(sectionCodes.filter(section => next.includes(section))); setPrepared(null); setError(''); setNotice('');
  };
  const chooseOriginals = (include:boolean) => {
    if (inFlight.current || locked) return;
    if (bundle.intent) bundle.clear();
    setIncludeOriginals(include);setPrepared(null);setError('');setNotice('');
  };
  const prepare = async () => {
    if (inFlight.current || locked || !selected.length) return;
    const session = sessionSnapshot();
    if (!session.identity) return;
    const requested = [...selected];
    inFlight.current = true; setBusy(true); setPrepared(null); setError(''); setNotice('');
    const current = new AbortController();requestAbort.current?.abort();requestAbort.current = current;
    try {
      if (bundle.intent) bundle.clear();
      if (includeOriginals) {await bundle.start(requested,true);return;}
      const result = await accountData<Result>({ action: 'account_self_export', sections: requested },current.signal);
      assertGeneration(session.generation);
      if (!mounted.current) return;
      const file = await verifiedExport(result, session.identity.account_id, requested);
      assertGeneration(session.generation);
      if (!mounted.current || current.signal.aborted) return;
      setPrepared({ file, filename: result.filename, generation: session.generation });
    } catch (cause) { if (mounted.current && sessionSnapshot().generation === session.generation && !current.signal.aborted) {
      if (cause instanceof AccountRequestError && cause.code === 'export_too_large') {
        try { await bundle.start(requested); }
        catch (failure) {if (mounted.current && sessionSnapshot().generation === session.generation) setError(failure instanceof Error ? failure.message : 'The ZIP could not be prepared. Check its saved status.');}
      } else setError(cause instanceof Error ? cause.message : 'The download could not be prepared. Try again.');
    } }
    finally { if (requestAbort.current === current) {inFlight.current = false; if (mounted.current) setBusy(false);} }
  };
  const download = () => {
    if (!prepared) return;
    try {
      assertGeneration(prepared.generation);
      if (!mounted.current || sessionSnapshot().identity?.account_id !== prepared.file.accountId) throw Error('Your account changed. Prepare a new download after signing in.');
      saveFile(JSON.stringify(prepared.file), prepared.filename, 'application/json');
      setPrepared(null); setNotice('Download requested. Check your browser’s downloads.');
    } catch (cause) { setPrepared(null); setError(cause instanceof Error ? cause.message : 'The download could not start. Try again.'); }
  };
  const file = prepared?.file || (bundle.job?.state === 'ready' ? bundle.job.manifest : null);
  const originals = bundle.job?.state === 'ready' ? bundle.job.manifest?.originals : undefined;
  const coverage = file?.coverage;
  const failedMessage = bundle.job?.error && ['export_raw_limit','export_zip_limit','export_record_too_large','export_resource_limit'].includes(bundle.job.error)
    ? includeOriginals ? 'This selection exceeds the ZIP preparation limit. No partial file was created. Choose fewer sections and prepare a new download.' : 'These records exceed the current ZIP preparation allowance. No partial ZIP is available.'
    : 'This ZIP could not be prepared. No partial ZIP is available. You can prepare a new download.';
  return <section className="cc-account-controls cc-export-card" aria-label="Download your data">
    <h3>Download your data</h3>
    <p className="cc-export-lead">Export a private copy of your saved Cupcake records. Larger histories are packaged as a ZIP.</p>
    <label className="cc-account-check"><input type="checkbox" checked={includeOriginals} disabled={locked} onChange={event => chooseOriginals(event.target.checked)}/>Include original photos and audio</label>
    {!selected.length && <p className="cc-muted cc-small">Choose at least one section to prepare your download.</p>}
    <button type="button" className={file ? 'cc-secondary cc-export-prepare' : 'cc-primary cc-export-prepare'} disabled={locked || !selected.length} onClick={() => void prepare()}>{busy ? 'Preparing your download…' : bundle.terminal ? 'Prepare a new download' : 'Prepare my download'}</button>
    {(error || bundle.error) && <p role="alert">{error || bundle.error}</p>}
    {notice && <p role="status">{notice}</p>}
    {bundle.notice && <p role="status">{bundle.notice}</p>}
    {bundle.intent && <div className="cc-export-progress" aria-busy={bundle.busy}>
      {bundle.busy && <p role="status">{bundle.phase === 'downloading' ? 'Downloading and verifying your ZIP…' : bundle.phase === 'preparing' ? 'Preparing a ZIP for your selected records…' : 'Checking your saved ZIP preparation…'}</p>}
      {!bundle.busy && bundle.job?.state === 'building' && <p role="status">Your ZIP is still being prepared. Check the saved status shortly.</p>}
      {!bundle.busy && !bundle.job && !bundle.terminal && <p>Your browser remembers a preparation request. Check its status to recover it.</p>}
      {bundle.job?.state === 'failed' && <p role="status">{failedMessage}</p>}
      {bundle.job?.state === 'expired' && <p role="status">This prepared ZIP has expired. You can prepare a new download.</p>}
      <button type="button" className="cc-text-button" disabled={bundle.busy || busy} onClick={() => void bundle.check()}>Check saved status</button>
    </div>}
    {file && coverage && <div className="cc-export-ready">
      <p role="status" className="cc-export-ready-head"><strong>{prepared ? 'Your file is ready.' : 'Your ZIP is ready.'}</strong><span>Prepared {new Date(file.generatedAt).toLocaleString()}{!prepared && bundle.job?.bytes ? ` · ${formatExportSize(bundle.job.bytes)}` : ''}.</span></p>
      <div className="cc-export-ready-actions">
        {prepared ? <><button type="button" className="cc-primary cc-export-download-cta" onClick={download}>Download JSON file</button><button type="button" className="cc-text-button" onClick={() => setPrepared(null)}>Clear prepared file</button></>
          : <><button type="button" className="cc-primary cc-export-download-cta" disabled={bundle.busy} onClick={() => void bundle.download()}>{bundle.phase === 'downloading' ? 'Verifying ZIP…' : 'Download ZIP file'}</button><button type="button" className="cc-text-button" disabled={bundle.busy} onClick={() => bundle.clear()}>Clear prepared ZIP</button></>}
      </div>
      {!prepared && bundle.job && <p className="cc-muted cc-small">Available until {new Date(bundle.job.expiresAt).toLocaleString()}. Keep downloaded files private.</p>}
      {originals?.requested && <div className="cc-export-originals-summary">
        <p role="status"><strong>Original files:</strong> {originals.files.filter(item => item.status === 'included').length.toLocaleString()} included{originals.unavailableCount ? ` · ${originals.unavailableCount.toLocaleString()} unavailable` : ''}.</p>
        {originals.unavailableCount > 0 && <p className="cc-muted cc-small">This ZIP does not contain every requested original.</p>}
        {originals.unavailableCount > 0 && <details className="cc-export-picker"><summary>Unavailable originals</summary><ul>
          {originals.sectionFailures.map(failure => <li key={failure.section}>{sections[failure.section]}: originals could not be read for this section.</li>)}
          {originals.files.filter(item => item.status === 'unavailable').map(item => <li key={item.kind + ':' + item.sourceId}>{item.kind === 'meal_photo' ? 'Meal photo' : item.kind === 'receipt_photo' ? 'Receipt photo' : 'Recording audio'}: the saved original could not be verified. Its reference is retained in the manifest.</li>)}
        </ul></details>}
      </div>}
      <ul className="cc-export-coverage-list" aria-label="Download coverage">{coverage.selectedSections.map(section => {
        const entry = coverage.sections[section]!, count = Object.values(entry.tables).reduce((sum, table) => sum + table.rowCount, 0);
        return <li key={section}><strong>{sections[section]}:</strong> {entry.status === 'included' ? `${count.toLocaleString()} saved record${count === 1 ? '' : 's'}` : 'Unavailable for this account'}</li>;
      })}</ul>
      {coverage.consistentSnapshot === false && <div className="cc-export-consistency">
        <p className="cc-muted cc-small">Each available saved store was read consistently; separate stores may reflect slightly different moments.</p>
        <ul aria-label="Saved store read times">{coverage.sourceSnapshots?.map(source => <li key={source.code}>{source.source}: {source.status === 'included' ? `read ${new Date(source.readAt!).toLocaleString()}` : 'Unavailable for this account'}</li>)}</ul>
      </div>}
      <details className="cc-export-picker"><summary>What this download leaves out</summary><ul>{coverage.excluded.map((entry, index) => <li key={index}>{entry.section in sections && <strong>{sections[entry.section as Section]}: </strong>}{entry.note}</li>)}</ul></details>
    </div>}
    <details className="cc-export-picker" ref={picker}><summary>Choose sections · {selected.length === sectionCodes.length ? 'all selected' : `${selected.length} selected`}</summary>
      <fieldset disabled={locked} className="cc-export-sections"><legend>Include these records</legend>
        <div className="cc-export-choices"><button type="button" className="cc-text-button" onClick={() => choose(sectionCodes)}>Select all</button><button type="button" className="cc-text-button" onClick={() => choose([])}>Clear selection</button></div>
        {sectionCodes.map(section => <label className="cc-account-check" key={section}><input type="checkbox" checked={selected.includes(section)} onChange={event => choose(event.target.checked ? [...selected, section] : selected.filter(current => current !== section))}/>{sections[section]}</label>)}
      </fieldset>
    </details>
    <details className="cc-export-picker cc-export-notes"><summary>What’s included &amp; technical notes</summary>
      <div className="cc-export-notes-body">
        <p className="cc-muted cc-small">This covers supported records saved in your account. Connected-service copies and other excluded data remain outside this download. Keep the file private.</p>
        <p className="cc-muted cc-small">Including original photos and audio packages saved meal photos, receipt photos and recording audio into a ZIP. For large audio collections, use Download originals individually below.</p>
        {selected.includes('sharing') && <p className="cc-muted cc-small">Invitations and sharing includes your connection and permission history, including expired or revoked permissions. Shared report contents and other people’s health records are excluded.</p>}
        {selected.includes('source_history') && <p className="cc-muted cc-small">Saved source-event history includes retained original event versions. Other sources and connected-service copies remain excluded.</p>}
        {selected.includes('native_health') && <p className="cc-muted cc-small">Native health history includes saved original Android or iPhone upload bytes and record versions as verified byte chunks. Source, estimate and requested-window labels stay intact. This does not include every health metric or your complete history.</p>}
      </div>
    </details>
    <AccountOriginalDownloads/>
  </section>;
}
