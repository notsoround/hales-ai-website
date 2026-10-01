import { useRef, useState } from 'react';
import { CalendarDateFields, type CalendarDate } from './CalendarDateFields';
import { libraryRequest } from './library';
import { LibraryApprovalCancelled } from './libraryApproval';
import { validDashboardDates } from './dashboardModel';
import { readPendingOutcome, keepPendingOutcome, clearPendingOutcome, type OutcomeRequest } from './personalOutcomeDraft';
import './meal-time.css';
import './personal-outcome-form.css';

export type SavedPersonalOutcome = { id: string; date: string; title: string; outcome: 'win' | 'loss' };
function chicagoDate(offset = 0): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  const day = new Date(Date.UTC(get('year'), get('month') - 1, get('day') + offset));
  return { year: String(day.getUTCFullYear()), month: String(day.getUTCMonth() + 1), day: String(day.getUTCDate()) };
}
const isoDate = (date: CalendarDate) => `${date.year}-${date.month.padStart(2, '0')}-${date.day.padStart(2, '0')}`;

export function PersonalOutcomeForm({ onSaved }: { onSaved: (entry: SavedPersonalOutcome) => void }) {
  const [recovery] = useState(() => {
    try { return readPendingOutcome(sessionStorage); }
    catch { return { pending: null, error: 'Browser storage is unavailable. Keep this draft open and allow storage before saving an outcome.' }; }
  });
  const [open, setOpen] = useState(!!recovery.pending || !!recovery.error);
  const [outcome, setOutcome] = useState<'win' | 'loss' | ''>(recovery.pending?.outcome || '');
  const [title, setTitle] = useState(recovery.pending?.title || '');
  const [note, setNote] = useState(recovery.pending?.note || '');
  const [date, setDate] = useState<CalendarDate>(() => recovery.pending ? { year: recovery.pending.date.slice(0, 4), month: String(Number(recovery.pending.date.slice(5, 7))), day: String(Number(recovery.pending.date.slice(8, 10))) } : chicagoDate());
  const [confirmed, setConfirmed] = useState(!!recovery.pending);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(recovery.error);
  const [pending, setPending] = useState<OutcomeRequest | null>(recovery.pending);
  const submitting = useRef(false);
  const save = async () => {
    if (submitting.current || recovery.error || (!pending && (!confirmed || !outcome || !title.trim()))) return;
    const day = isoDate(date);
    if (!pending && (!validDashboardDates(day, day) || day > isoDate(chicagoDate()))) { setError('Choose a real date no later than today in Chicago.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      const id = pending?.id || crypto.randomUUID();
      const request: OutcomeRequest = pending || { action: 'outcome_record', id, date: day, title: title.trim(), outcome: outcome as 'win' | 'loss', note: note.trim(), source: { type: 'owner-request', reference: `cupcake-web:${id}`, description: 'Explicitly recorded by the owner in Cupcake’s personal wins and setbacks form.' }, metrics: {} };
      keepPendingOutcome(sessionStorage, request);
      setPending(request);
      const result = await libraryRequest<{ entry: SavedPersonalOutcome; replayed: boolean; libraryIndexed: boolean }>(request);
      if (result.entry?.id !== request.id || result.entry.date !== request.date || result.entry.outcome !== request.outcome) throw new Error('The saved result was not confirmed. Retry this same entry.');
      clearPendingOutcome(sessionStorage, request.id);
      setPending(null); setTitle(''); setNote(''); setOutcome(''); setConfirmed(false); setDate(chicagoDate()); setOpen(false);
      onSaved(result.entry);
    } catch (e) {
      if (e instanceof LibraryApprovalCancelled && !pending) {
        try {
          const held = readPendingOutcome(sessionStorage).pending;
          if (held) clearPendingOutcome(sessionStorage, held.id);
          setPending(null); setConfirmed(false);
        } catch { setError('Nothing was approved, but retry details could not be cleared. Keep this tab open and retry once storage is available.'); return; }
      }
      setError(e instanceof Error ? e.message : 'The save was not confirmed. Retry this same entry.');
    }
    finally { submitting.current = false; setBusy(false); }
  };
  if (!open) return <button type="button" className="cc-primary" onClick={() => setOpen(true)}>Add a win or setback</button>;
  return <form className="cc-card cc-outcome-form cc-meal-time" onSubmit={e => { e.preventDefault(); void save(); }}>
    <h4>What happened?</h4><p className="cc-muted cc-small">Record something you did and how you want to score it. A setback counts as one personal loss. Nothing is scored automatically.</p>
    <fieldset disabled={busy || !!pending || !!recovery.error}><legend>Choose your outcome</legend><div className="cc-meal-time-choices"><button type="button" className="cc-secondary" aria-pressed={outcome === 'win'} onClick={() => { setOutcome('win'); setConfirmed(false); }}>Win</button><button type="button" className="cc-secondary" aria-pressed={outcome === 'loss'} onClick={() => { setOutcome('loss'); setConfirmed(false); }}>Setback</button></div>
      <label>What did you do?<input value={title} maxLength={160} required placeholder="e.g. Went for the walk I planned" onChange={e => { setTitle(e.target.value); setConfirmed(false); }} /></label>
      <label>Notes (optional)<textarea value={note} maxLength={2000} rows={3} placeholder="What helped, or what would you change next time?" onChange={e => { setNote(e.target.value); setConfirmed(false); }} /></label>
      <div className="cc-meal-time-choices"><button type="button" className="cc-secondary" onClick={() => { setDate(chicagoDate()); setConfirmed(false); }}>Today</button><button type="button" className="cc-secondary" onClick={() => { setDate(chicagoDate(-1)); setConfirmed(false); }}>Yesterday</button></div>
      <CalendarDateFields value={date} onChange={value => { setDate(value); setConfirmed(false); }} label="Outcome date" />
      <p className="cc-meal-time-help">Recorded for {isoDate(date)} · Chicago calendar date.</p>
      <label className="cc-meal-consent"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I want this counted as my reported {outcome === 'loss' ? 'setback' : outcome === 'win' ? 'win' : 'outcome'}.</label>
    </fieldset>
    {error && <p className="cc-error" role="alert">{error}</p>}
    {pending && !busy && <p className="cc-muted cc-small">This save is unconfirmed. Retry the same entry so it cannot count twice. Its text and retry details stay in this browser tab if you change views or reload; keep the tab open until confirmed.</p>}
    <div className="cc-meal-time-choices"><button className="cc-primary" disabled={busy || !!recovery.error || (!pending && (!confirmed || !outcome || !title.trim()))}>{busy ? 'Saving…' : pending ? 'Retry same entry' : 'Save my outcome'}</button>{!pending && <button type="button" className="cc-secondary" disabled={busy} onClick={() => setOpen(false)}>Keep draft & close</button>}</div>
  </form>;
}
