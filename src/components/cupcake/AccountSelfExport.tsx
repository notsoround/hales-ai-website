import { useEffect, useRef, useState } from 'react';
import { AccountRequestError, accountData, assertGeneration, sessionSnapshot, subscribeSession } from './accountSession';
import { saveFile } from './library';
import { exportSectionCodes, useAccountExportBundle, type ExportSection } from './accountExportBundle';

const sections = {
  profile: 'Account profile', health: 'Health records', activity: 'Activity', food: 'Meals and food settings',
  plans: 'Plans and goals', phone: 'Phone activity', apple_health: 'Apple Health records', chat: 'Text conversations',
  preferences: 'Assistant preferences', finance: 'Financial records', library: 'Library records',
  recordings: 'Saved recordings and transcripts', voice: 'Saved voice conversations',
} as const;
type Section = ExportSection;
const sectionCodes = [...exportSectionCodes];
type SourceSnapshot = { code: 'library' | 'recordings'; source: string; status: 'included' | 'unavailable'; consistentSnapshot: boolean; readAt: string | null };
type Coverage = { scope: 'owned-local-structured-data'; consistentSnapshot: boolean; consistency?: 'per-database'; sourceSnapshots?: SourceSnapshot[]; selectedSections: Section[];
  sections: Partial<Record<Section, { status: 'included' | 'unavailable'; reason?: string; tables: Record<string, { rowCount: number; columns: string[]; jsonColumns: string[] }> }>>;
  excluded: { section: string; reason: string; note: string }[]; notes: string[] };
type ExportFile = { format: 'cupcake.account.local-export.v1' | 'cupcake.account.local-export.v2'; generatedAt: string; accountId: string; completePrivacyExport: false; coverage: Coverage; data: Record<string, Record<string, Record<string, unknown>[]>> };
type Result = { export: ExportFile; filename: string; mimeType: string };
type Prepared = { file: ExportFile; filename: string; generation: number };
function verifiedExport(result: Result, accountId: string, requested: Section[]): Prepared['file'] {
  const file = result.export;
  if (!file || !['cupcake.account.local-export.v1', 'cupcake.account.local-export.v2'].includes(file.format) || file.accountId !== accountId || file.completePrivacyExport !== false || !Number.isFinite(Date.parse(file.generatedAt)) || result.mimeType !== 'application/json' || !/^cupcake-local-data-[A-Za-z0-9_-]+\.json$/.test(result.filename) || file.coverage?.scope !== 'owned-local-structured-data' || !Array.isArray(file.coverage.selectedSections) || !Array.isArray(file.coverage.excluded) || !Array.isArray(file.coverage.notes) || !file.data || typeof file.data !== 'object') throw Error('The download could not be verified. No file was created. Try again.');
  if (file.format === 'cupcake.account.local-export.v1') {
    if (file.coverage.consistentSnapshot !== true || requested.includes('recordings')) throw Error('The download consistency could not be verified. No file was created.');
  } else {
    const snapshots = file.coverage.sourceSnapshots;
    if (!requested.includes('recordings') || file.coverage.consistentSnapshot !== false || file.coverage.consistency !== 'per-database' || !Array.isArray(snapshots) || snapshots.length !== 2 || snapshots.some(item => !item || typeof item !== 'object') || new Set(snapshots.map(item => item.code)).size !== 2 || snapshots.some(item => !['library', 'recordings'].includes(item.code) || typeof item.source !== 'string' || !item.source.trim() || (item.status === 'included' ? item.consistentSnapshot !== true || !item.readAt || !Number.isFinite(Date.parse(item.readAt)) : item.status !== 'unavailable' || item.consistentSnapshot !== false || item.readAt !== null)) || snapshots.find(item => item.code === 'library')?.status !== 'included') throw Error('The download consistency could not be verified. No file was created.');
  }
  const selected = file.coverage.selectedSections;
  if (selected.length !== requested.length || new Set(selected).size !== selected.length || selected.some(section => !requested.includes(section)) || Object.keys(file.coverage.sections || {}).some(section => !requested.includes(section as Section)) || Object.keys(file.data).some(section => !requested.includes(section as Section))) throw Error('The download coverage does not match your selection. No file was created.');
  for (const section of selected) {
    const entry = file.coverage.sections?.[section];
    if (!entry || !['included', 'unavailable'].includes(entry.status) || !entry.tables || typeof entry.tables !== 'object' || Object.values(entry.tables).some(table => !Number.isSafeInteger(table.rowCount) || table.rowCount < 0)) throw Error('The download coverage could not be verified. No file was created.');
  }
  return file;
}

