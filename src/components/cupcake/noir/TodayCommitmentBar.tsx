/** Today "One Commitment" bar: the quick 1-tap lever that parts the clouds and shifts Today's Living Sky. */
import { useState } from 'react';
import { Check, ChevronDown, Cloud, CloudRain, CloudSun, MoonStar, Pause, Play, Sun, X } from 'lucide-react';
import type { SkyPreference } from '../accountSkyPreference';
import type { DayPhase, SkyMood, SkyState } from './livingSky';
import type { TodayCommitment } from './todayCommitment';

function SkyIcon({ phase, mood }: { phase: DayPhase; mood: SkyMood }) {
  if (mood === 'rain') return <CloudRain size={15} aria-hidden="true" />;
  if (mood === 'mist') return phase === 'night' ? <MoonStar size={15} aria-hidden="true" /> : <Cloud size={15} aria-hidden="true" />;
  if (mood === 'sunbreak') return <CloudSun size={15} aria-hidden="true" />;
  if (phase === 'night') return <MoonStar size={15} aria-hidden="true" />;
  return <Sun size={15} aria-hidden="true" />;
}

export function TodayCommitmentBar({
  sky,
  commitment,
  suggestions,
  skyPref,
  actionLabel,
  onAction,
  onToggleSkyPref,
  onCommit,
  onToggleDone,
  onClear,
}: {
  sky: SkyState;
  commitment: TodayCommitment | null;
  suggestions: string[];
  skyPref: SkyPreference;
  actionLabel?: string;
  onAction?: () => void;
  onToggleSkyPref: () => void;
  onCommit: (text: string) => void;
  onToggleDone: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const submitDraft = () => {
    const clean = draft.trim();
    if (!clean) return;
    onCommit(clean);
    setDraft('');
    setOpen(false);
  };

  return (
    <div className="nx-commit" data-done={commitment?.done ? 'true' : undefined}>
      <div className="nx-commit-row">
        {!commitment ? (
          <button
            type="button"
            className="nx-commit-main"
            aria-expanded={open}
            aria-label="Set today’s commitment"
            onClick={() => setOpen(o => !o)}
          >
            <span className="nx-commit-lead">
              <span className="nx-commit-sky-ico">
                <SkyIcon phase={sky.phase} mood={sky.mood} />
              </span>
              <span className="nx-commit-label is-muted">Set one commitment</span>
            </span>
            <span className="nx-commit-pill">{sky.label}</span>
            <ChevronDown size={15} className="nx-commit-chev" aria-hidden="true" />
          </button>
        ) : (
          <>
            <button
              type="button"
              className="nx-commit-check"
              aria-pressed={commitment.done}
              aria-label={commitment.done ? `Mark "${commitment.text}" not done` : `Mark "${commitment.text}" done`}
              onClick={onToggleDone}
            >
              <span className="nx-commit-box" aria-hidden="true">
                {commitment.done && <Check size={12} strokeWidth={2.5} />}
              </span>
              <span className="nx-commit-label">{commitment.text}</span>
            </button>
            {!commitment.done && actionLabel && onAction && (
              <button
                type="button"
                className="nx-commit-action"
                onClick={onAction}
              >
                {actionLabel}
              </button>
            )}
            <span className="nx-commit-pill">{sky.label}</span>
            <button
              type="button"
              className="nx-commit-edit"
              aria-expanded={open}
              aria-label="Edit today’s commitment"
              onClick={() => setOpen(o => !o)}
            >
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {open && (
        <div className="nx-commit-tray">
          <p className="nx-commit-prompt">{sky.prompt}</p>
          <div className="nx-commit-chips" role="group" aria-label="Suggested commitments">
            {suggestions.map(item => (
              <button
                key={item}
                type="button"
                className={`nx-commit-chip${commitment?.text === item ? ' is-active' : ''}`}
                onClick={() => {
                  onCommit(item);
                  setOpen(false);
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <form
            className="nx-commit-form"
            onSubmit={e => {
              e.preventDefault();
              submitDraft();
            }}
          >
            <input
              type="text"
              maxLength={80}
              value={draft}
              placeholder="Or write one move for today…"
              aria-label="Custom commitment for today"
              onChange={e => setDraft(e.target.value)}
            />
            <button type="submit" disabled={!draft.trim()}>
              Save
            </button>
          </form>
          <div className="nx-commit-foot">
            <button type="button" className="nx-commit-motion" onClick={onToggleSkyPref}>
              {skyPref === 'living' ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
              <span>{skyPref === 'living' ? 'Pause sky motion' : 'Resume sky motion'}</span>
            </button>
            {commitment && (
              <button
                type="button"
                className="nx-commit-clear"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
              >
                <X size={13} aria-hidden="true" />
                <span>Clear commitment</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
