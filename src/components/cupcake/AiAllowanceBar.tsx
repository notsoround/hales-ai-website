import { useEffect, useState } from 'react';
import { ACCOUNT_SESSIONS } from './accountMode';
import { accountData } from './accountSession';
import './noir/noir-plan.css';

type Budget = { enabled?: boolean; limitMicros?: number; usedMicros?: number; remainingMicros?: number; periodSeconds?: number; periodStart?: number | string | null; resetsAt?: number | string | null };
type View = { remaining: number; used: number; limit: number; resetHours: number | null };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const usd = (micros: number) => `$${(Math.max(0, micros) / 1_000_000).toFixed(2)}`;
// Servers send either epoch seconds, epoch milliseconds or an ISO string.
function instant(value: unknown): number | null {
  if (finite(value)) return value < 1e12 ? value * 1000 : value;
  if (typeof value === 'string') { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null; }
  return null;
}
function allowanceView(data: Budget | null | undefined, now = Date.now()): View | null {
  if (!data || data.enabled !== true || !finite(data.limitMicros) || data.limitMicros <= 0) return null;
  const used = finite(data.usedMicros) ? data.usedMicros : 0;
  const remaining = finite(data.remainingMicros) ? data.remainingMicros : data.limitMicros - used;
  let reset = instant(data.resetsAt);
  if (reset === null) { const start = instant(data.periodStart); if (start !== null && finite(data.periodSeconds)) reset = start + data.periodSeconds * 1000; }
  return { remaining, used, limit: data.limitMicros, resetHours: reset === null ? null : Math.max(0, Math.ceil((reset - now) / 3_600_000)) };
}

/** Compact AI-allowance headroom. Renders nothing unless the server reports an active allowance. */
export default function AiAllowanceBar({ refreshKey }: { refreshKey?: string | number }) {
  const [view, setView] = useState<View | null>(null);
  useEffect(() => {
    if (!ACCOUNT_SESSIONS) return;
    const controller = new AbortController();
    accountData<Budget>({ action: 'ai_budget_status' }, controller.signal)
      .then(data => { if (!controller.signal.aborted) setView(allowanceView(data)); })
      .catch(() => { if (!controller.signal.aborted) setView(null); });
    return () => controller.abort();
  }, [refreshKey]);
  if (!view) return null;
  const share = Math.min(1, Math.max(0, view.used / view.limit));
  const low = view.remaining / view.limit < 0.1;
  return <div className={`nx-allowance${low ? ' is-low' : ''}`} role="status" aria-label="AI allowance">
    <div className="nx-allowance-text">
      <strong>{usd(view.remaining)} left</strong>
      <span aria-hidden="true">·</span>
      <span>{usd(view.used)} / {usd(view.limit)}</span>
      {view.resetHours !== null && <><span aria-hidden="true">·</span><span>Resets in {view.resetHours}h</span></>}
    </div>
    <div className="nx-allowance-track" aria-hidden="true"><i style={{ width: `${Math.round(share * 100)}%` }} /></div>
  </div>;
}
