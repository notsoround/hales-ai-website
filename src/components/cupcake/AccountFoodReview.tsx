import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { accountData, AccountRequestError } from './accountSession';
import { notifyDataChanged, useDataChanged } from './dataChanges';
import { MealDialog } from './MealDialog';
import { loggedMeals, mealDay, mealTimeLabel, type NutritionHistory } from './nutritionModel';

type Resolution = 'not_food' | 'attach' | null;
type Review = { mealId: string; resolution: Resolution; targetMealId: string | null };
type Photo = Review & { description: string; reviewable: boolean; createdAt: string | null; photoTakenAt?: string | null };
type Action = 'not_food' | 'attach' | 'undo';

function reviewError(error: unknown) {
  return error instanceof Error ? error.message : 'Could not check the photo. Refresh and try again.';
}

function ReviewDialog({ photo, history, onClose, onSaved }: { photo: Photo; history?: NutritionHistory | null; onClose: () => void; onSaved: (review: Review) => void }) {
  const [image, setImage] = useState(''), [photoError, setPhotoError] = useState('');
  const [target, setTarget] = useState(''), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const pendingWrite = useRef(false);
  useEffect(() => {
    const abort = new AbortController();
    void accountData<{ photo: { dataUrl: string } }>({ action: 'food_photo', mealId: photo.mealId }, abort.signal)
      .then(({ photo }) => {
        if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo.dataUrl)) throw Error('Invalid photo.');
        if (!abort.signal.aborted) setImage(photo.dataUrl);
      }).catch(() => { if (!abort.signal.aborted) setPhotoError('The saved photo could not be displayed.'); });
    return () => abort.abort();
  }, [photo.mealId]);
  const targets = loggedMeals(history?.meals || []).reverse().filter(meal => /^meal_[0-9a-f]{32}$/.test(meal.id) && !meal.imageStored && meal.id !== photo.mealId);
  const resolve = async (resolution: Action) => {
    if (pendingWrite.current || (resolution === 'attach' && !target)) return;
    pendingWrite.current = true; setSaving(true); setError('');
    try {
      const { review } = await accountData<{review: Review}>({ action: 'food_review_resolve', mealId: photo.mealId, resolution, ...(resolution === 'attach' ? { targetMealId: target } : {}) });
      if (review?.mealId !== photo.mealId || review.resolution !== (resolution === 'undo' ? null : resolution) || review.targetMealId !== (resolution === 'attach' ? target : null)) {
        throw Error('Cupcake could not confirm the change. Refresh the review list before trying again.');
      }
      onSaved(review);
      notifyDataChanged('food');
    } catch (cause) { setError(reviewError(cause)); }
    finally { pendingWrite.current = false; setSaving(false); }
  };
  return <MealDialog open heading="Review photo" closeLabel="Close photo review" onClose={() => { if (!pendingWrite.current) onClose(); }}>
    <div className="nx-review-detail">
      <h3>{photo.description || 'Saved photo'}</h3>
      {image ? <img className="cc-snap-preview" src={image} alt="Photo under review" /> : <p role="status">{photoError || 'Loading photo…'}</p>}
      {photo.resolution ? <>
        <p>{photo.resolution === 'attach' ? 'Attached to a logged meal.' : 'Marked as not food.'}</p>
        <button type="button" className="cc-secondary" disabled={saving} onClick={() => void resolve('undo')}>Undo</button>
      </> : photo.reviewable ? <>
        <label>Logged meal
          <select value={target} onChange={event => setTarget(event.target.value)} disabled={saving || !targets.length}>
            <option value="">{targets.length ? 'Choose a meal' : 'No logged meals without a photo'}</option>
            {targets.map(meal => <option key={meal.id} value={meal.id}>{meal.consumedAt ? mealTimeLabel(meal.consumedAt) : mealDay(meal)} · {meal.description}</option>)}
          </select>
        </label>
        <p>Attaching a photo keeps the meal’s existing calories.</p>
        <div className="nx-review-actions">
          <button type="button" className="cc-primary" disabled={saving || !target} onClick={() => void resolve('attach')}>Attach to meal</button>
          <button type="button" className="cc-secondary" disabled={saving} onClick={() => void resolve('not_food')}>Not food</button>
        </div>
      </> : <p>This upload is currently unavailable for review. Check its saved request for status.</p>}
      {saving && <p role="status">Saving…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  </MealDialog>;
}

