import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { MealDialog } from './MealDialog';
import type { FoodMeal } from './DashboardView';
import { libraryRequest } from './library';
import { dayLabel, mealNeighbors, mealTimeLabel, type FoodHistoryMeal } from './nutritionModel';

export function SavedMealDialog({ mealId, meals, onSelect, onClose, returnFocus }: {
  mealId: string | null; meals: FoodHistoryMeal[]; onSelect: (id: string) => void; onClose: () => void;
  returnFocus?: { current: HTMLElement | null };
}) {
  const [meal, setMeal] = useState<FoodMeal | null>(null);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoRequested, setPhotoRequested] = useState(false);
  const [photoRetry, setPhotoRetry] = useState(0);
  const [retry, setRetry] = useState(0);
  const historical = meals.find(m => m.id === mealId && m.source === 'food_sheet');
  const legacy = historical && !historical.id.startsWith('meal_') ? historical : undefined;
  const photoLink = useRef<HTMLAnchorElement>(null);
  useEffect(()=>{if(photo)photoLink.current?.focus();},[photo]);
  useEffect(() => {
    let current = true;
    setMeal(null); setError(''); setPhoto(''); setPhotoError(''); setPhotoRequested(false); setPhotoBusy(false);
    if (legacy) setMeal({ ...legacy, consumedAt: legacy.consumedAt || undefined, status: 'ready' });
    else if (mealId) void libraryRequest<{ meal: FoodMeal }>({ action: 'food_get', mealId })
      .then(data => { if (current) setMeal({...historical,...data.meal,consumedAt:data.meal.consumedAt||historical?.consumedAt||undefined}); })
      .catch(e => { if (current) {if(historical)setMeal({...historical,consumedAt:historical.consumedAt||undefined,status:'ready'});else setError(e instanceof Error ? e.message : 'Meal details unavailable.');} });
    return () => { current = false; };
  }, [mealId, retry, legacy, historical]);
  useEffect(() => {
    if (!mealId || !photoRequested) return;
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
  }, [mealId, photoRequested, photoRetry]);
  const adjacent = mealNeighbors(meals, mealId || '');
  const currentMeal = meal?.id === mealId ? meal : null;
  return <MealDialog open={!!mealId} onClose={onClose} returnFocus={returnFocus}>
    <nav className="cc-meal-navigation" aria-label="Browse saved meals">
      <button className="cc-secondary" disabled={!adjacent.previous} onClick={() => adjacent.previous && onSelect(adjacent.previous.id)}><ArrowLeft size={16}/>Previous meal</button>
      <span>{adjacent.position ? `Meal ${adjacent.position} of ${adjacent.total}` : 'Saved meal'}</span>
      <button className="cc-secondary" disabled={!adjacent.next} onClick={() => adjacent.next && onSelect(adjacent.next.id)}>Next meal<ArrowRight size={16}/></button>
    </nav>
    {error ? <div role="alert"><p className="cc-error">{error}</p><button className="cc-secondary" onClick={() => setRetry(n => n + 1)}>Retry</button></div> : !currentMeal ? <p role="status">Loading saved meal…</p> : <>
      <h3>{currentMeal.description || 'Food photo'}</h3>
      <p><strong>{currentMeal.consumedAt ? `Eaten ${mealTimeLabel(currentMeal.consumedAt)}` : historical?.date ? `Eaten ${dayLabel(historical.date)} · time not recorded` : 'Eaten time not recorded'}</strong><br/><small className="cc-muted">America/Chicago · {currentMeal.sheetLoggedAt ? 'In your food log' : 'Not in calorie totals yet'}</small></p>
      {currentMeal.photoTakenAt && currentMeal.photoTakenAt !== currentMeal.consumedAt && <p className="cc-muted cc-small">Photo file time: {mealTimeLabel(currentMeal.photoTakenAt)}</p>}
      <div className="cc-meal-macros">
        {[['Est. calories', currentMeal.total?.calories, 'kcal'], ['Protein', currentMeal.total?.protein_g, 'g'], ['Total carbs', currentMeal.total?.carbs_g, 'g'], ['Sugar', currentMeal.total?.sugar_g, 'g']].map(([label, value, unit]) => <div key={String(label)}><small>{label}</small><strong>{value == null ? 'Unknown' : `${Number(value).toLocaleString()} ${unit}`}</strong></div>)}
      </div>
      {currentMeal.calorieRange && <p className="cc-muted">Estimated range: {currentMeal.calorieRange.low}–{currentMeal.calorieRange.high} kcal.</p>}
      {currentMeal.totalIsPartial && <p className="cc-error">Partial estimate: some nutrition is missing. This is not a complete meal total.</p>}
      {legacy ? <p className="cc-muted cc-small">This older food-log entry has no linked original photo.</p> : !photoRequested && <button className="cc-secondary" onClick={() => setPhotoRequested(true)}><ImageIcon size={17}/>View saved original photo</button>}
      {photoBusy && <p role="status">Opening private photo…</p>}
      {photoError && <div role="alert"><p className="cc-error">{photoError}</p><button className="cc-secondary" onClick={() => setPhotoRetry(n => n + 1)}>Retry photo</button></div>}
      {photo && <figure className="cc-meal-photo"><a ref={photoLink} href={photo} target="_blank" rel="noreferrer"><img src={photo} alt={`Saved photo: ${currentMeal.description || 'meal'}`}/><span>Open full photo ↗</span></a></figure>}
      <details className="cc-meal-estimate-details"><summary>Estimate details &amp; sources</summary>
        {[...(currentMeal.lookupWarnings || []), ...(currentMeal.warnings || [])].map(warning => <p className="cc-muted" key={warning}>{warning}</p>)}
        {currentMeal.items?.map(item => <div className="cc-meal-estimate-item" key={item.id}><strong>{item.name}</strong><p>{item.nutrition?.calories == null ? 'Calories unknown' : `${item.nutrition.calories} kcal`}{item.quantity != null ? ` · ${item.quantity} ${item.unit || 'portion(s)'}` : ''}</p><small>{item.provenance || 'Estimate provenance unavailable'}{item.calculation ? ` · ${item.calculation}` : ''}{item.portionAssumption ? ` · ${item.portionAssumption}` : ''}{item.variantWarning ? ` · ${item.variantWarning}` : ''}</small>{item.sourceCitations?.filter(source => /^https?:\/\//.test(source.url)).map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</div>)}
        <p className="cc-muted cc-small">{historical ? 'Nutrition comes from the saved food-log estimate.' : 'Nutrition is estimated from the saved food photo and identified portions.'}</p>
      </details>
    </>}
  </MealDialog>;
}
