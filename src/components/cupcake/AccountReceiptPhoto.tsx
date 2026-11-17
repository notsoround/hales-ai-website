import { useCallback, useEffect, useRef, useState } from 'react';
import { accountData, accountReceiptPhoto, assertGeneration, sessionSnapshot } from './accountSession';
import { receiptDraftStore, type ReceiptPhotoIntent } from './accountReceiptDraft';
import { prepareFoodImage } from './prepareFoodImage';

type SavedReceipt = { id: string; status: string };
type PhotoResponse = { ok: boolean; receipt: SavedReceipt; duplicate: boolean };

export function AccountReceiptPhoto({ onSaved }: { onSaved: (receiptId: string) => void }) {
  const [store] = useState(receiptDraftStore);
  const [generation] = useState(() => sessionSnapshot().generation);
  const [drafts, setDrafts] = useState<ReceiptPhotoIntent[]>([]);
  const [intent, setIntent] = useState<ReceiptPhotoIntent | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const sending = useRef(false);
  const alive = useRef(true);
  const savedCallback = useRef(onSaved);
  savedCallback.current = onSaved;
  const active = useCallback(() => {
    assertGeneration(generation);
    if (!alive.current) throw new DOMException('The receipt screen was closed.', 'AbortError');
  }, [generation]);
  const reloadDrafts = useCallback(async () => {
    const rows = await store.list();
    active();
    setDrafts(rows);
    return rows;
  }, [active, store]);

  useEffect(() => {
    alive.current = true;
    void reloadDrafts().then(rows => { if (rows.length) setIntent(rows[rows.length - 1]); })
      .catch(cause => { if (alive.current) setError(cause instanceof Error ? cause.message : 'Receipt photo recovery is unavailable.'); })
      .finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; };
  }, [reloadDrafts]);

  async function upload(original: ReceiptPhotoIntent) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError('');
    try {
      active();
      await store.save(original); active(); setIntent(original); await reloadDrafts();
      const response = await accountReceiptPhoto<PhotoResponse>({ ...original }); active();
      const receiptId = 'receipt_' + original.request_id.replace(/-/g, '').toLowerCase();
      if (response.ok !== true || response.receipt?.id !== receiptId || response.receipt.status !== 'saved_unread') {
        throw Error('The saved receipt could not be confirmed. Retry this same photo.');
      }
      const fetched = await accountData<{ receipt: SavedReceipt }>({ action: 'receipt_get', receiptId }); active();
      if (fetched.receipt?.id !== receiptId) throw Error('The saved receipt could not be confirmed. Retry this same photo.');
      await store.remove(original.request_id); active();
      await reloadDrafts(); setIntent(null); setSaved(true); savedCallback.current(receiptId);
    } catch (cause) {
      if (alive.current && sessionSnapshot().generation === generation) {
        setError(cause instanceof Error ? cause.message : 'The photo save could not be confirmed. Retry this same photo.');
      }
    } finally { sending.current = false; if (alive.current) setBusy(false); }
  }
  async function choose(file?: File) {
    if (!file || busy || sending.current) return;
    sending.current = true; setBusy(true); setError(''); setSaved(false);
    try {
      const image = await prepareFoodImage(file); active();
      const original = { request_id: crypto.randomUUID(), image };
      sending.current = false;
      await upload(original);
    } catch (cause) {
      if (alive.current && sessionSnapshot().generation === generation) setError(cause instanceof Error ? cause.message : 'The receipt photo could not be prepared.');
    } finally { sending.current = false; if (alive.current) setBusy(false); }
  }

  return <section aria-label="Add a receipt">
    <strong>Add a receipt photo</strong>
    <p className="cc-muted">Your photo will be saved to your account and sent to an AI provider to read the receipt. Compare it with your saved transactions afterward.</p>
    <div className="cc-action-row">
      <label className="cc-primary cc-file">Take photo<input aria-label="Take receipt photo" disabled={busy || loading} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; void choose(file); }}/></label>
      <label className="cc-secondary cc-file">Choose image<input aria-label="Choose receipt image" disabled={busy || loading} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; void choose(file); }}/></label>
    </div>
    {loading && <p role="status">Checking saved photo requests…</p>}
    {busy && <p role="status">Saving your receipt photo…</p>}
    {saved && <p role="status">Receipt photo saved. Reading is starting.</p>}
    {error && <p role="alert" className="cc-error">{error}</p>}
    {intent && <div>
      <img className="cc-receipt-photo" src={intent.image} alt="Receipt photo waiting to save" />
      <p className="cc-muted">This photo is kept on this device until its save is confirmed.</p>
      <button className="cc-secondary" type="button" disabled={busy} onClick={() => void upload(intent)}>Retry this photo</button>
    </div>}
    {drafts.filter(row => row.request_id !== intent?.request_id).length > 0 && <details>
      <summary>Other pending receipt photos ({drafts.filter(row => row.request_id !== intent?.request_id).length})</summary>
      {drafts.filter(row => row.request_id !== intent?.request_id).map((row, index) => <button key={row.request_id} type="button" className="cc-text-button" disabled={busy} onClick={() => { setIntent(row); setError(''); setSaved(false); }}>Pending photo {index + 1}</button>)}
    </details>}
  </section>;
}
