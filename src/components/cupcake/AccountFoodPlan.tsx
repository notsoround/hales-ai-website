import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Minus, Package, Plus, Receipt, RotateCcw, Sparkles, X } from 'lucide-react';
import { libraryRequest } from './library';
import { AccountRequestError } from './accountSession';
import { personalStorage } from './personalStorage';
import { draftPlan, matchTodayMealsToPlan, parseMealPlan, planDraft, planDraftError, readPlanRecovery, rebasePlanDraft, samePlan, suggestForMealSlot, PLAN_DRAFT_KEY, type MealPlan, type PlanDraft, type PlanIntent } from './foodPlanModel';
import './account-food-plan.css';
import './noir/noir-plan.css';
import { parsePlanText } from './planImport';
import { useLab } from './labsFlags';
import { useDataChanged } from './dataChanges';
import { appConfirm } from './appConfirm';
import { AccountPlanBuilder } from './AccountPlanBuilder';
import { useNutritionSnapshot } from './nutritionApi';
import { mealTimeLabel, nutritionDay, nutritionDays } from './nutritionModel';
import {
  GROCERY_CATEGORIES,
  PANTRY_CHANGED_EVENT,
  addPantryItem,
  appendCategorizedGroceries,
  appendGroceryItems,
  buildGroceryAiTriagePrompt,
  checkGroceryItem,
  estimatePantryWithMeals,
  groceryHeadings,
  groceryItems,
  groceryNotes,
  markPantryItemUsed,
  mergeRemotePantry,
  missingGroceryItems,
  parseAiTriagedGroceries,
  readPantryItems,
  registerPantryStorage,
  removePantryItem,
  restockPantryItem,
  triageGroceryText,
  type PantryItem,
  type TriagedGroceryItem,
} from './groceryChecklist';

registerPantryStorage(personalStorage);

function receiptsTabHref() {
  if (typeof location === 'undefined') return '?tab=library&view=receipts';
  const url = new URL(location.href);
  url.search = new URLSearchParams({ tab: 'library', view: 'receipts' }).toString();
  url.hash = '';
  return url.pathname + url.search;
}

