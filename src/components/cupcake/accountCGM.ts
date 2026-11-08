import { accountHealth, assertGeneration, sessionSnapshot } from './accountSession';

export type CGMReason = null | 'unsupported_account' | 'credential_unavailable' | 'source_offline' | 'invalid_source_response' | 'not_connected' | 'no_saved_reading';
export type CGMFreshness = 'current' | 'stale' | 'future' | 'unknown';
export type CGMStatus = {
  available: boolean; reason: CGMReason; source: 'libre-cgm'; basis: 'stored_sensor_observation';
  latest: null | { value: number; unit: 'mg/dL'; observedAt: string | null; trend: string };
  timestampBasis: 'saved_libre_log'; originalProviderTimestampVerified: false;
  freshness: CGMFreshness; ageMinutes: number | null; checkedAt: string; providerCheckedAt: null;
  sourceStatus: string | null; connected: boolean | null; manualReadingsIncluded: false; readOnly: true;
  coverage: 'Latest saved Libre observation only; not complete CGM history';
};
const reasons: readonly CGMReason[] = [null, 'unsupported_account', 'credential_unavailable', 'source_offline', 'invalid_source_response', 'not_connected', 'no_saved_reading'];
const freshness: readonly CGMFreshness[] = ['current', 'stale', 'future', 'unknown'];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max && !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
const utc = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const invalid = () => Error('Saved CGM source details could not be verified. Manual readings are unchanged.');
/** Validate source, unit and observation timing independently from a successful HTTP read. */
export function parseCGMStatus(value: unknown): CGMStatus {
  if (!object(value) || typeof value.available !== 'boolean' || !reasons.includes(value.reason as CGMReason)
    || value.source !== 'libre-cgm' || value.basis !== 'stored_sensor_observation' || !freshness.includes(value.freshness as CGMFreshness)
    || value.timestampBasis !== 'saved_libre_log' || value.originalProviderTimestampVerified !== false
    || !utc(value.checkedAt) || value.providerCheckedAt !== null || value.manualReadingsIncluded !== false || value.readOnly !== true
    || value.coverage !== 'Latest saved Libre observation only; not complete CGM history'
    || !(value.connected === null || typeof value.connected === 'boolean')
    || !(value.sourceStatus === null || text(value.sourceStatus, 200))
    || !(value.ageMinutes === null || typeof value.ageMinutes === 'number' && Number.isFinite(value.ageMinutes))) throw invalid();
  const latest = value.latest;
  if (value.available !== (latest !== null)) throw invalid();
  if (latest !== null && (!object(latest) || typeof latest.value !== 'number' || !Number.isFinite(latest.value) || latest.value <= 0 || latest.value >= 1000
    || latest.unit !== 'mg/dL' || !(latest.observedAt === null || utc(latest.observedAt)) || !text(latest.trend, 32))) throw invalid();
  if (!latest && (value.freshness !== 'unknown' || value.ageMinutes !== null || !value.reason)) throw invalid();
  if (latest && ![null, 'not_connected'].includes(value.reason as null | 'not_connected')) throw invalid();
  if (latest && object(latest)) {
    if (latest.observedAt === null && (value.freshness !== 'unknown' || value.ageMinutes !== null)) throw invalid();
    if (value.freshness !== 'unknown' && (latest.observedAt === null || value.ageMinutes === null)) throw invalid();
    if (latest.observedAt !== null) {
      const age = value.ageMinutes as number;
      if (typeof age !== 'number' || Math.abs((Date.parse(value.checkedAt as string) - Date.parse(latest.observedAt as string)) / 60000 - age) > 0.001
        || (age < 0 ? value.freshness !== 'future' : !['current', 'stale'].includes(value.freshness as string))
        || (age >= 15 && value.freshness === 'current')) throw invalid();
    }
    if (value.freshness === 'current' && (value.connected === false || value.reason !== null || value.sourceStatus !== 'ok' || (value.ageMinutes as number) < 0 || (value.ageMinutes as number) >= 15)) throw invalid();
    if (value.reason === 'not_connected' && value.connected !== false) throw invalid();
  }
  return value as CGMStatus;
}
/** Never upgrade a source-labelled stale/unknown reading. A recent snapshot also ages out while open. */
export function visibleCGMFreshness(data: CGMStatus, elapsedMilliseconds: number): CGMFreshness {
  return data.freshness === 'current' && data.ageMinutes !== null && data.ageMinutes + Math.max(0, elapsedMilliseconds) / 60000 >= 15 ? 'stale' : data.freshness;
}
export class CGMStatusClient {
  private generation = sessionSnapshot().generation;
  async read(signal?: AbortSignal) {
    assertGeneration(this.generation);
    const result = await accountHealth<{ cgm: unknown }>('cgm/latest', {}, signal);
    assertGeneration(this.generation);
    return parseCGMStatus(result.cgm);
  }
}
