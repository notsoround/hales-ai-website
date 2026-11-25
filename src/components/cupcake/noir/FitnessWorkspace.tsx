import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Dumbbell, Footprints, RefreshCw, Scale } from 'lucide-react';
import { ACCOUNT_SESSIONS } from '../accountMode';
import { libraryRequest } from '../library';
import { feedRequest } from '../feedApi';
import { useNutritionData } from '../nutritionApi';
import { addDays, nutritionDay } from '../nutritionModel';
import { TodayEnergy, useTodayExercise } from '../TodayEnergy';
import { AccountWorkoutPlan } from '../AccountWorkoutPlan';
import { SectionBoundary } from '../SectionBoundary';
import { useDataChanged } from '../dataChanges';
import { isUnknownAction } from '../exerciseApi';
import {
  hasRingconnMetrics,
  latestRingconnNight,
  RingconnUnavailableError,
  type RingconnNight,
} from '../ringconnApi';
import {
  StepsUnavailableError,
  listStepsDays,
  stepsDayLabel,
  stepsSourceLabel,
  stepsSourceSummary,
  stepsUpdatedLabel,
  type StepsDay,
} from '../stepsApi';
import {
  loadWeightPage,
  normalizeWeightMeasurements,
  recordQuickWeight,
  resolveHeadlineWeight,
  type BodyWeightSummary,
  type WeightPage,
} from '../weightApi';
import { Sparkline } from '../design/Visuals';

