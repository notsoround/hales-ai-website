import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { addDays } from '../nutritionModel';
import { stepsDayLabel, stepsSourceLabel, type StepsDay } from '../stepsApi';

const number = (value: number) => value.toLocaleString('en-US');

export function StepHistoryDisclosure({ today, days, selectedDate, onSelect }: {
  today: string; days: StepsDay[]; selectedDate: string; onSelect: (date: string) => void;
}) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const first = addDays(today, -period);
  // steps_list supplies one winning total per date. Excluding today keeps a partial day out of the average.
  const rows = days.filter(day => day.date >= first && day.date < today);
  const average = rows.length ? Math.round(rows.reduce((total, day) => total + day.count, 0) / rows.length) : null;
  const hasRolling = rows.some(day => day.windowBasis === 'trailing_24h_previous_day');
  const multipleSources = new Set(rows.map(day => day.winningSource ?? day.source)).size > 1;

  return (
    <details className="nx-step-history">
      <summary>
        <span>Step history</span>
        {average !== null && <small>{number(average)} avg · {period} days</small>}
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="nx-step-history-body">
        <div className="nx-step-history-range" role="group" aria-label="Average period">
          {([7, 30] as const).map(n => <button key={n} type="button" aria-pressed={n === period}
            onClick={() => setPeriod(n)}>{n} days</button>)}
        </div>
        <div className="nx-step-history-stat" aria-live="polite" aria-atomic="true">
          <span>Daily average</span>
          <strong>{average === null ? '—' : number(average)}{average !== null && <small> steps</small>}</strong>
          <p>{rows.length} of {period} days logged · Through yesterday</p>
        </div>
        {rows.length === 0 ? <p className="cc-muted">No step readings in this period.</p> : (
          <>
            {(hasRolling || multipleSources) && (
              <p className="nx-step-history-note">
                {hasRolling ? 'Includes rolling 24-hour readings. Select a date to see its source and time window.' : 'Step sources vary by date.'}
              </p>
            )}
            <ul className="nx-step-history-list" aria-label="Daily step readings">
              {rows.map(day => (
                <li key={day.date}>
                  <button type="button" onClick={() => onSelect(day.date)} aria-pressed={day.date === selectedDate}
                    aria-label={`View ${stepsDayLabel(day.date)}, ${number(day.count)} steps, ${stepsSourceLabel(day.winningSource ?? day.source)}`}>
                    <span>{stepsDayLabel(day.date)}</span>
                    <b>{number(day.count)}</b>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
