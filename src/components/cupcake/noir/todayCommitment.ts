/** Owner-scoped daily "One Commitment" storage for the Tier 6 Today hero lever.
 *  Stored cleanly via personalStorage so different signed-in accounts stay strictly isolated. */
import { useEffect, useState } from 'react';
import { personalStorage } from '../personalStorage';

export interface TodayCommitment {
  day: string;
  text: string;
  done: boolean;
  updatedAt: number;
}

const KEY = 'cc-noir-commitment-v1';
const EVENT = 'cc-commitment-changed';
const MAX_LEN = 80;

function emitChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function readTodayCommitment(day: string): TodayCommitment | null {
  if (!day) return null;
  try {
    const raw = personalStorage('localStorage').getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TodayCommitment> | null;
    if (!parsed || parsed.day !== day || typeof parsed.text !== 'string') return null;
    const text = parsed.text.trim().slice(0, MAX_LEN);
    if (!text) return null;
    return {
      day,
      text,
      done: Boolean(parsed.done),
      updatedAt: typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveTodayCommitment(day: string, text: string, done = false): TodayCommitment | null {
  const clean = text.trim().slice(0, MAX_LEN);
  if (!day || !clean) return null;
  const entry: TodayCommitment = { day, text: clean, done: Boolean(done), updatedAt: Date.now() };
  try {
    personalStorage('localStorage').setItem(KEY, JSON.stringify(entry));
    emitChange();
    return entry;
  } catch {
    return null;
  }
}

export function toggleTodayCommitment(day: string): TodayCommitment | null {
  const cur = readTodayCommitment(day);
  if (!cur) return null;
  return saveTodayCommitment(day, cur.text, !cur.done);
}

export function clearTodayCommitment(): void {
  try {
    personalStorage('localStorage').removeItem(KEY);
    emitChange();
  } catch {
    /* ignore storage unavailable */
  }
}

export function useTodayCommitment(day: string) {
  const [commitment, setCommitment] = useState<TodayCommitment | null>(() => readTodayCommitment(day));

  useEffect(() => {
    setCommitment(readTodayCommitment(day));
    if (typeof window === 'undefined') return;
    const sync = () => setCommitment(readTodayCommitment(day));
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.endsWith(`:${KEY}`) || event.key === KEY) sync();
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, [day]);

  return {
    commitment,
    commit: (text: string) => saveTodayCommitment(day, text, false),
    toggleDone: () => toggleTodayCommitment(day),
    clear: () => clearTodayCommitment(),
  };
}
