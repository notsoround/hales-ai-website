import { matchesPersonalStorageKey, personalStorage } from './personalStorage';
import { useCallback, useEffect, useState } from 'react';

export type Appearance = 'caribbean' | 'rose';
export type Persona = 'cupcake' | 'matthieu';
export type AssistantAppearanceState = {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  persona: Persona;
  setPersona: (persona: Persona) => void;
  name: string;
  setName: (name: string) => void;
};

type Preferences = { appearance: Appearance; persona: Persona; name: string };
const STORAGE_KEY = 'cupcake-assistant-appearance-v1';
const defaults: Preferences = { appearance: 'caribbean', persona: 'cupcake', name: 'Cupcake' };
const defaultName = (persona: Persona) => persona === 'matthieu' ? 'Matthieu' : 'Cupcake';
const cleanName = (name: string) => Array.from(name).filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127).join('').slice(0, 24);

function readPreferences(): Preferences {
  try {
    const value: unknown = JSON.parse(personalStorage('localStorage').getItem(STORAGE_KEY) || 'null');
    if (!value || typeof value !== 'object') return defaults;
    const saved = value as Partial<Preferences>;
    const persona: Persona = saved.persona === 'matthieu' ? 'matthieu' : 'cupcake';
    return {
      appearance: saved.appearance === 'rose' ? 'rose' : 'caribbean',
      persona,
      name: typeof saved.name === 'string' && saved.name.trim() ? cleanName(saved.name) : defaultName(persona),
    };
  } catch { return defaults; }
}

/** Presentation preferences only: never selects an account, changes access, or enters an API request. */
export function useAssistantAppearance(): AssistantAppearanceState {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  useEffect(() => {
    try { personalStorage('localStorage').setItem(STORAGE_KEY, JSON.stringify(preferences)); }
    catch { /* Appearance remains usable for this session if browser storage is unavailable. */ }
  }, [preferences]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (matchesPersonalStorageKey(event.key,STORAGE_KEY)) setPreferences(readPreferences());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const setAppearance = useCallback((appearance: Appearance) => {
    setPreferences(current => ({ ...current, appearance: appearance === 'rose' ? 'rose' : 'caribbean' }));
  }, []);
  const setPersona = useCallback((persona: Persona) => {
    setPreferences(current => {
      const next: Persona = persona === 'matthieu' ? 'matthieu' : 'cupcake';
      return { ...current, persona: next, name: current.name === defaultName(current.persona) ? defaultName(next) : current.name };
    });
  }, []);
  const setName = useCallback((name: string) => {
    setPreferences(current => ({ ...current, name: cleanName(name) }));
  }, []);
  return { ...preferences, setAppearance, setPersona, setName };
}
