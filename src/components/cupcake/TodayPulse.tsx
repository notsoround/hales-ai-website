import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CreditCard, Droplet, Moon, Phone, PhoneMissed, Quote, Scale, Smartphone, Utensils } from 'lucide-react';
import type { DashboardOutcome } from './dashboardModel';
import { nutritionDays, nutritionDay } from './nutritionModel';
import type { useNutritionData } from './nutritionApi';
import { privateAccessHeaders } from './privateAccess';
import { ToneIcon } from './design/ToneIcon';
import { OUTCOME_LABEL, dayHeading, freshness, lastNDays, latestQuote, savesWeek, timelineRow, type PulseItem, type QuoteMoment, type Tone } from './pulseModel';

const API = 'https://automate.hales.ai/webhook';
const WEEKDAY = (date: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'narrow' }).format(new Date(`${date}T12:00:00Z`));
const OUTCOME_CLASS: Record<DashboardOutcome, string> = { win: 'is-win', loss: 'is-loss', missed: 'is-missed', unscored: 'is-unscored' };

export function OutcomeChip({ outcome }: { outcome: DashboardOutcome }) {
  return <span className={`cc-outcome-chip ${OUTCOME_CLASS[outcome]}`}>{OUTCOME_LABEL[outcome]}</span>;
}

/** Calls this week (feed range query). Same source and scoring as Wins & losses. */
function useWeekCalls() {
  const [items, setItems] = useState<PulseItem[] | null>(null), [error, setError] = useState(false);
  const request = useRef(0);
  const load = useCallback(() => {
    const id = ++request.current, days = lastNDays(7);
    setError(false);
    fetch(`${API}/cupcake-feed?start=${days[0]}&end=${days[6]}`, { headers: privateAccessHeaders(), cache: 'no-store' })
      .then(r => { if (!r.ok) throw Error(String(r.status)); return r.json(); })
      .then((d: { items?: PulseItem[] }) => { if (id === request.current) setItems((d.items || []).filter(i => i && i.type === 'intervention')); })
      .catch(() => { if (id === request.current) setError(true); });
  }, []);
  useEffect(() => { load(); const ref = request; return () => { ref.current++; }; }, [load]);
  return { items, error, reload: load };
}

type Nutrition = ReturnType<typeof useNutritionData>;

