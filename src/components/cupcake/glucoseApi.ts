// Owner-reported (manual / fingerstick) glucose from the private library.
// Libre CGM readings are not here; they still live in the n8n Libre workflow.
export type GlucoseReading = { id: string; valueMgDl: number; observedAt: string; at: number; method?: string };
export type LibraryRequest = <T>(body: Record<string, unknown>) => Promise<T>;

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseGlucoseEntries(entries: unknown): GlucoseReading[] {
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry, index): GlucoseReading[] => {
    if (!record(entry)) return [];
    const observedAt = typeof entry.observedAt === 'string' ? entry.observedAt : '';
    const at = Date.parse(observedAt);
    const raw = entry.glucoseMgDl ?? entry.valueMgDl;
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
    if (!Number.isFinite(at) || !Number.isFinite(value) || value <= 0 || value >= 1000) return [];
    return [{ id: typeof entry.id === 'string' ? entry.id : `glucose-${index}-${at}`, valueMgDl: Math.round(value), observedAt, at, ...(typeof entry.method === 'string' ? { method: entry.method } : {}) }];
  }).sort((a, b) => a.at - b.at);
}

/** Manual readings observed in [start, end). `start`/`end` are epoch ms. */
export async function loadGlucoseReadings(request: LibraryRequest, start: number, end: number): Promise<GlucoseReading[]> {
  const data = await request<{ entries?: unknown }>({ action: 'glucose_manual_list', start: new Date(start).toISOString(), limit: 50 });
  return parseGlucoseEntries(data.entries).filter(r => r.at >= start && r.at < end);
}

/** The reading closest to `target`, or null. Ties go to the earlier reading. */
export function closestReading(readings: GlucoseReading[], target: number): GlucoseReading | null {
  let best: GlucoseReading | null = null;
  for (const reading of readings) if (!best || Math.abs(reading.at - target) < Math.abs(best.at - target)) best = reading;
  return best;
}

/** Epoch ms for `hour`:00 on a YYYY-MM-DD day in America/Chicago (DST-safe). */
export function chicagoHourOnDay(day: string, hour: number): number {
  const [year, month, date] = day.split('-').map(Number);
  const nominal = Date.UTC(year, month - 1, date, hour);
  const format = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  let result = nominal;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(format.formatToParts(new Date(result)).map(x => [x.type, x.value]));
    result += nominal - Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  }
  return result;
}
