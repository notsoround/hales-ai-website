import { ACCOUNT_SESSIONS } from './accountMode';
import { accountData } from './accountSession';
import { privateAccessHeaders } from './privateAccess';
import type { PulseItem } from './pulseModel';

export type FeedQuery = { start?: string; end?: string; scope?: 'range' | 'history' | 'food-history'; cursor?: string };
export type FeedOutcomes = { wins: number | null; losses: number | null; missed: number | null; unscored: number | null; interventions?: number | null };
export type FeedData = {
  items: Array<PulseItem & { id: string; ts: number; time: string; icon: string; body: string }>;
  outcomes?: FeedOutcomes;
  personalOutcomes?: { wins: number; losses: number; unscored: number; total: number } | null;
  nextCursor?: string | null;
  totals?: { calories?: number | null; caloriesPartial?: boolean | null; missingCalories?: number | null; spendUsd?: number | null; loggedSpendUsd?: number | null; foodCount?: number | null; transactionCount?: number | null; weightLb?: number | null; weightDate?: string };
  daily?: Array<{ date: string; calories?: number | null; caloriesPartial?: boolean | null; missingCalories?: number | null; spendUsd?: number | null; foodCount?: number | null; transactionCount?: number | null }>;
  coverage?: { start: string; end: string; timezone?: string; scope?: string; source?: string; complete?: boolean; localComplete?: boolean; returnedCount?: number; totalCount?: number | null; spendSource?: string; notes?: string[] };
};

/** Account transport never reads the owner key or visits the legacy webhook. */
export async function feedRequest(query: FeedQuery = {}): Promise<FeedData> {
  let value: FeedData;
  if (ACCOUNT_SESSIONS) {
    value = await accountData<FeedData>({ action: 'feed_get', ...query });
    if (value.coverage?.source !== 'owned-local-ledgers') throw Error('The account feed source was not confirmed.');
  } else {
    const parameters = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined) as Array<[string, string]>);
    const response = await fetch('https://automate.hales.ai/webhook/cupcake-feed' + (parameters.size ? '?' + parameters : ''),
      { headers: privateAccessHeaders(), cache: 'no-store', signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw Error(`Request failed (${response.status})`);
    value = await response.json();
  }
  if (!Array.isArray(value?.items)) throw Error('Cupcake returned an invalid feed.');
  return value;
}

export function phoneOutcomesAvailable(value: FeedOutcomes | null | undefined) {
  return !!value && [value.wins, value.losses, value.missed, value.unscored, value.interventions].every(number => typeof number === 'number' && Number.isInteger(number) && number >= 0);
}

export function feedCoverage(value: FeedData) {
  return value.coverage ? `${value.coverage.complete === false ? 'Partial coverage. ' : ''}${(value.coverage.notes || []).join(' ')}`.trim() : '';
}
