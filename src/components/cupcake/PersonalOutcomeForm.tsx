import { useEffect, useRef, useState } from 'react';
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
const headingId = 'cc-record-outcome-heading';
const focusableSelector = 'button, [href], input, select, textarea, [tabindex]';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(focusableSelector)].filter(el => {
    if (el.tabIndex < 0 || el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
    if (el.closest('fieldset[disabled]')) return false;
    return (el as HTMLInputElement).type !== 'hidden';
  });
}

type TrapEvent = { key: string; shiftKey: boolean; preventDefault: () => void; stopPropagation: () => void };

function trapDialogKey(event: TrapEvent, dialog: HTMLElement | null, blocked: boolean, dismiss: () => void) {
  if (typeof document === 'undefined' || !dialog) return;
  if (event.key === 'Escape') {
    if (blocked) return;
    event.preventDefault();
    event.stopPropagation();
    dismiss();
    return;
  }
  if (event.key !== 'Tab') return;
  const items = focusableIn(dialog);
  if (!items.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !dialog.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !dialog.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

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
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const pendingRef = useRef(pending);
  const busyRef = useRef(busy);
  const returnFocus = useRef(false);
  pendingRef.current = pending;
  busyRef.current = busy;
  const dismiss = () => {
    if (busyRef.current || pendingRef.current) return;
    returnFocus.current = true;
    setOpen(false);
  };
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!open) {
      if (!returnFocus.current) return;
      returnFocus.current = false;
      const launcher = launcherRef.current;
      if (launcher) launcher.focus();
      return;
    }
    const dialog = dialogRef.current;
    const preferred = pendingRef.current ? saveRef.current : titleRef.current;
    const initial = preferred && !preferred.disabled ? preferred : dialog;
    if (initial) initial.focus();
    const onKey = (event: KeyboardEvent) => trapDialogKey(event, dialogRef.current, !!(busyRef.current || pendingRef.current), () => dismissRef.current());
    const onFocusIn = (event: FocusEvent) => {
      const root = dialogRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      const items = focusableIn(root);
      (items[0] ?? root).focus();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    const previousOverflow = document.body?.style.overflow ?? '';
    if (document.body) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      if (document.body) document.body.style.overflow = previousOverflow;
    };
  }, [open, dismissRef]);
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
      setPending(null); setTitle(''); setNote(''); setOutcome(''); setConfirmed(false); setDate(chicagoDate());
      returnFocus.current = true;
      setOpen(false);
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
  const recorded = isoDate(date);
  const todayIso = isoDate(chicagoDate());
  const when = recorded === todayIso ? 'Today' : recorded === isoDate(chicagoDate(-1)) ? 'Yesterday' : recorded;
  return <>
    <button type="button" className="cc-primary cc-outcome-launcher" ref={launcherRef} aria-hidden={open || undefined} tabIndex={open ? -1 : undefined} onClick={() => setOpen(true)}>Add a win or setback</button>
    {open && <div className="cc-outcome-overlay" onMouseDown={event => { if (event.target === event.currentTarget) event.preventDefault(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1} ref={dialogRef} className="cc-card cc-outcome-form cc-meal-time" onKeyDown={event => trapDialogKey(event, dialogRef.current, !!(busy || pending), dismiss)} onSubmit={e => { e.preventDefault(); void save(); }}>
        <h4 id={headingId}>Record an outcome</h4><p className="cc-muted cc-small">Record something you did and how you want to score it. A setback counts as one personal loss. Nothing is scored automatically.</p>
        <fieldset disabled={busy || !!pending || !!recovery.error}><legend>Choose your outcome</legend><div className="cc-meal-time-choices"><button type="button" className="cc-secondary" aria-pressed={outcome === 'win'} onClick={() => { setOutcome('win'); setConfirmed(false); }}>Win</button><button type="button" className="cc-secondary" aria-pressed={outcome === 'loss'} onClick={() => { setOutcome('loss'); setConfirmed(false); }}>Setback</button></div>
          <label>What did you do?<input ref={titleRef} value={title} maxLength={160} required placeholder="e.g. Went for the walk I planned" onChange={e => { setTitle(e.target.value); setConfirmed(false); }} /></label>
          <label>Notes (optional)<textarea value={note} maxLength={2000} rows={3} placeholder="What helped, or what would you change next time?" onChange={e => { setNote(e.target.value); setConfirmed(false); }} /></label>
          <div className="cc-meal-time-choices"><button type="button" className="cc-secondary" onClick={() => { setDate(chicagoDate()); setConfirmed(false); }}>Today</button><button type="button" className="cc-secondary" onClick={() => { setDate(chicagoDate(-1)); setConfirmed(false); }}>Yesterday</button></div>
          <CalendarDateFields value={date} onChange={value => { setDate(value); setConfirmed(false); }} label="Outcome date" />
          <p className="cc-outcome-when">Date: {when}</p>
          <p className="cc-meal-time-help">Recorded for {isoDate(date)} · Chicago calendar date.</p>
          <label className="cc-meal-consent"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I want this counted as my reported {outcome === 'loss' ? 'setback' : outcome === 'win' ? 'win' : 'outcome'}.</label>
        </fieldset>
        {error && <p className="cc-error" role="alert">{error}</p>}
        {pending && !busy && <p className="cc-muted cc-small">This save is unconfirmed. Retry the same entry so it cannot count twice. Its text and retry details stay in this browser tab if you change views or reload; keep the tab open until confirmed.</p>}
        <div className="cc-meal-time-choices cc-outcome-actions"><button ref={saveRef} className="cc-primary" disabled={busy || !!recovery.error || (!pending && (!confirmed || !outcome || !title.trim()))}>{busy ? 'Saving…' : pending ? 'Retry same entry' : 'Save my outcome'}</button>{!pending && <button type="button" className="cc-secondary" disabled={busy} onClick={dismiss}>Keep draft & close</button>}</div>
      </form>
    </div>}
  </>;
}
