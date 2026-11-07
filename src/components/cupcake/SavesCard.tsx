import { ACCOUNT_SESSIONS } from './accountMode';
import { feedRequest, phoneOutcomesAvailable, type FeedData } from './feedApi';
import { todayKcalBit } from './dataState';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Quote } from 'lucide-react';
import type { DashboardOutcome } from './dashboardModel';
import { nutritionDays, nutritionDay } from './nutritionModel';
import type { useNutritionData } from './nutritionApi';
import { ToneIcon } from './design/ToneIcon';
import { OUTCOME_LABEL, dayHeading, itemClock, latestQuote, type PulseItem, type QuoteMoment } from './pulseModel';
import { OutcomeChip, Timeline } from './TodayPulse';
import { SignalSheet } from './SignalSheet';
import { KCAL_SOURCE, SAVES_WINDOWS, calendarWeeks, callsOn, countOutcomes, dayCells, dominant, quotedCalls, rangeTitle, readSavesWindow, savesRate, spendSourceLabel, sumDaily, weekBuckets, windowCounts, windowDays, windowLabel, writeSavesWindow, type DailyTotals, type DayCell, type OutcomeCounts, type SavesWindow, type ServerOutcomes } from './savesModel';
import './saves.css';

const OUTCOME_CLASS: Record<DashboardOutcome, string> = { win: 'is-win', loss: 'is-loss', missed: 'is-missed', unscored: 'is-unscored' };
const WEEKDAY = (date: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'narrow' }).format(new Date(`${date}T12:00:00Z`));
const DAYNUM = (date: string) => String(Number(date.slice(8, 10)));
type WindowData = { items: PulseItem[]; outcomes: ServerOutcomes | null; personalOutcomes:FeedData['personalOutcomes']; daily: DailyTotals[]; spendSource: string };

/** Everything in the selected window from the feed's ranged query. The server counts outcomes over the whole window. */
function useWindow(n: SavesWindow) {
  const [data, setData] = useState<WindowData | null>(null), [error, setError] = useState(false);
  const cache = useRef(new Map<string, WindowData>()), request = useRef(0);
  const load = useCallback((force = false) => {
    const days = windowDays(n), key = `${n}|${days[days.length - 1]}`, id = ++request.current;
    setError(false);
    const hit = cache.current.get(key);
    if (hit && !force) { setData(hit); return; }
    setData(null);
    feedRequest({start:days[0],end:days[days.length-1]})
      .then(d => {
        const value: WindowData = { items:d.items, outcomes:phoneOutcomesAvailable(d.outcomes)?d.outcomes as ServerOutcomes:null, personalOutcomes:d.personalOutcomes, daily:Array.isArray(d.daily)?d.daily:[],spendSource:String(d.coverage?.spendSource||'') };
        cache.current.set(key, value);
        if (id === request.current) setData(value);
      })
      .catch(() => { if (id === request.current) setError(true); });
  }, [n]);
  useEffect(() => { load(); const ref = request; return () => { ref.current++; }; }, [load]);
  return { data, error, reload: () => load(true) };
}

type Nutrition = ReturnType<typeof useNutritionData>;

