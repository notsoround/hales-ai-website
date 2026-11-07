import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './meal-detail.css';

export function MealDialog({ open, onClose, children, returnFocus, heading = 'Meal details', closeLabel = 'Close meal details' }: { open: boolean; onClose: () => void; children: ReactNode; returnFocus?: { current: HTMLElement | null }; heading?: string; closeLabel?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = returnFocus?.current || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    title.current?.focus({ preventScroll: true });
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, [open, returnFocus]);
  return <dialog ref={ref} aria-label={heading} className="cc-meal-dialog" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    <header className="cc-meal-dialog-head"><h2 ref={title} tabIndex={-1}>{heading}</h2><button type="button" className="cc-text-button" aria-label={closeLabel} onClick={onClose}><X size={22}/></button></header>
    {children}
  </dialog>;
}
