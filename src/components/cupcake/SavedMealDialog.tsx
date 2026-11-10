import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { MealDialog } from './MealDialog';
import type { FoodMeal } from './DashboardView';
import { libraryRequest } from './library';
import { dayLabel, mealNeighbors, mealTimeLabel, type FoodHistoryMeal } from './nutritionModel';
import { PhotoViewer } from './PhotoViewer';
import { ACCOUNT_SESSIONS } from './accountMode';
import { accountData, AccountRequestError } from './accountSession';

type Portion = { editable: boolean; blockedReason: null | 'not_logged' | 'sheet_backed' | 'no_items' | 'unavailable'; fraction: number; label: string; choices: number[]; setAt?: string | null; originalTotal?: { calories?: number | null } | null; adjusted: boolean };
const PORTION_TEXT: Record<string, [string, string]> = { '0.25': ['¼', 'A quarter'], '0.5': ['½', 'Half'], '0.75': ['¾', 'Three quarters'], '1': ['Full', 'The full plate'] };
const PORTION_BLOCKED: Record<string, string> = { not_logged: 'Log this meal first, then you can change its portion.', sheet_backed: 'This older meal lives in the original app’s food log, so its portion can only be changed there.', no_items: 'This estimate has no items to scale.', unavailable: 'Portion changes aren’t available for this meal yet.' };
const PORTION_CHOICES = [0.25, 0.5, 0.75, 1];

