import { useId } from 'react';
import type { MealTimeFields } from './mealTime';

export type CalendarDate = Pick<MealTimeFields, 'month' | 'day' | 'year'>;
function changeCalendarDate(value: CalendarDate, key: keyof CalendarDate, next: string): CalendarDate {
  const updated = { ...value, [key]: next };
  const lastDay = new Date(Number(updated.year), Number(updated.month), 0).getDate();
  return { ...updated, day: String(Math.min(Number(updated.day), lastDay)) };
}

/** Native option lists work on touch screens without opening a text keyboard. */
export function CalendarDateFields({ value, onChange, label = 'Date' }: { value: CalendarDate; onChange: (value: CalendarDate) => void; label?: string }) {
  const id = useId();
  const thisYear = new Date().getFullYear();
  const days = new Date(Number(value.year), Number(value.month), 0).getDate();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return <div className="cc-meal-date-fields" role="group" aria-label={label}>
    <label htmlFor={`${id}-month`}>Month<select id={`${id}-month`} value={value.month} onChange={e => onChange(changeCalendarDate(value, 'month', e.target.value))}>{months.map((month, i) => <option key={month} value={String(i + 1)}>{month}</option>)}</select></label>
    <label htmlFor={`${id}-day`}>Day<select id={`${id}-day`} value={value.day} onChange={e => onChange(changeCalendarDate(value, 'day', e.target.value))}>{Array.from({ length: days }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}</select></label>
    <label htmlFor={`${id}-year`}>Year<select id={`${id}-year`} value={value.year} onChange={e => onChange(changeCalendarDate(value, 'year', e.target.value))}>{Array.from({ length: thisYear - 1999 }, (_, i) => <option key={i} value={String(thisYear - i)}>{thisYear - i}</option>)}</select></label>
  </div>;
}