export function SavesHero({ todayItems, nutrition, onOpenWins, onTalkAbout, onOpenItem }: { todayItems: PulseItem[] | null; nutrition: Nutrition; onOpenWins: () => void; onTalkAbout: (item: PulseItem) => void; onOpenItem?: (item: PulseItem, index: number) => void }) {
  const [win, setWin] = useState<SavesWindow>(readSavesWindow);
  const [openDates, setOpenDates] = useState<string[] | null>(null);
  const today = nutritionDay();
  const days = useMemo(() => windowDays(win, today), [win, today]);
  const w = useWindow(win);
  const cells = useMemo(() => w.data ? dayCells(w.data.items, days) : null, [w.data, days]);
  const counts = w.data ? windowCounts(w.data.items, days, w.data.outcomes) : null;
  const calls = counts ? counts.win + counts.loss + counts.missed + counts.unscored : 0;
  const rate = counts ? savesRate(counts) : null;
  const quote = w.data ? latestQuote(w.data.items.filter(i => i.type === 'intervention')) : null;
  const todayWins = !ACCOUNT_SESSIONS && cells ? cells[cells.length - 1]?.outcomes.filter(o => o === 'win').length || 0 : null;
  const food = nutrition.history ? nutritionDays(nutrition.history.meals, [today], nutrition.settings)[0] : null;
  const spentToday = !ACCOUNT_SESSIONS && todayItems ? todayItems.filter(i => i.type === 'transaction' && i.date === today && typeof i.amount === 'number' && ['USD', '$'].includes(String(i.currency || '').toUpperCase())).reduce((t, i) => t + (i.amount as number), 0) : null;
  const todayBits = [
    todayWins !== null ? { k: 'saves', v: String(todayWins), l: todayWins === 1 ? 'save' : 'saves' } : null,
    spentToday !== null ? { k: 'spent', v: `$${spentToday.toFixed(2)}`, l: 'spent' } : null,
    todayKcalBit(food) ? {k:'kcal', ...todayKcalBit(food)!} : null,
  ].filter((b): b is { k: string; v: string; l: string } => !!b);
  const choose = (n: SavesWindow) => { setWin(n); writeSavesWindow(n); };
  const open = (dates: string[]) => setOpenDates(dates);
  return <div className="cc-pulse">
    <section className={`cc-saves cc-saves-w${win}`} aria-labelledby="cc-saves-title">
      <div className="cc-saves-head"><h3 id="cc-saves-title" className="cc-card-title"><ToneIcon tone="wins" />{ACCOUNT_SESSIONS?'Personal wins & losses':'Saves'}</h3><button type="button" className="cc-text-button" onClick={onOpenWins}>Wins &amp; losses<ArrowRight size={16} /></button></div>
      <div className="cc-sw-switch" role="radiogroup" aria-label="Saves window">{SAVES_WINDOWS.map(n => <button key={n} type="button" role="radio" aria-checked={win === n} onClick={() => choose(n)}>{n} days</button>)}</div>
      {ACCOUNT_SESSIONS && w.data && !w.error ? <div className="cc-account-outcome-summary">
        {w.data.personalOutcomes ? <><div className="cc-saves-number"><strong>{w.data.personalOutcomes.wins}</strong><span>personal wins · {windowLabel(win).toLowerCase()}</span></div><p>{w.data.personalOutcomes.losses} personal losses · {w.data.personalOutcomes.unscored} unscored</p></> : <p>Personal outcomes unavailable for this window.</p>}
        <p className="cc-muted cc-small">Phone purchase-call outcomes are not connected to account sign-in. Personal outcomes are counted separately.</p>
      </div> : w.error ? <div className="cc-saves-error" role="alert"><p>Couldn’t load {ACCOUNT_SESSIONS?'personal outcomes':'calls'} for the last {win} days.</p><button type="button" className="cc-secondary" onClick={w.reload}>Retry</button></div>
        : !counts || !cells ? <div className="cc-saves-skeleton" aria-busy="true" aria-label="Loading saves"><i /><i /><i /></div>
        : calls === 0 ? <div className="cc-saves-empty"><strong>No calls in the last {win} days</strong><p>Your card swipes. She calls. Every time you resist, it lands here as a save.</p></div>
        : <>
          <div className="cc-saves-number"><strong>{counts.win}</strong><span>{counts.win === 1 ? 'time you resisted' : 'times you resisted'} · {windowLabel(win).toLowerCase()}</span></div>
          {win === 7 ? <Strip cells={cells} today={today} onOpen={open} /> : win === 30 ? <Calendar cells={cells} today={today} onOpen={open} /> : <WeekBars cells={cells} onOpen={open} />}
          <FactsRow counts={counts} label={windowLabel(win)} />
          {rate !== null && <p className="cc-saves-rate cc-sw-rate"><b>{rate}%</b> of decided calls ended in a save</p>}
        </>}
      {todayBits.length > 0 && <p className="cc-today-line" aria-label="Today so far"><span className="cc-today-line-label">Today</span>{todayBits.map(b => <span key={b.k}><b>{b.v}</b> {b.l}</span>)}</p>}
    </section>
    {quote && <QuoteCard moment={quote} onTalkAbout={onTalkAbout} />}
    <SignalSheet open={!!openDates && !!w.data} label={openDates ? rangeTitle(openDates, today) : 'Day'} onClose={() => setOpenDates(null)}>
      {openDates && w.data && <DaySheet dates={openDates} data={w.data} today={today} onBack={() => setOpenDates(null)} onTalkAbout={item => { setOpenDates(null); onTalkAbout(item); }} onOpenItem={onOpenItem ? (item, i) => { setOpenDates(null); onOpenItem(item, i); } : undefined} />}
    </SignalSheet>
  </div>;
}

