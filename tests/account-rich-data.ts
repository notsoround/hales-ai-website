/** Rich synthetic data for design review (`?rich=1` on the account preview). Entirely fictional, deterministic, and relative to "now"
 *  so Today always has a populated day. Never used by the app itself. */
const TZ = 'America/Chicago';
const dayOf = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const hm = (ms: number) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const NOW = Date.now(), H = 3600000, D = 24 * H;
/** Chicago midnight today, approximately (fine for fixtures). */
const todayStart = (() => { const d = dayOf(NOW); for (let t = NOW - D; t <= NOW; t += 15 * 60000) if (dayOf(t) === d) return t; return NOW - 12 * H; })();
const hex = (n: number) => Array.from({ length: 32 }, (_, i) => ((n * 2654435761 + i * 40503) >>> (i % 24) & 15).toString(16)).join('');

const MEALS = [
  ['Greek yogurt, berries, granola', 410, 28, 52, 9], ['Chicken grain bowl', 640, 46, 62, 21], ['Salmon, rice, roasted vegetables', 690, 44, 58, 26],
  ['Eggs, toast, avocado', 480, 24, 34, 28], ['Turkey sandwich, apple', 560, 34, 66, 14], ['Steak salad', 610, 48, 22, 34], ['Protein shake', 220, 30, 12, 4],
] as const;
type Meal = { id: string; description: string; consumedAt: string; date: string; source: 'food_sheet'; sheetLoggedAt: string; countedInTotals: true; imageStored: boolean; total: { calories: number; protein_g: number; carbs_g: number; fat_g: number } };
function meals(): Meal[] {
  seed = 11; const out: Meal[] = [];
  for (let d = 44; d >= 0; d--) {
    if (d === 9 || d === 23) continue; // two days not logged
    const base = todayStart - d * D;
    for (const [hour, pick] of [[7.75, 0], [12.5, 1], [19, 2]] as const) {
      const at = base + hour * H + rnd() * 40 * 60000;
      if (at > NOW) continue;
      const m = MEALS[(pick + d * 3 + Math.floor(rnd() * 3)) % MEALS.length]!, scale = 0.85 + rnd() * 0.4;
      out.push({ id: `meal_${hex(d * 10 + pick)}`, description: m[0], consumedAt: new Date(at).toISOString(), date: dayOf(at), source: 'food_sheet', sheetLoggedAt: 'canonical_food_sheet', countedInTotals: true, imageStored: true,
        total: { calories: Math.round(m[1] * scale), protein_g: Math.round(m[2] * scale), carbs_g: Math.round(m[3] * scale), fat_g: Math.round(m[4] * scale) } });
    }
  }
  return out;
}
function weights() {
  seed = 3; const rows = []; let v = 196.4;
  for (let d = 90; d >= 0; d--) { v += -0.075 + (rnd() - 0.5) * 0.45; if (rnd() < 0.15 && d) continue; const at = todayStart - d * D + 6.6 * H; rows.push({ id: `w-${d}`, kind: 'measurement', weightLb: Math.round((v + (rnd() - 0.5) * 1.2) * 10) / 10, measuredAt: new Date(at).toISOString(), source: 'health-connect', recordId: `r-${d}`, basis: 'health_connect' }); }
  return rows;
}
function glucose() {
  seed = 5; const rows = [];
  for (let d = 13; d >= 0; d--) for (const h of [7.2, 9.4, 14.2, 18]) { const at = todayStart - d * D + h * H; if (at > NOW) continue; rows.push({ id: `g-${d}-${h}`, glucoseMgDl: Math.round(h === 9.4 ? 128 + rnd() * 40 : 88 + rnd() * 24), observedAt: new Date(at).toISOString(), method: 'fingerstick' }); }
  return rows;
}
function nights() {
  seed = 13; return Array.from({ length: 14 }, (_, i) => { const day = dayOf(NOW - i * D); const asleep = 380 + Math.round(rnd() * 90);
    return { night_id: day, captured_at: new Date(NOW - i * D).toISOString(), metrics: { sleep: { asleep_minutes: asleep, session_duration_minutes: asleep + 40 }, average_heart_rate: { value_bpm: 58 }, resting_heart_rate: { value_bpm: 52 }, spo2: { mean_percent: 96, min_percent: 91 } }, coverage: { all_reads_complete: true, types: {} } }; });
}
function steps() { seed = 17; return Array.from({ length: 30 }, (_, i) => ({ date: dayOf(NOW - i * D), count: i === 0 ? 6420 : 5200 + Math.round(rnd() * 6400), windowBasis: 'calendar_day', source: 'health_connect' })); }
function feed() {
  const today = dayOf(NOW), items = meals().filter(m => m.date === today).map(m => ({ id: m.id, type: 'food', icon: '🍽', title: m.description, body: '', date: today, time: hm(Date.parse(m.consumedAt)), ts: Date.parse(m.consumedAt), calories: m.total.calories, details: { mealId: m.id } }));
  const add = (h: number, o: object) => { const at = todayStart + h * H; if (at <= NOW) items.push({ date: today, time: hm(at), ts: at, body: '', icon: '', ...o } as never); };
  add(12.7, { id: 'p1', type: 'purchase', icon: '🛍', title: 'Sweetgreen', amount: 16.4, currency: 'USD' });
  add(14.1, { id: 'x1', type: 'exercise', icon: '🏃', title: 'Rowing, 25 min', calories: -240 });
  add(7.2, { id: 'g1', type: 'glucose', icon: '💧', title: 'Fasting glucose 94 mg/dL' });
  return items.sort((a, b) => b.ts - a.ts);
}

/** Returns a synthetic payload for a library action, or null to fall through to the plain fixture. */
export function richData(action: string): Record<string, unknown> | null {
  switch (action) {
    case 'food_history': { const m = meals(); return { meals: m, total: m.length, nextCursor: null, pendingCount: 0, undatedLoggedCount: 0 }; }
    case 'food_settings_get': return { settings: { calorieTarget: 2100, expenditureEstimate: 2450, effectiveFrom: dayOf(NOW - 60 * D), versions: [] } };
    case 'weight_list': { const w = weights(); return { measurements: [...w].reverse(), latestMeasurement: w[w.length - 1], total: w.length, nextCursor: null, coverage: { initialSince: null, lastSyncAt: null, lastObservedAt: null, resetCount: 0 } }; }
    case 'glucose_manual_list': return { entries: glucose(), latest: null };
    case 'ringconn_night_list': return { entries: nights() };
    case 'steps_list': return { entries: steps() };
    case 'feed_get': return { items: feed(), nextCursor: null, totals: { calories: null, spendUsd: 16.4 }, daily: [], personalOutcomes: null, outcomes: { wins: null, losses: null, missed: null, unscored: null, interventions: null }, coverage: { start: dayOf(NOW), end: dayOf(NOW), source: 'owned-local-ledgers', complete: true, localComplete: true, notes: [] } };
    default: return null;
  }
}
export const RICH = typeof location !== 'undefined' && new URLSearchParams(location.search).has('rich');
