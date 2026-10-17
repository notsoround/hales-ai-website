import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './meal-detail.css';

export function MealDialog({ open, onClose, children, returnFocus }: { open: boolean; onClose: () => void; children: ReactNode; returnFocus?: { current: HTMLElement | null } }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = returnFocus?.current || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open, returnFocus]);
  return <dialog ref={ref} aria-label="Meal details" className="cc-meal-dialog" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    <header className="cc-meal-dialog-head"><h2>Meal details</h2><button type="button" className="cc-text-button" aria-label="Close meal details" onClick={onClose}><X size={22}/></button></header>
    {children}
  </dialog>;
}