export function SavesHero({ todayItems, nutrition, onOpenWins, onTalkAbout }: { todayItems: PulseItem[] | null; nutrition: Nutrition; onOpenWins: () => void; onTalkAbout: (item: PulseItem) => void }) {
  const week = useWeekCalls();
  const today = nutritionDay();
  const s = week.items ? savesWeek(week.items) : null;
  const quote = week.items ? latestQuote(week.items) : null;
  const food = nutrition.history ? nutritionDays(nutrition.history.meals, [today], nutrition.settings)[0] : null;
  const spentToday = todayItems ? todayItems.filter(i => i.type === 'transaction' && i.date === today && typeof i.amount === 'number' && ['USD', '$'].includes(String(i.currency || '').toUpperCase())).reduce((t, i) => t + (i.amount as number), 0) : null;
  const todayBits = [
    s ? { k: 'saves', v: String(s.todayWins), l: s.todayWins === 1 ? 'save' : 'saves' } : null,
    spentToday !== null ? { k: 'spent', v: `$${spentToday.toFixed(2)}`, l: 'spent' } : null,
    food && food.meals.length ? { k: 'kcal', v: Math.round(food.calories).toLocaleString('en-US'), l: 'kcal eaten' } : null,
  ].filter((b): b is { k: string; v: string; l: string } => !!b);
  return <div className="cc-pulse">
    <section className="cc-saves" aria-labelledby="cc-saves-title">
      <div className="cc-saves-head"><h3 id="cc-saves-title" className="cc-card-title"><ToneIcon tone="wins" />Saves · last 7 days</h3><button type="button" className="cc-text-button" onClick={onOpenWins}>Wins &amp; losses<ArrowRight size={16} /></button></div>
      {week.error ? <div className="cc-saves-error" role="alert"><p>Couldn’t load this week’s calls.</p><button type="button" className="cc-secondary" onClick={week.reload}>Retry</button></div>
        : !s ? <div className="cc-saves-skeleton" aria-busy="true" aria-label="Loading saves"><i /><i /><i /></div>
        : s.calls === 0 ? <div className="cc-saves-empty"><strong>No calls this week</strong><p>Your card swipes. She calls. Every time you resist, it lands here as a save.</p></div>
        : <>
          <div className="cc-saves-main">
            <div className="cc-saves-number"><strong>{s.wins}</strong><span>{s.wins === 1 ? 'time you resisted' : 'times you resisted'}</span></div>
            <ol className="cc-saves-strip" aria-label="Calls by day">{s.days.map(d => <li key={d.date} className={d.date === today ? 'is-today' : undefined} aria-label={`${dayHeading(d.date, today)}: ${d.outcomes.length ? d.outcomes.map(o => OUTCOME_LABEL[o]).join(', ') : 'no calls'}`}>
              <span className="cc-saves-dots">{d.outcomes.length ? d.outcomes.slice(0, 4).map((o, i) => <i key={i} className={OUTCOME_CLASS[o]} />) : <i className="is-none" />}{d.outcomes.length > 4 && <b>+{d.outcomes.length - 4}</b>}</span>
              <small>{d.date === today ? 'Today' : WEEKDAY(d.date)}</small></li>)}</ol>
          </div>
          <p className="cc-saves-facts">{s.ratePercent !== null && <span className="cc-saves-rate"><b>{s.ratePercent}%</b> of decided calls ended in a save</span>}<span><i className="is-loss" />{s.losses} gave in</span><span><i className="is-missed" />{s.missed} missed</span>{s.unscored > 0 && <span><i className="is-unscored" />{s.unscored} no decision</span>}</p>
        </>}
      {todayBits.length > 0 && <p className="cc-today-line" aria-label="Today so far"><span className="cc-today-line-label">Today</span>{todayBits.map(b => <span key={b.k}><b>{b.v}</b> {b.l}</span>)}</p>}
    </section>
    {quote && <QuoteCard moment={quote} onTalkAbout={onTalkAbout} />}
  </div>;
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

const TONE_ICON: Record<Tone, typeof Phone> = { call: Phone, missed: PhoneMissed, spend: CreditCard, food: Utensils, body: Scale, glucose: Droplet, sleep: Moon, phone: Smartphone };

export function Timeline({ items, onOpen, max = 8, onAll, formatClock }: { items: PulseItem[]; onOpen: (item: PulseItem, index: number) => void; max?: number; onAll: () => void; formatClock?: (item: PulseItem) => string }) {
  const rows = items.slice(0, max).map((item, i) => { const row = timelineRow(item, i, items); const clock = formatClock?.(item); return clock ? { ...row, clock } : row; });
  const groups: Array<{ date: string; rows: typeof rows }> = [];
  rows.forEach(r => { const g = groups[groups.length - 1]; if (g && g.date === r.item.date) g.rows.push(r); else groups.push({ date: r.item.date, rows: [r] }); });
  const fresh = freshness(items);
  return <div className="cc-timeline">
    {fresh.length > 0 && <p className="cc-freshness" aria-label="Latest from each source">{fresh.map(f => <span key={f.label}>{f.label} <b>{f.ago}</b></span>)}</p>}
    {groups.map(g => <section key={g.date} className="cc-timeline-day" aria-label={dayHeading(g.date)}>
      <h4>{dayHeading(g.date)}</h4>
      <ol>{g.rows.map(r => { const Icon = TONE_ICON[r.tone]; return <li key={r.key} className={`cc-tl-is-${r.tone}`}><button type="button" onClick={() => onOpen(r.item, items.indexOf(r.item))} aria-label={`Open ${r.title}`}>
        <time>{r.clock}</time>
        <span className="cc-tl-node" aria-hidden="true"><Icon size={14} strokeWidth={2.2} /></span>
        <span className="cc-tl-body"><strong>{r.title}</strong>{r.quote ? <q>{r.quote}</q> : r.sub ? <small>{r.sub}</small> : null}</span>
        <span className="cc-tl-value">{r.outcome ? <OutcomeChip outcome={r.outcome} /> : r.value}</span>
      </button></li>; })}</ol>
    </section>)}
    {items.length > max && <button type="button" className="cc-secondary cc-timeline-all" onClick={onAll}>See all {items.length} signals</button>}
  </div>;
}
