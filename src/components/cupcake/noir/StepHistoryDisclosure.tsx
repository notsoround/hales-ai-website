import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { libraryRequest } from '../library';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { addDays } from '../nutritionModel';
import { isCompleteA55Day, listStepsDays, stepsDayLabel, stepsSourceLabel, type StepsDay } from '../stepsApi';

const number = (value: number) => value.toLocaleString('en-US');
const DAY_MS = 86400000;

type HistoryRow = { date: string; day: StepsDay | null; note: string };

/** Every date from end back to start (newest first), each with the reason it does or doesn't count. */
function historyRows(start: string, end: string, days: StepsDay[], phoneAverage: boolean, inAverage: boolean): HistoryRow[] {
  const byDate = new Map(days.map(day => [day.date, day]));
  const rows: HistoryRow[] = [];
  for (let date = end; date >= start; date = addDays(date, -1)) {
    const day = byDate.get(date) ?? null;
    rows.push({ date, day, note: rowNote(day, phoneAverage, inAverage) });
  }
  return rows;
}

// Mirrors the average below: the phone average keeps only isCompleteA55Day days; otherwise every reading counts.
function rowNote(day: StepsDay | null, phoneAverage: boolean, inAverage: boolean): string {
  if (!day) return inAverage ? 'No reading · not counted' : 'No reading';
  const source = stepsSourceLabel(day.winningSource ?? day.source);
  if (phoneAverage && day.source !== 'galaxy_a55') return inAverage ? `${source} · not in A55 average` : source;
  if (phoneAverage && !isCompleteA55Day(day)) return inAverage ? `${source} · partial day, not counted` : `${source} · partial day`;
  if (day.count === 0) return inAverage ? `${source} · reported zero, counted` : `${source} · reported zero`;
  return source;
}

