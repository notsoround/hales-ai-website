// Calm / Hot accent preference for the Cupcake app, ported from cupcake-opolis
// ui/src/app/accent-heat.ts. Browser-local only. `calm` keeps the existing pink;
// `hot` swaps in the magenta set from cupcake-opolis styles/base.css via
// `:root[data-accent-heat="hot"] .cc-app` in accent-heat.css.
export type AccentHeat = 'calm' | 'hot';
export const ACCENT_HEAT_STORAGE_KEY = 'cupcake-accent-heat-v1';
export const ACCENT_HEAT_ATTRIBUTE = 'data-accent-heat';

export function normalizeAccentHeat(value: unknown): AccentHeat { return value === 'hot' ? 'hot' : 'calm'; }

function storage(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
export function loadAccentHeat(): AccentHeat { try { return normalizeAccentHeat(storage()?.getItem(ACCENT_HEAT_STORAGE_KEY)); } catch { return 'calm'; } }
export function saveAccentHeat(heat: AccentHeat): void { try { storage()?.setItem(ACCENT_HEAT_STORAGE_KEY, normalizeAccentHeat(heat)); } catch { /* attribute still applies for this tab */ } }
