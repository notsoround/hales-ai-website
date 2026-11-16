import { useEffect, useId, useRef, useState } from 'react';
import { ACCOUNT_SESSIONS } from './accountMode';
import { accountReplyReport, AccountRequestError, type ReportableReply } from './accountSession';
import { readLab } from './labsFlags';
import { useBackClose } from './nativeFeel';

export function ReportReply({ reply }: { reply: ReportableReply }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const close = () => { setOpen(false); setReason(''); setError(''); };
  useBackClose(open, close);
  useEffect(() => {
    const dialog = dialogRef.current, origin = trigger.current;
    if (!open || !dialog) return;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; origin?.focus({ preventScroll: true }); };
  }, [open]);

  if (!ACCOUNT_SESSIONS) return null;
  return <>
    <button ref={trigger} type="button" className="cc-text-button cc-small" aria-disabled={busy || saved}
      onClick={() => { if (!busy && !saved && readLab('reply-reports')) setOpen(true); }}>
      {saved ? 'Reply reported' : 'Report this reply'}
    </button>
    <span role="status" className="cc-visually-hidden">{saved ? 'Reply reported' : ''}</span>
    {open && <dialog ref={dialogRef} className="cc-meal-dialog" aria-labelledby={heading}
      onCancel={event => { event.preventDefault(); close(); }}>
      <header className="cc-meal-dialog-head"><h2 id={heading}>Report this reply</h2></header>
      <form className="cc-meal-time" onSubmit={async event => {
        event.preventDefault();
        if (inFlight.current || saved || !readLab('reply-reports')) return;
        inFlight.current = true;
        setBusy(true); setError('');
        try {
          await accountReplyReport(reply, reason.trim());
          setSaved(true); close();
        } catch (err) {
          setError(err instanceof AccountRequestError && err.code === 'account_reply_report_not_ready' ? err.message
            : 'Cupcake couldn’t confirm this report. You can retry without creating a duplicate.');
        } finally {
          inFlight.current = false; setBusy(false);
        }
      }}>
        <p className="cc-muted">This saves a report in Cupcake. It does not send the reply or your reason to a third party.</p>
        <label className="cc-label">Reason (optional)<textarea rows={3} maxLength={500} value={reason}
          disabled={busy} onChange={event => setReason(event.target.value)} /></label>
        {error && <p role="alert">{error}</p>}
        <div className="cc-action-row"><button type="button" className="cc-secondary" onClick={close}>Cancel</button>
          <button className="cc-primary" disabled={busy}>{busy ? 'Saving report…' : 'Save report'}</button></div>
      </form>
    </dialog>}
  </>;
}
