import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { LockKeyhole, Settings, X } from 'lucide-react';
import { useBackClose } from './nativeFeel';
import './cupcake-settings.css';

export function SettingsGroup({
  title,
  children,
  danger = false,
  id,
  openRequest = 0,
  closeRequest = 0,
  onToggle,
}: {
  title: string;
  children: ReactNode;
  danger?: boolean;
  id?: string;
  openRequest?: number;
  closeRequest?: number;
  onToggle?: (open: boolean) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  useEffect(() => {
    if (!openRequest || !detailsRef.current) return;
    detailsRef.current.open = true;
    onToggleRef.current?.(true);
    window.setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }, [openRequest]);

  useEffect(() => {
    if (!closeRequest || !detailsRef.current || !detailsRef.current.open) return;
    detailsRef.current.open = false;
    onToggleRef.current?.(false);
  }, [closeRequest]);

  return (
    <details
      ref={detailsRef}
      id={id}
      className={`cc-settings-group${danger ? ' cc-settings-group-danger' : ''}`}
      onToggle={event => onToggle?.(event.currentTarget.open)}
    >
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  );
}

export default function CupcakeSettings({
  children,
  openRequest = 0,
  closeRequest = 0,
  onOpenChange,
  onSignOut,
  signOutLabel = 'Sign out',
  signOutAriaLabel,
  signOutDisabled = false,
}: {
  children: ReactNode;
  openRequest?: number;
  closeRequest?: number;
  onOpenChange?: (open: boolean) => void;
  onSignOut?: () => void;
  signOutLabel?: string;
  signOutAriaLabel?: string;
  signOutDisabled?: boolean;
}) {
  const root = useRef<HTMLDetailsElement>(null), panel = useRef<HTMLDivElement>(null), trigger = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const wasOpen = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const close = useCallback(() => { if (root.current) root.current.open = false; setOpen(false); trigger.current?.focus(); }, []);

  useEffect(() => {
    if (!openRequest || !root.current) return;
    root.current.open = true;
    setOpen(true);
  }, [openRequest]);

  useEffect(() => {
    if (!closeRequest || !root.current || !root.current.open) return;
    root.current.open = false;
    setOpen(false);
  }, [closeRequest]);

  useEffect(() => {
    if (wasOpen.current === open) return;
    wasOpen.current = open;
    onOpenChangeRef.current?.(open);
  }, [open]);

  useBackClose(open, close);
  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    const container = panel.current;
    const focusable = () => [...container.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.getClientRects().length > 0 && !el.closest('[inert]') && el.tabIndex >= 0);
    if (!container.contains(document.activeElement)) (focusable()[0] || container).focus();
    const key = (event: KeyboardEvent) => {
      if (!root.current?.open || document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key !== 'Tab') return;
      const controls = focusable(), first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); container.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    const contain = (event: FocusEvent) => { if (!document.querySelector('dialog[open]') && root.current?.open && event.target instanceof Node && !container.contains(event.target)) (focusable()[0] || container).focus(); };
    document.addEventListener('keydown', key, true); document.addEventListener('focusin', contain, true);
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('focusin', contain, true); };
  }, [open, close]);

  return (
    <details ref={root} className="cc-settings" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary ref={trigger} aria-label="Settings">
        <Settings size={18} aria-hidden="true" />
        <span className="cc-top-label">Settings</span>
      </summary>
      <div className="cc-settings-scrim" aria-hidden="true" onClick={close} />
      <div ref={panel} className="cc-settings-panel" role="dialog" aria-modal={open || undefined} aria-label="Settings" tabIndex={-1}>
        <div className="cc-settings-head">
          <strong>Settings</strong>
          <button type="button" className="cc-settings-close" aria-label="Close settings" onClick={close}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
        {onSignOut && (
          <div className="cc-settings-footer">
            <button
              type="button"
              className="cc-secondary cc-settings-signout cc-lock"
              aria-label={signOutAriaLabel || signOutLabel}
              disabled={signOutDisabled}
              onClick={onSignOut}
            >
              <LockKeyhole size={17} aria-hidden="true" />
              <span>{signOutLabel}</span>
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
