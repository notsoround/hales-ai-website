import { useId } from 'react';
import type { AssistantAppearanceState, Persona } from './assistantAppearance';

type PortraitProps = { persona: Persona; name: string; small?: boolean; busy?: boolean };

/** Cupcake uses her original portrait; character choice never changes account access. */
export function AssistantPortrait({ persona, name, small = false, busy = false }: PortraitProps) {
  const label = name.trim() || (persona === 'matthieu' ? 'Matthieu' : 'Cupcake');
  return <span className={`cc-assistant-portrait${persona === 'cupcake' ? ' is-photo' : ''}${small ? ' is-small' : ''}${busy ? ' is-busy' : ''}`} role="img" aria-label={`${label} assistant character`}>
    {persona === 'cupcake' ? <span className="cc-assistant-photo"><img src="/cupcake-avatar.jpg" alt="" draggable={false} decoding="async" /></span> : <svg viewBox="0 0 100 112" aria-hidden="true" focusable="false">
        <ellipse cx="50" cy="105" rx="27" ry="4" fill="#120f1f" opacity=".3" />
        <path d="M17 106 21 85q3-14 21-18h17q18 5 21 18l4 21" fill="var(--assistant-art-jacket)" />
        <path d="m39 69 11 18 11-18-5 37H44Z" fill="var(--assistant-art-light)" />
        <path d="m32 74 11 32h-9l-9-25 9-2-3-4Zm36 0-11 32h9l9-25-9-2 3-4Z" fill="var(--assistant-art-trim)" />
        <path d="M42 59v17q8 8 16 0V58" fill="#cf9b88" />
        <path d="M28 38q-2-25 22-25 24-1 24 25l-4 19q-5 14-20 17-15-4-20-18Z" fill="#e6b7a0" />
        <path d="M26 43q-7-14 3-26 6-12 26-9 13 0 19 12l-2 24-6-18q-13 6-26 0l-10 21Z" fill="#34232c" />
        <path d="M30 20q15-21 37-5" fill="none" stroke="#62414b" strokeWidth="5" strokeLinecap="round" />
        <path d="m34 39 10-1m12 0 10 1" stroke="#50343b" strokeWidth="2.8" strokeLinecap="round" />
        <g className="cc-assistant-eyes" fill="#48303d"><ellipse cx="40" cy="44" rx="2" ry="2.4" /><ellipse cx="61" cy="44" rx="2" ry="2.4" /></g>
        <path d="m50 43-2 9 4 1m-9 7q7 4 14-1" fill="none" stroke="#ac6f68" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M32 57q6 13 18 15 12-3 19-16l-3 9q-7 12-17 13-12-5-17-15Z" fill="#684246" opacity=".5" />
        <path d="m68 83 7 7m-43-7-8 7" stroke="var(--assistant-art-hair)" strokeWidth="1.5" /><circle cx="68" cy="94" r="2" fill="var(--assistant-art-spark)" />
    </svg>}
    {busy && <span className="cc-assistant-portrait-dot" aria-hidden="true" />}
  </span>;
}

export function AssistantAppearanceSettings({ appearance, setAppearance, persona, setPersona, name, setName, persistence }: AssistantAppearanceState) {
  const id = useId();
  return <section className="cc-assistant-appearance-settings" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>Make it feel like you</h3>
    <p>Colors, a character, and a name you choose. These preferences do not change your account or access.</p>
    <label className="cc-assistant-preference">Appearance<select aria-label="Assistant appearance" disabled={!persistence.editable} value={appearance} onChange={e => setAppearance(e.target.value === 'rose' ? 'rose' : 'caribbean')}><option value="caribbean">Caribbean · turquoise & ocean</option><option value="rose">Soft rose · blush & lavender</option></select></label>
    <fieldset disabled={!persistence.editable}><legend>Character</legend><div className="cc-assistant-persona-options">{(['cupcake', 'matthieu'] as const).map(value => <button key={value} type="button" aria-pressed={persona === value} onClick={() => setPersona(value)}><AssistantPortrait persona={value} name={value === 'cupcake' ? 'Cupcake' : 'Matthieu'} /><span>{value === 'cupcake' ? 'Cupcake' : 'Matthieu'}</span></button>)}</div></fieldset>
    <label className="cc-assistant-preference">Assistant name<input aria-label="Assistant name" disabled={!persistence.editable} value={name} maxLength={24} autoComplete="off" onChange={e => setName(e.target.value)} onBlur={() => { if (!name.trim()) setName(persona === 'matthieu' ? 'Matthieu' : 'Cupcake'); }} /></label>
    <p className="cc-assistant-preference-note" role={persistence.mode === 'account' ? 'status' : undefined}>{persistence.message}</p>
    {persistence.retry&&<button type="button" className="cc-text-button" onClick={persistence.retry}>Retry assistant preferences</button>}
    <p className="cc-assistant-preference-note">Colors and character are independent choices. Your system’s Reduce Motion setting is respected.</p>
  </section>;
}
