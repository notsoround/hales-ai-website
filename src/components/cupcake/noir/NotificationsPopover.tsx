import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, ChevronRight, PhoneMissed, Receipt, RefreshCw, Scale, Sparkles, Utensils, X } from 'lucide-react';
import { AccountRequestError } from '../accountSession';
import { libraryRequest } from '../library';
import { useDataChanged } from '../dataChanges';
import { useBackClose } from '../nativeFeel';
import { loadWeightPage, normalizeWeightMeasurements } from '../weightApi';
import { lastLoggedMeal, nutritionDay, type FoodHistoryMeal } from '../nutritionModel';
import { openMissedCalls } from '../phoneCallHistory';
import { personalStorage } from '../personalStorage';

export type NotificationTarget = 'talk' | 'snap' | 'fitness' | 'library' | 'week' | 'settings' | 'receipts';

export type NotificationActionItem = {
  id: string;
  kind: 'missed_calls' | 'unmatched_receipts' | 'low_allowance' | 'stale_sync' | 'no_meal' | 'general';
  count: number;
  title: string;
  detail: string;
  target: NotificationTarget;
};

export type NotificationsSummarySnapshot = {
  unreadCount: number;
  missedCalls7d: number;
  unmatchedReceipts: number;
  lowAllowance: boolean;
  staleSyncs: number;
  items: NotificationActionItem[];
  source: 'server' | 'fallback';
};

type ServerNotificationItem = {
  id?: unknown;
  kind?: unknown;
  count?: unknown;
  title?: unknown;
  detail?: unknown;
  targetTab?: unknown;
  action?: unknown;
  ts?: unknown;
};

type ServerSummaryResponse = {
  unreadCount?: unknown;
  missedCalls7d?: unknown;
  unmatchedReceipts?: unknown;
  lowAllowance?: unknown;
  staleSyncs?: unknown;
  items?: unknown;
};

type FallbackReceipt = {
  id?: string;
  status?: string;
  matchedTransactionId?: string | null;
  paymentMethod?: string | null;
  paidWithCash?: boolean;
};

const CASH_RECEIPTS_KEY = 'cupcake-receipt-cash-v1';
const SEEN_NOTIF_KEY = 'cc-notif-seen-v1';
const INITIAL_FETCH_DELAY_MS = 600;