export function StepHistoryDisclosure({ today, days, phoneAverage, selectedDate, onSelect }: {
  today: string; days: StepsDay[]; phoneAverage: boolean; selectedDate: string; onSelect: (day: StepsDay) => void;
}) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const first = addDays(today, -period);
  const yesterday = addDays(today, -1);
  const olderStart = addDays(first, -30 * page);
  const olderEnd = addDays(olderStart, 29);
  const [archive, setArchive] = useState<{ start: string; days: StepsDay[] | null } | null>(null);
  // After paging or jumping, bring the new page's date range (or the chosen date) into view.
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const rangeRef = useRef<HTMLParagraphElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!page) return;
    let current = true;
    listStepsDays(libraryRequest, olderStart, olderEnd).then(
      result => { if (current) setArchive({ start: olderStart, days: result }); },
      () => { if (current) setArchive({ start: olderStart, days: null }); },
    );
    return () => { current = false; };
  }, [page, olderStart, olderEnd, attempt]);
  // steps_list supplies one winning total per date (sources are never added together).
  // Excluding today keeps a partial day out of the average.
  const inWindow = days.filter(day => day.date >= first && day.date < today);
  const contributors = phoneAverage ? inWindow.filter(isCompleteA55Day) : inWindow;
  const logged = contributors.length;
  const loading = page > 0 && archive?.start !== olderStart;
  const failed = !loading && page > 0 && archive?.days === null;
  const pageDays = page ? (archive?.start === olderStart ? archive.days ?? [] : []) : inWindow;
  const visibleRows = page
    ? historyRows(olderStart, olderEnd, pageDays, phoneAverage, false)
    : historyRows(first, yesterday, pageDays, phoneAverage, true);
  const todayDay = page ? null : days.find(day => day.date === today) ?? null;
  const average = logged ? Math.round(contributors.reduce((total, day) => total + day.count, 0) / logged) : null;
  const hasRolling = inWindow.some(day => day.windowBasis === 'trailing_24h_previous_day');
  const hasPastDay = inWindow.some(day => day.windowBasis === 'reported_past_day_snapshot');
  const multipleSources = new Set(inWindow.map(day => day.winningSource ?? day.source)).size > 1;
  const windowLabel = `${stepsDayLabel(first)} – ${stepsDayLabel(yesterday)}`;
  const rangeLabel = page ? `${stepsDayLabel(olderStart)} – ${stepsDayLabel(olderEnd)}, ${olderEnd.slice(0, 4)}` : windowLabel;

  useLayoutEffect(() => {
    if (!focusTarget || loading) return;
    if (listRef.current) listRef.current.scrollTop = 0;
    const found = focusTarget === 'range' ? null : listRef.current?.querySelector<HTMLElement>(`[data-date="${focusTarget}"]`);
    const target = found ?? rangeRef.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: found ? 'nearest' : 'start' });
    setFocusTarget(null);
  }, [focusTarget, loading, page]);

  function goToPage(next: number, target = 'range') {
    setPage(next);
    setFocusTarget(target);
  }

  function jumpTo(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '2000-01-01' || date >= today) return;
    const behind = Math.round((Date.parse(first) - Date.parse(date)) / DAY_MS);
    goToPage(behind <= 0 ? 0 : Math.ceil(behind / 30), date);
  }

  const row = ({ date, day, note }: HistoryRow, label = stepsDayLabel(date)) => (
    <li key={date}>
      {day ? (
        <button type="button" data-date={date} onClick={() => onSelect(day)} aria-pressed={date === selectedDate}
          aria-label={`View ${label}, ${number(day.count)} steps, ${note}`}>
          <span><span>{label}</span><small>{note}</small></span>
          <b>{number(day.count)}</b>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      ) : (
        <div className="nx-step-history-gap" data-date={date} tabIndex={-1}>
          <span><span>{label}</span><small>{note}</small></span>
          <b aria-hidden="true">—</b>
        </div>
      )}
    </li>
  );

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
          <p>{logged} of {period} {phoneAverage ? 'complete phone days' : 'days logged'} · {windowLabel}</p>
        </div>
        <p className="nx-step-history-note">
          {phoneAverage
            ? 'Only midnight-to-midnight Galaxy A55 days count. Days with no reading, other devices and partial days are left out; a zero the phone reported counts.'
            : 'Days with no reading are left out; a reported zero counts.'}
          {' '}Today’s count is still partial, so it isn’t included.
        </p>
        {!phoneAverage && (hasRolling || hasPastDay || multipleSources) && (
          <p className="nx-step-history-note">
            {hasRolling || hasPastDay
              ? `Includes ${hasRolling ? 'rolling 24-hour readings' : 'past-day snapshots'}. Select a date to see its source and time window.`
              : 'Step sources vary by date.'}
          </p>
        )}
        <p className="nx-step-history-caption" ref={rangeRef} tabIndex={-1}>
          {page ? `Earlier days · ${rangeLabel}` : todayDay ? `Today, then the days in this average` : `Days in this average · ${rangeLabel}`}
        </p>
        {loading ? <p role="status" className="cc-muted">Loading earlier readings…</p> : failed ?
          <p role="status">Couldn’t load these dates. <button type="button" className="cc-text-button"
            onClick={() => { setArchive(null); setAttempt(n => n + 1); }}>Retry</button></p> :
          pageDays.length === 0 && !todayDay ? <p className="cc-muted">No step readings in this period.</p> : (
            <ul className="nx-step-history-list" aria-label="Daily step readings" ref={listRef}>
              {todayDay && row({ date: today, day: todayDay, note: `${stepsSourceLabel(todayDay.winningSource ?? todayDay.source)} · so far, not counted` }, 'Today')}
              {visibleRows.map(item => row(item))}
            </ul>
        )}
        <div className="nx-step-history-range" role="group" aria-label="Browse dated step history">
          <button type="button" onClick={() => goToPage(page + 1)}>Earlier days</button>
          {page > 0 && <button type="button" onClick={() => goToPage(page - 1)}>Newer days</button>}
        </div>
        <label className="nx-step-history-jump">
          <span>Go to a date</span>
          <input type="date" max={yesterday} onChange={event => jumpTo(event.currentTarget.value)} />
        </label>
      </div>
    </details>
  );
}
