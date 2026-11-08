import { accountHealth, assertGeneration, sessionSnapshot } from './accountSession';

export type HealthDeviceStatus = { id: string; label: string; timezone: string; preferred_source: string; created_at: number; expires_at: number; revoked_at: number | null; status: 'active' | 'expired' | 'revoked'; last_received_at: number | null; last_observed_at: string | null; metrics: string[] };
export type HealthSyncStatus = { devices: HealthDeviceStatus[]; last_received_at: number | null; last_observed_at: string | null; metrics: string[]; coverage_note: string };
const epoch = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 8640000000000;
const optionalEpoch = (value: unknown) => value === null || epoch(value);
const observed = (value: unknown) => value === null || typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
const metrics = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 20 && value.every(v => typeof v === 'string' && v.length <= 80);
export function validateHealthStatus(value: HealthSyncStatus) {
  if (!value || !Array.isArray(value.devices) || value.devices.length > 200 || !optionalEpoch(value.last_received_at) || !observed(value.last_observed_at)
      || !metrics(value.metrics) || typeof value.coverage_note !== 'string' || value.coverage_note.length > 5000
      || value.devices.some(d => !d || typeof d.id !== 'string' || !d.id || d.id.length > 128 || typeof d.label !== 'string' || d.label.length > 80
        || typeof d.preferred_source !== 'string' || d.preferred_source.length > 200 || typeof d.timezone !== 'string' || d.timezone.length > 100
        || !epoch(d.created_at) || !epoch(d.expires_at) || !optionalEpoch(d.revoked_at) || !['active', 'expired', 'revoked'].includes(d.status)
        || !optionalEpoch(d.last_received_at) || !observed(d.last_observed_at) || !metrics(d.metrics))) throw Error('Health connection status could not be verified. Try checking again.');
  return value;
}
/** A pending read stays bound to the session that started it. */
export class HealthStatusClient {
  private generation = sessionSnapshot().generation;
  async read() {
    assertGeneration(this.generation);
    const result = await accountHealth<HealthSyncStatus>('sync', {});
    assertGeneration(this.generation);
    return validateHealthStatus(result);
  }
}
export const healthMetricLabel = (metric: string) => ({ step_count: 'Steps', heart_rate: 'Heart rate', sleep_analysis: 'Sleep estimate', summarized_sleep_analysis: 'Sleep estimate' })[metric] || 'Other supported observation';
/** Navigation opens existing Settings; it never creates a grant or starts an export. */
export function openHealthSettings() {
  const section = document.getElementById('account-health-connection');
  if (!section || !section.closest('details')) return false;
  for (let parent: HTMLElement | null = section.parentElement; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  }
  requestAnimationFrame(() => { section.scrollIntoView({ block: 'start' }); section.focus({ preventScroll: true }); });
  return true;
}
