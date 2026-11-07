import { useId, useRef, useState, type ReactNode } from 'react';
import { ACCOUNT_SESSIONS } from './accountMode';
import { AccountFoodPlan } from './AccountFoodPlan';
import './account-food-plan.css';

const sections = [{ key: 'log', label: 'Food log' }, { key: 'plan', label: 'Meal plan' }, { key: 'groceries', label: 'Groceries' }] as const;
function FoodSections({ children }: { children: ReactNode }) {
  const id = useId(), buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [section, setSection] = useState<'log' | 'plan' | 'groceries'>('log');
  const [opened, setOpened] = useState(false);
  const choose = (key: typeof section) => { setSection(key); if (key !== 'log') setOpened(true); };
  return <>
    <div className="cc-food-sections" role="tablist" aria-label="Food sections">{sections.map((item, index) => <button key={item.key} ref={node => { buttons.current[index] = node; }} id={`${id}-${item.key}`} aria-controls={`${id}-panel-${item.key}`} type="button" role="tab" aria-selected={section === item.key} tabIndex={section === item.key ? 0 : -1} onClick={() => choose(item.key)} onKeyDown={event => { const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1; if (next >= 0) { event.preventDefault(); choose(sections[next].key); buttons.current[next]?.focus(); } }}>{item.label}</button>)}</div>
    <div className="space-y-4" id={`${id}-panel-log`} role="tabpanel" aria-labelledby={`${id}-log`} hidden={section !== 'log'}>{children}</div>
    {opened && <div id={`${id}-panel-${section === 'log' ? 'plan' : section}`} role="tabpanel" aria-labelledby={`${id}-${section === 'log' ? 'plan' : section}`} hidden={section === 'log'}><AccountFoodPlan section={section === 'groceries' ? 'groceries' : 'plan'} onPlan={() => choose('plan')}/></div>}
  </>;
}
export function AccountFoodSections({ children }: { children: ReactNode }) { return ACCOUNT_SESSIONS ? <FoodSections>{children}</FoodSections> : <>{children}</>; }
