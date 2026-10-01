import { useId, useState } from 'react';
import { localMealDate, parseMealTime, type MealTimeFields } from './mealTime';
import { CalendarDateFields } from './CalendarDateFields';
import './meal-time.css';

export function MealTimeInput({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId();
  const [mode, setMode] = useState<'now' | 'custom' | null>(null);
  const [fields, setFields] = useState<MealTimeFields>(() => ({ ...localMealDate(), hour: '', minute: '', period: '' }));
  const [error, setError] = useState('');
  const edit = (updated: MealTimeFields) => {
    setFields(updated);
    const parsed = parseMealTime(updated);
    setError(parsed.error);
    onChange(parsed.consumedAt);
  };
  const chooseDay = (offset: number) => {
    const day = new Date(); day.setDate(day.getDate() + offset);
    setMode('custom');
    const updated = { ...fields, ...localMealDate(day) };
    setFields(updated); setError(''); onChange(parseMealTime(updated).consumedAt);
  };

  return <fieldset className="cc-meal-time" disabled={disabled}>
    <legend>When did you eat it?</legend>
    <div className="cc-meal-time-choices">
      <button type="button" className="cc-secondary" aria-pressed={mode === 'now'} onClick={() => { setMode('now'); setError(''); onChange(new Date().toISOString()); }}>Ate just now</button>
      <button type="button" className="cc-secondary" onClick={() => chooseDay(0)}>Today</button>
      <button type="button" className="cc-secondary" onClick={() => chooseDay(-1)}>Yesterday</button>
      <button type="button" className="cc-secondary" aria-pressed={mode === 'custom'} onClick={() => { if (mode !== 'custom') { setMode('custom'); setFields({ ...localMealDate(), hour: '', minute: '', period: '' }); setError(''); onChange(''); } }}>Choose date &amp; time</button>
    </div>
    {mode === 'custom' && <>
      <CalendarDateFields value={fields} onChange={date => edit({ ...fields, ...date })} label="Meal date" />
      <div className="cc-meal-clock-fields">
        <label htmlFor={`${id}-hour`}>Hour<select id={`${id}-hour`} value={fields.hour} onChange={e => edit({ ...fields, hour: e.target.value })}><option value="">Choose</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}</select></label>
        <label htmlFor={`${id}-minute`}>Minutes<select id={`${id}-minute`} value={fields.minute} onChange={e => edit({ ...fields, minute: e.target.value })}><option value="">Choose</option>{Array.from({ length: 60 }, (_, i) => <option key={i} value={String(i)}>{String(i).padStart(2, '0')}</option>)}</select></label>
        <label htmlFor={`${id}-period`}>AM / PM<select id={`${id}-period`} value={fields.period} onChange={e => edit({ ...fields, period: e.target.value as MealTimeFields['period'] })}><option value="">Choose</option><option>AM</option><option>PM</option></select></label>
      </div>
    </>}
    <p id={`${id}-help`} className="cc-meal-time-help">{mode === 'custom' ? 'Tap each list to choose a date and time. No keyboard needed. ' : ''}Uses this device’s local time.</p>
    {error && <p id={`${id}-error`} className="cc-meal-time-error" role="status">{error}</p>}
    {value && <p className="cc-meal-time-selected" role="status">Meal time: {new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>}
  </fieldset>;
}
