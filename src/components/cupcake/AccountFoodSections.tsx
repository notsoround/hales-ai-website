import { Children, cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ACCOUNT_SESSIONS } from './accountMode';
import { NutritionWorkspace, type NutritionWorkspaceProps } from './NutritionWorkspace';
import { AccountPhotoMeal } from './AccountPhotoMeal';
import { AccountManualMeal } from './AccountManualMeal';
import { AccountFoodPlan } from './AccountFoodPlan';
import ReceiptWorkspace from './ReceiptWorkspace';
import './account-food-plan.css';
import { FOOD_CAMERA_REQUESTED, MEAL_PHOTO_QUEUED, pendingCaptureKind, RECEIPT_PHOTO_QUEUED } from './accountMealPhotoHandoff';
import { LocalCapturePhotos } from './camera/LocalCapturePhotos';

const OPEN_RECEIPTS_EVENT = 'cc-open-food-receipts';
const FOOD_LOG_FOCUSED_EVENT = 'cc-food-log-focused';

type Section = 'log' | 'plan' | 'groceries' | 'receipts';
const phoneSections: ReadonlyArray<{ key: Section; label: string }> = [
  { key: 'log', label: 'Food log' },
  { key: 'plan', label: 'Meal plan' },
  { key: 'groceries', label: 'Groceries' },
  { key: 'receipts', label: 'Receipts' },
];
// Desktop has room for the plan and the grocery list together, so they share one tab and one draft.
const desktopSections: ReadonlyArray<{ key: Section; label: string }> = [
  { key: 'log', label: 'Food log' },
  { key: 'plan', label: 'Plan & groceries' },
  { key: 'receipts', label: 'Receipts' },
];
const DESKTOP = '(min-width: 1024px)';
function useDesktop() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(DESKTOP).matches);
  useEffect(() => {
    const query = window.matchMedia?.(DESKTOP); if (!query) return;
    const update = () => setWide(query.matches); update();
    query.addEventListener('change', update); return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}
/** Compose the pinned page's existing controls into the account Food workspace. */
function arrangeFoodLog(children: ReactNode, active: boolean) {
  const parts = Children.toArray(children);
  const calendar = parts.find(part => isValidElement<NutritionWorkspaceProps>(part) && part.type === NutritionWorkspace);
  if (!isValidElement<NutritionWorkspaceProps>(calendar)) return children;
  const capture = parts.filter(part => isValidElement(part) && (part.type === AccountPhotoMeal || part.type === AccountManualMeal));
  const review = parts.find(part => isValidElement<{ 'aria-label'?: string }>(part) && part.type === 'section' && part.props['aria-label'] === 'Photos to check');
  return <>
    {cloneElement(calendar, {
      foodLogActive: active,
      logControls: capture.map(part => isValidElement<{ compact?: boolean }>(part) ? cloneElement(part, { compact: true }) : part),
      reviewQueue: review,
      reviewFirst: !!review && review === parts[0],
    })}
    {parts.filter(part => part !== calendar && part !== review && !capture.includes(part))}
  </>;
}

function FoodSections({ children, onOpenReceipts }: { children: ReactNode; onOpenReceipts?: () => void }) {
  const id = useId(), buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const wide = useDesktop(), sections = wide ? desktopSections : phoneSections, count = sections.length;
  const atReceipts = () => {
    const p = new URLSearchParams(location.search);
    return p.get('tab') === 'snap' && p.get('view') === 'receipts';
  };
  const [chosen, setSection] = useState<Section>(() => atReceipts() || pendingCaptureKind() === 'receipt' ? 'receipts' : 'log');
  const section: Section = wide && chosen === 'groceries' ? 'plan' : chosen;
  const [planOpened, setPlanOpened] = useState(false);
  const [receiptsOpened, setReceiptsOpened] = useState(chosen === 'receipts');
  const choose = useCallback((key: Section, writeHistory = true) => {
    setSection(key);
    if (key === 'plan' || key === 'groceries') setPlanOpened(true);
    if (key === 'receipts') setReceiptsOpened(true);
    if (writeHistory) {
      const url = new URL(location.href);
      if (key === 'receipts') url.searchParams.set('view', 'receipts');
      else if (url.searchParams.get('view') === 'receipts') {
        for (const param of ['view', 'receipt', 'transaction', 'receiptTab']) url.searchParams.delete(param);
      }
      if (url.href !== location.href) history.pushState(history.state, '', url);
    }
    if (key === 'log' && receiptsOpened) window.dispatchEvent(new Event(FOOD_LOG_FOCUSED_EVENT));
  }, [receiptsOpened]);
  const focusTab = useCallback((key: Section) => {
    const index = sections.findIndex(item => item.key === key);
    if (index >= 0) buttons.current[index]?.focus();
  }, [sections]);
  useEffect(() => {
    const onOpen = () => {
      if (onOpenReceipts) { onOpenReceipts(); return; }
      choose('receipts');
      requestAnimationFrame(() => focusTab('receipts'));
    };
    window.addEventListener(OPEN_RECEIPTS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_RECEIPTS_EVENT, onOpen);
  }, [choose, focusTab, onOpenReceipts]);
  useEffect(() => {
    const receipt = () => {
      const url = new URL(location.href);
      url.searchParams.set('view','receipts');
      for (const key of ['receipt','transaction','receiptTab']) url.searchParams.delete(key);
      if (url.href !== location.href) {
        history.pushState(history.state, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      choose('receipts', false);
    };
    const log = () => choose('log');
    const restore = () => choose(atReceipts() ? 'receipts' : 'log', false);
    if (pendingCaptureKind() === 'receipt') receipt();
    window.addEventListener(RECEIPT_PHOTO_QUEUED, receipt);
    window.addEventListener(MEAL_PHOTO_QUEUED, log);
    window.addEventListener(FOOD_CAMERA_REQUESTED, log);
    window.addEventListener('popstate', restore);
    return () => {
      window.removeEventListener(RECEIPT_PHOTO_QUEUED, receipt);
      window.removeEventListener(MEAL_PHOTO_QUEUED, log);
      window.removeEventListener(FOOD_CAMERA_REQUESTED, log);
      window.removeEventListener('popstate', restore);
    };
  }, [choose]);
  return <>
    <div className="cc-food-sections" role="tablist" aria-label="Food sections">{sections.map((item, index) => <button key={item.key} ref={node => { buttons.current[index] = node; }} id={`${id}-${item.key}`} aria-controls={`${id}-panel-${item.key}`} type="button" role="tab" aria-selected={section === item.key} tabIndex={section === item.key ? 0 : -1} onClick={() => choose(item.key)} onKeyDown={event => { const next = event.key === 'ArrowRight' ? (index + 1) % count : event.key === 'ArrowLeft' ? (index + count - 1) % count : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : -1; if (next >= 0) { event.preventDefault(); choose(sections[next].key); buttons.current[next]?.focus(); } }}>{item.label}</button>)}</div>
    <div className="space-y-4 nx-food-log-stack" id={`${id}-panel-log`} role="tabpanel" aria-labelledby={`${id}-log`} hidden={section !== 'log'}>{arrangeFoodLog(children, section === 'log')}</div>
    {planOpened && <div id={`${id}-panel-${section === 'groceries' ? 'groceries' : 'plan'}`} role="tabpanel" aria-labelledby={`${id}-${section === 'groceries' ? 'groceries' : 'plan'}`} hidden={section !== 'plan' && section !== 'groceries'}><AccountFoodPlan section={wide ? 'both' : section === 'groceries' ? 'groceries' : 'plan'} onPlan={() => choose('plan')} onGroceries={() => { choose('groceries'); focusTab('groceries'); }} onReceipts={() => { choose('receipts'); focusTab('receipts'); }}/></div>}
    {receiptsOpened && <div id={`${id}-panel-receipts`} role="tabpanel" aria-labelledby={`${id}-receipts`} hidden={section !== 'receipts'}><ReceiptWorkspace active={section === 'receipts'} /></div>}
    <LocalCapturePhotos/>
  </>;
}
export function AccountFoodSections({ children, onOpenReceipts }: { children: ReactNode; onOpenReceipts?: () => void }) { return ACCOUNT_SESSIONS ? <FoodSections onOpenReceipts={onOpenReceipts}>{children}</FoodSections> : <>{children}</>; }
