import { personalStorage } from './personalStorage';
// Saves over an adjustable window (7 / 30 / 90 days) and per-day drill-down. Pure helpers; nothing invented.
import { interventionOutcome, type DashboardOutcome } from './dashboardModel';
import { addDays, nutritionDay } from './nutritionModel';
import { lastNDays, ownerQuote, callPlace, type PulseItem } from './pulseModel';

export const SAVES_WINDOWS = [7, 30, 90] as const;
export type SavesWindow = (typeof SAVES_WINDOWS)[number];
export type OutcomeCounts = { win: number; loss: number; missed: number; unscored: number };
export type DailyTotals = { date: string; calories?: number | null; spendUsd?: number | null; foodCount?: number | null; transactionCount?: number | null };
export type ServerOutcomes = { wins: number; losses: number; missed: number; unscored: number; interventions?: number };

const WINDOW_KEY = 'cupcake-saves-window';
export function readSavesWindow(): SavesWindow {
  try { const v = Number(personalStorage('localStorage').getItem(WINDOW_KEY)); return (SAVES_WINDOWS as readonly number[]).includes(v) ? v as SavesWindow : 7; } catch { return 7; }
}
export function writeSavesWindow(value: SavesWindow) { try { personalStorage('localStorage').setItem(WINDOW_KEY, String(value)); } catch { /* In-memory choice still applies. */ } }
export const windowLabel = (n: SavesWindow) => `Last ${n} days`;

export function emptyCounts(): OutcomeCounts { return { win: 0, loss: 0, missed: 0, unscored: 0 }; }
export function callsOn(items: PulseItem[], dates: string[]): PulseItem[] {
  const set = new Set(dates);
  return items.filter(i => i.type === 'intervention' && set.has(i.date)).sort((a, b) => (a.ts || 0) - (b.ts || 0));
}
export function countOutcomes(calls: PulseItem[]): OutcomeCounts {
  const c = emptyCounts();
  for (const call of calls) c[interventionOutcome({ ...call, details: call.details })]++;
  return c;
}
/** Window totals: the server counts the whole window before any paging, so prefer them; fall back to counting the calls we have. */
export function windowCounts(items: PulseItem[], days: string[], server?: ServerOutcomes | null): OutcomeCounts {
  if (server && [server.wins, server.losses, server.missed, server.unscored].every(n => Number.isInteger(n) && n >= 0)) return { win: server.wins, loss: server.losses, missed: server.missed, unscored: server.unscored };
  return countOutcomes(callsOn(items, days));
}
export function savesRate(c: OutcomeCounts): number | null { return c.win + c.loss ? Math.round(c.win / (c.win + c.loss) * 100) : null; }

export type DayCell = { date: string; outcomes: DashboardOutcome[] };
export function dayCells(items: PulseItem[], days: string[]): DayCell[] {
  const calls = callsOn(items, days);
  return days.map(date => ({ date, outcomes: calls.filter(c => c.date === date).map(c => interventionOutcome({ ...c, details: c.details })) }));
}
/** The colour a calendar cell shows: any save wins the day's colour, then gave in, missed, no decision. */
export function dominant(outcomes: DashboardOutcome[]): DashboardOutcome | null {
  for (const o of ['win', 'loss', 'missed', 'unscored'] as const) if (outcomes.includes(o)) return o;
  return null;
}
/** 30-day calendar: Sunday-first weeks with blank leading cells so weekdays line up. */
export function calendarWeeks(cells: DayCell[]): Array<Array<DayCell | null>> {
  if (!cells.length) return [];
  const lead = new Date(`${cells[0].date}T12:00:00Z`).getUTCDay();
  const flat: Array<DayCell | null> = [...Array(lead).fill(null), ...cells];
  while (flat.length % 7) flat.push(null);
  const weeks: Array<Array<DayCell | null>> = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
}
/** 90-day bars: rolling 7-day weeks ending today (the oldest may be shorter). */
export function weekBuckets(cells: DayCell[]): Array<{ dates: string[]; counts: OutcomeCounts }> {
  const out: Array<{ dates: string[]; counts: OutcomeCounts }> = [];
  for (let end = cells.length; end > 0; end -= 7) {
    const slice = cells.slice(Math.max(0, end - 7), end), counts = emptyCounts();
    slice.forEach(c => c.outcomes.forEach(o => counts[o]++));
    out.unshift({ dates: slice.map(c => c.date), counts });
  }
  return out;
}
export function windowDays(n: SavesWindow, today = nutritionDay()) { return lastNDays(n, today); }
export function rangeTitle(dates: string[], today = nutritionDay()): string {
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...o }).format(new Date(`${d}T12:00:00Z`));
  if (dates.length === 1) { const d = dates[0]; const rel = d === today ? 'Today · ' : d === addDays(today, -1) ? 'Yesterday · ' : ''; return rel + fmt(d, { weekday: 'long', month: 'short', day: 'numeric' }); }
  return `${fmt(dates[0], { month: 'short', day: 'numeric' })} – ${fmt(dates[dates.length - 1], { month: 'short', day: 'numeric' })}`;
}
export function sumDaily(daily: DailyTotals[] | null | undefined, dates: string[], key: 'calories' | 'spendUsd'): number | null {
  if (!daily?.length) return null;
  const set = new Set(dates), rows = daily.filter(d => set.has(d.date));
  if (!rows.length || rows.some(row => row[key] === null)) return null;
  return rows.reduce((t, d) => t + (typeof d[key] === 'number' ? d[key] as number : 0), 0);
}
export function quotedCalls(calls: PulseItem[]) {
  return calls.map(item => ({ item, quote: ownerQuote(item.details?.summary), outcome: interventionOutcome({ ...item, details: item.details }), place: callPlace(item) })).filter(c => !!c.quote);
}
/** Plain label for where day spend comes from (the feed reports it per range). */
export function spendSourceLabel(source: unknown): string {
  const s = String(source || '');
  if (/plaid/i.test(s)) return 'Bank posted charges (Plaid)';
  if (/notification/i.test(s)) return 'Card notifications (not bank-reconciled)';
  return 'Source not reported';
}
export const KCAL_SOURCE = 'Food log estimates · logged meals only';
