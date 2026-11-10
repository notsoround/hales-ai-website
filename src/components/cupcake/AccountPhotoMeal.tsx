import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { accountData, accountFoodPhoto, AccountRequestError, assertGeneration, sessionSnapshot } from './accountSession';
import { photoDraftStore, type PhotoIntent } from './accountFoodPhotoDraft';
import { prepareFoodImage } from './prepareFoodImage';
import { MealTimeInput } from './MealTimeInput';
import { takeQueuedAccountMealPhoto } from './accountMealPhotoHandoff';
import type { FoodMeal } from './DashboardView';
import './account-photo-meal.css';

type PhotoRequest = { request_id: string; attempt: string; meal_id: string; status: 'queued' | 'running' | 'completed' | 'failed' | 'uncertain'; error: string | null; dispatched: boolean };
type PhotoResult = { request: PhotoRequest; meal?: FoodMeal };
const states = new Set(['queued', 'running', 'completed', 'failed', 'uncertain']);
const errorText = (error: unknown) => error instanceof Error ? error.message : 'The photo save could not be confirmed. Check the same request again.';
function validTime(value: string) { const now = Date.now(), time = Date.parse(value); return Number.isFinite(time) && time >= now - 400 * 86400000 && time <= now + 300000; }

export function AccountPhotoMeal({ onSaved, onOpenMeal }: { onSaved: () => void; onOpenMeal?: (mealId: string) => void }) {
  const [store] = useState(photoDraftStore), [generation] = useState(() => sessionSnapshot().generation);
  const [drafts, setDrafts] = useState<PhotoIntent[]>([]), [intent, setIntent] = useState<PhotoIntent | null>(null);
  const [request, setRequest] = useState<PhotoRequest | null>(null), [receipt, setReceipt] = useState<FoodMeal | null>(null);
  const [note, setNote] = useState(''), [fileTime, setFileTime] = useState(true), [consumedAt, setConsumedAt] = useState('');
  const [backgroundTick, setBackgroundTick] = useState(0);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [missing, setMissing] = useState(false);
  const camera = useRef<HTMLInputElement>(null), picker = useRef<HTMLInputElement>(null), sending = useRef(false), alive = useRef(true);
  const completed = useRef(new Set<string>()), terminal = useRef(new Set<string>());
  const current = useRef<PhotoIntent | null>(null), timer = useRef<ReturnType<typeof setTimeout>>(), onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const active = useCallback(() => { assertGeneration(generation); if (!alive.current) throw new DOMException('The food screen was closed.', 'AbortError'); }, [generation]);
  const reloadDrafts = useCallback(async () => { const saved = await store.list(); active(); setDrafts(saved); return saved; }, [store, active]);

  const accept = useCallback(async (result: PhotoResult, original: PhotoIntent, foreground = true) => {
    active();
    if (completed.current.has(original.request_id)) return;
    const row = result.request;
    if (!row || row.request_id !== original.request_id || !states.has(row.status) || typeof row.attempt !== 'string' || !row.attempt || typeof row.meal_id !== 'string' || !row.meal_id) throw Error('The photo receipt did not match your request. Check its status again.');
    if (foreground && current.current?.request_id !== original.request_id) return;
    if (['failed', 'uncertain'].includes(row.status)) terminal.current.add(original.request_id);
    if (current.current?.request_id === original.request_id) { setRequest(row); setMissing(false); }
    if (row.status !== 'completed') return;
    if (result.meal?.id !== row.meal_id) throw Error('The completed photo returned no matching meal. Check the saved request again.');
    const saved = await accountData<{ meal: FoodMeal }>({ action: 'food_get', mealId: row.meal_id }); active();
    if (foreground && current.current?.request_id !== original.request_id) return;
    if (saved.meal?.id !== row.meal_id || saved.meal.source !== 'account-photo-estimate' || saved.meal.logDestination !== 'account-local' || !saved.meal.accountLoggedAt || saved.meal.logState !== 'logged' || saved.meal.countedInTotals !== true || Date.parse(saved.meal.consumedAt || '') !== Date.parse(original.consumed_at)) throw Error('The meal is not yet confirmed in your food log. Check the same request again.');
    await store.remove(original.request_id); active();
    if (foreground && current.current?.request_id !== original.request_id || completed.current.has(original.request_id)) return;
    completed.current.add(original.request_id); if (current.current?.request_id === original.request_id) setReceipt(saved.meal); await reloadDrafts(); onSavedRef.current();
  }, [active, store, reloadDrafts]);
  const check = useCallback(async (original: PhotoIntent) => {
    active(); if (current.current?.request_id !== original.request_id || completed.current.has(original.request_id)) return; setError(''); setMissing(false);
    try { await accept(await accountData<PhotoResult>({ action: 'food_photo_status', request_id: original.request_id }), original); }
    catch (cause) { if (!alive.current || sessionSnapshot().generation !== generation || current.current?.request_id !== original.request_id) return; if (cause instanceof AccountRequestError && cause.code === 'photo_request_not_found') setMissing(true); else setError(errorText(cause)); }
  }, [active, accept, generation]);

  useEffect(() => {
    alive.current = true;
    void reloadDrafts().then(saved => { if (saved.length) { const original = saved[saved.length - 1]; current.current = original; setIntent(original); void check(original); } }).catch(cause => { if (alive.current) setError(errorText(cause)); }).finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; clearTimeout(timer.current); };
  }, [reloadDrafts, check]);
  useEffect(() => {
    if (intent && ['queued', 'running'].includes(request?.status || '') && !busy && !error) timer.current = setTimeout(() => { void check(intent); }, 2500);
    return () => clearTimeout(timer.current);
  }, [intent, request, busy, error, check]);

  // Other photos continue to finish when the owner starts the next meal.
  useEffect(() => {
    const pending = drafts.filter(row => row.request_id !== intent?.request_id && !terminal.current.has(row.request_id));
    if (!pending.length) return;
    let cancelled = false;
    const scheduled = setTimeout(() => { void (async () => {
      for (const original of pending.slice(0, 2)) {
        if (cancelled) return;
        try { await accept(await accountData<PhotoResult>({ action: 'food_photo_status', request_id: original.request_id }), original, false); }
        catch (cause) { if (cause instanceof AccountRequestError && cause.code === 'photo_request_not_found') terminal.current.add(original.request_id); }
      }
      if (!cancelled && alive.current) setBackgroundTick(value => value + 1);
    })(); }, 10000);
    return () => { cancelled = true; clearTimeout(scheduled); };
  }, [drafts, intent, backgroundTick, accept]);

  const upload = async (original: PhotoIntent) => {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError(''); setMissing(false);
    try { active(); await store.save(original); active(); current.current = original; setIntent(original); await reloadDrafts(); await accept(await accountFoodPhoto<PhotoResult>({ ...original }), original); }
    catch (cause) { if (alive.current) { setError(errorText(cause)); setMissing(false); } }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  };
  const chooseFile = async (file: File) => {
    if (sending.current) return;
    setError(''); setReceipt(null); setRequest(null); setMissing(false);
    const hasFileTime = Number.isFinite(file.lastModified) && file.lastModified >= 946684800000 && file.lastModified <= Date.now() + 300000;
    const photoAt = hasFileTime ? new Date(file.lastModified).toISOString() : null;
    const eatenAt = fileTime ? photoAt || '' : consumedAt;
    if (!validTime(eatenAt)) { setError('Choose when you ate this meal, then select the photo again. Its file time is missing or outside the last 400 days.'); return; }
    sending.current = true; setBusy(true);
    try {
      const image = await prepareFoodImage(file); active();
      const original: PhotoIntent = { request_id: crypto.randomUUID(), image, consumed_at: eatenAt, photo_taken_at: photoAt, photo_time_basis: photoAt ? 'file_last_modified' : 'unknown', confirm_consumed: true, estimate_visible_portion: true, ...(note.trim() ? { note: note.trim() } : {}) };
      sending.current = false; await upload(original);
    } catch (cause) { if (alive.current) setError(errorText(cause)); }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  };
  // A photo taken from Today's one-tap camera continues here with the default file time.
  const chooseRef = useRef(chooseFile); chooseRef.current = chooseFile;
  useEffect(() => { if (loading) return; const file = takeQueuedAccountMealPhoto(); if (file) void chooseRef.current(file); }, [loading]);
  const resume = (original: PhotoIntent) => { terminal.current.delete(original.request_id); current.current = original; setIntent(original); setRequest(null); setReceipt(null); setMissing(false); void check(original); };
  const another = () => { current.current = null; setIntent(null); setRequest(null); setReceipt(null); setError(''); setMissing(false); setNote(''); setFileTime(true); setConsumedAt(''); };
  const retry = async () => {
    if (!intent || sending.current) return;
    sending.current = true; terminal.current.delete(intent.request_id); setBusy(true); setError('');
    try { await accept(await accountData<PhotoResult>({ action: 'food_photo_retry', request_id: intent.request_id }), intent); }
    catch (cause) { if (alive.current) setError(errorText(cause)); }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  };
  const input = (ref: typeof picker, capture = false) => <input ref={ref} aria-label={capture ? 'Take meal photo file' : 'Choose meal photo file'} type="file" accept="image/jpeg,image/png,image/webp" {...(capture ? { capture: 'environment' as const } : {})} hidden onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void chooseFile(file); }}/>;
  return <section className="cc-card cc-account-photo" aria-label="Photo meal logging">
    <div className="cc-account-photo-head"><h3>Log a food photo</h3>{!intent && !receipt && <p className="cc-muted cc-small">Snap it and you’re done. The whole plate is estimated and logged for you.</p>}</div>
    {!intent && !receipt && <>
      <div className="cc-snap-actions"><button type="button" className="cc-primary" disabled={busy || loading || !fileTime && !validTime(consumedAt)} onClick={() => camera.current?.click()}><Camera size={17}/>Take meal photo</button><button type="button" className="cc-secondary" disabled={busy || loading || !fileTime && !validTime(consumedAt)} onClick={() => picker.current?.click()}>Choose meal photo</button></div>
      <details className="cc-account-photo-adjustments"><summary>Portions, meal time &amp; how it works</summary><div>
        <p className="cc-muted cc-small">Full photo = full meal. Uses the photo’s file time by default. Nutrition is estimated; unknown values stay unknown.</p>
        <label className="cc-account-photo-option"><input type="checkbox" checked={fileTime} disabled={busy} onChange={event => setFileTime(event.target.checked)}/>Use photo file time for when I ate</label>
        <p className="cc-muted cc-small">File metadata is a time suggestion, not verified capture time.</p>
        {!fileTime && <MealTimeInput value={consumedAt} onChange={setConsumedAt} disabled={busy}/>}
        <label>Portion or meal note (optional)<textarea maxLength={1000} value={note} disabled={busy} rows={2} onChange={event => setNote(event.target.value)} placeholder="For example: half the rice, unsweetened drink…"/></label>
      </div></details>
    </>}
    {input(camera, true)}{input(picker)}
    {loading && <p role="status">Checking this device’s saved photo requests…</p>}
    {busy && <p role="status">Preserving your photo and checking its saved meal…</p>}
    {intent && <div className="cc-account-photo-progress">
      <img src={intent.image} alt="Selected meal photo"/>
      <p className="cc-muted">Meal time: {new Date(intent.consumed_at).toLocaleString()}</p>
      {receipt ? <div role="status" className="cc-account-photo-receipt"><h4>Meal saved to your food log</h4><strong>{receipt.description}</strong><p>{receipt.total?.calories == null ? 'Calories unknown' : `${receipt.total.calories} kcal (estimate)`}</p>{receipt.totalIsPartial && <p className="cc-muted">Some nutrition is unknown. Open meal details for the estimate.</p>}{onOpenMeal && <button type="button" className="cc-text-button" onClick={() => onOpenMeal(receipt.id)}>Meal details &amp; photo →</button>}</div> : <>
        {request && <p role="status">{request.status === 'queued' ? 'Photo saved. Waiting to estimate your meal…' : request.status === 'running' ? 'Estimating your meal…' : request.status === 'uncertain' ? 'The estimate outcome is uncertain. Your original is kept; checking status will not request another estimate.' : request.status === 'failed' ? 'This meal was not logged. You can retry only if no estimate was sent.' : 'Confirming your saved meal…'}</p>}
        {missing && <p role="status">The server has no matching request. Send the original photo again using the same request key.</p>}
        <div className="cc-snap-actions"><button type="button" className="cc-secondary" disabled={busy} onClick={() => void check(intent)}>Check saved photo</button>{missing && <button type="button" className="cc-primary" disabled={busy} onClick={() => void upload(intent)}>Retry same upload</button>}{request?.status === 'failed' && <button type="button" className="cc-secondary" disabled={busy} onClick={() => void retry()}>Retry unsent estimate</button>}</div>
      </>}
      <button type="button" className="cc-secondary" disabled={busy} onClick={another}>{receipt ? 'Log another photo' : 'Keep this request and log another photo'}</button>
    </div>}
    {error && <p role="alert" className="cc-error">{error}</p>}
    {drafts.filter(row => row.request_id !== intent?.request_id).length > 0 && <details><summary>Other saved photo requests ({drafts.filter(row => row.request_id !== intent?.request_id).length})</summary>{drafts.filter(row => row.request_id !== intent?.request_id).map(row => <button key={row.request_id} className="cc-text-button" disabled={busy} onClick={() => resume(row)}>Check meal photo · {new Date(row.consumed_at).toLocaleString()}</button>)}</details>}
  </section>;
}