export function AccountSelfExport() {
  const [selected, setSelected] = useState<Section[]>(sectionCodes);
  const bundle = useAccountExportBundle(setSelected);
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
  const prepare = async () => {
    if (inFlight.current || locked || !selected.length) return;
    const session = sessionSnapshot();
    if (!session.identity) return;
    const requested = [...selected];
    inFlight.current = true; setBusy(true); setPrepared(null); setError(''); setNotice('');
    const current = new AbortController();requestAbort.current?.abort();requestAbort.current = current;
    try {
      if (bundle.intent) bundle.clear();
      const result = await accountData<Result>({ action: 'account_self_export', sections: requested },current.signal);
      assertGeneration(session.generation);
      if (!mounted.current) return;
      const file = verifiedExport(result, session.identity.account_id, requested);
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
  const coverage = file?.coverage;
  const failedMessage = bundle.job?.error && ['export_raw_limit','export_zip_limit','export_record_too_large','export_resource_limit'].includes(bundle.job.error)
    ? 'These records exceed the current ZIP preparation allowance. No partial ZIP is available.'
    : 'This ZIP could not be prepared. No partial ZIP is available. You can prepare a new download.';
  return <section className="cc-account-controls" aria-label="Download your data">
    <h3>Download your data</h3>
    <p>Copy supported records saved in your account. Larger histories are automatically prepared as a ZIP with all selected supported records. Review the coverage before downloading.</p>
    <p className="cc-muted cc-small">This covers part of your data. Connected services and original files are outside this download. Keep the file private.</p>
    <details className="cc-export-picker" ref={picker}><summary>Choose sections · {selected.length === sectionCodes.length ? 'all selected' : `${selected.length} selected`}</summary>
      <fieldset disabled={locked} className="cc-export-sections"><legend>Include these records</legend>
        <div className="cc-export-choices"><button type="button" className="cc-text-button" onClick={() => choose(sectionCodes)}>Select all</button><button type="button" className="cc-text-button" onClick={() => choose([])}>Clear selection</button></div>
        {sectionCodes.map(section => <label className="cc-account-check" key={section}><input type="checkbox" checked={selected.includes(section)} onChange={event => choose(event.target.checked ? [...selected, section] : selected.filter(current => current !== section))}/>{sections[section]}</label>)}
      </fieldset>
    </details>
    <p className="cc-muted cc-small">{selected.length ? 'You can include every supported section in one preparation.' : 'Choose at least one section to prepare your download.'}</p>
    <button type="button" className="cc-secondary" disabled={locked || !selected.length} onClick={() => void prepare()}>{busy ? 'Preparing your download…' : bundle.terminal ? 'Prepare a new download' : 'Prepare my download'}</button>
    {(error || bundle.error) && <p role="alert">{error || bundle.error}</p>}
    {notice && <p role="status">{notice}</p>}
    {bundle.notice && <p role="status">{bundle.notice}</p>}
    {bundle.intent && <div aria-busy={bundle.busy}>
      {bundle.busy && <p role="status">{bundle.phase === 'downloading' ? 'Downloading and verifying your ZIP…' : bundle.phase === 'preparing' ? 'Preparing a ZIP for your selected records…' : 'Checking your saved ZIP preparation…'}</p>}
      {!bundle.busy && bundle.job?.state === 'building' && <p role="status">Your ZIP is still being prepared. Check the saved status shortly.</p>}
      {!bundle.busy && !bundle.job && !bundle.terminal && <p>Your browser remembers a preparation request. Check its status to recover it.</p>}
      {bundle.job?.state === 'failed' && <p role="status">{failedMessage}</p>}
      {bundle.job?.state === 'expired' && <p role="status">This prepared ZIP has expired. You can prepare a new download.</p>}
      <button type="button" className="cc-text-button" disabled={bundle.busy || busy} onClick={() => void bundle.check()}>Check saved status</button>
    </div>}
    {file && coverage && <div>
      <p role="status">{prepared ? 'Your file is ready.' : 'Your ZIP is ready.'} Prepared {new Date(file.generatedAt).toLocaleString()}.</p>
      {!prepared && bundle.job && <p className="cc-muted cc-small">The ZIP contains structured record files and a coverage manifest. It expires {new Date(bundle.job.expiresAt).toLocaleString()}. Original files and connected-service copies are excluded.</p>}
      {coverage.consistentSnapshot === false && <div className="cc-export-consistency">
        <p className="cc-muted cc-small">Each available saved store was read consistently; the Library and recording archive may reflect slightly different moments.</p>
        <ul aria-label="Saved store read times">{coverage.sourceSnapshots?.map(source => <li key={source.code}>{source.source}: {source.status === 'included' ? `read ${new Date(source.readAt!).toLocaleString()}` : 'Unavailable for this account'}</li>)}</ul>
      </div>}
      <ul aria-label="Download coverage">{coverage.selectedSections.map(section => {
        const entry = coverage.sections[section]!, count = Object.values(entry.tables).reduce((sum, table) => sum + table.rowCount, 0);
        return <li key={section}><strong>{sections[section]}:</strong> {entry.status === 'included' ? `${count.toLocaleString()} saved record${count === 1 ? '' : 's'}` : 'Unavailable for this account'}</li>;
      })}</ul>
      <details><summary>What this download leaves out</summary><ul>{coverage.excluded.map((entry, index) => <li key={index}>{entry.section in sections && <strong>{sections[entry.section as Section]}: </strong>}{entry.note}</li>)}</ul></details>
      {prepared ? <><button type="button" className="cc-primary" onClick={download}>Download JSON file</button><button type="button" className="cc-text-button" onClick={() => setPrepared(null)}>Clear prepared file</button></>
        : <><button type="button" className="cc-primary" disabled={bundle.busy} onClick={() => void bundle.download()}>{bundle.phase === 'downloading' ? 'Verifying ZIP…' : 'Download ZIP file'}</button><button type="button" className="cc-text-button" disabled={bundle.busy} onClick={() => bundle.clear()}>Clear prepared ZIP</button></>}
    </div>}
  </section>;
}
