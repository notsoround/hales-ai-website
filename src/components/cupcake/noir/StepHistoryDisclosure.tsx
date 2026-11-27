import { useEffect, useState } from 'react';
import { libraryRequest } from '../library';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { addDays } from '../nutritionModel';
import { isCompleteA55Day, listStepsDays, stepsDayLabel, stepsSourceLabel, type StepsDay } from '../stepsApi';

const number = (value: number) => value.toLocaleString('en-US');

export function StepHistoryDisclosure({ today, days, phoneAverage, selectedDate, onSelect }: {
  today: string; days: StepsDay[]; phoneAverage: boolean; selectedDate: string; onSelect: (day: StepsDay) => void;
}) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const first = addDays(today, -period);
  const olderStart = addDays(first, -30 * page);
  const olderEnd = addDays(olderStart, 29);
  const [archive, setArchive] = useState<{ start: string; days: StepsDay[] | null } | null>(null);
  useEffect(() => {
    if (!page) return;
    let current = true;
    listStepsDays(libraryRequest, olderStart, olderEnd).then(
      result => { if (current) setArchive({ start: olderStart, days: result }); },
      () => { if (current) setArchive({ start: olderStart, days: null }); },
    );
    return () => { current = false; };
  }, [page, olderStart, olderEnd, attempt]);
  // steps_list supplies one winning total per date. Excluding today keeps a partial day out of the average.
  const rows = days.filter(day => day.date >= first && day.date < today);
  const contributors = phoneAverage ? rows.filter(isCompleteA55Day) : rows;
  const logged = contributors.length;
  const loading = page > 0 && archive?.start !== olderStart;
  const failed = !loading && page > 0 && archive?.days === null;
  const visibleRows = page ? (archive?.start === olderStart ? archive.days ?? [] : []) : rows;
  const average = logged ? Math.round(contributors.reduce((total, day) => total + day.count, 0) / logged) : null;
  const hasRolling = rows.some(day => day.windowBasis === 'trailing_24h_previous_day');
  const hasPastDay = rows.some(day => day.windowBasis === 'reported_past_day_snapshot');
  const multipleSources = new Set(rows.map(day => day.winningSource ?? day.source)).size > 1;

  return (
    <details className="nx-step-history">
      <summary>
        <span>Step history</span>
        {average !== null && <small>{number(average)} avg · {logged < period ? `${logged} of ${period}` : period} days</small>}
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="nx-step-history-body">
        <div className="nx-step-history-range" role="group" aria-label="Average period">
          {([7, 30] as const).map(n => <button key={n} type="button" aria-pressed={n === period}
            onClick={() => { setPeriod(n); setPage(0); }}>{n} days</button>)}
        </div>
        <div className="nx-step-history-stat" aria-live="polite" aria-atomic="true">
          <span>{phoneAverage ? 'Galaxy A55 daily average' : 'Daily average'}</span>
          <strong>{average === null ? '—' : number(average)}{average !== null && <small> steps</small>}</strong>
          <p>{logged} of {period} {phoneAverage ? 'complete phone days' : 'days logged'} · Through yesterday</p>
        </div>
        {phoneAverage && logged < rows.length && <p className="nx-step-history-note">Only midnight-to-midnight A55 readings count toward this average. Select a date below to see its source.</p>}
        {!phoneAverage && (hasRolling || hasPastDay || multipleSources) && (
          <p className="nx-step-history-note">
            {hasRolling || hasPastDay
              ? `Includes ${hasRolling ? 'rolling 24-hour readings' : 'past-day snapshots'}. Select a date to see its source and time window.`
              : 'Step sources vary by date.'}
          </p>
        )}
        {page > 0 && <p className="nx-step-history-note">{stepsDayLabel(olderStart)} – {stepsDayLabel(olderEnd)}, {olderEnd.slice(0, 4)}</p>}
        {loading ? <p role="status" className="cc-muted">Loading earlier readings…</p> : failed ?
          <p role="status">Couldn’t load these dates. <button type="button" className="cc-text-button"
            onClick={() => { setArchive(null); setAttempt(n => n + 1); }}>Retry</button></p> :
          visibleRows.length === 0 ? <p className="cc-muted">No step readings in this period.</p> : (
            <ul className="nx-step-history-list" aria-label="Daily step readings">
              {visibleRows.map(day => (
                <li key={day.date}>
                  <button type="button" onClick={() => onSelect(day)} aria-pressed={day.date === selectedDate}
                    aria-label={`View ${stepsDayLabel(day.date)}, ${number(day.count)} steps, ${stepsSourceLabel(day.winningSource ?? day.source)}`}>
                    <span>{stepsDayLabel(day.date)}</span>
                    <b>{number(day.count)}</b>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
        )}
        <div className="nx-step-history-range" role="group" aria-label="Browse dated step history">
          <button type="button" onClick={() => setPage(n => n + 1)}>Earlier days</button>
          {page > 0 && <button type="button" onClick={() => setPage(n => n - 1)}>Newer days</button>}
        </div>
      </div>
    </details>
  );
}
