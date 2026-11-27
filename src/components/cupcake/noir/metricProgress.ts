export type DialState = 'normal' | 'near-target' | 'at-target' | 'over-target' | 'milestone' | 'empty';

export function calorieState(eaten: number, target: number | null): DialState {
  if (target === null || target <= 0) return 'normal';
  if (eaten > target) return 'over-target';
  if (eaten === target) return 'at-target';
  return eaten >= target * 0.9 ? 'near-target' : 'normal';
}

export function stepInk(fraction: number | null): string {
  if (fraction === null) return 'var(--nx-ink-3)';
  if (fraction >= 1) return 'var(--nx-warm)';
  const firstHalf = fraction < 0.5;
  const from = firstHalf ? 'var(--nx-a2)' : 'var(--nx-a)';
  const to = firstHalf ? 'var(--nx-a)' : 'var(--nx-warm)';
  const mix = Math.round((firstHalf ? fraction : fraction - 0.5) * 200);
  return `color-mix(in oklab, ${from}, ${to} ${mix}%)`;
}
