import { useSyncExternalStore } from 'react';
import { personalStorage } from './personalStorage';

/** Labs: unfinished account-app features. Every flag is OFF unless the signed-in person
 *  turns it on in Settings → Labs. Stored per account on this device only. */
export const LABS = [
  { key: 'plan-builder', label: 'Build a plan by talking with the assistant', detail: 'Adds “Build it with the assistant” under Food → Meal plan → Paste or upload a plan. The assistant drafts meals from what you tell it; you review them before anything is saved. It cannot search the web yet.' },
  { key: 'assistant-actions', label: 'Let the assistant suggest changes', detail: 'In the Assistant chat, ask it to log a meal, a workout or a weight, add groceries, record a win or setback, write your meal or workout plan, change a meal’s portion, remove a logged workout, or mark a purchase. Each change appears as a card with the exact details; nothing changes until you tap. While this is on, the assistant also sees your recent meals, workouts and purchases and your current plans and groceries.' },
  { key: 'workout-plan', label: 'Weekly workout plan', detail: 'Adds a Workout plan card to Today. Paste or upload a routine, or build one by talking with the assistant; you review it before anything is saved. It cannot search the web yet.' },
  { key: 'web-search', label: 'Web search in the plan builders', detail: 'Adds a “Search the web” button to “Build it with the assistant”. Only the words you type go to the search, never your logs or health details. Pick the results you want the assistant to use. Up to 10 searches a day; the server switch must also be on.' },
  { key: 'camera-quips', label: 'Live comments in the meal camera', detail: 'While the meal camera is open, the assistant guesses what it is looking at and reacts with a short line: food, a drink, “that’s not food”, or “say cheese” when someone is in frame. The guess runs on this device; the camera picture is never sent anywhere for it and nobody is identified. The first use downloads about 15 MB once.' },
  { key: 'voice-save-cards', label: 'Save cards from voice and phone calls', detail: 'After a live voice conversation or a phone call with Cupcake, open it (Saved voice conversations, or a call’s Recap under Phone calls) and tap “Get Save cards”. The assistant reads what you said, with the same app data the chat sees, and turns each meal, workout, weight, glucose reading, grocery, win or setback, plan or target you asked for into the same cards as the chat. Nothing changes until you tap Save on a card. Each tap uses a little of your reply allowance.' },
  { key: 'camera-autofile', label: 'Camera files photos for you', detail: 'When you open the camera from the Food button, Cupcake checks on this device whether the photo is a meal or a receipt, says what it thinks, and files it in the Food log or Receipts after a three-second countdown. One tap files it somewhere else instead. When it cannot tell, it asks you, as it does now. Nothing is sent anywhere for the check.' },
  { key: 'reply-reports', label: 'Report AI replies', detail: 'Adds a report button to saved AI replies in chat and saved voice conversations. Reports stay in Cupcake; no report is sent to a third party.' },
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