/** "3 resisted · 1 gave in · 1 missed · 0 no decision", always with the window it covers. */
export function FactsRow({ counts, label }: { counts: OutcomeCounts; label: string }) {
  return <p className="cc-sw-facts" aria-label={`${label}: ${counts.win} resisted, ${counts.loss} gave in, ${counts.missed} missed, ${counts.unscored} no decision`}>
    <span className="cc-sw-window">{label}</span>
    <span><i className="is-win" /><b>{counts.win}</b> resisted</span>
    <span><i className="is-loss" /><b>{counts.loss}</b> gave in</span>
    <span><i className="is-missed" /><b>{counts.missed}</b> missed</span>
    <span><i className="is-unscored" /><b>{counts.unscored}</b> no decision</span>
  </p>;
}

const dayAria = (c: DayCell, today: string) => `${dayHeading(c.date, today)}: ${c.outcomes.length ? c.outcomes.map(o => OUTCOME_LABEL[o]).join(', ') : 'no calls'}. Open day.`;

function Strip({ cells, today, onOpen }: { cells: DayCell[]; today: string; onOpen: (d: string[]) => void }) {
  return <ol className="cc-sw-strip" aria-label="Calls by day">{cells.map(c => <li key={c.date}><button type="button" className={c.date === today ? 'is-today' : undefined} aria-label={dayAria(c, today)} onClick={() => onOpen([c.date])}>
    <span className="cc-saves-dots">{c.outcomes.length ? c.outcomes.slice(0, 4).map((o, i) => <i key={i} className={OUTCOME_CLASS[o]} />) : <i className="is-none" />}{c.outcomes.length > 4 && <b>+{c.outcomes.length - 4}</b>}</span>
    <small>{c.date === today ? 'Today' : WEEKDAY(c.date)}</small></button></li>)}</ol>;
}

function Calendar({ cells, today, onOpen }: { cells: DayCell[]; today: string; onOpen: (d: string[]) => void }) {
  const weeks = calendarWeeks(cells);
  return <div className="cc-sw-cal" role="grid" aria-label="Calls by day, last 30 days">
    <div className="cc-sw-cal-head" role="row">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} role="columnheader">{d}</span>)}</div>
    {weeks.map((week, wi) => <div key={wi} className="cc-sw-cal-row" role="row">{week.map((c, i) => c ? (() => { const top = dominant(c.outcomes); return <button key={c.date} type="button" role="gridcell" className={`${c.date === today ? 'is-today ' : ''}${top ? `has-${top}` : 'is-quiet'}`} aria-label={dayAria(c, today)} onClick={() => onOpen([c.date])}>
      <small>{DAYNUM(c.date)}</small>{top ? <i className={OUTCOME_CLASS[top]} /> : null}{c.outcomes.length > 1 && <b>{c.outcomes.length}</b>}</button>; })() : <span key={`blank-${i}`} className="cc-sw-cal-blank" role="gridcell" aria-hidden="true" />)}</div>)}
  </div>;
}

function WeekBars({ cells, onOpen }: { cells: DayCell[]; onOpen: (d: string[]) => void }) {
  const weeks = weekBuckets(cells);
  const max = Math.max(1, ...weeks.map(w => w.counts.win + w.counts.loss + w.counts.missed + w.counts.unscored));
  const short = (d: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'numeric', day: 'numeric' }).format(new Date(`${d}T12:00:00Z`));
  return <div className="cc-sw-bars-wrap"><ol className="cc-sw-bars" aria-label="Calls by week, last 90 days">{weeks.map((w, i) => { const total = w.counts.win + w.counts.loss + w.counts.missed + w.counts.unscored; return <li key={w.dates[0]}>
    <button type="button" aria-label={`Week of ${rangeTitle(w.dates)}: ${w.counts.win} resisted, ${w.counts.loss} gave in, ${w.counts.missed} missed, ${w.counts.unscored} no decision. Open week.`} onClick={() => onOpen(w.dates)}>
      <span className="cc-sw-bar" style={{ height: `${Math.max(total ? 10 : 3, total / max * 100)}%` }}>{(['unscored', 'missed', 'loss', 'win'] as const).map(o => w.counts[o] ? <i key={o} className={OUTCOME_CLASS[o]} style={{ flexGrow: w.counts[o] }} /> : null)}</span>
      {(i === 0 || i === weeks.length - 1 || i % 4 === 0) ? <small>{i === weeks.length - 1 ? 'Now' : short(w.dates[0])}</small> : <small aria-hidden="true">&nbsp;</small>}
    </button></li>; })}</ol></div>;
}

