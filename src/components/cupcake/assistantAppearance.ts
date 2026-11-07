import { matchesPersonalStorageKey, personalStorage } from './personalStorage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ACCOUNT_SESSIONS } from './accountMode';
import { accountData, AccountRequestError, sessionSnapshot } from './accountSession';

export type Appearance = 'caribbean' | 'rose';
export type Persona = 'cupcake' | 'matthieu';
type Preferences = { appearance: Appearance; persona: Persona; name: string };
type AccountPreferences = { preferences: Preferences; revision: number; updated: number | null; saved: boolean };
type Persistence = { mode: 'browser' | 'account'; editable: boolean; message: string; retry?: () => void };
export type AssistantAppearanceState = Preferences & {
  setAppearance: (appearance: Appearance) => void;
  setPersona: (persona: Persona) => void;
  setName: (name: string) => void;
  persistence: Persistence;
};

const STORAGE_KEY = 'cupcake-assistant-appearance-v1';
const defaults: Preferences = { appearance: 'caribbean', persona: 'cupcake', name: 'Cupcake' };
const defaultName = (persona: Persona) => persona === 'matthieu' ? 'Matthieu' : 'Cupcake';
const cleanName = (name: string) => Array.from(name).filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127).join('').slice(0, 24);
const cleanAccountName = (name: string) => Array.from(name).filter(char => !/\p{C}/u.test(char)).slice(0, 24).join('');
const accountName = (name: string, persona: Persona) => cleanAccountName(name).trim() || defaultName(persona);
const equal = (left: Preferences, right: Preferences) => left.appearance === right.appearance && left.persona === right.persona && left.name === right.name;

function readPreferences(): Preferences {
  try {
    const value: unknown = JSON.parse(personalStorage('localStorage').getItem(STORAGE_KEY) || 'null');
    if (!value || typeof value !== 'object') return defaults;
    const saved = value as Partial<Preferences>;
    const persona: Persona = saved.persona === 'matthieu' ? 'matthieu' : 'cupcake';
    return {
      appearance: saved.appearance === 'rose' ? 'rose' : 'caribbean', persona,
      name: typeof saved.name === 'string' && saved.name.trim() ? cleanName(saved.name) : defaultName(persona),
    };
  } catch { return defaults; }
}
function confirmedRecord(value: AccountPreferences): AccountPreferences {
  const p = value?.preferences;
  if (!p || !['caribbean', 'rose'].includes(p.appearance) || !['cupcake', 'matthieu'].includes(p.persona)
      || typeof p.name !== 'string' || !p.name.trim() || p.name !== accountName(p.name, p.persona)
      || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.saved !== 'boolean'
      || !(value.updated === null || (typeof value.updated === 'number' && Number.isFinite(value.updated) && value.updated >= 0))
      || (value.saved ? value.revision < 1 || value.updated === null : value.revision !== 0 || value.updated !== null)) {
    throw Error('Cupcake did not confirm your saved assistant preferences.');
  }
  return { ...value, preferences: { ...p } };
}

