export type MealTimeFields = { month: string; day: string; year: string; hour: string; minute: string; period: 'AM' | 'PM' | '' };

export function localMealDate(now = new Date()): Pick<MealTimeFields, 'month' | 'day' | 'year'> {
  return { month: String(now.getMonth() + 1), day: String(now.getDate()), year: String(now.getFullYear()) };
}

/** Interpret the entered clock time on this device, never as a UTC calendar date. */
export function parseMealTime(fields: MealTimeFields, now = new Date()): { consumedAt: string; error: string } {
  const { month, day, year, hour, minute, period } = fields;
  if (![month, day, year, hour, minute, period].every(value => value.trim())) return { consumedAt: '', error: 'Choose the date, hour, minutes, and AM or PM when you ate.' };
  if (![month, day, year, hour, minute].every(value => /^\d+$/.test(value)) || year.length !== 4) return { consumedAt: '', error: 'Use numbers for the date and time, with a four-digit year.' };
  const [mo, d, y, h, m] = [month, day, year, hour, minute].map(Number);
  if (!['AM', 'PM'].includes(period) || y < 2000 || mo < 1 || mo > 12 || d < 1 || d > 31 || h < 1 || h > 12 || m < 0 || m > 59) return { consumedAt: '', error: 'Check the date and time. Use a year from 2000 onward, hours 1–12, and minutes 00–59.' };
  const hour24 = h % 12 + (period === 'PM' ? 12 : 0);
  const date = new Date(y, mo - 1, d, hour24, m, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d || date.getHours() !== hour24 || date.getMinutes() !== m) return { consumedAt: '', error: 'That date or local clock time does not exist. Check it and try again.' };
  if (date.getTime() > now.getTime()) return { consumedAt: '', error: 'Choose a time no later than now.' };
  return { consumedAt: date.toISOString(), error: '' };
}
