/** "Are you sure?" as part of the app: a small sheet in the app's own look instead of the browser's
 *  "hales.ai says" popup. It is a real modal dialog, so Escape and the phone's Back button answer No, focus stays inside
 *  and returns to where it was. The original (non-account) app keeps the browser prompt it always had. */
import { ACCOUNT_SESSIONS } from './accountMode';
import './noir/noir-native.css';

export type ConfirmOptions = { title?: string; yes?: string; no?: string; danger?: boolean };
let serial = 0;

export function appConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  const host = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.cc-app[data-entry=account]');
  if (!ACCOUNT_SESSIONS || !host || typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return Promise.resolve(window.confirm(message));
  return new Promise<boolean>(resolve => {
    const id = `nx-confirm-${++serial}`, previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.createElement('dialog');
    dialog.className = 'nx-confirm'; dialog.setAttribute('role', 'alertdialog'); dialog.setAttribute('aria-describedby', id + '-text');
    const text = document.createElement('p'); text.id = id + '-text'; text.className = 'nx-confirm-text'; text.textContent = message;
    if (options.title) { const title = document.createElement('h2'); title.id = id + '-title'; title.className = 'nx-confirm-title'; title.textContent = options.title; dialog.setAttribute('aria-labelledby', title.id); dialog.append(title); }
    else dialog.setAttribute('aria-label', 'Please confirm');
    const actions = document.createElement('div'); actions.className = 'nx-confirm-actions';
    const button = (label: string, answer: 'yes' | 'no') => { const el = document.createElement('button'); el.type = 'button'; el.textContent = label; el.dataset.answer = answer; return el; };
    const no = button(options.no || 'Cancel', 'no'), yes = button(options.yes || 'OK', 'yes');
    if (options.danger) yes.dataset.danger = '';
    actions.append(no, yes); dialog.append(text, actions);
    let settled = false;
    const finish = (answer: boolean) => { if (settled) return; settled = true; try { dialog.close(); } catch { /* already closed */ } dialog.remove(); previous?.focus?.(); resolve(answer); };
    yes.addEventListener('click', () => finish(true)); no.addEventListener('click', () => finish(false));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    dialog.addEventListener('close', () => finish(false));
    dialog.addEventListener('click', event => { if (event.target === dialog) finish(false); });
    host.append(dialog);
    try { dialog.showModal(); } catch { dialog.remove(); settled = true; resolve(window.confirm(message)); return; }
    (options.danger ? no : yes).focus();
  });
}