function readCashReceiptIds(): Set<string> {
  try {
    const raw = personalStorage('localStorage').getItem(CASH_RECEIPTS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function readSeenFingerprint(): string {
  try {
    return personalStorage('localStorage').getItem(SEEN_NOTIF_KEY) || '';
  } catch {
    return '';
  }
}

function writeSeenFingerprint(fingerprint: string) {
  try {
    if (fingerprint) personalStorage('localStorage').setItem(SEEN_NOTIF_KEY, fingerprint);
  } catch {
    // Storage may be unavailable or signed out.
  }
}

function notificationSummaryFingerprint(summary: NotificationsSummarySnapshot | null): string {
  if (!summary || !summary.items.length) return '';
  return summary.items
    .map(item => `${item.id}:${item.kind}:${item.count}:${item.title}`)
    .sort()
    .join('|');
}

function isActionUnsupportedError(error: unknown): boolean {
  if (error instanceof AccountRequestError) {
    return error.code === 'unknown_action' || error.code === 'account_action_not_ready';
  }
  if (error instanceof Error) {
    return error.message === 'unknown_action' || error.message === 'account_action_not_ready';
  }
  return false;
}

function asNonNegInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mapTarget(rawTarget: string, kind: string): NotificationTarget {
  const t = rawTarget.toLowerCase();
  if (t === 'talk' || t === 'voice') return 'talk';
  if (t === 'receipts' || kind.includes('receipt')) return 'receipts';
  if (t === 'snap' || t === 'food') return 'snap';
  if (t === 'fitness' || t === 'steps' || t === 'weight') return 'fitness';
  if (t === 'library') return 'library';
  if (t === 'week' || t === 'history') return 'week';
  if (t === 'settings' || t === 'connections') return 'settings';
  if (kind.includes('call')) return 'talk';
  if (kind.includes('allowance') || kind.includes('budget')) return 'settings';
  if (kind.includes('sync') || kind.includes('stale') || kind.includes('step') || kind.includes('weight')) return 'fitness';
  if (kind.includes('meal') || kind.includes('food')) return 'snap';
  return 'talk';
}

function mapKind(rawKind: string): NotificationActionItem['kind'] {
  const k = rawKind.toLowerCase();
  if (k.includes('call') || k.includes('missed')) return 'missed_calls';
  if (k.includes('receipt')) return 'unmatched_receipts';
  if (k.includes('allowance') || k.includes('budget')) return 'low_allowance';
  if (k.includes('stale') || k.includes('sync') || k.includes('weight') || k.includes('step')) return 'stale_sync';
  if (k.includes('meal') || k.includes('food')) return 'no_meal';
  return 'general';
}

function parseServerSummary(data: ServerSummaryResponse): NotificationsSummarySnapshot {
  const missedCalls7d = asNonNegInt(data.missedCalls7d);
  const unmatchedReceipts = asNonNegInt(data.unmatchedReceipts);
  const lowAllowance = data.lowAllowance === true;
  const staleSyncs = asNonNegInt(data.staleSyncs);
  const items: NotificationActionItem[] = [];

  if (Array.isArray(data.items)) {
    for (let i = 0; i < data.items.length; i++) {
      const raw = data.items[i] as ServerNotificationItem;
      if (!raw || typeof raw !== 'object') continue;
      const rawKind = asString(raw.kind);
      const kind = mapKind(rawKind);
      const count = asNonNegInt(raw.count);
      const title = asString(raw.title);
      const detail = asString(raw.detail);
      if (!title) continue;
      items.push({
        id: asString(raw.id) || `srv-${kind}-${i}`,
        kind,
        count: count || 1,
        title: kind === 'missed_calls' ? 'Missed call recaps' : title,
        detail: kind === 'missed_calls' ? 'Read or listen to saved recaps' : detail || (kind === 'unmatched_receipts' ? 'Review →' : 'Open →'),
        target: mapTarget(asString(raw.targetTab) || asString(raw.action), rawKind),
      });
    }
  }

  if (!items.length) {
    if (missedCalls7d > 0) {
      items.push({
        id: 'missed-calls',
        kind: 'missed_calls',
        count: missedCalls7d,
        title: 'Missed call recaps',
        detail: 'Read or listen to saved recaps',
        target: 'library',
      });
    }
    if (unmatchedReceipts > 0) {
      items.push({
        id: 'unmatched-receipts',
        kind: 'unmatched_receipts',
        count: unmatchedReceipts,
        title: `${unmatchedReceipts} unmatched ${unmatchedReceipts === 1 ? 'receipt' : 'receipts'}`,
        detail: 'Review →',
        target: 'receipts',
      });
    }
    if (lowAllowance) {
      items.push({
        id: 'low-allowance',
        kind: 'low_allowance',
        count: 1,
        title: 'AI allowance running low',
        detail: 'Review budget & settings →',
        target: 'settings',
      });
    }
    if (staleSyncs > 0) {
      items.push({
        id: 'stale-syncs',
        kind: 'stale_sync',
        count: staleSyncs,
        title: staleSyncs === 1 ? 'Health sync needs a check' : `${staleSyncs} health syncs are stale`,
        detail: 'Check steps & weight →',
        target: 'fitness',
      });
    }
  }

  const derivedCount = items.length;
  const reportedUnread = asNonNegInt(data.unreadCount);
  const unreadCount = items.length > 0
    ? (reportedUnread > 0 && reportedUnread < derivedCount ? reportedUnread : derivedCount)
    : reportedUnread;

  return {
    unreadCount,
    missedCalls7d,
    unmatchedReceipts,
    lowAllowance,
    staleSyncs,
    items,
    source: 'server',
  };
}

async function deriveClientFallback(): Promise<NotificationsSummarySnapshot> {
  const items: NotificationActionItem[] = [];
  let unmatchedReceipts = 0;
  let staleSyncs = 0;

  const today = nutritionDay();
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));

  const [receiptsRes, foodRes, weightRes] = await Promise.allSettled([
    libraryRequest<{ receipts?: FallbackReceipt[] }>({ action: 'receipt_list' }),
    libraryRequest<{ meals?: FoodHistoryMeal[] }>({ action: 'food_history', days: 2 }),
    loadWeightPage(),
  ]);

  if (receiptsRes.status === 'fulfilled' && Array.isArray(receiptsRes.value.receipts)) {
    const cashIds = readCashReceiptIds();
    for (const r of receiptsRes.value.receipts) {
      const matched = r.status === 'matched' || !!r.matchedTransactionId;
      const cash = r.paymentMethod === 'cash' || r.paidWithCash === true || (r.id ? cashIds.has(r.id) : false);
      if (!matched && !cash) unmatchedReceipts += 1;
    }
    if (unmatchedReceipts > 0) {
      items.push({
        id: 'fallback-receipts',
        kind: 'unmatched_receipts',
        count: unmatchedReceipts,
        title: `${unmatchedReceipts} unmatched ${unmatchedReceipts === 1 ? 'receipt' : 'receipts'}`,
        detail: 'Review →',
        target: 'receipts',
      });
    }
  }

  if (foodRes.status === 'fulfilled' && Array.isArray(foodRes.value.meals) && hour >= 10) {
    const last = lastLoggedMeal(foodRes.value.meals);
    const lastDay = last?.consumedAt
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.parse(last.consumedAt)))
      : '';
    if (lastDay !== today) {
      items.push({
        id: 'fallback-meal',
        kind: 'no_meal',
        count: 1,
        title: 'No meal logged yet today',
        detail: 'Snap or log a meal →',
        target: 'snap',
      });
    }
  }

  if (weightRes.status === 'fulfilled') {
    const measurements = normalizeWeightMeasurements(weightRes.value);
    const latest = measurements[measurements.length - 1];
    if (latest) {
      const ageMs = Date.now() - Date.parse(latest.measuredAt);
      if (Number.isFinite(ageMs) && ageMs > 48 * 3600000) {
        staleSyncs += 1;
        const days = Math.max(2, Math.round(ageMs / 86400000));
        items.push({
          id: 'fallback-weight',
          kind: 'stale_sync',
          count: 1,
          title: `Weight not synced for ${days} days`,
          detail: 'Log weigh-in →',
          target: 'fitness',
        });
      }
    }
  }

  return {
    unreadCount: items.length,
    missedCalls7d: 0,
    unmatchedReceipts,
    lowAllowance: false,
    staleSyncs,
    items,
    source: 'fallback',
  };
}

