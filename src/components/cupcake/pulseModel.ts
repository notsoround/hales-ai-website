// Today "pulse": Saves (purchase-call wins), the owner's own quoted words from a call, and a readable day timeline.
// Pure helpers over the existing feed shape. Nothing here invents data: a missing field renders as absent.
import { interventionOutcome, type DashboardOutcome } from './dashboardModel';
import { addDays, nutritionDay } from './nutritionModel';

export type PulseItem = { id?: string; type: string; title: string; body?: string; date: string; time?: string; ts?: number; amount?: number | null; currency?: string | null; calories?: number | null; icon?: string; details?: Record<string, unknown> };

export const OUTCOME_LABEL: Record<DashboardOutcome, string> = { win: 'Saved', loss: 'Gave in', missed: 'Missed', unscored: 'No decision' };

/** The place a call was about: the merchant (or location hotspot) Cupcake recorded, without the internal "Intervention:" prefix. */
export function callPlace(item: Pick<PulseItem, 'title' | 'details'>): string {
  const merchant = typeof item.details?.merchant === 'string' ? item.details.merchant.trim() : '';
  return merchant || String(item.title || '').replace(/^Intervention:\s*/i, '').trim() || 'a stop';
}

/** Verbatim words Matt said on the call, as stored by Call Memory ("Owner said: …"). Never paraphrased; null when absent. */
export function ownerQuote(summary: unknown): string | null {
  if (typeof summary !== 'string') return null;
  for (const raw of summary.split(/\r?\n/)) {
    const m = raw.match(/^\s*Owner said:\s*(.+)$/i);
    if (!m) continue;
    const text = m[1].trim().replace(/^["“”']+|["“”']+$/g, '').trim();
    if (text) return text.length > 280 ? `${text.slice(0, 277).trimEnd()}…` : text;
  }
  return null;
}

export function lastNDays(n: number, today = nutritionDay()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

export type SavesWeek = { days: Array<{ date: string; outcomes: DashboardOutcome[] }>; wins: number; losses: number; missed: number; unscored: number; calls: number; todayWins: number; ratePercent: number | null };

export function savesWeek(items: PulseItem[], days = lastNDays(7)): SavesWeek {
  const calls = items.filter(item => item.type === 'intervention' && days.includes(item.date)).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const byDay = days.map(date => ({ date, outcomes: calls.filter(c => c.date === date).map(c => interventionOutcome({ ...c, details: c.details })) }));
  const all = byDay.flatMap(d => d.outcomes);
  const count = (o: DashboardOutcome) => all.filter(x => x === o).length;
  const wins = count('win'), losses = count('loss');
  return { days: byDay, wins, losses, missed: count('missed'), unscored: count('unscored'), calls: all.length, todayWins: byDay[byDay.length - 1]?.outcomes.filter(o => o === 'win').length || 0, ratePercent: wins + losses ? Math.round(wins / (wins + losses) * 100) : null };
}

export type QuoteMoment = { item: PulseItem; quote: string; outcome: DashboardOutcome; place: string };

/** The latest quoted line this week, preferring a save; falls back to the latest quote of any outcome. */
export function latestQuote(items: PulseItem[]): QuoteMoment | null {
  const quoted = items.filter(i => i.type === 'intervention').map(item => ({ item, quote: ownerQuote(item.details?.summary), outcome: interventionOutcome({ ...item, details: item.details }), place: callPlace(item) }))
    .filter((q): q is QuoteMoment => !!q.quote).sort((a, b) => (b.item.ts || 0) - (a.item.ts || 0));
  return quoted.find(q => q.outcome === 'win') || quoted[0] || null;
}

const chicagoClock = (ms: number) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).format(new Date(ms)).replace(/[\u202f\u00a0]/g, ' ');

/** A clock time only when the source recorded one (a posted bank row has a date but no time). */
export function itemClock(item: PulseItem): string {
  const t = String(item.time || '').trim();
  if (!t) return '';
  if (/^\d{1,2}:\d{2}\s*[AP]M$/i.test(t)) return t.toUpperCase().replace(/\s+/, ' ');
  const direct = Date.parse(t);
  if (Number.isFinite(direct)) return chicagoClock(direct);
  if (typeof item.ts === 'number' && item.ts > 0) return chicagoClock(item.ts < 1e12 ? item.ts * 1000 : item.ts);
  return /\d{1,2}:\d{2}/.test(t) ? t : '';
}

export function dayHeading(date: string, today = nutritionDay()): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`));
}

export function agoLabel(ms: number, now = Date.now()): string {
  const m = Math.round((now - ms) / 60000);
  if (!Number.isFinite(m) || m < 0) return '';
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export type Tone = 'food' | 'spend' | 'call' | 'missed' | 'body' | 'glucose' | 'sleep' | 'phone';
export type TimelineRow = { key: string; item: PulseItem; tone: Tone; title: string; sub: string; value: string; outcome?: DashboardOutcome; quote?: string | null; clock: string };

const money = (amount: number, currency?: string | null) => { const c = String(currency || '').toUpperCase(); return c === 'USD' || c === '$' ? `$${amount.toFixed(2)}` : `${c || '?'} ${amount.toFixed(2)}`; };
const category = (item: PulseItem) => { const c = typeof item.details?.category === 'string' ? item.details.category : ''; return c.split(':').pop()?.replace(/_/g, ' ').trim().toLowerCase() || ''; };

export function timelineRow(item: PulseItem, index: number, all: PulseItem[] = []): TimelineRow {
  const key = item.id || `${item.type}-${item.ts || index}`, clock = itemClock(item);
  if (item.type === 'intervention') {
    const outcome = interventionOutcome({ ...item, details: item.details });
    const quote = ownerQuote(item.details?.summary);
    return { key, item, tone: outcome === 'missed' ? 'missed' : 'call', title: callPlace(item), sub: quote ? '' : outcome === 'missed' ? 'Cupcake called · no answer' : outcome === 'unscored' ? 'Cupcake called · no decision recorded' : 'Cupcake called', value: '', outcome, quote, clock };
  }
  if (item.type === 'transaction') {
    const amount = typeof item.amount === 'number' ? item.amount : null;
    const cat = category(item);
    const call = all.find(c => c.type === 'intervention' && c.date === item.date && typeof c.ts === 'number' && typeof item.ts === 'number' && Math.abs(c.ts - item.ts) <= 45 * 60000 && callPlace(c).toLowerCase() === String(item.title || '').trim().toLowerCase());
    const callOutcome = call ? interventionOutcome({ ...call, details: call.details }) : null;
    return { key, item, tone: 'spend', title: item.title || 'Purchase', sub: [cat ? `Purchase · ${cat}` : 'Purchase', callOutcome ? `Cupcake called · ${OUTCOME_LABEL[callOutcome].toLowerCase()}` : ''].filter(Boolean).join(' · '), value: amount !== null ? money(amount, item.currency) : '', clock };
  }
  if (item.type === 'food') {
    const kcal = typeof item.calories === 'number' ? item.calories : null;
    return { key, item, tone: 'food', title: item.title || 'Meal', sub: 'Meal · photo estimate', value: kcal !== null ? `${Math.round(kcal).toLocaleString('en-US')} kcal` : '— kcal', clock };
  }
  if (item.type === 'activity') {
    const lb = typeof item.details?.weightLb === 'number' ? item.details.weightLb as number : typeof item.amount === 'number' ? item.amount : null;
    return { key, item, tone: 'body', title: item.title || 'Weight', sub: 'Weight', value: lb !== null ? `${lb.toFixed(1)} lb` : '', clock };
  }
  if (item.type === 'glucose') return { key, item, tone: 'glucose', title: item.title || 'Glucose', sub: item.body || '', value: '', clock };
  if (item.type === 'sleep') return { key, item, tone: 'sleep', title: item.title || 'Sleep', sub: item.body || '', value: '', clock };
  return { key, item, tone: 'phone', title: item.title || 'Signal', sub: item.body || '', value: '', clock };
}

/** Human-readable second line for a call in any list: the outcome in words, plus the quoted line when one exists. */
export function callSubtitle(item: PulseItem): string {
  const outcome = interventionOutcome({ ...item, details: item.details });
  const quote = ownerQuote(item.details?.summary);
  return `${OUTCOME_LABEL[outcome]}${quote ? ` · “${quote}”` : ''}`;
}
export function listTitle(item: Pick<PulseItem, 'type' | 'title' | 'details'>): string {
  return item.type === 'intervention' ? `Cupcake called · ${callPlace(item)}` : item.title;
}

/** Freshness: how long since each source last produced something on this feed. */
export function freshness(items: PulseItem[], now = Date.now()): Array<{ label: string; ago: string }> {
  const latest = (type: string) => items.filter(i => i.type === type && typeof i.ts === 'number' && i.ts > 0 && i.ts <= now + 300000 && (type !== 'transaction' || itemClock(i))).reduce((m, i) => Math.max(m, i.ts as number), 0);
  const out: Array<{ label: string; ago: string }> = [];
  for (const [label, type] of [['Purchase', 'transaction'], ['Call', 'intervention'], ['Meal', 'food']]) { const ms = latest(type); const ago = ms ? agoLabel(ms, now) : ''; if (ago) out.push({ label, ago }); }
  return out;
}
