import { useId, useState } from 'react';
import { localMealDate, parseMealTime, type MealTimeFields } from './mealTime';
import './meal-time.css';

export function MealTimeInput({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId();
  const [mode, setMode] = useState<'now' | 'custom' | null>(null);
  const [fields, setFields] = useState<MealTimeFields>(() => ({ ...localMealDate(), hour: '', minute: '', period: 'AM' }));
  const [error, setError] = useState('');
  const edit = (key: keyof MealTimeFields, next: string) => {
    const updated = { ...fields, [key]: next };
    setFields(updated);
    const parsed = parseMealTime(updated);
    setError(parsed.error);
    onChange(parsed.consumedAt);
  };
  const numberField = (key: 'month' | 'day' | 'year' | 'hour' | 'minute', label: string, placeholder: string, maxLength: number) => <label htmlFor={`${id}-${key}`}>{label}<input id={`${id}-${key}`} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={maxLength} placeholder={placeholder} value={fields[key]} onChange={event => edit(key, event.target.value)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} /></label>;

  return <fieldset className="cc-meal-time" disabled={disabled}>
    <legend>When did you eat it?</legend>
    <div className="cc-meal-time-choices">
      <button type="button" className="cc-secondary" aria-pressed={mode === 'now'} onClick={() => { setMode('now'); setError(''); onChange(new Date().toISOString()); }}>Ate just now</button>
      <button type="button" className="cc-secondary" aria-pressed={mode === 'custom'} onClick={() => { if (mode !== 'custom') { setMode('custom'); setFields({ ...localMealDate(), hour: '', minute: '', period: 'AM' }); setError(''); onChange(''); } }}>Choose date &amp; time</button>
    </div>
    {mode === 'custom' && <>
      <div className="cc-meal-date-fields">{numberField('month', 'Month', 'MM', 2)}{numberField('day', 'Day', 'DD', 2)}{numberField('year', 'Year', 'YYYY', 4)}</div>
      <div className="cc-meal-clock-fields">{numberField('hour', 'Hour', '1–12', 2)}{numberField('minute', 'Minutes', '00–59', 2)}<label htmlFor={`${id}-period`}>AM / PM<select id={`${id}-period`} value={fields.period} onChange={event => edit('period', event.target.value)}><option>AM</option><option>PM</option></select></label></div>
    </>}
    <p id={`${id}-help`} className="cc-meal-time-help">{mode === 'custom' ? 'Type the date and time using your keyboard. ' : ''}Uses this device’s local time.</p>
    {error && <p id={`${id}-error`} className="cc-meal-time-error" role="status">{error}</p>}
    {value && <p className="cc-meal-time-selected" role="status">Meal time: {new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>}
  </fieldset>;
}
