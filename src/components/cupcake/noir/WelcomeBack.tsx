/** Welcome-back recap. A small portrait chip beside the greeting; after you've been away it pulses once in a while.
 *  Tapping it opens a short status card in the assistant's voice with one or two things to do now. It never opens by itself. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { personalStorage } from '../personalStorage';
import './welcome-back.css';

const SEEN_KEY = 'cc-noir-last-seen';
const AWAY_MS = 4 * 3600000;

export type RecapFacts = {
  lastMealAt: number | null; caloriesLeft: number | null; target: number | null; eatenToday: number;
  weightAt: number | null; weightDeltaWeek: number | null; glucoseAt: number | null; sleepLastNight: boolean;
};
type Action = { label: string; run: () => void };

const ago = (ms: number) => { const m = Math.round(ms / 60000); if (m < 60) return `${m} min`; const h = Math.round(m / 60); if (h < 36) return `${h} ${h === 1 ? 'hour' : 'hours'}`; const d = Math.round(h / 24); return `${d} days`; };

function readSeen(): number | null { try { const v = Number(personalStorage('localStorage').getItem(SEEN_KEY)); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; } }
function writeSeen(t: number) { try { personalStorage('localStorage').setItem(SEEN_KEY, String(t)); } catch { /* Recap still works without memory. */ } }

/** When you were last here, remembered on this device; refreshed while the page is open. */
function useAway() {
  const [previous] = useState(readSeen);
  useEffect(() => { writeSeen(Date.now()); const id = window.setInterval(() => writeSeen(Date.now()), 60000); const hide = () => writeSeen(Date.now()); document.addEventListener('visibilitychange', hide); return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', hide); }; }, []);
  return previous;
}

export function WelcomeBack({ assistantName, sassy, portrait, facts, onCamera, onTalk, onWeigh }: {
  assistantName: string; sassy: boolean; portrait: ReactNode; facts: RecapFacts | null; onCamera: () => void; onTalk: () => void; onWeigh: () => void;
}) {
  const previous = useAway(), now = Date.now();
  const away = previous !== null && now - previous >= AWAY_MS ? now - previous : null;
  const [open, setOpen] = useState(false), [seen, setSeen] = useState(false);
  const card = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!open) return; card.current?.focus(); const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [open]);

  const lines: { k: string; v: string; tone?: 'good' | 'warn' }[] = [];
  if (facts) {
    lines.push(facts.lastMealAt ? { k: 'Last meal', v: `${ago(now - facts.lastMealAt)} ago`, tone: now - facts.lastMealAt > 6 * 3600000 ? 'warn' : undefined } : { k: 'Last meal', v: 'Nothing logged yet', tone: 'warn' });
    if (facts.target !== null && facts.caloriesLeft !== null) lines.push({ k: 'Today', v: facts.caloriesLeft >= 0 ? `${Math.round(facts.caloriesLeft).toLocaleString('en-US')} kcal left of ${facts.target.toLocaleString('en-US')}` : `${Math.round(-facts.caloriesLeft).toLocaleString('en-US')} kcal over`, tone: facts.caloriesLeft >= 0 ? 'good' : 'warn' });
    lines.push(facts.weightAt ? { k: 'Scale', v: `${now - facts.weightAt > 2 * 864e5 ? `Last synced ${ago(now - facts.weightAt)} ago` : facts.weightDeltaWeek !== null ? `${facts.weightDeltaWeek <= 0 ? '−' : '+'}${Math.abs(facts.weightDeltaWeek).toFixed(1)} lb this week` : 'Synced'}`, tone: now - facts.weightAt > 2 * 864e5 ? 'warn' : facts.weightDeltaWeek !== null && facts.weightDeltaWeek <= 0 ? 'good' : undefined } : { k: 'Scale', v: 'Not connected', tone: 'warn' });
    lines.push(facts.glucoseAt ? { k: 'Glucose', v: `Last reading ${ago(now - facts.glucoseAt)} ago`, tone: now - facts.glucoseAt > 864e5 ? 'warn' : undefined } : { k: 'Glucose', v: 'No readings', tone: 'warn' });
    lines.push({ k: 'Sleep', v: facts.sleepLastNight ? 'Last night is in' : 'No night uploaded', tone: facts.sleepLastNight ? undefined : 'warn' });
  }
  const noMealToday = facts ? facts.eatenToday === 0 : false, staleScale = facts ? !facts.weightAt || now - facts.weightAt > 2 * 864e5 : false;
  const actions: Action[] = [
    ...(noMealToday ? [{ label: 'Log a meal', run: onCamera }] : []),
    ...(staleScale ? [{ label: 'Weigh in', run: onWeigh }] : []),
    { label: `Talk to ${assistantName}`, run: onTalk },
  ].slice(0, 2);
  const title = away ? sassy ? `Where’ve you been? ${ago(away)}. I counted.` : `Welcome back. It’s been ${ago(away)}.` : sassy ? 'Here’s the damage.' : 'Where things stand.';
  const pulse = !!away && !seen;

  return <div className="nx-recap">
    <button ref={trigger} type="button" className={`nx-recap-chip${pulse ? ' is-pulsing' : ''}`} aria-expanded={open} aria-haspopup="dialog"
      onClick={() => { setOpen(o => !o); setSeen(true); }}>
      <span className="nx-recap-portrait" aria-hidden="true">{portrait}</span>
      <span>{away ? 'Catch up' : 'Status'}</span>
    </button>
    {open && <div ref={card} className="nx-recap-card" role="dialog" aria-label={`${assistantName} recap`} tabIndex={-1}>
      <header><span className="nx-recap-portrait is-large" aria-hidden="true">{portrait}</span><div><small>{assistantName}</small><strong>{title}</strong></div>
        <button type="button" className="nx-recap-close" aria-label="Close recap" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={16} aria-hidden="true" /></button></header>
      {facts ? <dl>{lines.map(l => <div key={l.k}><dt>{l.k}</dt><dd className={l.tone ? `nx-${l.tone}` : undefined}>{l.v}</dd></div>)}</dl> : <p className="nx-recap-loading">Pulling your numbers…</p>}
      <div className="nx-recap-actions">{actions.map((a, i) => <button key={a.label} type="button" className={i === 0 ? 'is-primary' : undefined} onClick={() => { setOpen(false); a.run(); }}>{a.label}</button>)}</div>
    </div>}
  </div>;
}