function ItemIcon({ kind }: { kind: NotificationActionItem['kind'] }) {
  if (kind === 'missed_calls') return <PhoneMissed size={16} aria-hidden="true" />;
  if (kind === 'unmatched_receipts') return <Receipt size={16} aria-hidden="true" />;
  if (kind === 'low_allowance') return <Sparkles size={16} aria-hidden="true" />;
  if (kind === 'stale_sync') return <Scale size={16} aria-hidden="true" />;
  if (kind === 'no_meal') return <Utensils size={16} aria-hidden="true" />;
  return <Bell size={16} aria-hidden="true" />;
}

export function NotificationsPopover({
  onNavigate,
  onSummary,
}: {
  onNavigate: (target: NotificationTarget) => void;
  onSummary?: (summary: NotificationsSummarySnapshot) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<NotificationsSummarySnapshot | null>(null);
  const [seenFingerprint, setSeenFingerprint] = useState<string>(() => readSeenFingerprint());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const openRef = useRef(false);
  openRef.current = open;
  const initialTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const onSummaryRef = useRef(onSummary);
  onSummaryRef.current = onSummary;

  const markSeen = useCallback((target: NotificationsSummarySnapshot | null) => {
    const fingerprint = notificationSummaryFingerprint(target);
    if (!fingerprint) return;
    writeSeenFingerprint(fingerprint);
    setSeenFingerprint(fingerprint);
  }, []);

  const refresh = useCallback(async () => {
    if (initialTimerRef.current !== undefined) {
      window.clearTimeout(initialTimerRef.current);
      initialTimerRef.current = undefined;
    }
    setLoading(true);
    try {
      const raw = await libraryRequest<ServerSummaryResponse>({ action: 'notifications_summary' });
      if (!mountedRef.current) return;
      const parsed = parseServerSummary(raw || {});
      setSummary(parsed);
      if (openRef.current) markSeen(parsed);
      onSummaryRef.current?.(parsed);
    } catch (error) {
      if (!mountedRef.current) return;
      if (isActionUnsupportedError(error)) {
        try {
          const fallback = await deriveClientFallback();
          if (!mountedRef.current) return;
          setSummary(fallback);
          if (openRef.current) markSeen(fallback);
          onSummaryRef.current?.(fallback);
        } catch {
          // Stay quiet when offline or unauthenticated.
        }
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [markSeen]);

  useEffect(() => {
    mountedRef.current = true;
    initialTimerRef.current = window.setTimeout(() => {
      initialTimerRef.current = undefined;
      void refresh();
    }, INITIAL_FETCH_DELAY_MS);
    return () => {
      mountedRef.current = false;
      if (initialTimerRef.current !== undefined) {
        window.clearTimeout(initialTimerRef.current);
        initialTimerRef.current = undefined;
      }
    };
  }, [refresh]);

  useDataChanged(['food', 'weight', 'exercise', 'outcome', 'purchase'], () => {
    void refresh();
  });

  const close = useCallback((byPointer = false) => {
    setOpen(false);
    if (byPointer) {
      triggerRef.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    } else {
      triggerRef.current?.focus();
    }
  }, []);
  const closeByKeyboard = useCallback(() => close(false), [close]);

  useBackClose(open, closeByKeyboard);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(false);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  const currentFingerprint = notificationSummaryFingerprint(summary);
  const seen = Boolean(currentFingerprint && currentFingerprint === seenFingerprint);
  const unread = seen ? 0 : (summary?.unreadCount ?? 0);
  const badge = unread > 99 ? '99+' : String(unread);
  const items = summary?.items ?? [];

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      markSeen(summary);
      void refresh();
    }
  };

  const handlePick = (item: NotificationActionItem) => {
    setOpen(false);
    if (item.kind === 'missed_calls') openMissedCalls();
    else onNavigate(item.target);
  };

  return (
    <div className={`nx-notif${open ? ' is-open' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="nx-notif-btn"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={handleToggle}
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && <span className="nx-notif-badge" aria-hidden="true">{badge}</span>}
      </button>

      {open && (
        <>
          <div className="nx-notif-scrim" aria-hidden="true" onClick={() => close(true)} />
          <div ref={panelRef} className="nx-notif-panel" role="dialog" aria-label="Notifications">
            <header className="nx-notif-head">
              <div>
                <strong>Notifications</strong>
                {items.length > 0 && <small>{items.length} needing attention</small>}
              </div>
              <div className="nx-notif-head-actions">
                <button
                  type="button"
                  className="nx-notif-icon-btn"
                  aria-label="Refresh notifications"
                  disabled={loading}
                  onClick={() => void refresh()}
                >
                  <RefreshCw size={15} aria-hidden="true" className={loading ? 'is-spinning' : undefined} />
                </button>
                <button
                  type="button"
                  className="nx-notif-icon-btn"
                  aria-label="Close notifications"
                  onClick={event => close(event.detail > 0)}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </header>

            {loading && !summary ? (
              <p className="nx-notif-empty" role="status">Checking your updates…</p>
            ) : !items.length ? (
              <p className="nx-notif-empty">You’re all caught up. Nothing needs attention right now.</p>
            ) : (
              <ul className="nx-notif-list">
                {items.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`nx-notif-item is-${item.kind}`}
                      onClick={() => handlePick(item)}
                    >
                      <span className="nx-notif-item-ico"><ItemIcon kind={item.kind} /></span>
                      <span className="nx-notif-item-copy">
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <ChevronRight size={15} aria-hidden="true" className="nx-notif-item-chev" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