export function AccountFoodReview({ history, fallback, initiallyOpen }: { history?: NutritionHistory | null; fallback?: ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(!!initiallyOpen), [photos, setPhotos] = useState<Photo[] | null>(null);
  const [selectedId, setSelectedId] = useState(''), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [revision, setRevision] = useState(0), [truncated, setTruncated] = useState(false);
  const summary = useRef<HTMLElement>(null);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useDataChanged(['food'], refresh);
  useEffect(() => { if (initiallyOpen) setOpen(true); }, [initiallyOpen]);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setError('');
    void accountData<{ photos: Photo[]; truncated?: boolean }>({ action: 'food_review_list' }, abort.signal)
      .then(data => {
        if (!Array.isArray(data.photos)) throw Error('Photo review is unavailable.');
        if (!abort.signal.aborted) { setPhotos(data.photos); setTruncated(data.truncated === true); }
      }).catch(cause => { if (!abort.signal.aborted) { setPhotos(null); setError(cause instanceof AccountRequestError && cause.code === 'account_action_not_ready' ? 'Photo review tools are not available yet.' : reviewError(cause)); } });
    return () => abort.abort();
  }, [open, revision]);
  const selected = photos?.find(photo => photo.mealId === selectedId);
  const pending = photos?.filter(photo => !photo.resolution) || [], reviewed = photos?.filter(photo => photo.resolution) || [];
  const row = (photo: Photo) => {
    const raw = photo.photoTakenAt || photo.createdAt, timestamp = raw ? Date.parse(raw) : NaN;
    return <button key={photo.mealId} type="button" className="cc-snap-recent-item" onClick={() => { setMessage(''); setSelectedId(photo.mealId); }}>
      <span><strong>{photo.description || 'Saved photo'}</strong>{Number.isFinite(timestamp) && <small>{new Date(timestamp).toLocaleString()}</small>}</span><ChevronRight size={16} aria-hidden="true" />
    </button>;
  };
  return <details className="nx-food-review" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary ref={summary} className="nx-food-pending-pill"><AlertCircle size={15} aria-hidden="true" />Photos to check <ChevronRight size={15} aria-hidden="true" /></summary>
    {open && <div className="nx-review-content">
      {photos && <section className="cc-snap-queue" aria-label="Photos to check">
        <div className="cc-heading-row"><h3>{pending.length ? `${pending.length} ${pending.length === 1 ? 'photo' : 'photos'} to check` : 'No photos to check'}</h3><button type="button" className="cc-text-button" onClick={refresh}>Refresh</button></div>
        {pending.map(row)}
        {truncated && <p>Showing the first {photos.length} photos, with unreviewed photos first.</p>}
        {reviewed.length > 0 && <details><summary>Reviewed photos ({reviewed.length})</summary>{reviewed.map(row)}</details>}
      </section>}
      {!photos && !error && <p role="status">Checking saved photos…</p>}
      {error && <><p role="status">{error} <button type="button" className="cc-text-button" onClick={refresh}>Try again</button></p>{fallback}</>}
      {message && <p role="status">{message}</p>}
      {selected && <ReviewDialog key={selected.mealId} photo={selected} history={history} onClose={() => setSelectedId('')} onSaved={review => {
        setPhotos(current => current?.map(photo => photo.mealId === review.mealId ? { ...photo, ...review } : photo) || null);
        setMessage(review.resolution === 'attach' ? 'Photo attached to the logged meal.' : review.resolution === 'not_food' ? 'Photo moved to Reviewed photos.' : 'Photo returned to Photos to check.');
        setSelectedId('');
        requestAnimationFrame(() => summary.current?.focus());
      }} />}
    </div>}
  </details>;
}
