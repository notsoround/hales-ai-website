import { useEffect, useMemo, useRef, useState } from 'react';
import { CloudSun, MapPin } from 'lucide-react';
import { libraryRequest } from './library';
import { ReadAloudButton } from './ReadAloudButton';
import {
  pendingReset,
  savePendingReset,
  clearPendingReset,
  readChatStorage,
  writeChatStorage,
  resetDraftKey,
  selectedResetKey,
  type PendingReset,
} from './quickResetRecovery';

type Session = {
  id: string;
  request: { mode: string; message: string };
  status: string;
  response?: {
    reply: string;
    model: string;
    sources?: { title?: string; url?: string }[];
    recordsUnavailable?: boolean;
  };
  createdAt: number;
  outcome: string;
  note: string;
  error?: string;
};

type WeatherCoords = { latitude: number; longitude: number };

const outcomeLabel = (value: string) => (value === 'win' ? 'You did it' : value === 'loss' ? "You didn't" : 'Not scored');

function planLine(session: Session) {
  const note = session.note.trim();
  if (note) return note.slice(0, 4000);
  const reply = session.response?.reply?.trim() || '';
  const line = reply.split('\n').map(item => item.trim()).find(Boolean) || session.request.message;
  return line.slice(0, 4000);
}

function localContextFields(): { localDate: string; localTime: string; timeZone: string } {
  const now = new Date();
  let timeZone = 'America/Chicago';
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved) timeZone = resolved;
  } catch {
    // Fallback to America/Chicago.
  }
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const localTime = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now);
  return { localDate, localTime, timeZone };
}

/** Splits a reply containing numbered moves (1. / 2. / 3.) into structured move cards for 320px+ readability. */
function parseQuickMoves(reply: string): { intro: string; moves: string[]; outro: string } | null {
  const lines = reply.split(/\r?\n/);
  const introLines: string[] = [];
  const moves: string[] = [];
  const outroLines: string[] = [];
  let inMoves = false;

  for (const raw of lines) {
    const trimmed = raw.trim();
    const match = trimmed.match(/^(?:[1-3][.)]|Move\s+[1-3]:)\s*(.+)$/i);
    if (match && moves.length < 3) {
      inMoves = true;
      moves.push(match[1].trim());
      continue;
    }
    if (!inMoves) {
      if (trimmed) introLines.push(trimmed);
    } else if (trimmed) {
      if (moves.length > 0 && moves.length < 3 && !trimmed.startsWith('---')) {
        moves[moves.length - 1] = `${moves[moves.length - 1]} ${trimmed}`;
      } else {
        outroLines.push(trimmed);
      }
    }
  }
  if (moves.length < 2) return null;
  return { intro: introLines.join(' '), moves, outro: outroLines.join(' ') };
}