function DaySheet({ dates, data, today, onBack, onTalkAbout, onOpenItem }: { dates: string[]; data: WindowData; today: string; onBack: () => void; onTalkAbout: (item: PulseItem) => void; onOpenItem?: (item: PulseItem, index: number) => void }) {
  const set = new Set(dates);
  const calls = callsOn(data.items, dates), counts = countOutcomes(calls), quoted = quotedCalls(calls);
  const items = data.items.filter(i => set.has(i.date)).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const spend = sumDaily(data.daily, dates, 'spendUsd'), kcal = sumDaily(data.daily, dates, 'calories');
  return <section className="cc-dashboard cc-dashboard-detail cc-daysheet">
    <div className="cc-detail-head"><button type="button" className="cc-text-button" onClick={onBack}><ArrowLeft size={17} />Back to Today</button></div>
    <p className="cc-detail-kind">{dates.length === 1 ? 'Day' : `Week · ${dates.length} days`}</p>
    <h2>{rangeTitle(dates, today)}</h2>
    <dl className="cc-ds-stats">
      <div className="is-win"><dt>Resisted</dt><dd>{counts.win}</dd></div>
      <div className="is-loss"><dt>Gave in</dt><dd>{counts.loss}</dd></div>
      <div className="is-missed"><dt>Missed</dt><dd>{counts.missed}</dd></div>
      <div className="is-unscored"><dt>No decision</dt><dd>{counts.unscored}</dd></div>
      <div className="is-wide"><dt>Spend</dt><dd>{spend === null ? '—' : `$${spend.toFixed(2)}`}</dd><small>{spendSourceLabel(data.spendSource)}</small></div>
      <div className="is-wide"><dt>Calories</dt><dd>{kcal === null ? '—' : `${Math.round(kcal).toLocaleString('en-US')} kcal`}</dd><small>{KCAL_SOURCE}</small></div>
    </dl>
    {quoted.length > 0 && <div className="cc-ds-section"><h3>What you said</h3><ul className="cc-ds-quotes">{quoted.map(q => <li key={q.item.id || `${q.item.ts}`}>
      <blockquote><span>{q.quote}</span></blockquote>
      <p><span>{q.place}{itemClock(q.item) ? ` · ${itemClock(q.item)}` : ''}</span><OutcomeChip outcome={q.outcome} /></p>
      <button type="button" className="cc-text-button" onClick={() => onTalkAbout(q.item)}>Talk to Cupcake about this call<ArrowRight size={15} /></button>
    </li>)}</ul></div>}
    <div className="cc-ds-section"><h3>Timeline</h3>{items.length ? <Timeline items={items} max={items.length} onAll={() => {}} onOpen={(item, i) => onOpenItem?.(item, i)} /> : <p className="cc-muted">Nothing was logged {dates.length === 1 ? 'this day' : 'these days'}.</p>}</div>
  </section>;
}

function QuoteCard({ moment, onTalkAbout }: { moment: QuoteMoment; onTalkAbout: (item: PulseItem) => void }) {
  const when = [dayHeading(moment.item.date), String(moment.item.time || '').trim()].filter(Boolean).join(' · ');
  return <figure className={`cc-quote ${OUTCOME_CLASS[moment.outcome]}`}>
    <Quote className="cc-quote-mark" size={28} aria-hidden="true" />
    <blockquote>{moment.quote}</blockquote>
    <figcaption><span>You, on the call about <b>{moment.place}</b><br /><small>{when}</small></span><OutcomeChip outcome={moment.outcome} /></figcaption>
    <button type="button" className="cc-text-button" onClick={() => onTalkAbout(moment.item)}>Talk to Cupcake about this call<ArrowRight size={16} /></button>
  </figure>;
}
