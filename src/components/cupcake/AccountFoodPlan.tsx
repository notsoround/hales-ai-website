import { useCallback, useEffect, useRef, useState } from 'react';
import { libraryRequest } from './library';
import { AccountRequestError } from './accountSession';
import { personalStorage } from './personalStorage';
import { draftPlan, parseMealPlan, planDraft, planDraftError, readPlanRecovery, rebasePlanDraft, samePlan, PLAN_DRAFT_KEY, type MealPlan, type PlanDraft, type PlanIntent } from './foodPlanModel';
import './account-food-plan.css';
import { appendGroceryItems, checkGroceryItem, groceryItems, missingGroceryItems } from './groceryChecklist';

export function AccountFoodPlan({ section, onPlan }: { section: 'plan' | 'groceries'; onPlan: () => void }) {
  const [storage] = useState(() => personalStorage('sessionStorage'));
  const [recovery] = useState(() => readPlanRecovery(storage));
  const [base, setBase] = useState<MealPlan | null>(recovery?.base || null);
  const [draft, setDraft] = useState<PlanDraft>(() => recovery?.draft || planDraft(null));
  const [pending, setPending] = useState<PlanIntent | null>(recovery?.pending || null);
  const [latest, setLatest] = useState<MealPlan | null | undefined>();
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [choosingItems, setChoosingItems] = useState(false), [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [shoppingError, setShoppingError] = useState('');
  const current = useRef({ base, draft, pending }); current.current = { base, draft, pending };
  const generation = useRef(0), inFlight = useRef(false);
  const value = draftPlan(base, draft), dirty = !!pending || !samePlan(value, base || { meals: [] });
  const validation = planDraftError(draft, value);
  const groceries = groceryItems(draft.groceries);
  const suggestions = missingGroceryItems(draft.groceries, draft.meals.flatMap(meal => groceryItems(meal.items).map(item => item.label)));
  const selected = suggestions.filter(item => selectedItems.includes(item));

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    const request = ++generation.current; setBusy(true); setError('');
    try {
      const response = await libraryRequest<{ plan: { meal_plan?: unknown } }>({ action: 'coach_plan_get' });
      if (generation.current !== request) return;
      const saved = parseMealPlan(response.plan.meal_plan), previous = current.current;
      const hasDraft = !!previous.pending || !samePlan(draftPlan(previous.base, previous.draft), previous.base || { meals: [] });
      if (saved && previous.pending && samePlan(saved, previous.pending.value)) {
        storage.removeItem(PLAN_DRAFT_KEY); setBase(saved); setDraft(planDraft(saved)); setPending(null); setLatest(undefined); setNotice('Plan and groceries saved to your account. Planned meals have not been added to your food log.');
      } else if (hasDraft && !samePlan(saved, previous.base)) {
        setLatest(saved); setNotice('The saved plan has changed. Your draft is kept below. Review the latest version before saving.');
      } else {
        setBase(saved); if (!hasDraft) setDraft(planDraft(saved)); setLatest(undefined);
      }
      setLoaded(true);
    } catch (cause) { if (generation.current === request) setError(cause instanceof Error ? cause.message : 'The saved meal plan is unavailable.'); }
    finally { if (generation.current === request) setBusy(false); }
  }, [storage]);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => { void refresh(); return invalidate; }, [refresh, invalidate]);

  const edit = (next: PlanDraft) => {
    if (pending || busy) return;
    setDraft(next); setNotice('');
    try { storage.setItem(PLAN_DRAFT_KEY, JSON.stringify({ base, draft: next, pending: null })); }
    catch { setError('This browser cannot keep the draft across navigation. Leave this page open until you save.'); }
  };
  const confirm = (saved: MealPlan) => {
    storage.removeItem(PLAN_DRAFT_KEY); setBase(saved); setDraft(planDraft(saved)); setPending(null); setLatest(undefined); setNotice('Plan and groceries saved to your account. Planned meals have not been added to your food log.');
  };
  const save = async () => {
    if (inFlight.current || !loaded || latest !== undefined || (!pending && (!dirty || validation))) return;
    inFlight.current = true; const request = ++generation.current; setBusy(true); setError(''); setNotice('');
    const intent: PlanIntent = pending || { action: 'coach_plan_set', kind: 'meal_plan', value, expected_value: base };
    try {
      storage.setItem(PLAN_DRAFT_KEY, JSON.stringify({ base, draft, pending: intent })); setPending(intent);
      await libraryRequest({ ...intent });
      const response = await libraryRequest<{ plan: { meal_plan?: unknown } }>({ action: 'coach_plan_get' });
      if (generation.current !== request) return;
      const saved = parseMealPlan(response.plan.meal_plan);
      if (!saved || !samePlan(saved, intent.value)) { setLatest(saved); throw Error('The saved version differs from this draft. Your draft is kept; review the latest plan.'); }
      confirm(saved);
    } catch (cause) {
      if (generation.current !== request) return;
      if (cause instanceof AccountRequestError && cause.code === 'plan_conflict') {
        setPending(null);
        try { storage.setItem(PLAN_DRAFT_KEY, JSON.stringify({ base, draft, pending: null })); } catch { /* The current draft remains visible in memory. */ }
        setNotice('Another device changed this plan. Your draft is kept. Load the latest saved version to compare.');
        // Fetching the conflict version never overwrites the draft.
        try { const response = await libraryRequest<{ plan: { meal_plan?: unknown } }>({ action: 'coach_plan_get' }); if (generation.current === request) setLatest(parseMealPlan(response.plan.meal_plan)); }
        catch { /* Keep the exact pending request until a fresh read can confirm the conflict. */ }
      }
      setError(cause instanceof Error ? cause.message : 'Save not confirmed. Retry the same plan.');
    } finally { inFlight.current = false; if (generation.current === request) setBusy(false); }
  };
  const useLatest = () => {
    if (latest === undefined || !window.confirm('Replace this unsaved draft with the latest saved plan?')) return;
    try { storage.removeItem(PLAN_DRAFT_KEY); setBase(latest); setDraft(planDraft(latest)); setPending(null); setLatest(undefined); setNotice('Latest saved plan loaded.'); setError(''); }
    catch { setError('The browser could not clear this draft. Try again.'); }
  };
  const keepDraft = () => {
    if (latest === undefined || !window.confirm('Keep your meal and grocery edits for a new save over the latest version? Review both sections first.')) return;
    const rebased = rebasePlanDraft(base, draft, latest);
    try { storage.setItem(PLAN_DRAFT_KEY, JSON.stringify({ base: latest, draft: rebased, pending: null })); setBase(latest); setDraft(rebased); setPending(null); setLatest(undefined); setNotice('Draft kept against the latest version. Review it, then explicitly save.'); setError(''); }
    catch { setError('The browser could not keep this draft. Try again.'); }
  };
  const addShoppingItems = () => {
    if (busy || pending || !selected.length) return;
    try {
      const groceries = appendGroceryItems(draft.groceries, selected);
      edit({ ...draft, groceries }); setChoosingItems(false); setShoppingError('');
      setNotice(`${selected.length} ${selected.length === 1 ? 'item added' : 'items added'} to your grocery draft. Review the list, then Save plan & groceries.`);
    } catch (cause) { setShoppingError(cause instanceof Error ? cause.message : 'These items could not be added. Your notes are unchanged.'); }
  };
  return <section className="cc-food-plan" aria-label={section === 'plan' ? 'Meal plan workspace' : 'Grocery workspace'}>
    <div className="cc-heading-row"><h3>{section === 'plan' ? 'Your meal plan' : 'Your groceries'}</h3><button type="button" className="cc-secondary" disabled={busy} onClick={() => void refresh()}>Reload saved plan</button></div>
    <p className="cc-muted">{section === 'plan' ? 'Plan meals in your own words. This reference plan is separate from meals you actually ate.' : 'Keep your grocery list and shopping notes with your meal plan.'}</p>
    {!loaded && !error && <p role="status">Loading your saved plan…</p>}
    {error && <p role="alert" className="cc-error">{error}</p>}
    {notice && <p role="status" className="cc-muted">{notice}</p>}
    {latest !== undefined && <aside className="cc-card cc-plan-conflict"><strong>Latest saved version · draft kept</strong><p>{latest?.title || (latest ? 'Untitled meal plan' : 'No saved meal plan')}</p>{latest?.meals.map((meal, index) => <p key={index}>{meal.name}: {meal.items.join(' · ')}</p>)}<p className="cc-plan-text">{latest?.groceries || 'No grocery notes saved.'}</p><div className="cc-plan-actions"><button type="button" className="cc-secondary" disabled={busy} onClick={useLatest}>Use latest saved version</button><button type="button" className="cc-secondary" disabled={busy} onClick={keepDraft}>Keep my draft for a new save</button></div></aside>}
    {loaded && <>
      <p className="cc-plan-save-state" role="status">{pending ? 'Save unconfirmed · original request kept for retry' : dirty ? 'Unsaved changes · draft kept in this browser tab' : base ? 'Saved plan loaded from your account' : 'No saved meal plan yet'}</p>
      <fieldset disabled={busy || !!pending} className="cc-plan-fields">
        {section === 'plan' ? <>
          <label>Plan title (optional)<input maxLength={200} value={draft.title} onChange={event => edit({ ...draft, title: event.target.value })}/></label>
          {draft.meals.map((meal, index) => <article className="cc-card cc-plan-meal" key={index}>
            <div className="cc-heading-row"><strong>Planned meal {index + 1}</strong><button type="button" className="cc-text-button" onClick={() => edit({ ...draft, meals: draft.meals.filter((_, at) => at !== index) })}>Remove meal {index + 1}</button></div>
            <label>Meal {index + 1} name<input maxLength={300} value={meal.name} onChange={event => edit({ ...draft, meals: draft.meals.map((item, at) => at === index ? { ...item, name: event.target.value } : item) })}/></label>
            <label>Meal {index + 1} food items · one per line<textarea rows={3} maxLength={5000} value={meal.items} onChange={event => edit({ ...draft, meals: draft.meals.map((item, at) => at === index ? { ...item, items: event.target.value } : item) })}/></label>
            <label>Meal {index + 1} planned calories (optional)<input type="number" inputMode="decimal" min={0} max={20000} step="any" placeholder="Unknown" value={meal.kcal} onChange={event => edit({ ...draft, meals: draft.meals.map((item, at) => at === index ? { ...item, kcal: event.target.value } : item) })}/></label>
          </article>)}
          <button type="button" className="cc-secondary" disabled={draft.meals.length >= 10} onClick={() => edit({ ...draft, meals: [...draft.meals, { original: null, name: '', items: '', kcal: '' }] })}>Add planned meal</button>
          <p className="cc-muted cc-small">Up to 10 meals. Enter planned calories only when you know them; otherwise leave them blank.</p>
        </> : <>
          <div className="cc-card cc-shopping-builder">
            <div><h4>Shop your meal plan</h4><p className="cc-muted cc-small">Choose the food items you still need. Your quantities, notes and checked items stay as they are.</p></div>
            {!draft.meals.length ? <button type="button" className="cc-secondary" onClick={onPlan}>Create a meal plan</button>
              : !suggestions.length ? <p className="cc-muted cc-small">{draft.meals.some(meal => groceryItems(meal.items).length) ? 'Your planned food items are already on this list. You can still add or edit groceries below.' : 'Add food items to your meal plan to choose groceries here.'}</p>
                : <button type="button" className="cc-secondary" aria-expanded={choosingItems} aria-controls="cc-shopping-choices" onClick={() => { setChoosingItems(!choosingItems); setSelectedItems(suggestions); setShoppingError(''); }}>{choosingItems ? 'Close meal plan items' : 'Choose meal plan items'}</button>}
            {choosingItems && suggestions.length > 0 && <fieldset className="cc-shopping-choices" id="cc-shopping-choices">
              <legend>Meal plan items to add</legend>
              <p className="cc-muted cc-small">Items already listed are skipped. Different quantities stay separate. Adding items makes a draft; it does not log food.</p>
              <div className="cc-plan-actions"><button type="button" className="cc-text-button" onClick={() => setSelectedItems(suggestions)}>Select all</button><button type="button" className="cc-text-button" onClick={() => setSelectedItems([])}>Clear selection</button></div>
              {suggestions.map(item => <label className="cc-grocery-item" key={item}><input type="checkbox" checked={selectedItems.includes(item)} onChange={event => setSelectedItems(event.target.checked ? [...selectedItems, item] : selectedItems.filter(value => value !== item))}/><span>{item}</span></label>)}
              {shoppingError && <p role="alert" className="cc-error">{shoppingError}</p>}
              <button type="button" className="cc-secondary" disabled={!selected.length} onClick={addShoppingItems}>Add {selected.length} {selected.length === 1 ? 'item' : 'items'} to grocery draft</button>
            </fieldset>}
          </div>
          <div className="cc-grocery-checklist" aria-label="Grocery checklist">
            <div className="cc-heading-row"><strong>Shopping checklist</strong><span className="cc-muted cc-small">{groceries.filter(item => item.checked).length} of {groceries.length} checked</span></div>
            <p className="cc-muted cc-small">Check off items as you shop, then Save plan &amp; groceries.</p>
            {groceries.map(item => <label className="cc-grocery-item" key={item.line}><input type="checkbox" checked={item.checked} onChange={event => edit({ ...draft, groceries: checkGroceryItem(draft.groceries, item.line, event.target.checked) })}/><span className={item.checked ? 'cc-grocery-checked' : ''}>{item.label}</span></label>)}
            {!groceries.length && <p className="cc-muted">Add grocery items below, one per line, to make your checklist.</p>}
          </div>
          <label>Grocery notes<textarea rows={10} maxLength={10000} value={draft.groceries} placeholder="Food, quantity, and shopping notes — one item per line" onChange={event => edit({ ...draft, groceries: event.target.value })}/></label>
          {!draft.meals.length && <p className="cc-muted">Grocery notes save with a meal plan. <button type="button" className="cc-text-button" onClick={onPlan}>Create your meal plan first</button></p>}
          <p className="cc-muted cc-small">Add or edit items in Grocery notes. Your other notes are kept.</p>
        </>}
      </fieldset>
      {dirty && validation && !pending && <p className="cc-muted cc-small">{validation}</p>}
      <div className="cc-plan-actions"><button type="button" className="cc-primary" disabled={busy || latest !== undefined || (!pending && (!dirty || !!validation))} onClick={() => void save()}>{busy ? 'Confirming saved plan…' : pending ? 'Retry same plan save' : 'Save plan & groceries'}</button></div>
    </>}
  </section>;
}
