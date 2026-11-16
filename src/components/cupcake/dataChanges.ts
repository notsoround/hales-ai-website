import { useEffect, useRef } from 'react';

/** Screens that show account data listen here, so a change confirmed elsewhere (for example a
 *  suggestion saved from the assistant chat) shows up straight away without a page reload. */
export type DataArea = 'food' | 'exercise' | 'weight' | 'plan' | 'outcome' | 'workout-plan' | 'purchase' | 'glucose';
const EVENT = 'cupcake-account-data-changed';
export function notifyDataChanged(area: DataArea) {
  window.dispatchEvent(new CustomEvent<DataArea>(EVENT, { detail: area }));
}
/** Everything may be stale (the connection came back, or the app was reopened after a while): each listener reloads once. */
export function notifyAllDataChanged() {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: '*' }));
}
/** Call `reload` whenever one of `areas` changes. The latest callback is always used. */
export function useDataChanged(areas: readonly DataArea[], reload: () => void) {
  const latest = useRef(reload); latest.current = reload;
  const key = areas.join(' ');
  useEffect(() => {
    const wanted = new Set(key.split(' '));
    const listener = (event: Event) => { const area = (event as CustomEvent<string>).detail; if (area === '*' || wanted.has(area)) latest.current(); };
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  }, [key]);
}
