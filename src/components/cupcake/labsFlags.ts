import { useSyncExternalStore } from 'react';
import { personalStorage } from './personalStorage';

/** Labs: unfinished account-app features. Every flag is OFF unless the signed-in person
 *  turns it on in Settings → Labs. Stored per account on this device only. */
export const LABS = [
  { key: 'plan-builder', label: 'Build a plan by talking with the assistant', detail: 'Adds “Build it with the assistant” under Food → Meal plan → Paste or upload a plan. The assistant drafts meals from what you tell it; you review them before anything is saved. It cannot search the web yet.' },
  { key: 'assistant-actions', label: 'Let the assistant suggest changes', detail: 'In the Assistant chat, ask it to log a meal, a workout or a weight, add groceries, record a win or setback, write your meal or workout plan, change a meal’s portion, remove a logged workout, or mark a purchase. Each change appears as a card with the exact details; nothing changes until you tap. While this is on, the assistant also sees your recent meals, workouts and purchases and your current plans and groceries.' },
  { key: 'workout-plan', label: 'Weekly workout plan', detail: 'Adds a Workout plan card to Today. Paste or upload a routine, or build one by talking with the assistant; you review it before anything is saved. It cannot search the web yet.' },
  { key: 'web-search', label: 'Web search in the plan builders', detail: 'Adds a “Search the web” button to “Build it with the assistant”. Only the words you type go to the search, never your logs or health details. Pick the results you want the assistant to use. Up to 10 searches a day; the server switch must also be on.' },
] as const;
export type LabKey = typeof LABS[number]['key'];
const EVENT = 'cupcake-labs-change', storageKey = (key: LabKey) => `cupcake-labs-${key}`;

export function readLab(key: LabKey): boolean {
  try { return personalStorage('localStorage').getItem(storageKey(key)) === '1'; } catch { return false; }
}
export function writeLab(key: LabKey, on: boolean): boolean {
  try { const store = personalStorage('localStorage'); if (on) store.setItem(storageKey(key), '1'); else store.removeItem(storageKey(key)); }
  catch { return false; }
  window.dispatchEvent(new Event(EVENT)); return true;
}
const subscribe = (notify: () => void) => {
  window.addEventListener(EVENT, notify); window.addEventListener('storage', notify);
  return () => { window.removeEventListener(EVENT, notify); window.removeEventListener('storage', notify); };
};
export function useLab(key: LabKey): boolean { return useSyncExternalStore(subscribe, () => readLab(key), () => false); }
