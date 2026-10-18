import type { AccentHeat } from './accentHeat';
import './accent-heat.css';

/** Calm / Hot pink switch (cupcake-opolis accent-heat-toggle). */
export function AccentHeatToggle({ heat, onChange }: { heat: AccentHeat; onChange: (heat: AccentHeat) => void }) {
  return <div className="cc-heat" role="group" aria-label="Accent heat">
    {(['calm', 'hot'] as const).map(value => <button key={value} type="button" aria-pressed={heat === value} onClick={() => onChange(value)}>{value === 'calm' ? 'Calm' : 'Hot'}</button>)}
  </div>;
}
