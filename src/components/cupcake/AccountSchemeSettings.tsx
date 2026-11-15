import { Moon, Smartphone, Sun } from 'lucide-react';
import type { SchemeChoice } from './accountScheme';
import './account-scheme.css';

const CHOICES: { value: SchemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'Auto', Icon: Smartphone },
];

/** Light, dark or follow the device. Account app only; saved on this device. */
export function AccountSchemeSettings({ choice, onChange }: { choice: SchemeChoice; onChange: (choice: SchemeChoice) => void }) {
  return <div className="cc-scheme">
    <span className="cc-scheme-label" id="cc-scheme-label">Theme</span>
    <div className="cc-scheme-options" role="group" aria-labelledby="cc-scheme-label">
      {CHOICES.map(({ value, label, Icon }) => <button key={value} type="button" aria-pressed={choice === value} onClick={() => onChange(value)}><Icon size={15} aria-hidden="true"/>{label}</button>)}
    </div>
    <p className="cc-scheme-note">Saved on this device. Auto follows your phone’s light or dark setting.</p>
  </div>;
}
