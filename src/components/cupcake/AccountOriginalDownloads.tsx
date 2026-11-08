import { useEffect, useRef, useState } from 'react';
import { accountExport, assertGeneration, sessionSnapshot, subscribeSession } from './accountSession';

const originalSections = ['food', 'finance', 'recordings'] as const;
type OriginalSection = typeof originalSections[number];
const kinds = ['meal_photo', 'receipt_photo', 'recording_audio'] as const;
type OriginalKind = typeof kinds[number];
const kindSection: Record<OriginalKind, OriginalSection> = { meal_photo: 'food', receipt_photo: 'finance', recording_audio: 'recordings' };
const kindLabels: Record<OriginalKind, string> = { meal_photo: 'Meal photos', receipt_photo: 'Receipt photos', recording_audio: 'Recording audio' };
const sectionLabels: Record<OriginalSection, string> = { food: 'Meal photos', finance: 'Receipt photos', recordings: 'Recording audio' };
type OriginalFile = { kind: OriginalKind; sourceId: string; filename: string; title?: string | null; mimeType: string | null; bytes: number | null; sha256: string | null; status: 'available' | 'unavailable'; reason?: string; verification: 'saved_metadata_and_file_stat' };
type OriginalInventory = { format: 'cupcake.account.original-inventory.v1'; accountId: string; generatedAt: string; completePrivacyExport: false; sections: OriginalSection[]; files: OriginalFile[]; sectionFailures: { section: OriginalSection; reason: string }[]; totalBytes: number; notes: string[] };
type InventoryResult = OriginalInventory & { generation: number };
type OriginalLink = { url: string; expiresAt: number; original: Pick<OriginalFile, 'kind' | 'sourceId' | 'filename' | 'mimeType' | 'bytes' | 'sha256'> };
const metadataError = () => Error('The original-file details could not be confirmed. Refresh the list before downloading.');
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
const bytes = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function originalFile(value: OriginalFile) {
  return value && kinds.includes(value.kind) && text(value.sourceId) && text(value.filename)
    && (value.title === undefined || value.title === null || text(value.title))
    && !/[\\/]/.test(value.filename) && value.filename !== '.' && value.filename !== '..'
    && (value.mimeType === null || (typeof value.mimeType === 'string' && /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(value.mimeType)))
    && value.verification === 'saved_metadata_and_file_stat'
    && (value.status === 'available' ? bytes(value.bytes) && digest(value.sha256)
      : value.status === 'unavailable' && value.bytes === null && value.sha256 === null && text(value.reason));
}
function inventoryResult(value: OriginalInventory, accountId: string): OriginalInventory {
  if (!value || value.format !== 'cupcake.account.original-inventory.v1' || value.accountId !== accountId || value.completePrivacyExport !== false
    || typeof value.generatedAt !== 'string' || !Number.isFinite(Date.parse(value.generatedAt)) || Date.parse(value.generatedAt) > Date.now() + 60000
    || !Array.isArray(value.sections) || value.sections.length !== originalSections.length || new Set(value.sections).size !== originalSections.length || value.sections.some(section => !originalSections.includes(section))
    || !Array.isArray(value.files) || !value.files.every(originalFile)
    || new Set(value.files.map(file => file.kind + ':' + file.sourceId)).size !== value.files.length
    || !Array.isArray(value.sectionFailures) || value.sectionFailures.some(failure => !failure || !originalSections.includes(failure.section) || !text(failure.reason))
    || new Set(value.sectionFailures.map(failure => failure.section)).size !== value.sectionFailures.length
    || value.files.some(file => value.sectionFailures.some(failure => failure.section === kindSection[file.kind]))
    || !Number.isSafeInteger(value.totalBytes) || value.totalBytes < 0 || value.totalBytes !== value.files.reduce((sum, file) => sum + (file.status === 'available' ? file.bytes! : 0), 0)
    || !Array.isArray(value.notes) || value.notes.some(note => typeof note !== 'string')) throw metadataError();
  return value;
}
function originalURL(value: OriginalLink, file: OriginalFile): string {
  if (!value || typeof value.url !== 'string' || !/^https:\/\/automate\.hales\.ai\/api\/account\/exports\/original\?token=[A-Za-z0-9_-]{43}$/.test(value.url)
    || typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now() / 1000 || value.expiresAt > Date.now() / 1000 + 301 || !value.original
    || (['kind', 'sourceId', 'filename', 'mimeType', 'bytes', 'sha256'] as const).some(key => value.original[key] !== file[key])) throw metadataError();
  return value.url;
}
function sizeLabel(size: number) {
  if (size >= 1024 ** 3) return `${(size / 1024 ** 3).toLocaleString(undefined, { maximumFractionDigits: 2 })} GiB`;
  if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toLocaleString(undefined, { maximumFractionDigits: 1 })} MiB`;
  if (size >= 1024) return `${(size / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KiB`;
  return `${size.toLocaleString()} bytes`;
}

/** Original bytes go straight to the browser; this component never fetches or buffers them. */
export function AccountOriginalDownloads() {
  const [inventory, setInventory] = useState<InventoryResult | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const mounted = useRef(true), inFlight = useRef(false), requestAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    const stop = subscribeSession(() => { requestAbort.current?.abort(); inFlight.current = false; setInventory(null); setBusy(false); setError(''); setNotice(''); });
    return () => { mounted.current = false; requestAbort.current?.abort(); stop(); };
  }, []);
  const run = async (file?: OriginalFile) => {
    if (inFlight.current) return;
    const session = sessionSnapshot();
    if (!session.identity || (file && (!inventory || inventory.generation !== session.generation || inventory.accountId !== session.identity.account_id || file.status !== 'available'))) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    const current = new AbortController(); requestAbort.current?.abort(); requestAbort.current = current;
    const active = () => { assertGeneration(session.generation); if (!mounted.current || current.signal.aborted) throw new DOMException('Download cancelled.', 'AbortError'); };
    try {
      if (!file) {
        setInventory(null);
        const result = await accountExport<OriginalInventory>('originals', { sections: [...originalSections] }, session, current.signal);
        active(); setInventory({ ...inventoryResult(result, session.identity.account_id), generation: session.generation });
      } else {
        const result = await accountExport<OriginalLink>('original-link', { kind: file.kind, source_id: file.sourceId, sha256: file.sha256 }, session, current.signal);
        active(); const url = originalURL(result, file); active();
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = file.filename; anchor.rel = 'noopener noreferrer'; anchor.referrerPolicy = 'no-referrer';
        anchor.target = '_blank'; anchor.hidden = true;
        document.body.appendChild(anchor);
        try { active(); anchor.click(); } finally { anchor.remove(); }
        setNotice('Download requested. Check your browser’s downloads for completion.');
      }
    } catch (cause) {
      if (mounted.current && sessionSnapshot().generation === session.generation && !current.signal.aborted) setError(cause instanceof Error ? cause.message : 'The original-file request could not be confirmed. Refresh the list and try again.');
    } finally {
      if (requestAbort.current === current) { inFlight.current = false; if (mounted.current) setBusy(false); }
    }
  };
  return <details className="cc-export-picker">
    <summary>Download originals individually</summary>
    <section aria-label="Individual original downloads" aria-busy={busy}>
      <p>Download saved meal photos, receipt photos and recording audio one at a time, including files too large for a ZIP. Each file goes straight to your browser.</p>
      <p className="cc-muted cc-small">This list checks saved metadata and file status, not file contents. These originals are part of your data; connected-service copies and other excluded records remain outside this download. Keep downloaded files private.</p>
      <button type="button" className="cc-secondary" disabled={busy} onClick={() => void run()}>{busy && !inventory ? 'Loading originals…' : inventory ? 'Refresh original list' : 'List my originals'}</button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {inventory && <>
        <p role="status">{inventory.files.length.toLocaleString()} saved original reference{inventory.files.length === 1 ? '' : 's'} · {sizeLabel(inventory.totalBytes)} available. Listed {new Date(inventory.generatedAt).toLocaleString()}.</p>
        {inventory.files.length === 0 && inventory.sectionFailures.length === 0 && <p>No saved meal photos, receipt photos or recording audio were found for this account.</p>}
        {inventory.sectionFailures.length > 0 && <div role="status"><p>Some originals could not be listed. This is not a complete list.</p><ul>{inventory.sectionFailures.map(failure => <li key={failure.section}>{sectionLabels[failure.section]}: unavailable. Refresh the list to try again.</li>)}</ul></div>}
        {kinds.map(kind => {
          const files = inventory.files.filter(file => file.kind === kind);
          if (!files.length) return null;
          return <details key={kind} className="cc-export-picker"><summary>{kindLabels[kind]} · {files.length.toLocaleString()}</summary><ul aria-label={kindLabels[kind]} style={{ paddingInlineStart: '1.2rem' }}>{files.map(file => <li key={file.sourceId} style={{ overflowWrap: 'anywhere', marginBlock: '0.75rem' }}>
            {file.title && <><strong>{file.title}</strong><br/></>}
            <span>{file.filename}</span><br/>
            <span className="cc-muted cc-small">Saved source: {file.sourceId}. {file.status === 'available' ? sizeLabel(file.bytes!) : 'Original unavailable.'}</span><br/>
            {file.status === 'available' ? <button type="button" className="cc-text-button" style={{ minHeight: 44 }} disabled={busy} aria-label={`Download ${file.filename} (${file.sourceId})`} onClick={() => void run(file)}>Download file</button>
              : <span className="cc-muted cc-small">The saved original cannot currently be downloaded. Its reference remains in this list.</span>}
          </li>)}</ul></details>;
        })}
        <p className="cc-muted cc-small">Saved sizes and hashes describe the expected files. Requesting a download does not confirm it completed; check your browser’s downloads.</p>
      </>}
    </section>
  </details>;
}
