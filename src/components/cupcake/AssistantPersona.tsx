import { useId } from 'react';
import type { AssistantAppearanceState, Persona } from './assistantAppearance';

type PortraitProps = { persona: Persona; name: string; small?: boolean; busy?: boolean };

/** Original Cupcake/Matthieu artwork from the approved assistant design preview. */
export function AssistantPortrait({ persona, name, small = false, busy = false }: PortraitProps) {
  const label = name.trim() || (persona === 'matthieu' ? 'Matthieu' : 'Cupcake');
  return <span className={`cc-assistant-portrait${small ? ' is-small' : ''}${busy ? ' is-busy' : ''}`} role="img" aria-label={`${label} assistant character`}>
    <svg viewBox="0 0 100 112" aria-hidden="true" focusable="false">
      {persona === 'matthieu' ? <>
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
      </> : <>
        <ellipse cx="50" cy="105" rx="25" ry="4" fill="#140e23" opacity=".32" />
        <path d="M31 57q-17 8-18 28 15-1 24-16m32-12q17 8 18 28-15-1-24-16" fill="var(--assistant-art-hair)" />
        <path d="M34 68q16-11 32 0l8 30q-23 12-48 0Z" fill="var(--assistant-art-light)" />
        <path d="m37 72 13 10 13-10-3 27H40Z" fill="var(--assistant-art-trim)" />
        <path d="M32 77 24 91m44-14 8 14" stroke="var(--assistant-art-light)" strokeWidth="9" strokeLinecap="round" />
        <path d="M37 99v7m26-7v7" stroke="var(--assistant-art-hair)" strokeWidth="8" strokeLinecap="round" />
        <path d="M45 63h10v11q-5 6-10 0Z" fill="var(--assistant-art-trim)" />
        <path d="M25 27q0-17 25-17t25 17v24q-2 19-25 19T25 51Z" fill="var(--assistant-art-light)" />
        <path d="M23 31q-2-23 27-23t27 23l-9 8-6-16-12 7-12-7-7 16Z" fill="var(--assistant-art-hair)" />
        <path d="M27 19q8-8 17-6m14 0q10 0 15 10" fill="none" stroke="var(--assistant-art-shine)" strokeWidth="3" strokeLinecap="round" />
        <rect x="20" y="35" width="8" height="20" rx="4" fill="var(--assistant-art-trim)" /><rect x="72" y="35" width="8" height="20" rx="4" fill="var(--assistant-art-trim)" />
        <rect x="30" y="33" width="40" height="25" rx="11" fill="var(--assistant-art-screen)" />
        <g className="cc-assistant-eyes" fill="var(--assistant-art-spark)"><path d="M37 44q3-5 6 0v4h-6Zm20 0q3-5 6 0v4h-6Z" /></g>
        <ellipse cx="35" cy="53" rx="4" ry="2" fill="var(--assistant-art-shine)" opacity=".75" /><ellipse cx="65" cy="53" rx="4" ry="2" fill="var(--assistant-art-shine)" opacity=".75" />
        <path d="M46 53q4 4 8 0" fill="none" stroke="var(--assistant-art-light)" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M50 10V4" stroke="var(--assistant-art-hair)" strokeWidth="2" /><circle cx="50" cy="4" r="3" fill="var(--assistant-art-spark)" />
        <path d="m70 18 9-4-1 10-8-1Z" fill="var(--assistant-art-trim)" /><path d="m71 18-5-5-3 9 7 1Z" fill="var(--assistant-art-shine)" /><circle cx="70" cy="21" r="3" fill="var(--assistant-art-spark)" />
        <path d="m47 87 3-2 3 2v4l-3 2-3-2Z" fill="var(--assistant-art-spark)" />
      </>}
    </svg>
    {busy && <span className="cc-assistant-portrait-dot" aria-hidden="true" />}
  </span>;
}

export function AssistantAppearanceSettings({ appearance, setAppearance, persona, setPersona, name, setName }: AssistantAppearanceState) {
  const id = useId();
  return <section className="cc-assistant-appearance-settings" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>Make it feel like you</h3>
    <p>Colors, a character, and a name you choose. These preferences do not change your account or access.</p>
    <label className="cc-assistant-preference">Appearance<select aria-label="Assistant appearance" value={appearance} onChange={e => setAppearance(e.target.value === 'rose' ? 'rose' : 'caribbean')}><option value="caribbean">Caribbean · turquoise & ocean</option><option value="rose">Soft rose · blush & lavender</option></select></label>
    <fieldset><legend>Character</legend><div className="cc-assistant-persona-options">{(['cupcake', 'matthieu'] as const).map(value => <button key={value} type="button" aria-pressed={persona === value} onClick={() => setPersona(value)}><AssistantPortrait persona={value} name={value === 'cupcake' ? 'Cupcake' : 'Matthieu'} /><span>{value === 'cupcake' ? 'Cupcake' : 'Matthieu'}</span></button>)}</div></fieldset>
    <label className="cc-assistant-preference">Assistant name<input aria-label="Assistant name" value={name} maxLength={24} autoComplete="off" onChange={e => setName(e.target.value)} onBlur={() => { if (!name.trim()) setName(persona === 'matthieu' ? 'Matthieu' : 'Cupcake'); }} /></label>
    <p className="cc-assistant-preference-note">Saved in this browser when device storage is available. Colors and character are independent choices. Your system’s Reduce Motion setting is respected.</p>
  </section>;
}
