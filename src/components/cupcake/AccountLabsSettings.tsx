import { useState } from 'react';
import { LABS, useLab, writeLab, type LabKey } from './labsFlags';
import './account-labs.css';

function LabSwitch({ id, label, detail }: { id: LabKey; label: string; detail: string }) {
  const on = useLab(id), [error, setError] = useState('');
  return <div className="cc-labs-item">
    <label className="cc-labs-toggle"><input type="checkbox" role="switch" checked={on} aria-describedby={`cc-lab-${id}`} onChange={event => setError(writeLab(id, event.target.checked) ? '' : 'This browser could not save the switch. It stays off.')}/><span>{label}</span></label>
    <p id={`cc-lab-${id}`} className="cc-muted cc-small">{detail}</p>
    {error && <p role="alert" className="cc-error cc-small">{error}</p>}
  </div>;
}
export function AccountLabsSettings() {
  return <div className="cc-labs">
    <p className="cc-muted cc-small">Early features that are not finished yet. All are off unless you turn them on here, on this device.</p>
    {LABS.map(lab => <LabSwitch key={lab.key} id={lab.key} label={lab.label} detail={lab.detail}/>)}
  </div>;
}