export function QuickReset({
  onBack,
  onMode,
  mode = 'reset',
}: {
  onBack: () => void;
  onMode?: (mode: 'tip' | 'reset') => void;
  mode?: 'tip' | 'reset';
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [current, setCurrent] = useState<Session | null>(null);
  const [message, setMessage] = useState(() => readChatStorage(resetDraftKey(mode)) || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedDecision, setSavedDecision] = useState(false);
  const [decisionText, setDecisionText] = useState('');
  const pending = useRef<PendingReset | null>(null);
  const sending = useRef(false);
  const [recovery, setRecovery] = useState<PendingReset | null>(null);
  const [checking, setChecking] = useState(true);

  const [weatherState, setWeatherState] = useState<'off' | 'locating' | 'ready' | 'denied'>('off');
  const [coords, setCoords] = useState<WeatherCoords | null>(null);
  const [weatherNote, setWeatherNote] = useState('');

  useEffect(() => {
    if (!writeChatStorage(resetDraftKey(mode), message)) {
      setError('Your draft cannot be saved in this browser. Keep this page open.');
    }
  }, [message, mode]);

  const load = async () => {
    const d = await libraryRequest<{ sessions: Session[] }>({ action: 'reset_list' });
    setSessions(d.sessions);
  };

  const acknowledge = (session: Session) => {
    setCurrent(session);
    setNote(session.note || '');
    setSavedDecision(false);
    setDecisionText(planLine(session));
    writeChatStorage(selectedResetKey, session.id);
    if (pending.current?.id === session.id) {
      clearPendingReset(session.id);
      pending.current = null;
      setRecovery(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const saved = pendingReset();
        pending.current = saved;
        if (saved) {
          setRecovery(saved);
          setMessage(saved.message);
        }
        const d = await libraryRequest<{ sessions: Session[] }>({ action: 'reset_list' });
        if (cancelled) return;
        setSessions(d.sessions);
        const id = saved?.id || readChatStorage(selectedResetKey);
        if (id) {
          const found = d.sessions.find(s => s.id === id);
          if (found) acknowledge(found);
          else {
            const detail = await libraryRequest<{ session: Session }>({ action: 'reset_get', id });
            if (!cancelled) acknowledge(detail.session);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(`Saved request status could not be confirmed. No new AI request was sent. ${e instanceof Error ? e.message : ''}`);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!current || !['queued', 'running'].includes(current.status)) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void libraryRequest<{ session: Session }>({ action: 'reset_get', id: current.id })
        .then(d => { if (!cancelled) setCurrent(d.session); })
        .catch(() => { if (!cancelled) setError('Your plan continues on the server. Reopen it to check.'); });
    }, 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [current]);

  const toggleWeather = () => {
    if (weatherState === 'ready') {
      setWeatherState('off');
      setCoords(null);
      setWeatherNote('');
      return;
    }
    if (weatherState === 'locating') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setWeatherState('denied');
      setWeatherNote('Location is not available in this browser.');
      return;
    }
    setWeatherState('locating');
    setWeatherNote('');
    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = Math.round(position.coords.latitude * 1000) / 1000;
        const lon = Math.round(position.coords.longitude * 1000) / 1000;
        if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          setCoords({ latitude: lat, longitude: lon });
          setWeatherState('ready');
          setWeatherNote('Local weather will be included with this request.');
        } else {
          setWeatherState('denied');
          setWeatherNote('Could not read coordinates. Continuing without weather.');
        }
      },
      () => {
        setWeatherState('denied');
        setCoords(null);
        setWeatherNote('Location not granted — continuing with local date and time only.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  };

  const start = async (retry = false) => {
    if (busy || sending.current || checking) return;
    if (recovery && !retry) {
      setError('Recover the saved request before starting another.');
      return;
    }
    const text = message.trim() || (
      mode === 'tip'
        ? 'Give me 3 practical quick moves for this time of day, based on my current records.'
        : 'Help me interrupt the spiral and pick 3 achievable moves for the next ten minutes.'
    );
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const stored = pendingReset();
      if (stored) pending.current = stored;
      if (!pending.current) pending.current = { id: crypto.randomUUID(), message: text, mode };
      savePendingReset(pending.current);
      setRecovery(pending.current);
      const context = localContextFields();
      const payload: Record<string, unknown> = {
        action: 'reset_start',
        ...pending.current,
        ...context,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      };
      const d = await libraryRequest<{ session: Session }>(payload);
      acknowledge(d.session);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not confirm the saved request.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const checkSaved = async () => {
    if (!recovery || busy) return;
    setBusy(true);
    setError('');
    try {
      const d = await libraryRequest<{ session: Session }>({ action: 'reset_get', id: recovery.id });
      acknowledge(d.session);
    } catch {
      setError('Still unable to confirm this request. Retry the same saved request when ready; do not create a replacement.');
    } finally {
      setBusy(false);
    }
  };

  const outcome = async (value: string) => {
    if (!current || busy) return;
    setBusy(true);
    setError('');
    try {
      const d = await libraryRequest<{ session: Session }>({ action: 'reset_outcome', id: current.id, outcome: value, note });
      setCurrent(d.session);
      setDecisionText(planLine(d.session));
      setSavedDecision(false);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveDecision = async () => {
    if (!current || busy || !decisionText.trim() || !['win', 'loss'].includes(current.outcome)) return;
    setBusy(true);
    setError('');
    try {
      await libraryRequest({
        action: 'decision_save',
        text: decisionText.trim(),
        type: 'decision',
        status: current.outcome === 'win' ? 'done' : 'open',
        sourceIds: [],
      });
      setSavedDecision(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The decision could not be saved. This plan score is unchanged.');
    } finally {
      setBusy(false);
    }
  };

  const scored = current && ['win', 'loss'].includes(current.outcome);
  const parsedMoves = useMemo(
    () => (current?.response?.reply ? parseQuickMoves(current.response.reply) : null),
    [current?.response?.reply]
  );

  return (
    <section className="cc-reset space-y-5 pb-6">
      <button type="button" onClick={onBack} className="cc-secondary cc-reset-back">← Today</button>
      <div>
        <p className="cc-eyebrow">Cupcake in your corner</p>
        <h2 className="mt-2 text-3xl font-bold">{mode === 'tip' ? 'Three good next moves.' : 'Take back the next ten minutes.'}</h2>
        <p className="cc-muted mt-3">
          {mode === 'tip'
            ? 'A short plan using your recent records, local time, and optional local weather. Tell me what’s happening, or let me start.'
            : 'One interrupt for the next ten minutes. It does not call anyone, and it does not change your scores until you say how it went.'}
        </p>
      </div>
      {onMode && (
        <button type="button" className="cc-text-button" onClick={() => onMode(mode === 'tip' ? 'reset' : 'tip')}>
          {mode === 'tip' ? 'I need a 10-minute reset instead' : 'Back to a quick tip'}
        </button>
      )}
      <textarea
        aria-label="What is happening right now?"
        value={message}
        onChange={e => setMessage(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="What’s pulling you off track? What do you need right now?"
        className="cc-reset-input"
      />
      <div className="cc-reset-controls">
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy || checking || !!recovery || (!!current && ['queued', 'running'].includes(current.status))}
          className="cc-primary cc-reset-go"
        >
          {busy ? 'Saving…' : mode === 'tip' ? 'Give me a Quick Tip' : 'Give me a Quick Reset'}
        </button>
        <button
          type="button"
          className={`cc-secondary cc-reset-weather${weatherState === 'ready' ? ' is-active' : ''}`}
          aria-pressed={weatherState === 'ready'}
          disabled={weatherState === 'locating' || busy}
          onClick={toggleWeather}
        >
          {weatherState === 'ready' ? <MapPin size={15} aria-hidden="true" /> : <CloudSun size={15} aria-hidden="true" />}
          <span>
            {weatherState === 'locating'
              ? 'Locating…'
              : weatherState === 'ready'
                ? 'Local weather included'
                : 'Include local weather'}
          </span>
        </button>
      </div>
      {weatherNote && <p className="cc-muted cc-small" role="status">{weatherNote}</p>}

      {recovery && (
        <div className="cc-card cc-reset-recovery">
          <p>Your {recovery.mode === 'tip' ? 'tip' : 'reset'} request is saved on this device. Closing this page will not change its request ID.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="cc-secondary" disabled={busy || checking} onClick={() => void checkSaved()}>Check saved request</button>
            <button type="button" className="cc-secondary" disabled={busy || checking} onClick={() => void start(true)}>Retry same saved request</button>
          </div>
          <p className="cc-muted cc-small mt-2">Checking is read-only. Retrying uses the same ID and will not restart an already saved job.</p>
        </div>
      )}

      {error && <p role="alert" className="cc-error">{error}</p>}

      {current && (
        <article className="cc-card cc-reset-plan space-y-4">
          <p className="cc-muted cc-small">{new Date(current.createdAt * 1000).toLocaleString()} · {outcomeLabel(current.outcome)}</p>
          {current.response ? (
            <>
              <ReadAloudButton text={current.response.reply} label={mode === 'tip' ? 'Play this tip' : 'Play this reset'} />
              {parsedMoves ? (
                <div className="cc-reset-moves-wrap">
                  {parsedMoves.intro && <p className="cc-reset-intro">{parsedMoves.intro}</p>}
                  <ol className="cc-reset-moves" aria-label="Quick moves">
                    {parsedMoves.moves.map((move, idx) => (
                      <li key={idx} className="cc-reset-move">
                        <span className="cc-reset-move-num" aria-hidden="true">{idx + 1}</span>
                        <p>{move}</p>
                      </li>
                    ))}
                  </ol>
                  {parsedMoves.outro && <p className="cc-muted cc-small">{parsedMoves.outro}</p>}
                </div>
              ) : (
                <p className="cc-reset-reply">{current.response.reply}</p>
              )}
              <p className="cc-muted cc-small">{current.response.model} · AI coaching, based on the sources available for this request.</p>
              {current.response.recordsUnavailable && (
                <p className="cc-error cc-small">Some current records were unavailable. This plan may be less specific.</p>
              )}
              {current.response.sources?.map((s, i) => (
                <p className="cc-small" key={i}>
                  {s.url?.startsWith('https://') ? <a href={s.url} target="_blank" rel="noreferrer">{s.title || 'Source'}</a> : s.title}
                </p>
              ))}
              <label className="cc-label">
                <span>How did it go?</span>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  maxLength={1000}
                  rows={2}
                  className="cc-reset-input"
                  placeholder="Optional outcome note"
                />
              </label>
              <div className="cc-reset-outcomes">
                {[['win', 'I did it'], ['loss', 'I didn’t'], ['unscored', 'Leave unscored']].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={busy}
                    onClick={() => void outcome(value)}
                    className={`cc-secondary cc-reset-outcome-btn${current.outcome === value ? ' is-selected' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="cc-muted cc-small">Only your response scores this plan. Silence stays unscored. Phone intervention scores and personal wins stay separate.</p>
              {current.outcome !== 'unscored' && (
                <p role="status" className="cc-small">
                  Saved on this plan and filed in your library. Cupcake can see it when you ask across your library. It does not check off a to-do or change your other scores.
                </p>
              )}
              {scored && (
                <div className="cc-decision-form">
                  <label className="cc-label">
                    {current.outcome === 'win' ? 'Save the move you finished' : 'Keep the move on your decision list'}
                    <textarea value={decisionText} onChange={e => setDecisionText(e.target.value)} maxLength={4000} rows={3} />
                  </label>
                  <p className="cc-muted cc-small">
                    {current.outcome === 'win' ? 'Saving marks this decision done in Review your day.' : 'Saving leaves this decision open in Review your day.'} Edit the words first. The tip itself stays an AI suggestion.
                  </p>
                  {savedDecision ? (
                    <p role="status">Saved on your decision list. Open Library, then Review your day, to see it.</p>
                  ) : (
                    <button type="button" className="cc-primary" disabled={busy || !decisionText.trim()} onClick={() => void saveDecision()}>
                      {current.outcome === 'win' ? 'Save as done' : 'Save as still open'}
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <p aria-live="polite">
              {['queued', 'running'].includes(current.status)
                ? 'Cupcake is checking your context and building a short plan. You can leave and come back.'
                : current.error || 'This attempt could not be confirmed.'}
            </p>
          )}
        </article>
      )}

      {!!sessions.length && (
        <details className="cc-reset-history">
          <summary>Your saved plans ({sessions.length})</summary>
          <div className="cc-reset-history-list">
            {sessions.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  try { acknowledge(s); } catch (e) { setError(String(e)); }
                }}
                className="cc-secondary cc-reset-history-item"
              >
                <span className="cc-reset-history-msg">{s.request.message.slice(0, 100)}</span>
                <small className="cc-muted">{new Date(s.createdAt * 1000).toLocaleDateString()} · {s.status} · {outcomeLabel(s.outcome)}</small>
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
