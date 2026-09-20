import type { DashboardEntry } from './DashboardView';
export function weightMeasurements(entries: DashboardEntry[]) {
  return entries.filter(entry => entry.type === 'activity' && entry.details?.weightKind === 'measurement' && typeof entry.details.measuredAt === 'string' && Number.isFinite(Date.parse(entry.details.measuredAt)) && typeof entry.details.weightLb === 'number' && Number.isFinite(entry.details.weightLb)).map(entry => ({ entry, at: Date.parse(String(entry.details!.measuredAt)), lb: Number(entry.details!.weightLb) })).sort((a,b)=>a.at-b.at || a.entry.id.localeCompare(b.entry.id));
}
export function weightTime(value: string | number) { return new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value)); }