const STEP_GOAL = 8000;
const STALE_SYNC_MS = 36 * 3600000;
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
const shortMonthDay = (dayIso: string) =>
  new Date(`${dayIso}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });

function isOlderThan36h(dateIso: string, timestampIso?: string, nowMs = Date.now()): boolean {
  if (timestampIso) {
    const ms = Date.parse(timestampIso);
    if (Number.isFinite(ms)) return nowMs - ms > STALE_SYNC_MS;
  }
  const dayEndMs = Date.parse(`${dateIso}T23:59:59Z`);
  return Number.isFinite(dayEndMs) && nowMs - dayEndMs > STALE_SYNC_MS;
}

type FeedRow = {
  id?: string;
  type: string;
  date: string;
  time: string;
  title: string;
  body: string;
  ts: number;
  amount?: number | null;
  currency?: string | null;
  details?: Record<string, unknown>;
};

function InlineErrorLine({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="nx-fitness-error"
      role="alert"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '4px 12px',
        padding: '8px 12px',
        borderLeft: '2px solid var(--nx-warm)',
        borderRadius: '0 12px 12px 0',
        background: 'color-mix(in oklab, var(--nx-warm) 9%, transparent)',
        color: 'var(--nx-ink)',
        fontSize: '13.5px',
        lineHeight: 1.4,
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        className="cc-text-button nx-retry-btn"
        onClick={onRetry}
        style={{ minHeight: 44, padding: '0 4px', fontWeight: 600 }}
      >
        Retry
      </button>
    </div>
  );
}

export function FitnessWorkspace({
  onOpenWeight,
}: {
  onOpenWeight: () => void;
}) {
  const today = nutritionDay();
  const nutrition = useNutritionData();
  const exercise = useTodayExercise();
  const [logExerciseRequest, setLogExerciseRequest] = useState(0);
  const [items, setItems] = useState<FeedRow[] | null>(null);

  const [stepsState, setStepsState] = useState<{
    status: 'loading' | 'ready' | 'unavailable' | 'error';
    days: StepsDay[];
  }>({ status: 'loading', days: [] });

  const [weightState, setWeightState] = useState<{
    loading: boolean;
    error: boolean;
    page: WeightPage | null;
    body: BodyWeightSummary | null;
  }>({ loading: true, error: false, page: null, body: null });

  const [sleepState, setSleepState] = useState<{
    status: 'loading' | 'ready' | 'unavailable' | 'error';
    night: RingconnNight | null;
  }>({ status: 'loading', night: null });

  const [weighOpen, setWeighOpen] = useState(false);
  const [weighRaw, setWeighRaw] = useState('');
  const [weighBusy, setWeighBusy] = useState(false);
  const [weighErr, setWeighErr] = useState('');
  const [weighSaved, setWeighSaved] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadSteps = useCallback(() => {
    setNowMs(Date.now());
    setStepsState(prev => ({ ...prev, status: 'loading' }));
    listStepsDays(body => libraryRequest(body), addDays(today, -30), today)
      .then(days => setStepsState({ status: 'ready', days }))
      .catch(err =>
        setStepsState(prev => ({
          status: err instanceof StepsUnavailableError ? 'unavailable' : 'error',
          days: err instanceof StepsUnavailableError ? [] : prev.days,
        })),
      );
  }, [today]);

  const loadFeed = useCallback(() => {
    feedRequest({ start: today, end: today })
      .then(d => setItems((d.items || []) as FeedRow[]))
      .catch(() => setItems([]));
  }, [today]);

  const loadWeight = useCallback(() => {
    setWeightState(prev => ({ ...prev, loading: true, error: false }));
    void Promise.allSettled([
      loadWeightPage(),
      libraryRequest<{ body?: BodyWeightSummary }>({ action: 'body_headline_get' }),
    ]).then(([w, b]) => {
      const pageFailed = w.status === 'rejected';
      const bodyFailed = b.status === 'rejected' && !isUnknownAction(b.reason);
      setWeightState(prev => ({
        loading: false,
        error: pageFailed || bodyFailed,
        page: w.status === 'fulfilled' ? w.value : prev.page,
        body: b.status === 'fulfilled' ? (b.value.body ?? null) : prev.body,
      }));
    });
  }, []);

  const loadSleep = useCallback(() => {
    setSleepState(prev => ({ ...prev, status: 'loading' }));
    latestRingconnNight(body => libraryRequest(body), addDays(today, -30), today)
      .then(night => setSleepState({ status: 'ready', night }))
      .catch(err =>
        setSleepState(prev => ({
          status: err instanceof RingconnUnavailableError ? 'unavailable' : 'error',
          night: err instanceof RingconnUnavailableError ? null : prev.night,
        })),
      );
  }, [today]);

  useEffect(() => {
    loadSteps();
    loadFeed();
    loadWeight();
    loadSleep();
  }, [loadSteps, loadFeed, loadWeight, loadSleep]);

  useDataChanged([], loadSteps);
  useDataChanged([], loadSleep);
  useDataChanged(['weight'], loadWeight);
  useDataChanged(['exercise', 'food', 'glucose'], loadFeed);

  const exerciseWithRefresh = ACCOUNT_SESSIONS
    ? {
        ...exercise,
        add: (entry: Parameters<typeof exercise.add>[0]) => { exercise.add(entry); loadFeed(); },
        remove: (id: string) => { exercise.remove(id); loadFeed(); },
      }
    : exercise;

  const todaySteps = useMemo(() => stepsState.days.find(d => d.date === today) || null, [stepsState.days, today]);
  const activeSteps = todaySteps || stepsState.days[0] || null;
  const recent7 = useMemo(() => {
    const byDate = new Map(stepsState.days.map(d => [d.date, d]));
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i - 6);
      return { date, day: byDate.get(date) || null };
    });
  }, [stepsState.days, today]);
  const maxBar = useMemo(() => Math.max(STEP_GOAL, ...recent7.map(r => r.day?.count ?? 0)), [recent7]);

  const measurements = useMemo(() => normalizeWeightMeasurements(weightState.page), [weightState.page]);
  const headlineW = useMemo(() => resolveHeadlineWeight(weightState.page, weightState.body), [weightState.page, weightState.body]);
  const trend30 = useMemo(() => {
    const now = Date.now();
    return measurements.filter(m => now - Date.parse(m.measuredAt) <= 30 * 864e5).map(m => m.weightLb);
  }, [measurements]);

  const parsedWeight = Number(weighRaw.trim());
  const weightValid = weighRaw.trim().length > 0 && Number.isFinite(parsedWeight) && parsedWeight >= 40 && parsedWeight <= 999;

  const submitWeighIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!weightValid || weighBusy) return;
    setWeighBusy(true);
    setWeighErr('');
    setWeighSaved('');
    try {
      await recordQuickWeight(parsedWeight);
      setWeighRaw('');
      setWeighOpen(false);
      setWeighSaved(`Saved ${parsedWeight.toFixed(1)} lb`);
      loadWeight();
    } catch (e) {
      setWeighErr(e instanceof Error ? e.message : 'Could not save weigh-in right now.');
    } finally {
      setWeighBusy(false);
    }
  };

  const stepPct = activeSteps ? Math.min(100, Math.round((activeSteps.count / STEP_GOAL) * 100)) : 0;
  const stepsStale = Boolean(activeSteps && isOlderThan36h(activeSteps.date, activeSteps.updatedAt, nowMs));
  const sleepNight = sleepState.night;
  const validSleepNight = sleepNight && hasRingconnMetrics(sleepNight) ? sleepNight : null;
  const sleepStale = Boolean(validSleepNight && isOlderThan36h(validSleepNight.nightId, validSleepNight.capturedAt, nowMs));
  const hasConnectedHealthState = Boolean(
    activeSteps ||
    validSleepNight ||
    measurements.some(m => m.basis === 'health_connect' || m.source.toLowerCase().includes('health')),
  );
  const stepsMissingConnected = stepsState.status === 'ready' && !activeSteps && hasConnectedHealthState;
  const sleepMissingConnected = sleepState.status === 'ready' && !validSleepNight && hasConnectedHealthState;

  return (
    <section className="nx-fitness" aria-label="Fitness">
      <header className="nx-fitness-head">
        <div>
          <span className="cc-eyebrow">Movement &amp; body</span>
          <h2>Fitness</h2>
        </div>
        <button
          type="button"
          className="cc-primary nx-fitness-log-btn"
          onClick={() => setLogExerciseRequest(n => n + 1)}
        >
          <Dumbbell size={16} aria-hidden="true" />
          <span>Log workout</span>
        </button>
      </header>

      <div className="nx-fitness-top">
      <article className="cc-card nx-steps-card" aria-label="Steps">
        <div className="cc-heading-row">
          <h3 className="cc-card-title">
            <Footprints size={16} aria-hidden="true" />
            <span>{todaySteps ? 'Steps today' : activeSteps ? `Steps · ${stepsDayLabel(activeSteps.date)}` : 'Steps today'}</span>
          </h3>
          <button
            type="button"
            className="cc-text-button"
            disabled={stepsState.status === 'loading'}
            onClick={loadSteps}
            aria-label="Refresh steps"
          >
            <RefreshCw size={14} aria-hidden="true" className={stepsState.status === 'loading' ? 'is-spinning' : undefined} />
            <span>Refresh</span>
          </button>
        </div>

        {stepsState.status === 'loading' && !activeSteps ? (
          <p className="cc-muted" role="status">Checking synced steps…</p>
        ) : stepsState.status === 'unavailable' ? (
          <p className="cc-muted">Steps sync isn’t enabled on this account yet. Connect Apple Health or Health Connect in Settings → Connections.</p>
        ) : stepsState.status === 'error' && !activeSteps ? (
          <InlineErrorLine message="Couldn't load steps right now." onRetry={loadSteps} />
        ) : !activeSteps ? (
          <div className="nx-steps-empty">
            <strong className="nx-steps-big">—</strong>
            <p className="cc-muted">
              {stepsMissingConnected
                ? validSleepNight
                  ? `Last synced ${shortMonthDay(validSleepNight.nightId)} · Check Health Connect in Settings`
                  : 'No recent steps synced · Check Health Connect in Settings'
                : 'No steps synced in the last 30 days. Connect Apple Health or Health Connect in Settings → Connections.'}
            </p>
          </div>
        ) : (
          <>
            <div className="nx-steps-hero">
              <div>
                <strong className="nx-steps-big">{fmtInt(activeSteps.count)}</strong>
                <span className="nx-steps-goal">of {fmtInt(STEP_GOAL)} goal ({stepPct}%)</span>
              </div>
              <div className="nx-steps-meta">
                <span className="nx-steps-source">{stepsSourceSummary(activeSteps)}</span>
                <small>{stepsUpdatedLabel(activeSteps, nowMs)}</small>
              </div>
            </div>

            <div className="nx-steps-bar" role="progressbar" aria-valuenow={activeSteps.count} aria-valuemin={0} aria-valuemax={STEP_GOAL} aria-label="Daily step progress">
              <i style={{ width: `${stepPct}%` }} />
            </div>

            {stepsState.status === 'error' && (
              <InlineErrorLine message="Couldn't load steps right now." onRetry={loadSteps} />
            )}

            {stepsStale && (
              <p className="nx-stale-note cc-muted cc-small" role="status" style={{ margin: 0 }}>
                Last synced {shortMonthDay(activeSteps.date)} · Check Health Connect in Settings
              </p>
            )}

            {activeSteps.sources && activeSteps.sources.length > 1 && (
              <div className="nx-steps-sources" aria-label="Synced devices">
                {activeSteps.sources.map(src => (
                  <span key={src.source} className={src.source === (activeSteps.winningSource || activeSteps.source) ? 'is-winner' : undefined}>
                    {stepsSourceLabel(src.source)} · {fmtInt(src.count)}
                  </span>
                ))}
              </div>
            )}

            {stepsState.days.length > 1 && (
              <div className="nx-steps-week" aria-label="Last 7 days steps">
                {recent7.map(slot => {
                  const h = slot.day ? Math.max(8, Math.round((slot.day.count / maxBar) * 100)) : 4;
                  const shortDay = new Date(`${slot.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'narrow' });
                  return (
                    <div key={slot.date} className={`nx-steps-col${slot.date === today ? ' is-today' : ''}${slot.day ? '' : ' is-empty'}`} title={`${stepsDayLabel(slot.date)}: ${slot.day ? `${fmtInt(slot.day.count)} steps` : 'no data'}`}>
                      <span className="nx-steps-col-track"><i style={{ height: `${h}%` }} /></span>
                      <small>{shortDay}</small>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </article>

      <article className="cc-card nx-fitness-weight" aria-label="Weight">
        <div className="cc-heading-row">
          <h3 className="cc-card-title">
            <Scale size={16} aria-hidden="true" />
            <span>Weight</span>
          </h3>
          <button type="button" className="cc-text-button" onClick={onOpenWeight}>
            <span>Full history</span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="nx-fitness-weight-row">
          <div>
            <strong className="nx-fitness-weight-val">
              {weightState.loading && !headlineW ? '—' : headlineW ? headlineW.valueLb.toFixed(1) : '—'}
              {headlineW && <small> lb</small>}
            </strong>
            {weightState.loading && !headlineW ? (
              <span className="cc-muted cc-small">Checking weight…</span>
            ) : weightState.error && !headlineW ? null : (
              <span className="cc-muted cc-small">
                {headlineW
                  ? headlineW.deltaLb !== null
                    ? `${headlineW.deltaLb <= 0 ? '▼ −' : '▲ +'}${Math.abs(headlineW.deltaLb).toFixed(1)} lb this week`
                    : headlineW.label
                  : 'No weigh-in logged yet'}
              </span>
            )}
          </div>
          {trend30.length >= 2 && (
            <div className="nx-fitness-spark" aria-hidden="true">
              <Sparkline values={trend30} width={132} height={36} />
              <small>30 days</small>
            </div>
          )}
        </div>

        {weightState.error && (
          <InlineErrorLine message="Couldn't load weight right now." onRetry={loadWeight} />
        )}

        {weighSaved && <p className="nx-fitness-saved" role="status">{weighSaved}</p>}

        {!weighOpen ? (
          <div className="nx-fitness-weight-actions">
            <button type="button" className="cc-secondary" onClick={() => { setWeighOpen(true); setWeighSaved(''); }}>
              Quick weigh-in
            </button>
          </div>
        ) : (
          <form className="nx-fitness-weigh-form" onSubmit={e => void submitWeighIn(e)}>
            <label className="cc-label">
              <span>Current weight (lb)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="40"
                max="999"
                disabled={weighBusy}
                value={weighRaw}
                placeholder={headlineW ? headlineW.valueLb.toFixed(1) : 'e.g. 198.4'}
                onChange={e => { setWeighRaw(e.target.value); setWeighErr(''); }}
              />
            </label>
            {weighErr && <p className="cc-error" role="alert">{weighErr}</p>}
            <div className="nx-fitness-weight-actions">
              <button type="submit" className="cc-primary" disabled={!weightValid || weighBusy}>
                {weighBusy ? 'Saving…' : 'Save weigh-in'}
              </button>
              <button type="button" className="cc-secondary" disabled={weighBusy} onClick={() => setWeighOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </article>
      </div>

      {sleepState.status === 'error' ? (
        <InlineErrorLine message="Couldn't load RingConn sleep sync right now." onRetry={loadSleep} />
      ) : sleepStale && validSleepNight ? (
        <p className="nx-stale-note cc-muted cc-small" role="status" style={{ margin: 0 }}>
          RingConn last synced {shortMonthDay(validSleepNight.nightId)} · Open RingConn app to sync
        </p>
      ) : sleepMissingConnected ? (
        <p className="nx-stale-note cc-muted cc-small" role="status" style={{ margin: 0 }}>
          No recent RingConn sleep · Open RingConn app to sync
        </p>
      ) : null}

      <SectionBoundary label="Exercise & energy">
        <TodayEnergy
          items={items}
          nutrition={nutrition}
          exercise={exerciseWithRefresh}
          openLogRequest={logExerciseRequest}
        />
      </SectionBoundary>

      {ACCOUNT_SESSIONS && (
        <SectionBoundary label="Workout plan">
          <AccountWorkoutPlan />
        </SectionBoundary>
      )}
    </section>
  );
}
