import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Settings, X } from 'lucide-react';
import './cupcake-settings.css';

export function SettingsGroup({ title, children, danger = false }: { title: string; children: ReactNode; danger?: boolean }) {
  return <details className={`cc-settings-group${danger ? ' cc-settings-group-danger' : ''}`}><summary>{title}</summary><div>{children}</div></details>;
}

export default function CupcakeSettings({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDetailsElement>(null), panel = useRef<HTMLDivElement>(null), trigger = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => { if (root.current) root.current.open = false; setOpen(false); trigger.current?.focus(); }, []);
  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    const container = panel.current;
    const focusable = () => [...container.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.getClientRects().length > 0 && !el.closest('[inert]') && el.tabIndex >= 0);
    if (!container.contains(document.activeElement)) (focusable()[0] || container).focus();
    const key = (event: KeyboardEvent) => {
      if (!root.current?.open) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key !== 'Tab') return;
      const controls = focusable(), first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); container.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    const contain = (event: FocusEvent) => { if (root.current?.open && event.target instanceof Node && !container.contains(event.target)) (focusable()[0] || container).focus(); };
    document.addEventListener('keydown', key, true); document.addEventListener('focusin', contain, true);
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('focusin', contain, true); };
  }, [open, close]);
  return <details ref={root} className="cc-settings" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary ref={trigger} aria-label="Settings"><Settings size={18} aria-hidden="true"/><span className="cc-top-label">Settings</span></summary>
    <div className="cc-settings-scrim" aria-hidden="true" onClick={close}/>
    <div ref={panel} className="cc-settings-panel" role="dialog" aria-modal={open || undefined} aria-label="Settings" tabIndex={-1}>
      <div className="cc-settings-head"><strong>Settings</strong><button type="button" className="cc-settings-close" aria-label="Close settings" onClick={close}><X size={20} aria-hidden="true"/></button></div>
      {children}
    </div>
  </details>;
}
