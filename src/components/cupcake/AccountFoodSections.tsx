import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ACCOUNT_SESSIONS } from './accountMode';
import { AccountFoodPlan } from './AccountFoodPlan';
import './account-food-plan.css';

type Section = 'log' | 'plan' | 'groceries';
const phoneSections: ReadonlyArray<{ key: Section; label: string }> = [{ key: 'log', label: 'Food log' }, { key: 'plan', label: 'Meal plan' }, { key: 'groceries', label: 'Groceries' }];
// Desktop has room for the plan and the grocery list together, so they share one tab and one draft.
const desktopSections: ReadonlyArray<{ key: Section; label: string }> = [{ key: 'log', label: 'Food log' }, { key: 'plan', label: 'Plan & groceries' }];
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
function FoodSections({ children }: { children: ReactNode }) {
  const id = useId(), buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const wide = useDesktop(), sections = wide ? desktopSections : phoneSections, count = sections.length;
  const [chosen, setSection] = useState<Section>('log');
  const section: Section = wide && chosen === 'groceries' ? 'plan' : chosen;
  const [opened, setOpened] = useState(false);
  const choose = (key: Section) => { setSection(key); if (key !== 'log') setOpened(true); };
  return <>
    <div className="cc-food-sections" role="tablist" aria-label="Food sections">{sections.map((item, index) => <button key={item.key} ref={node => { buttons.current[index] = node; }} id={`${id}-${item.key}`} aria-controls={`${id}-panel-${item.key}`} type="button" role="tab" aria-selected={section === item.key} tabIndex={section === item.key ? 0 : -1} onClick={() => choose(item.key)} onKeyDown={event => { const next = event.key === 'ArrowRight' ? (index + 1) % count : event.key === 'ArrowLeft' ? (index + count - 1) % count : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : -1; if (next >= 0) { event.preventDefault(); choose(sections[next].key); buttons.current[next]?.focus(); } }}>{item.label}</button>)}</div>
    <div className="space-y-4" id={`${id}-panel-log`} role="tabpanel" aria-labelledby={`${id}-log`} hidden={section !== 'log'}>{children}</div>
    {opened && <div id={`${id}-panel-${section === 'log' ? 'plan' : section}`} role="tabpanel" aria-labelledby={`${id}-${section === 'log' ? 'plan' : section}`} hidden={section === 'log'}><AccountFoodPlan section={wide ? 'both' : section === 'groceries' ? 'groceries' : 'plan'} onPlan={() => choose('plan')} onGroceries={() => { choose('groceries'); buttons.current[2]?.focus(); }}/></div>}
  </>;
}
export function AccountFoodSections({ children }: { children: ReactNode }) { return ACCOUNT_SESSIONS ? <FoodSections>{children}</FoodSections> : <>{children}</>; }