/** Presentation preferences never select an account or authorize an action. */
export function useAssistantAppearance(): AssistantAppearanceState {
  const [preferences, setPreferences] = useState<Preferences>(() => ACCOUNT_SESSIONS ? defaults : readPreferences());
  const [persistence, setPersistence] = useState<Persistence>({ mode: ACCOUNT_SESSIONS ? 'account' : 'browser', editable: !ACCOUNT_SESSIONS, message: ACCOUNT_SESSIONS ? 'Loading your account preferences…' : 'Saved in this browser when device storage is available.' });
  const generation = useRef(sessionSnapshot().generation).current;
  const mounted = useRef(false), editable = useRef(!ACCOUNT_SESSIONS), saving = useRef(false);
  const desired = useRef(preferences), confirmed = useRef<AccountPreferences | null>(null);
  const loadSequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const loadRef = useRef<(conflict?: boolean) => Promise<void>>(async () => {});
  const active = useCallback(() => mounted.current && (!ACCOUNT_SESSIONS || generation === sessionSnapshot().generation), [generation]);
  const cancelLoads = useCallback(() => { loadSequence.current++; }, []);
  const cancelTimer = useCallback(() => { clearTimeout(timer.current); timer.current = undefined; }, []);
  const schedule = useCallback(() => { cancelTimer(); timer.current = setTimeout(() => { void saveRef.current(); }, 500); }, [cancelTimer]);

  loadRef.current = async (conflict = false) => {
    if (!active()) return;
    const sequence = ++loadSequence.current;
    cancelTimer(); editable.current = false;
    setPersistence({ mode:'account', editable:false, message:conflict ? 'Preferences changed elsewhere. Loading the latest settings…' : 'Loading your account preferences…' });
    try {
      const record = confirmedRecord(await accountData<AccountPreferences>({action:'persona_get'}));
      if (!active() || sequence !== loadSequence.current) return;
      confirmed.current = record; desired.current = record.preferences; editable.current = true;
      setPreferences(record.preferences);
      setPersistence({ mode:'account', editable:true, message:conflict ? 'Preferences changed elsewhere. The latest settings are loaded; your unsaved changes were not applied.' : record.saved ? 'Saved to your account.' : 'Account defaults. Changes will save to your account.' });
    } catch {
      if (active() && sequence === loadSequence.current) setPersistence({ mode:'account', editable:false, message:conflict ? 'Preferences changed elsewhere, but the latest settings could not load. Editing is paused.' : 'Your account preferences could not load. Editing is paused; nothing was saved in this browser.', retry:() => { void loadRef.current(conflict); } });
    }
  };
  saveRef.current = async () => {
    if (!active() || !editable.current || saving.current || !confirmed.current) return;
    cancelTimer();
    const target = { ...desired.current, name:accountName(desired.current.name, desired.current.persona) };
    if (equal(target, confirmed.current.preferences)) {
      desired.current = target; setPreferences(target);
      setPersistence({mode:'account',editable:true,message:confirmed.current.saved ? 'Saved to your account.' : 'Account defaults. Changes will save to your account.'});
      return;
    }
    saving.current = true;
    setPersistence({mode:'account',editable:true,message:'Saving to your account…'});
    let continueSaving = false;
    try {
      const record = confirmedRecord(await accountData<AccountPreferences>({action:'persona_save',preferences:target,revision:confirmed.current.revision}));
      if (!active()) return;
      if (!record.saved || record.revision <= confirmed.current.revision || !equal(record.preferences, target)) throw Error('The updated preferences were not confirmed.');
      confirmed.current = record;
      // An edit made during this request stays pending and uses the new revision.
      const latest = { ...desired.current, name:accountName(desired.current.name, desired.current.persona) };
      continueSaving = !equal(latest, target);
      if (!continueSaving) { desired.current = record.preferences; setPreferences(record.preferences); }
      setPersistence({mode:'account',editable:true,message:continueSaving ? 'Saving to your account…' : 'Saved to your account.'});
    } catch (error) {
      if (!active()) return;
      cancelTimer();
      if (error instanceof AccountRequestError && error.code === 'persona_conflict') {
        // Never retry stale edits against a newer revision automatically.
        await loadRef.current(true);
      } else {
        setPersistence({mode:'account',editable:true,message:'Could not save to your account. Your changes are unsaved; retry before leaving.',retry:() => { void saveRef.current(); }});
      }
    } finally {
      saving.current = false;
      if (continueSaving && active()) schedule();
    }
  };

  useEffect(() => {
    mounted.current = true;
    editable.current = !ACCOUNT_SESSIONS;
    if (ACCOUNT_SESSIONS) void loadRef.current();
    return () => { mounted.current = false; editable.current = false; cancelLoads(); cancelTimer(); };
  }, [cancelLoads, cancelTimer]);
  useEffect(() => {
    if (ACCOUNT_SESSIONS) return;
    try { personalStorage('localStorage').setItem(STORAGE_KEY, JSON.stringify(preferences)); }
    catch { /* Legacy appearance remains usable if browser storage is unavailable. */ }
  }, [preferences]);
  useEffect(() => {
    if (ACCOUNT_SESSIONS) return;
    const onStorage = (event: StorageEvent) => {
      if (matchesPersonalStorageKey(event.key,STORAGE_KEY)) { const next = readPreferences(); desired.current = next; setPreferences(next); }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const change = useCallback((update: (current: Preferences) => Preferences) => {
    if (!active() || !editable.current) return;
    const next = update(desired.current); desired.current = next; setPreferences(next);
    if (ACCOUNT_SESSIONS) { setPersistence({mode:'account',editable:true,message:'Saving to your account…'}); schedule(); }
  }, [active, schedule]);
  const setAppearance = useCallback((appearance: Appearance) => change(current => ({ ...current, appearance:appearance === 'rose' ? 'rose' : 'caribbean' })), [change]);
  const setPersona = useCallback((persona: Persona) => change(current => {
    const next: Persona = persona === 'matthieu' ? 'matthieu' : 'cupcake';
    return { ...current, persona:next, name:current.name === defaultName(current.persona) ? defaultName(next) : current.name };
  }), [change]);
  const setName = useCallback((name: string) => change(current => ({ ...current, name:ACCOUNT_SESSIONS ? cleanAccountName(name) : cleanName(name) })), [change]);
  return { ...preferences, setAppearance, setPersona, setName, persistence };
}
