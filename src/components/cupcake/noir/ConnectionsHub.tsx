/** Connections: one clean list that knows which phone you're on. Your phone's own steps come first; each row opens its detail.
 *  Only real connections are listed; nothing here creates a connection by itself. */
import { useState, type ReactNode } from 'react';
import { ChevronRight, Smartphone, HeartPulse, Droplet } from 'lucide-react';
import './connections.css';

export type Platform = 'ios' | 'android' | 'desktop';
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

type Row = { key: string; icon: ReactNode; title: string; note: string; status?: 'on' | 'off' | 'na'; detail: ReactNode };

export function ConnectionsHub({ appleHealth, iphoneInstall, canInstall, onInstall, assistantName }: {
  appleHealth: ReactNode; iphoneInstall: ReactNode; canInstall: boolean; onInstall: () => void; assistantName: string;
}) {
  const [platform] = useState(detectPlatform);
  // Phones open only what matters on that phone; a computer shows every detail.
  const standalone = typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches;
  const startOpen = (key: string) => platform === 'desktop' || (platform === 'ios' && (key === 'apple-health' || (key === 'install' && !standalone))) || (platform === 'android' && key === 'install' && !standalone);
  const androidInstall = <div className="nx-connect-steps">
    {canInstall ? <button type="button" className="nx-connect-cta" onClick={onInstall}>Install {assistantName}</button>
      : <ol><li>Open this page in Chrome.</li><li>Tap the ⋮ menu, then Install app (or Add to Home screen).</li><li>Open {assistantName} from your home screen.</li></ol>}
  </div>;
  const install: Row = platform === 'android'
    ? { key: 'install', icon: <Smartphone size={18} aria-hidden="true" />, title: 'Home screen', note: 'Android · one tap to open', detail: androidInstall }
    : { key: 'install', icon: <Smartphone size={18} aria-hidden="true" />, title: 'Home screen', note: platform === 'ios' ? 'iPhone · add from Safari' : 'Add on your phone', detail: iphoneInstall };
  const health: Row = { key: 'apple-health', icon: <HeartPulse size={18} aria-hidden="true" />, title: 'Apple Health', note: platform === 'android' ? 'For iPhone users' : 'Steps, sleep, weight and more', detail: appleHealth };
  const android: Row = { key: 'health-connect', icon: <HeartPulse size={18} aria-hidden="true" />, title: 'Health Connect', note: 'Android · not available for accounts yet', status: 'na',
    detail: <p className="nx-connect-note">Android health data can't reach accounts yet. Until it can, enter weight and readings by voice or in Food, and they count the same.</p> };
  const cgm: Row = { key: 'cgm', icon: <Droplet size={18} aria-hidden="true" />, title: 'Libre glucose sensor', note: 'Shown on Today when connected', detail: <p className="nx-connect-note">Your latest saved sensor reading appears on Today. Manual readings always work alongside it.</p> };
  const rows = platform === 'android' ? [install, android, cgm, health] : [install, health, cgm, android];
  return <section className="nx-connect" aria-label="Connections">
    <p className="nx-connect-device">{platform === 'ios' ? 'On iPhone · iPhone steps first' : platform === 'android' ? 'On Android · Android steps first' : 'On a computer · every option shown'}</p>
    <ul>{rows.map(row => <li key={row.key}><details className="nx-connect-item" open={startOpen(row.key)}>
      <summary className="nx-connect-row">
        <span className="nx-connect-icon">{row.icon}</span>
        <span className="nx-connect-text"><b>{row.title}</b><small>{row.note}</small></span>
        {row.status === 'na' && <span className="nx-connect-badge">Soon</span>}
        <ChevronRight size={16} className="nx-connect-chevron" aria-hidden="true" />
      </summary>
      <div className="nx-connect-detail">{row.detail}</div>
    </details>
    </li>)}</ul>
  </section>;
}
