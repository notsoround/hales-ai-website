import { useCallback, useEffect, useRef, useState } from 'react';
import { libraryRequest } from './library';
import { AccountRequestError } from './accountSession';
import { personalStorage } from './personalStorage';
import { draftPlan, parseMealPlan, planDraft, planDraftError, readPlanRecovery, rebasePlanDraft, samePlan, PLAN_DRAFT_KEY, type MealPlan, type PlanDraft, type PlanIntent } from './foodPlanModel';
import './account-food-plan.css';
import { parsePlanText } from './planImport';
import { useLab } from './labsFlags';
import { useDataChanged } from './dataChanges';
import { AccountPlanBuilder } from './AccountPlanBuilder';
import { appendGroceryItems, checkGroceryItem, groceryHeadings, groceryItems, groceryNotes, missingGroceryItems } from './groceryChecklist';

/** `both` (desktop) shows the meal plan and groceries side by side from one draft and one save. */
export function AccountFoodPlan({ section, onPlan, onGroceries }: { section: 'plan' | 'groceries' | 'both'; onPlan: () => void; onGroceries?: () => void }) {
  const [storage] = useState(() => personalStorage('sessionStorage'));
  const [recovery] = useState(() => readPlanRecovery(storage));
  const [base, setBase] = useState<MealPlan | null>(recovery?.base || null);
  const [draft, setDraft] = useState<PlanDraft>(() => recovery?.draft || planDraft(null));
  const [pending, setPending] = useState<PlanIntent | null>(recovery?.pending || null);
  const [latest, setLatest] = useState<MealPlan | null | undefined>();
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false);
  const [importText, setImportText] = useState(''), [importNote, setImportNote] = useState('');
  const [newItem, setNewItem] = useState(''), [addError, setAddError] = useState('');
  // The raw list text stays folded once the checklist shows the items, so the list is not on screen twice.
  const [textOpen, setTextOpen] = useState(false);
  const planBuilder = useLab('plan-builder');
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [choosingItems, setChoosingItems] = useState(false), [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [shoppingError, setShoppingError] = useState('');
  const checklistHeading = useRef<HTMLHeadingElement>(null), focusChecklist = useRef(false);
  const both = section === 'both', planTitle = useRef<HTMLInputElement>(null), shopHeading = useRef<HTMLHeadingElement>(null);
  // Side by side, both halves are already on screen: move focus instead of switching sections.
  const toPlan = both ? () => planTitle.current?.focus() : onPlan;
  const toGroceries = both ? () => shopHeading.current?.focus() : onGroceries;
  useEffect(() => {
    if (!choosingItems && focusChecklist.current) { focusChecklist.current = false; checklistHeading.current?.focus(); }
  }, [choosingItems]);
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
  useDataChanged(['plan'], () => { void refresh(); });

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
      edit({ ...draft, groceries }); focusChecklist.current = true; setChoosingItems(false); setShoppingError('');
      setNotice(`${selected.length} ${selected.length === 1 ? 'item added' : 'items added'} to your grocery draft. Review the list, then Save plan & groceries.`);
    } catch (cause) { setShoppingError(cause instanceof Error ? cause.message : 'These items could not be added. Your notes are unchanged.'); }
  };
  return <section className={`cc-food-plan${both ? ' cc-food-plan-both' : ''}`} aria-label={both ? 'Meal plan and grocery workspace' : section === 'plan' ? 'Meal plan workspace' : 'Grocery workspace'}>
    <div className="cc-heading-row"><h3>{both ? 'Your meal plan & groceries' : section === 'plan' ? 'Your meal plan' : 'Your groceries'}</h3><button type="button" className="cc-secondary" disabled={busy} onClick={() => void refresh()}>Reload saved plan</button></div>
    <p className="cc-muted">{both ? 'Plan meals in your own words and shop for them. This reference plan is separate from meals you actually ate.' : section === 'plan' ? 'Plan meals in your own words. This reference plan is separate from meals you actually ate.' : 'Keep your grocery list and shopping notes with your meal plan.'}</p>
    {!loaded && !error && <p role="status">Loading your saved plan…</p>}
    {error && <p role="alert" className="cc-error">{error}</p>}
    {notice && <p role="status" className="cc-muted">{notice}</p>}
    {latest !== undefined && <aside className="cc-card cc-plan-conflict"><strong>Latest saved version · draft kept</strong><p>{latest?.title || (latest ? 'Untitled meal plan' : 'No saved meal plan')}</p>{latest?.meals.map((meal, index) => <p key={index}>{meal.name}: {meal.items.join(' · ')}</p>)}<p className="cc-plan-text">{latest?.groceries || 'No grocery notes saved.'}</p><div className="cc-plan-actions"><button type="button" className="cc-secondary" disabled={busy} onClick={useLatest}>Use latest saved version</button><button type="button" className="cc-secondary" disabled={busy} onClick={keepDraft}>Keep my draft for a new save</button></div></aside>}
    {loaded && <>
      <p className="cc-plan-save-state" role="status">{pending ? 'Save unconfirmed · original request kept for retry' : dirty ? 'Unsaved changes · draft kept in this browser tab' : base ? 'Saved plan loaded from your account' : 'No saved meal plan yet'}</p>
      <fieldset disabled={busy || !!pending} className="cc-plan-fields">
        {(() => { const planPart = <>
          <details className="cc-plan-import"><summary>Paste or upload a plan</summary><div>
            <p className="cc-muted cc-small">A routine, a meal plan or a coach’s notes. Headings such as “Monday” or “Lunch:” become planned meals and the lines under them become items. Nothing is saved until you choose Save plan &amp; groceries.</p>
            <label>Plan text<textarea rows={5} maxLength={20000} value={importText} placeholder={'Monday:\n- Oats with berries\n- Greek yogurt\nLunch 550 kcal:\n- Chicken quinoa bowl'} onChange={event => { setImportText(event.target.value); setImportNote(''); }}/></label>
            <label className="cc-plan-import-file">Or choose a text file<input type="file" accept=".txt,.md,.markdown,.csv,text/plain,text/markdown" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (!file) return; if (file.size > 200000) { setImportNote('That file is too large. Paste the part you want instead.'); return; } void file.text().then(text => { setImportText(text.slice(0, 20000)); setImportNote(''); }).catch(() => setImportNote('That file could not be read. Paste its text instead.')); }}/></label>
            {(() => { const found = parsePlanText(importText, Math.max(0, 10 - draft.meals.length)); return <><button type="button" className="cc-secondary" disabled={!found.length} onClick={() => { edit({ ...draft, meals: [...draft.meals, ...found.map(meal => ({ original: null, name: meal.name, items: meal.items.join('\n'), kcal: meal.kcal }))] }); setImportText(''); setImportNote(`Added ${found.length} planned ${found.length === 1 ? 'meal' : 'meals'} to your draft. Review them below, then save.`); }}>{found.length ? `Add ${found.length} planned ${found.length === 1 ? 'meal' : 'meals'} to draft` : draft.meals.length >= 10 ? 'Plan is full (10 meals)' : 'Add to draft'}</button>{importNote && <p role="status" className="cc-muted cc-small">{importNote}</p>}</>; })()}
            {planBuilder && <AccountPlanBuilder room={Math.max(0, 10 - draft.meals.length)} disabled={busy || !!pending} onAdd={found => edit({ ...draft, meals: [...draft.meals, ...found.map(meal => ({ original: null, name: meal.name, items: meal.items.join('\n'), kcal: meal.kcal }))] })}/>}
          </div></details>
          <label>Plan title (optional)<input ref={planTitle} maxLength={200} value={draft.title} onChange={event => edit({ ...draft, title: event.target.value })}/></label>
          {draft.meals.map((meal, index) => <article className="cc-card cc-plan-meal" key={index}>
            <div className="cc-heading-row"><strong>Planned meal {index + 1}</strong><button type="button" className="cc-text-button" onClick={() => edit({ ...draft, meals: draft.meals.filter((_, at) => at !== index) })}>Remove meal {index + 1}</button></div>
            <label>Meal {index + 1} name<input maxLength={300} value={meal.name} onChange={event => edit({ ...draft, meals: draft.meals.map((item, at) => at === index ? { ...item, name: event.target.value } : item) })}/></label>
            <label>Meal {index + 1} food items · one per line<textarea rows={3} maxLength={5000} value={meal.items} onChange={event => edit({ ...draft, meals: draft.meals.map((item, at) => at === index ? { ...item, items: event.target.value } : item) })}/></label>
            <label>Meal {index + 1} planned calories (optional)<input type="number" inputMode="decimal" min={0} max={20000} step="any" placeholder="Unknown" value={meal.kcal} onChange={event => edit({ ...draft, meals: draft.meals.map((item, at) => at === index ? { ...item, kcal: event.target.value } : item) })}/></label>
          </article>)}
          <button type="button" className="cc-secondary" disabled={draft.meals.length >= 10} onClick={() => edit({ ...draft, meals: [...draft.meals, { original: null, name: '', items: '', kcal: '' }] })}>Add planned meal</button>
          <p className="cc-muted cc-small">Up to 10 meals. Enter planned calories only when you know them; otherwise leave them blank.</p>
          {toGroceries && suggestions.length > 0 && <button type="button" className="cc-plan-to-groceries" onClick={toGroceries}><span><strong>Shop this plan</strong><small>{suggestions.length} planned {suggestions.length === 1 ? 'item isn’t' : 'items aren’t'} on your grocery list yet</small></span><span aria-hidden="true">{both ? '↓' : '→'}</span></button>}
        </>; const groceryPart = <>
          <div className="cc-card cc-shopping-builder">
            <div><h4 ref={shopHeading} tabIndex={-1} className="cc-shopping-heading">Shop your meal plan</h4><p className="cc-muted cc-small">Choose the food items you still need. Your quantities, notes and checked items stay as they are.</p></div>
            {!draft.meals.length ? <button type="button" className="cc-secondary" onClick={toPlan}>Create a meal plan</button>
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
            <div className="cc-heading-row"><h4 ref={checklistHeading} tabIndex={-1} className="cc-shopping-heading">Shopping checklist</h4><span className="cc-muted cc-small">{groceries.filter(item => item.checked).length} of {groceries.length} checked</span></div>
            <p className="cc-muted cc-small">Check off items as you shop, then Save plan &amp; groceries.</p>
            {groceries.flatMap(item => [...groceryHeadings(draft.groceries).filter(heading => heading.line < item.line && !groceries.some(other => other.line < item.line && other.line > heading.line) ).map(heading => <p className="cc-grocery-section" key={`h${heading.line}`}>{heading.label}</p>), <label className="cc-grocery-item" key={item.line}><input type="checkbox" checked={item.checked} onChange={event => edit({ ...draft, groceries: checkGroceryItem(draft.groceries, item.line, event.target.checked) })}/><span className={item.checked ? 'cc-grocery-checked' : ''}>{item.label}</span></label>])}
            {!groceries.length && <p className="cc-muted">Add an item below, or type your list in Grocery notes, one item per line.</p>}
            {groceryNotes(draft.groceries).length > 0 && <ul className="cc-grocery-notes" aria-label="Shopping notes">{groceryNotes(draft.groceries).map(note => <li key={note.line}>{note.text}</li>)}</ul>}
            <form className="cc-grocery-add" onSubmit={event => { event.preventDefault(); const item = newItem.trim(); if (!item) return; try { edit({ ...draft, groceries: appendGroceryItems(draft.groceries, [item]) }); setNewItem(''); setAddError(''); } catch (failure) { setAddError(failure instanceof Error ? failure.message : 'That item could not be added.'); } }}><label className="cc-sr-only" htmlFor="cc-grocery-new">Add a grocery item</label><input id="cc-grocery-new" maxLength={300} value={newItem} placeholder="Add an item, e.g. 2 avocados" enterKeyHint="done" onChange={event => { setNewItem(event.target.value); setAddError(''); }}/><button type="submit" className="cc-secondary" disabled={!newItem.trim()}>Add</button></form>
            {addError && <p role="alert" className="cc-error cc-small">{addError}</p>}
          </div>
          {(() => { const showText = textOpen || !groceries.length; return <div className="cc-grocery-text">
            {groceries.length > 0 && <button type="button" className="cc-text-button cc-grocery-text-toggle" aria-expanded={showText} aria-controls="cc-grocery-text" onClick={() => setTextOpen(!showText)}>Edit list as text<span aria-hidden="true">▾</span></button>}
            {showText && <div id="cc-grocery-text">
              <label>Grocery notes<textarea rows={groceries.length ? 6 : 8} maxLength={10000} value={draft.groceries} placeholder="Food, quantity, and shopping notes — one item per line" onFocus={() => setTextOpen(true)} onChange={event => edit({ ...draft, groceries: event.target.value })}/></label>
              <p className="cc-muted cc-small">One item per line. Lines starting with “Notes:” stay notes. Your quantities and checked items are kept.</p>
            </div>}
          </div>; })()}
          {!draft.meals.length && <p className="cc-muted">Grocery notes save with a meal plan. <button type="button" className="cc-text-button" onClick={toPlan}>Create your meal plan first</button></p>}
        </>;
          return both ? <div className="cc-plan-split"><div className="cc-plan-col" role="group" aria-labelledby="cc-plan-col-plan"><h4 id="cc-plan-col-plan" className="cc-plan-col-title">Meal plan</h4>{planPart}</div><div className="cc-plan-col" role="group" aria-labelledby="cc-plan-col-groceries"><h4 id="cc-plan-col-groceries" className="cc-plan-col-title">Groceries</h4>{groceryPart}</div></div> : section === 'plan' ? planPart : groceryPart; })()}
      </fieldset>
      {dirty && validation && !pending && <p className="cc-muted cc-small">{validation}</p>}
      <div className="cc-plan-actions"><button type="button" className="cc-primary" disabled={busy || latest !== undefined || (!pending && (!dirty || !!validation))} onClick={() => void save()}>{busy ? 'Confirming saved plan…' : pending ? 'Retry same plan save' : 'Save plan & groceries'}</button></div>
    </>}
  </section>;
}
