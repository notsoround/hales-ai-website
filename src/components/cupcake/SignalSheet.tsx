import { useEffect, useRef, type ReactNode } from 'react';
import './signal-sheet.css';

/** Detail over Today: a bottom sheet on phones, a centred panel on wider screens. Today stays put underneath. */
export function SignalSheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    (dialog.querySelector('.cc-detail-head button') as HTMLElement | null)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { if (dialog.open) dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  return <dialog ref={ref} aria-label={label} className="cc-signal-sheet" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    <span className="cc-sheet-grip" aria-hidden="true" />
    {open ? children : null}
  </dialog>;
}
