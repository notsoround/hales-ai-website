import { useEffect, useRef, useState } from 'react';
import { accountData, assertGeneration, sessionSnapshot } from './accountSession';
import { saveFile } from './library';

const sections = {
  profile: 'Account profile', health: 'Health records', activity: 'Activity', food: 'Meals and food settings',
  plans: 'Plans and goals', phone: 'Phone activity', apple_health: 'Apple Health records', chat: 'Text conversations',
  preferences: 'Assistant preferences', finance: 'Financial records', library: 'Library records',
} as const;
type Section = keyof typeof sections;
const sectionCodes = Object.keys(sections) as Section[];
type Coverage = { scope: 'owned-local-structured-data'; consistentSnapshot: true; selectedSections: Section[];
  sections: Partial<Record<Section, { status: 'included' | 'unavailable'; reason?: string; tables: Record<string, { rowCount: number; columns: string[]; jsonColumns: string[] }> }>>;
  excluded: { section: string; reason: string; note: string }[]; notes: string[] };
type ExportFile = { format: 'cupcake.account.local-export.v1'; generatedAt: string; accountId: string; completePrivacyExport: false; coverage: Coverage; data: Record<string, Record<string, Record<string, unknown>[]>> };
type Result = { export: ExportFile; filename: string; mimeType: string };
type Prepared = { file: ExportFile; filename: string; generation: number };
function verifiedExport(result: Result, accountId: string, requested: Section[]): Prepared['file'] {
  const file = result.export;
  if (!file || file.format !== 'cupcake.account.local-export.v1' || file.accountId !== accountId || file.completePrivacyExport !== false || !Number.isFinite(Date.parse(file.generatedAt)) || result.mimeType !== 'application/json' || !/^cupcake-local-data-[A-Za-z0-9_-]+\.json$/.test(result.filename) || file.coverage?.scope !== 'owned-local-structured-data' || file.coverage.consistentSnapshot !== true || !Array.isArray(file.coverage.selectedSections) || !Array.isArray(file.coverage.excluded) || !Array.isArray(file.coverage.notes) || !file.data || typeof file.data !== 'object') throw Error('The download could not be verified. No file was created. Try again.');
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
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const mounted = useRef(true), inFlight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const choose = (next: Section[]) => {
    if (inFlight.current) return;
    setSelected(sectionCodes.filter(section => next.includes(section))); setPrepared(null); setError(''); setNotice('');
  };
  const prepare = async () => {
    if (inFlight.current || !selected.length) return;
    const session = sessionSnapshot();
    if (!session.identity) return;
    const requested = [...selected];
    inFlight.current = true; setBusy(true); setPrepared(null); setError(''); setNotice('');
    try {
      const result = await accountData<Result>({ action: 'account_self_export', sections: requested });
      assertGeneration(session.generation);
      if (!mounted.current) return;
      const file = verifiedExport(result, session.identity.account_id, requested);
      setPrepared({ file, filename: result.filename, generation: session.generation });
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'The download could not be prepared. Try again.'); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
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
  return <section className="cc-account-controls" aria-label="Download your data">
    <h3>Download your data</h3>
    <p>Make a JSON copy of supported records saved in your account. Review its coverage before downloading.</p>
    <p className="cc-muted cc-small">This covers part of your data. Connected services and original files are outside this download. Keep the file private.</p>
    <details className="cc-export-picker"><summary>Choose sections · {selected.length === sectionCodes.length ? 'all selected' : `${selected.length} selected`}</summary>
      <fieldset disabled={busy} className="cc-export-sections"><legend>Include these records</legend>
        <div className="cc-export-choices"><button type="button" className="cc-text-button" onClick={() => choose(sectionCodes)}>Select all</button><button type="button" className="cc-text-button" onClick={() => choose([])}>Clear selection</button></div>
        {sectionCodes.map(section => <label className="cc-account-check" key={section}><input type="checkbox" checked={selected.includes(section)} onChange={event => choose(event.target.checked ? [...selected, section] : selected.filter(current => current !== section))}/>{sections[section]}</label>)}
      </fieldset>
    </details>
    <p className="cc-muted cc-small">{selected.length ? 'For a smaller file, choose fewer sections.' : 'Choose at least one section to prepare your download.'}</p>
    <button type="button" className="cc-secondary" disabled={busy || !selected.length} onClick={() => void prepare()}>{busy ? 'Preparing your download…' : 'Prepare my download'}</button>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {prepared && <div>
      <p role="status">Your file is ready. Prepared {new Date(prepared.file.generatedAt).toLocaleString()}.</p>
      <ul aria-label="Download coverage">{prepared.file.coverage.selectedSections.map(section => {
        const entry = prepared.file.coverage.sections[section]!, count = Object.values(entry.tables).reduce((sum, table) => sum + table.rowCount, 0);
        return <li key={section}><strong>{sections[section]}:</strong> {entry.status === 'included' ? `${count.toLocaleString()} saved record${count === 1 ? '' : 's'}` : 'Unavailable for this account'}</li>;
      })}</ul>
      <details><summary>What this download leaves out</summary><ul>{prepared.file.coverage.excluded.map((entry, index) => <li key={index}>{entry.section in sections && <strong>{sections[entry.section as Section]}: </strong>}{entry.note}</li>)}</ul></details>
      <button type="button" className="cc-primary" onClick={download}>Download JSON file</button>
      <button type="button" className="cc-text-button" onClick={() => setPrepared(null)}>Clear prepared file</button>
    </div>}
  </section>;
}
