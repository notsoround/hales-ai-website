/** Meal name from the local time of day, used when the caller doesn't pass one. */
export function mealForTime(date: Date): string {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 4 * 60 && minutes < 10 * 60 + 30) return 'Breakfast';
  if (minutes >= 10 * 60 + 30 && minutes < 15 * 60) return 'Lunch';
  if (minutes >= 17 * 60 && minutes < 21 * 60 + 30) return 'Dinner';
  return 'Snack';
}

export function clockTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
}

export const wholeNumber = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
