import { CloudSun, Minus, Moon, Smartphone, Sun } from 'lucide-react';
import type { SchemeChoice } from './accountScheme';
import { useAccountSky, type SkyPreference } from './accountSkyPreference';
import './account-scheme.css';

const CHOICES: { value: SchemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'Auto', Icon: Smartphone },
];

const SKY_CHOICES: { value: SkyPreference; label: string; Icon: typeof Sun }[] = [
  { value: 'living', label: 'Living', Icon: CloudSun },
  { value: 'static', label: 'Static', Icon: Minus },
];

/** Light, dark or follow the device, plus Living vs Static sky atmosphere. Account app only; saved on this device. */
export function AccountSchemeSettings({ choice, onChange }: { choice: SchemeChoice; onChange: (choice: SchemeChoice) => void }) {
  const [skyPref, setSkyPref] = useAccountSky();
  return <div className="cc-scheme">
    <span className="cc-scheme-label" id="cc-scheme-label">Theme</span>
    <div className="cc-scheme-options" role="group" aria-labelledby="cc-scheme-label">
      {CHOICES.map(({ value, label, Icon }) => <button key={value} type="button" aria-pressed={choice === value} onClick={() => onChange(value)}><Icon size={15} aria-hidden="true"/>{label}</button>)}
    </div>
    <p className="cc-scheme-note">Saved on this device. Auto follows your phone’s light or dark setting.</p>
    <span className="cc-scheme-label" id="cc-sky-label" style={{ marginTop: 14 }}>Sky atmosphere</span>
    <div className="cc-scheme-options cc-scheme-options-2" role="group" aria-labelledby="cc-sky-label">
      {SKY_CHOICES.map(({ value, label, Icon }) => <button key={value} type="button" aria-pressed={skyPref === value} onClick={() => setSkyPref(value)}><Icon size={15} aria-hidden="true"/>{label}</button>)}
    </div>
    <p className="cc-scheme-note">Matches local time of day and brightens as you commit and log progress.</p>
  </div>;
}
