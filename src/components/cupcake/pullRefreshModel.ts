/** Pure rules for pull to refresh on Today (installed account app only). No DOM, no React, so tests can run them in Node. */

/** Finger travel is halved so the pull feels weighted; the indicator never moves further than this. */
export const PULL_MAX = 96;
/** Pulled this far (after resistance), letting go refreshes. */
export const PULL_TRIGGER = 64;
/** Travel before the gesture is judged as a pull or something else (a scroll, a chart scrub). */
export const PULL_SLOP = 10;

export type PullPhase = 'idle' | 'pull' | 'armed' | 'refreshing';

/** Distance the indicator follows for a downward finger travel of `dy` CSS pixels. */
export function pullDistance(dy: number): number {
  if (!Number.isFinite(dy) || dy <= 0) return 0;
  return Math.min(PULL_MAX, Math.round(dy * 0.5));
}

export function pullPhase(distance: number, refreshing: boolean): PullPhase {
  if (refreshing) return 'refreshing';
  if (distance <= 0) return 'idle';
  return distance >= PULL_TRIGGER ? 'armed' : 'pull';
}

/** After PULL_SLOP of travel: a clearly downward, mostly vertical move is a pull; anything else (sideways chart scrub, upward scroll) is not. */
export function judgeGesture(dx: number, dy: number): 'pending' | 'pull' | 'other' {
  if (Math.hypot(dx, dy) < PULL_SLOP) return 'pending';
  return dy > 0 && dy > Math.abs(dx) * 1.5 ? 'pull' : 'other';
}

export type PullGate = { accountSessions: boolean; standalone: boolean; layerOpen: boolean; atTop: boolean; refreshing: boolean };
/** A pull may start only in the account app, installed to the home screen, at the top of Today, with no sheet, dialog or camera open. */
export function canPull(g: PullGate): boolean {
  return g.accountSessions && g.standalone && !g.layerOpen && g.atTop && !g.refreshing;
}

type Queryable = { querySelector: (selector: string) => unknown };
/** Open layers: any registered through useBackClose (`counted`), plus native modal dialogs (the camera, meal details,
 *  the confirm sheet) and anything marked aria-modal (Settings while open). */
export const OPEN_LAYER_SELECTOR = 'dialog[open], [aria-modal="true"]';
export function openLayerPresent(root: Queryable | null | undefined, counted: number): boolean {
  if (counted > 0) return true;
  try { return !!root?.querySelector(OPEN_LAYER_SELECTOR); } catch { return false; }
}

export function pullLabel(phase: PullPhase): string {
  return phase === 'refreshing' ? 'Refreshing…' : phase === 'armed' ? 'Release to refresh' : 'Pull to refresh';
}