/** `both` (desktop) shows the meal plan and groceries side by side from one draft and one save. */
export function AccountFoodPlan({ section, onPlan, onGroceries, onReceipts }: { section: 'plan' | 'groceries' | 'both'; onPlan: () => void; onGroceries?: () => void; onReceipts?: () => void }) {
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
  // A saved plan opens as a plan to read; the form appears on Edit, or by itself when there is nothing saved or a draft is in progress.
  const [editingPlan, setEditingPlan] = useState(false);
  const planBuilder = useLab('plan-builder');
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [choosingItems, setChoosingItems] = useState(false), [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [shoppingError, setShoppingError] = useState('');
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);
  const [smartImportText, setSmartImportText] = useState(''), [excludedTriaged, setExcludedTriaged] = useState<string[]>([]);
  const [smartImportNotice, setSmartImportNotice] = useState('');
  const [aiTriaged, setAiTriaged] = useState<{ items: TriagedGroceryItem[]; pantryNotes: string[] } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const [pantry, setPantry] = useState<PantryItem[]>(() => readPantryItems());
  const [newPantryItem, setNewPantryItem] = useState('');
  const nutritionSnapshot = useNutritionSnapshot();
  useEffect(() => {
    const syncPantry = () => setPantry(readPantryItems());
    window.addEventListener(PANTRY_CHANGED_EVENT, syncPantry);
    return () => window.removeEventListener(PANTRY_CHANGED_EVENT, syncPantry);
  }, []);
  const syncPantryRemote = (next: PantryItem[]) => {
    setPantry(next);
    void libraryRequest({ action: 'coach_plan_set', kind: 'pantry', value: { items: next } }).catch(() => { /* Keep local pantry when server pantry kind is not enabled yet. */ });
  };
  const checklistHeading = useRef<HTMLHeadingElement>(null), focusChecklist = useRef(false);
  const both = section === 'both', planTitle = useRef<HTMLInputElement>(null), shopHeading = useRef<HTMLHeadingElement>(null);
  // Side by side, both halves are already on screen: move focus instead of switching sections.
  const toPlan = both ? () => { setEditingPlan(true); requestAnimationFrame(() => planTitle.current?.focus()); } : onPlan;
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
  const reading = !editingPlan && !pending && samePlan(value.meals, base?.meals || []) && !!base?.meals.length;
  const plannedKcal = draft.meals.reduce((sum, meal) => sum + (meal.kcal.trim() && Number.isFinite(Number(meal.kcal)) ? Number(meal.kcal) : 0), 0), unknownKcal = draft.meals.filter(meal => !meal.kcal.trim()).length;
  const checkedCount = groceries.filter(item => item.checked).length;

  const today = nutritionDay();
  const todayLoggedMeals = useMemo(() => {
    if (!nutritionSnapshot.history?.meals.length) return [];
    return nutritionDays(nutritionSnapshot.history.meals, [today], nutritionSnapshot.settings)[0]?.meals || [];
  }, [nutritionSnapshot.history, nutritionSnapshot.settings, today]);
  const todayLoggedKcal = useMemo(
    () => Math.round(todayLoggedMeals.reduce((sum, meal) => sum + (typeof meal.total?.calories === 'number' && Number.isFinite(meal.total.calories) ? meal.total.calories : 0), 0)),
    [todayLoggedMeals],
  );
  const slotTracking = useMemo(
    () => matchTodayMealsToPlan(
      draft.meals.map(meal => ({ name: meal.name, kcal: meal.kcal.trim() && Number.isFinite(Number(meal.kcal)) ? Number(meal.kcal) : null })),
      todayLoggedMeals,
    ),
    [draft.meals, todayLoggedMeals],
  );

  const localTriagedPreview = useMemo(() => triageGroceryText(smartImportText), [smartImportText]);
  const triagedPreview = aiTriaged?.items ?? localTriagedPreview;
  const activeTriaged = useMemo(() => triagedPreview.filter(item => !excludedTriaged.includes(item.id)), [triagedPreview, excludedTriaged]);
  const estimatedPantry = useMemo(() => estimatePantryWithMeals(pantry, nutritionSnapshot.history?.meals || []), [pantry, nutritionSnapshot.history]);
  const runningLowItems = useMemo(() => estimatedPantry.filter(item => item.status === 'low'), [estimatedPantry]);
  const missingLowLabels = useMemo(() => missingGroceryItems(draft.groceries, runningLowItems.map(item => item.name)), [draft.groceries, runningLowItems]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    const request = ++generation.current; setBusy(true); setError('');
    try {
      const response = await libraryRequest<{ plan: { meal_plan?: unknown; pantry?: unknown } }>({ action: 'coach_plan_get' });
      if (generation.current !== request) return;
      if (response.plan.pantry !== undefined) setPantry(mergeRemotePantry(response.plan.pantry));
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
  const useLatest = async () => {
    if (latest === undefined || !await appConfirm('Replace this unsaved draft with the latest saved plan?', { title: 'Use the saved plan?', yes: 'Replace draft', danger: true })) return;
    try { storage.removeItem(PLAN_DRAFT_KEY); setBase(latest); setDraft(planDraft(latest)); setPending(null); setLatest(undefined); setNotice('Latest saved plan loaded.'); setError(''); }
    catch { setError('The browser could not clear this draft. Try again.'); }
  };
  const keepDraft = async () => {
    if (latest === undefined || !await appConfirm('Keep your meal and grocery edits for a new save over the latest version? Review both sections first.', { title: 'Keep your draft?', yes: 'Keep my edits' })) return;
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
    <div className="cc-heading-row"><h3>{both ? 'Your meal plan & groceries' : section === 'plan' ? 'Your meal plan' : 'Your groceries'}</h3><button type="button" className="cc-secondary nx-plan-reload" disabled={busy} onClick={() => void refresh()}>Reload saved plan</button></div>
    <p className="cc-muted nx-plan-intro">{both ? 'Plan meals in your own words and shop for them. This reference plan is separate from meals you actually ate.' : section === 'plan' ? 'Plan meals in your own words. This reference plan is separate from meals you actually ate.' : 'Keep your grocery list and shopping notes with your meal plan.'}</p>
    {!loaded && !error && <p role="status">Loading your saved plan…</p>}
    {error && <p role="alert" className="cc-error">{error}</p>}
    {notice && <p role="status" className="cc-muted">{notice}</p>}
    {latest !== undefined && <aside className="cc-card cc-plan-conflict"><strong>Latest saved version · draft kept</strong><p>{latest?.title || (latest ? 'Untitled meal plan' : 'No saved meal plan')}</p>{latest?.meals.map((meal, index) => <p key={index}>{meal.name}: {meal.items.join(' · ')}</p>)}<p className="cc-plan-text">{latest?.groceries || 'No grocery notes saved.'}</p><div className="cc-plan-actions"><button type="button" className="cc-secondary" disabled={busy} onClick={useLatest}>Use latest saved version</button><button type="button" className="cc-secondary" disabled={busy} onClick={keepDraft}>Keep my draft for a new save</button></div></aside>}
    {loaded && <>
      <p className="cc-plan-save-state" role="status">{pending ? 'Save unconfirmed · original request kept for retry' : dirty ? 'Unsaved changes · draft kept in this browser tab' : base ? 'Saved plan loaded from your account' : 'No saved meal plan yet'}</p>
      <fieldset disabled={busy || !!pending} className="cc-plan-fields">
        {(() => { const addItemsToDraft = (labels: string[], sourceLabel: string) => {
          if (busy || pending || !labels.length) return;
          try {
            const missing = missingGroceryItems(draft.groceries, labels);
            if (!missing.length) { setNotice('Those items are already on your grocery list.'); return; }
            const nextGroceries = appendGroceryItems(draft.groceries, missing);
            edit({ ...draft, groceries: nextGroceries });
            setNotice(`Added ${missing.length} ${missing.length === 1 ? 'item' : 'items'} from ${sourceLabel} to your grocery draft. Save plan & groceries when ready.`);
          } catch (cause) { setShoppingError(cause instanceof Error ? cause.message : 'These items could not be added.'); }
        };
        const applySmartImport = () => {
          if (busy || pending || !activeTriaged.length) return;
          try {
            const nextGroceries = appendCategorizedGroceries(draft.groceries, activeTriaged);
            if (nextGroceries === draft.groceries) { setSmartImportNotice('All parsed items are already on your list.'); return; }
            edit({ ...draft, groceries: nextGroceries });
            const addedCount = activeTriaged.length;
            setSmartImportText(''); setExcludedTriaged([]); setAiTriaged(null); setAiError('');
            setSmartImportNotice(`Triaged & added ${addedCount} ${addedCount === 1 ? 'item' : 'items'} to your grocery draft. Review below, then Save plan & groceries.`);
          } catch (cause) { setSmartImportNotice(cause instanceof Error ? cause.message : 'Could not import these items.'); }
        };
        const runAiTriage = async () => {
          if (busy || pending || aiBusy || !smartImportText.trim()) return;
          setAiBusy(true); setAiError(''); setSmartImportNotice('');
          try {
            const threadId = crypto.randomUUID();
            const stockedNames = estimatedPantry.filter(item => item.status === 'stocked').map(item => item.name);
            const activeNames = groceries.filter(item => !item.checked).map(item => item.label);
            const prompt = buildGroceryAiTriagePrompt(smartImportText, stockedNames, activeNames);
            await libraryRequest({ action: 'quick_chat_create', threadId, title: 'Grocery list triage' });
            let thread = (await libraryRequest<{ thread: { id: string; turns: { status: string; error?: string; response?: { reply: string } }[] } }>({
              action: 'quick_chat_begin', threadId, turnId: crypto.randomUUID(), text: prompt, parentTurnId: null,
            })).thread;
            for (let attempt = 0; attempt < 8 && mountedRef.current; attempt++) {
              const turn = thread.turns[thread.turns.length - 1];
              if (!turn || turn.response?.reply || !['queued', 'running'].includes(turn.status)) break;
              await new Promise(resolve => window.setTimeout(resolve, Math.min(4000, 1500 + attempt * 400)));
              if (!mountedRef.current) return;
              thread = (await libraryRequest<{ thread: typeof thread }>({ action: 'quick_chat_get', threadId })).thread;
            }
            if (!mountedRef.current) return;
            const lastTurn = thread.turns[thread.turns.length - 1];
            const reply = lastTurn?.response?.reply;
            if (!reply) {
              setAiError(lastTurn?.error?.startsWith('account_budget') ? 'No assistant allowance left right now. Quick local categories remain ready above.' : 'Cupcake did not finish organizing this list. Quick local categories remain ready above.');
              return;
            }
            const parsed = parseAiTriagedGroceries(reply);
            if (!parsed.items.length) {
              setAiError('No grocery items were recognized in Cupcake’s reply. Quick local categories remain ready above.');
              return;
            }
            setAiTriaged(parsed);
            setExcludedTriaged([]);
          } catch (cause) {
            if (!mountedRef.current) return;
            if (cause instanceof AccountRequestError && /not_ready|disabled|unavailable/.test(cause.code)) {
              setAiError('Assistant triage is not turned on for this account yet. Quick local categories remain ready above.');
            } else {
              setAiError(cause instanceof Error ? cause.message : 'Assistant triage is unavailable right now. Quick local categories remain ready above.');
            }
          } finally {
            if (mountedRef.current) setAiBusy(false);
          }
        };
        const planPart = reading ? <div className="nx-plan-read">
          <header><div><h4>{draft.title || 'Meal plan'}</h4><p>{plannedKcal > 0 ? `${Math.round(plannedKcal).toLocaleString('en-US')} kcal planned` : `${draft.meals.length} planned ${draft.meals.length === 1 ? 'meal' : 'meals'}`}{plannedKcal > 0 && unknownKcal > 0 ? ` · ${unknownKcal} without calories` : ''}{todayLoggedMeals.length > 0 ? ` · ${todayLoggedKcal.toLocaleString('en-US')} logged today` : ''}</p></div>
            <button type="button" className="cc-secondary nx-plan-edit" onClick={() => { setEditingPlan(true); requestAnimationFrame(() => planTitle.current?.focus()); }}>Edit plan</button></header>
          <ol>{draft.meals.map((meal, index) => {
            const track = slotTracking[index];
            const isOpen = expandedSlot === index;
            const slotItems = meal.items.split('\n').map(item => item.trim()).filter(Boolean);
            const targetVal = meal.kcal.trim() && Number.isFinite(Number(meal.kcal)) ? Number(meal.kcal) : null;
            const slotIdeas = isOpen ? suggestForMealSlot({ name: meal.name, items: slotItems, kcal: targetVal }, track?.deltaKcal) : [];
            const pct = track?.progress != null ? Math.min(100, Math.round(track.progress * 100)) : 0;
            return <li key={index} className={`nx-plan-slot${isOpen ? ' is-open' : ''}${track?.status === 'over' ? ' is-over' : ''}`}>
              <button type="button" className="nx-plan-slot-btn" aria-expanded={isOpen} onClick={() => setExpandedSlot(isOpen ? null : index)}>
                <div className="nx-plan-slot-main">
                  <div className="nx-plan-slot-title">
                    <strong>{meal.name}</strong>
                    {track?.status === 'over' && <span className="nx-slot-badge is-over"><AlertTriangle size={12} aria-hidden="true" />+{Math.abs(track.deltaKcal!).toLocaleString('en-US')} kcal over</span>}
                    {track?.status === 'hit' && <span className="nx-slot-badge is-hit">On target</span>}
                    {track?.status === 'on_track' && track.deltaKcal != null && <span className="nx-slot-badge is-track">{track.deltaKcal.toLocaleString('en-US')} kcal left</span>}
                    {track?.status === 'logged_no_target' && <span className="nx-slot-badge is-track">{track.loggedKcal.toLocaleString('en-US')} kcal logged</span>}
                  </div>
                  <span className="nx-plan-slot-items">{slotItems.join(' · ')}</span>
                  {track && track.loggedMeals.length > 0 && track.targetKcal != null && (
                    <span className="nx-slot-bar" aria-hidden="true"><i className={track.status === 'over' ? 'is-over' : undefined} style={{ width: `${pct}%` }} /></span>
                  )}
                </div>
                <span className="nx-plan-slot-right">
                  {targetVal !== null ? <b>{Math.round(targetVal).toLocaleString('en-US')}<small>kcal</small></b> : <b className="is-unknown">—</b>}
                  <ChevronDown size={15} aria-hidden="true" className="nx-slot-chev" />
                </span>
              </button>
              {isOpen && <div className="nx-slot-drawer">
                {track && track.loggedMeals.length > 0 && <div className={`nx-slot-logged${track.status === 'over' ? ' is-over' : ''}`}>
                  <div className="nx-slot-logged-head">
                    <span>Logged today ({track.loggedKcal.toLocaleString('en-US')} kcal{track.targetKcal ? ` / ${Math.round(track.targetKcal).toLocaleString('en-US')} target` : ''})</span>
                    {track.status === 'over' && <strong>Exceeded target by {Math.abs(track.deltaKcal!).toLocaleString('en-US')} kcal</strong>}
                    {track.status === 'on_track' && track.deltaKcal != null && <strong>{track.deltaKcal.toLocaleString('en-US')} kcal remaining</strong>}
                  </div>
                  <ul>{track.loggedMeals.map(logged => <li key={logged.id}><span>{logged.description}</span><small>{mealTimeLabel(logged.consumedAt, false)} · {typeof logged.total?.calories === 'number' ? `${Math.round(logged.total.calories)} kcal` : 'kcal unknown'}</small></li>)}</ul>
                </div>}
                <div className="nx-slot-ideas-head">
                  <span>{track?.status === 'on_track' && track.deltaKcal && track.deltaKcal >= 100 && track.deltaKcal < (targetVal || 0) - 40 ? `Ideas to finish this slot (~${track.deltaKcal} kcal left)` : targetVal ? `Calorie-matched ideas (~${Math.round(targetVal)} kcal)` : `Balanced ideas for ${meal.name}`}</span>
                </div>
                <div className="nx-slot-ideas">
                  {slotIdeas.map(idea => {
                    const missing = missingGroceryItems(draft.groceries, idea.items);
                    return <article key={idea.id} className={`nx-slot-idea${idea.fromPlan ? ' is-plan' : ''}`}>
                      <div className="nx-slot-idea-top">
                        <div>
                          {idea.fromPlan && <span className="nx-slot-idea-tag">Your plan</span>}
                          <h5>{idea.title}</h5>
                          <p>{idea.subtitle}</p>
                        </div>
                        <span className="nx-slot-idea-kcal">~{idea.kcal}<small>kcal</small></span>
                      </div>
                      <div className="nx-slot-idea-foot">
                        <span className="nx-slot-macros">{idea.proteinG}g P · {idea.carbsG}g C · {idea.fatG}g F</span>
                        <button type="button" className="nx-slot-add-btn" disabled={!missing.length} onClick={() => addItemsToDraft(idea.items, idea.title)}>{missing.length ? `+ ${missing.length} to groceries` : 'On list'}</button>
                      </div>
                    </article>;
                  })}
                </div>
              </div>}
            </li>;
          })}</ol>
          {toGroceries && suggestions.length > 0 && <button type="button" className="cc-plan-to-groceries" onClick={toGroceries}><span><strong>Shop this plan</strong><small>{suggestions.length} planned {suggestions.length === 1 ? 'item isn’t' : 'items aren’t'} on your grocery list yet</small></span><span aria-hidden="true">→</span></button>}
        </div> : <>
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
          <p className="cc-muted cc-small nx-plan-hint">Up to 10 meals. Enter planned calories only when you know them; otherwise leave them blank.</p>
          {toGroceries && suggestions.length > 0 && <button type="button" className="cc-plan-to-groceries" onClick={toGroceries}><span><strong>Shop this plan</strong><small>{suggestions.length} planned {suggestions.length === 1 ? 'item isn’t' : 'items aren’t'} on your grocery list yet</small></span><span aria-hidden="true">→</span></button>}
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

          <details className="nx-smart-import">
            <summary><Sparkles size={15} aria-hidden="true" /><span>Smart import · paste a list or notes</span></summary>
            <div className="nx-smart-import-body">
              <p className="cc-muted cc-small">Paste texts, Robyn’s notes, or a rough list. Items are automatically sorted into Produce, Protein, Dairy, Pantry, Household, and Notes.</p>
              <label>Paste unstructured list<textarea rows={4} maxLength={6000} value={smartImportText} placeholder={'Hey grab chicken breast, 2 avocados, Greek yogurt, oats, paper towels, and remind me to check olive oil'} onChange={event => { setSmartImportText(event.target.value); setExcludedTriaged([]); setSmartImportNotice(''); setAiTriaged(null); setAiError(''); }} /></label>
              {triagedPreview.length > 0 && <div className="nx-triage-preview" aria-label="Triaged grocery preview">
                {aiTriaged && <div className="nx-triage-ai-head"><small>Organized by Cupcake</small><button type="button" className="cc-text-button" onClick={() => { setAiTriaged(null); setExcludedTriaged([]); }}>Reset to quick parse</button></div>}
                {GROCERY_CATEGORIES.map(category => {
                  const group = triagedPreview.filter(item => item.category === category);
                  if (!group.length) return null;
                  return <div key={category} className="nx-triage-group">
                    <small>{category}</small>
                    <div className="nx-triage-chips">{group.map(item => {
                      const kept = !excludedTriaged.includes(item.id);
                      return <button key={item.id} type="button" className={`nx-triage-chip${kept ? ' is-kept' : ''}`} aria-pressed={kept} onClick={() => setExcludedTriaged(curr => curr.includes(item.id) ? curr.filter(id => id !== item.id) : [...curr, item.id])}>
                        <span>{item.label}</span>
                      </button>;
                    })}</div>
                  </div>;
                })}
                <div className="nx-triage-actions">
                  <button type="button" className="cc-secondary nx-triage-apply" disabled={!activeTriaged.length || aiBusy} onClick={applySmartImport}>Add {activeTriaged.length} categorized {activeTriaged.length === 1 ? 'item' : 'items'} to grocery draft</button>
                  <button type="button" className="nx-triage-ai-btn" disabled={!smartImportText.trim() || aiBusy} onClick={() => void runAiTriage()}><Sparkles size={14} aria-hidden="true" /><span>{aiBusy ? 'Cupcake is organizing…' : 'AI triage with Cupcake'}</span></button>
                </div>
              </div>}
              {aiError && <p role="status" className="cc-muted cc-small">{aiError}</p>}
              {smartImportNotice && <p role="status" className="cc-muted cc-small">{smartImportNotice}</p>}
            </div>
          </details>

          <div className="cc-grocery-checklist" aria-label="Grocery checklist">
            <div className="cc-heading-row"><h4 ref={checklistHeading} tabIndex={-1} className="cc-shopping-heading">Shopping checklist</h4><span className="cc-muted cc-small">{checkedCount} of {groceries.length} checked</span></div>
            {groceries.length > 0 && <div className="nx-grocery-progress" aria-hidden="true"><i style={{ width: `${checkedCount / groceries.length * 100}%` }}/></div>}
            <p className="cc-muted cc-small nx-plan-intro">Check off items as you shop, then Save plan &amp; groceries.</p>
            {groceries.flatMap(item => [...groceryHeadings(draft.groceries).filter(heading => heading.line < item.line && !groceries.some(other => other.line < item.line && other.line > heading.line) ).map(heading => <p className="cc-grocery-section" key={`h${heading.line}`}>{heading.label}</p>), <label className="cc-grocery-item" key={item.line}><input type="checkbox" checked={item.checked} onChange={event => edit({ ...draft, groceries: checkGroceryItem(draft.groceries, item.line, event.target.checked) })}/><span className={item.checked ? 'cc-grocery-checked' : ''}>{item.label}</span></label>])}
            {!groceries.length && <p className="cc-muted">Add an item below, or type your list in Grocery notes, one item per line.</p>}
            {groceryNotes(draft.groceries).length > 0 && <ul className="cc-grocery-notes" aria-label="Shopping notes">{groceryNotes(draft.groceries).map(note => <li key={note.line}>{note.text}</li>)}</ul>}
            <form className="cc-grocery-add" onSubmit={event => { event.preventDefault(); const item = newItem.trim(); if (!item) return; try { edit({ ...draft, groceries: appendGroceryItems(draft.groceries, [item]) }); setNewItem(''); setAddError(''); } catch (failure) { setAddError(failure instanceof Error ? failure.message : 'That item could not be added.'); } }}><label className="cc-sr-only" htmlFor="cc-grocery-new">Add a grocery item</label><input id="cc-grocery-new" maxLength={300} value={newItem} placeholder="Add an item, e.g. 2 avocados" enterKeyHint="done" onChange={event => { setNewItem(event.target.value); setAddError(''); }}/><button type="submit" className="cc-secondary" disabled={!newItem.trim()}>Add</button></form>
            {addError && <p role="alert" className="cc-error cc-small">{addError}</p>}
          </div>

          <section className="nx-pantry" aria-label="Household pantry">
            <div className="nx-pantry-head">
              <div>
                <h4><Package size={15} aria-hidden="true" />Household pantry</h4>
                <small>Estimated local inventory · updates as receipts are routed &amp; meals are logged</small>
              </div>
              {onReceipts ? <button type="button" className="nx-pantry-receipts-link" onClick={onReceipts}><Receipt size={14} aria-hidden="true" />Receipts</button>
                : <a className="nx-pantry-receipts-link" href={receiptsTabHref()}><Receipt size={14} aria-hidden="true" />Receipts</a>}
            </div>
            {missingLowLabels.length > 0 && <div className="nx-pantry-low-banner" role="region" aria-label="Running low items">
              <div>
                <strong>Running low ({missingLowLabels.length})</strong>
                <span>{missingLowLabels.slice(0, 4).join(', ')}{missingLowLabels.length > 4 ? ` +${missingLowLabels.length - 4} more` : ''}</span>
              </div>
              <button type="button" className="nx-pantry-low-btn" onClick={() => addItemsToDraft(missingLowLabels, 'running-low pantry')}>Add to shopping list</button>
            </div>}
            {estimatedPantry.length > 0 ? <ul className="nx-pantry-list">{estimatedPantry.map(item => {
              const alreadyOnList = !missingGroceryItems(draft.groceries, [item.name]).length;
              return <li key={item.id} className={item.status === 'low' ? 'is-low' : undefined}>
                <div className="nx-pantry-item-info">
                  <strong>{item.name}</strong>
                  <small>{item.category} · {item.status === 'low' ? 'Running low' : `~${item.estimatedRemaining} left`}{item.sourceMerchant ? ` · ${item.sourceMerchant}` : ''}{item.matchedMealsCount > 0 ? ` · −${item.matchedMealsCount} from meals` : ''}</small>
                </div>
                <div className="nx-pantry-item-actions">
                  {item.status === 'low' && !alreadyOnList && <button type="button" className="nx-pantry-pill" onClick={() => addItemsToDraft([item.name], 'pantry')}><Plus size={12} aria-hidden="true" />List</button>}
                  <button type="button" className="nx-pantry-icon-btn" aria-label={`Use one serving of ${item.name}`} title="Mark 1 used" onClick={() => syncPantryRemote(markPantryItemUsed(item.id, 1))}><Minus size={13} aria-hidden="true" /></button>
                  {item.status === 'low' && <button type="button" className="nx-pantry-icon-btn" aria-label={`Restock ${item.name}`} title="Restocked" onClick={() => syncPantryRemote(restockPantryItem(item.id))}><RotateCcw size={13} aria-hidden="true" /></button>}
                  <button type="button" className="nx-pantry-icon-btn" aria-label={`Remove ${item.name} from pantry`} title="Remove" onClick={() => syncPantryRemote(removePantryItem(item.id))}><X size={13} aria-hidden="true" /></button>
                </div>
              </li>;
            })}</ul> : <p className="cc-muted cc-small">Route a confirmed grocery receipt from Receipts or add staples on hand below.</p>}
            <form className="nx-pantry-add" onSubmit={event => { event.preventDefault(); const label = newPantryItem.trim(); if (!label) return; syncPantryRemote(addPantryItem(label)); setNewPantryItem(''); }}>
              <label className="cc-sr-only" htmlFor="nx-pantry-new">Add pantry staple</label>
              <input id="nx-pantry-new" maxLength={120} value={newPantryItem} placeholder="Add staple, e.g. eggs" onChange={event => setNewPantryItem(event.target.value)} />
              <button type="submit" className="cc-secondary" disabled={!newPantryItem.trim()}>Stock</button>
            </form>
          </section>

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
      <div className={`cc-plan-actions nx-plan-save${dirty || pending ? ' is-dirty' : ''}`}><button type="button" className="cc-primary" disabled={busy || latest !== undefined || (!pending && (!dirty || !!validation))} onClick={() => void save()}>{busy ? 'Confirming saved plan…' : pending ? 'Retry same plan save' : 'Save plan & groceries'}</button></div>
    </>}
  </section>;
}