export function SavedMealDialog({ mealId, meals, onSelect, onClose, returnFocus, onUpdated }: {
  mealId: string | null; meals: FoodHistoryMeal[]; onSelect: (id: string) => void; onClose: () => void; onUpdated?: () => void;
  returnFocus?: { current: HTMLElement | null };
}) {
  const [meal, setMeal] = useState<FoodMeal | null>(null);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoRetry, setPhotoRetry] = useState(0);
  const [retry, setRetry] = useState(0);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [portionBusy, setPortionBusy] = useState(false), [portionError, setPortionError] = useState('');
  const historical = meals.find(m => m.id === mealId && m.source === 'food_sheet');
  const legacy = historical && !historical.id.startsWith('meal_') ? historical : undefined;
  const currentMeal = meal?.id === mealId ? meal : null;
  const manual = currentMeal?.source === 'manual-entry' || !!currentMeal?.manualLoggedAt;
  const noPhoto = manual || currentMeal?.imageStored === false;
  const logged = !!currentMeal && currentMeal.countedInTotals !== false && (!!currentMeal.sheetLoggedAt || (currentMeal.source === 'account-photo-estimate' && currentMeal.logDestination === 'account-local' && !!currentMeal.accountLoggedAt && currentMeal.logState === 'logged' && currentMeal.countedInTotals === true && !!currentMeal.consumedAt && Number.isFinite(Date.parse(currentMeal.consumedAt))));
  useEffect(() => {
    let current = true;
    setMeal(null); setError('');
    if (legacy) setMeal({ ...legacy, consumedAt: legacy.consumedAt || undefined, status: 'ready' });
    else if (mealId) void libraryRequest<{ meal: FoodMeal }>({ action: 'food_get', mealId })
      .then(data => { if (current) setMeal({...historical,...data.meal,consumedAt:data.meal.consumedAt||historical?.consumedAt||undefined}); })
      .catch(e => { if (current) {if(historical)setMeal({...historical,consumedAt:historical.consumedAt||undefined,status:'ready'});else setError(e instanceof Error ? e.message : 'Meal details unavailable.');} });
    return () => { current = false; };
  }, [mealId, retry, legacy, historical]);
  useEffect(() => {
    setPhoto(''); setPhotoError(''); setPhotoBusy(false);
    if (!mealId || legacy || !currentMeal || noPhoto) return;
    let current = true; let objectUrl = '';
    setPhotoBusy(true); setPhotoError('');
    void libraryRequest<{ photo: { dataUrl: string } }>({ action: 'food_photo', mealId })
      .then(data => {
        const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data.photo.dataUrl);
        if (!match) throw new Error('The saved photo could not be opened.');
        const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: match[1] }));
        if (current) setPhoto(objectUrl); else URL.revokeObjectURL(objectUrl);
      }).catch(e => { if (current) setPhotoError(e instanceof Error ? e.message : 'Photo unavailable.'); })
      .finally(() => { if (current) setPhotoBusy(false); });
    return () => { current = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [mealId, legacy, photoRetry, currentMeal, noPhoto]);
  const adjacent = mealNeighbors(meals, mealId || '');
  // Portion is always a fraction of the original estimate; the server rescales and returns the saved meal.
  // Chips always show in the account app so the feature is discoverable; a meal the server did not
  // describe (older Food Sheet rows, or a details fallback) shows them disabled with the reason.
  const served = (currentMeal as (FoodMeal & { portion?: Portion }) | null)?.portion;
  const portion: Portion | undefined = !ACCOUNT_SESSIONS || !currentMeal ? undefined : served
    || { editable: false, blockedReason: historical || currentMeal.source === 'food_sheet' ? 'sheet_backed' : logged ? 'unavailable' : 'not_logged', fraction: 1, label: 'full', choices: PORTION_CHOICES, adjusted: false };
  const setPortion = async (fraction: number) => {
    if (!currentMeal || portionBusy) return;
    setPortionBusy(true); setPortionError('');
    try {
      const result = await accountData<{ meal: FoodMeal; unchanged?: boolean }>({ action: 'food_portion_set', mealId: currentMeal.id, fraction });
      setMeal(previous => previous && previous.id === currentMeal.id ? { ...previous, ...result.meal } : previous);
      if (!result.unchanged) onUpdated?.();
    } catch (cause) {
      setPortionError(cause instanceof AccountRequestError && cause.code === 'account_action_not_ready' ? 'Portion changes aren’t switched on yet. Your meal is unchanged.' : cause instanceof Error ? cause.message : 'The portion could not be saved. Your meal is unchanged.');
    } finally { setPortionBusy(false); }
  };
  return <MealDialog open={!!mealId} onClose={onClose} returnFocus={returnFocus}>
    <nav className="cc-meal-navigation" aria-label="Browse saved meals">
      <button className="cc-secondary" disabled={!adjacent.previous} onClick={() => adjacent.previous && onSelect(adjacent.previous.id)}><ArrowLeft size={16}/>Previous meal</button>
      <span>{adjacent.position ? `Meal ${adjacent.position} of ${adjacent.total}` : 'Saved meal'}</span>
      <button className="cc-secondary" disabled={!adjacent.next} onClick={() => adjacent.next && onSelect(adjacent.next.id)}>Next meal<ArrowRight size={16}/></button>
    </nav>
    {error ? <div role="alert"><p className="cc-error">{error}</p><button className="cc-secondary" onClick={() => setRetry(n => n + 1)}>Retry</button></div> : !currentMeal ? <p role="status">Loading saved meal…</p> : <>
      <h3>{currentMeal.description || 'Food photo'}</h3>
      <p><strong>{currentMeal.consumedAt ? `Eaten ${mealTimeLabel(currentMeal.consumedAt)}` : historical?.date ? `Eaten ${dayLabel(historical.date)} · time not recorded` : 'Eaten time not recorded'}</strong><br/><small className="cc-muted">America/Chicago · {logged ? 'In your food log' : 'Not in calorie totals yet'}</small></p>
      {currentMeal.photoTakenAt && currentMeal.photoTakenAt !== currentMeal.consumedAt && <p className="cc-muted cc-small">Photo file time: {mealTimeLabel(currentMeal.photoTakenAt)}</p>}
      <div className="cc-meal-macros">
        {[[manual ? 'Calories (entered)' : 'Est. calories', currentMeal.total?.calories, 'kcal'], ['Protein', currentMeal.total?.protein_g, 'g'], ['Total carbs', currentMeal.total?.carbs_g, 'g'], ['Sugar', currentMeal.total?.sugar_g, 'g'], ...(manual ? [['Fat', currentMeal.total?.fat_g, 'g'], ['Fiber', currentMeal.total?.fiber_g, 'g']] : [])].map(([label, value, unit]) => <div key={String(label)}><small>{label}</small><strong>{value == null ? 'Unknown' : `${Number(value).toLocaleString()} ${unit}`}</strong></div>)}
      </div>
      {portion && <div className="cc-portion" role="group" aria-label="Portion you ate" aria-describedby={!portion.editable && portion.blockedReason ? 'cc-portion-note' : undefined}>
        <span className="cc-portion-label">Portion you ate</span>
        <div className="cc-portion-chips">{portion.choices.map(choice => { const [short, long] = PORTION_TEXT[String(choice)] || [`${Math.round(choice * 100)}%`, `${Math.round(choice * 100)} percent`]; return <button key={choice} type="button" aria-label={long} aria-pressed={portion.fraction === choice} disabled={!portion.editable || portionBusy} onClick={() => void setPortion(choice)}>{short}</button>; })}</div>
        {portionBusy && <p role="status" className="cc-muted cc-small">Saving portion…</p>}
        {portion.adjusted && portion.originalTotal?.calories != null && <p className="cc-muted cc-small">Original estimate: {Math.round(portion.originalTotal.calories).toLocaleString()} kcal</p>}
        {!portion.editable && portion.blockedReason && <p id="cc-portion-note" className="cc-muted cc-small">{PORTION_BLOCKED[portion.blockedReason]}</p>}
        {portionError && <p role="alert" className="cc-error">{portionError}</p>}
      </div>}
      {currentMeal.calorieRange && <p className="cc-muted">Estimated range: {currentMeal.calorieRange.low}–{currentMeal.calorieRange.high} kcal.</p>}
      {currentMeal.totalIsPartial && <p className="cc-error">{manual ? 'Partial entry' : 'Partial estimate'}: some nutrition is missing. This is not a complete meal total.</p>}
      {manual && <p className="cc-muted">Manually entered meal · no photo. Nutrition values were entered by you; missing values remain unknown.</p>}
      {legacy && <p className="cc-muted cc-small">This older food-log entry has no linked original photo.</p>}
      {photoBusy && <p role="status">Opening private photo…</p>}
      {photoError && <div role="alert"><p className="cc-error">{photoError}</p><button className="cc-secondary" onClick={() => setPhotoRetry(n => n + 1)}>Retry photo</button></div>}
      {photo && <figure className="cc-meal-photo"><button className="cc-meal-photo-btn" onClick={() => setPhotoViewerOpen(true)}><img src={photo} alt={`Saved photo: ${currentMeal.description || 'meal'}`}/><span>View full photo</span></button></figure>}
      {photoViewerOpen && photo && (
        <PhotoViewer
          photoUrl={photo}
          title={currentMeal.description || 'Food photo'}
          onClose={() => setPhotoViewerOpen(false)}
          onPrevious={adjacent.previous ? () => { setPhotoViewerOpen(false); onSelect(adjacent.previous!.id); } : undefined}
          onNext={adjacent.next ? () => { setPhotoViewerOpen(false); onSelect(adjacent.next!.id); } : undefined}
          hasPrevious={!!adjacent.previous}
          hasNext={!!adjacent.next}
        />
      )}
      <details className="cc-meal-estimate-details"><summary>{manual ? 'Entry details & sources' : 'Estimate details & sources'}</summary>
        {[...(currentMeal.lookupWarnings || []), ...(currentMeal.warnings || [])].map(warning => <p className="cc-muted" key={warning}>{warning}</p>)}
        {currentMeal.items?.map(item => <div className="cc-meal-estimate-item" key={item.id}><strong>{item.name}</strong><p>{item.nutrition?.calories == null ? 'Calories unknown' : `${item.nutrition.calories} kcal`}{item.quantity != null ? ` · ${item.quantity} ${item.unit || 'portion(s)'}` : ''}</p><small>{item.provenance || 'Estimate provenance unavailable'}{item.calculation ? ` · ${item.calculation}` : ''}{item.portionAssumption ? ` · ${item.portionAssumption}` : ''}{item.variantWarning ? ` · ${item.variantWarning}` : ''}</small>{item.sourceCitations?.filter(source => /^https?:\/\//.test(source.url)).map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</div>)}
        <p className="cc-muted cc-small">{manual ? 'Owner-entered nutrition, saved with your explicit eaten confirmation and actual meal time.' : historical ? 'Nutrition comes from the saved food-log estimate.' : 'Nutrition is estimated from the saved food photo and identified portions.'}</p>
      </details>
    </>}
  </MealDialog>;
}
