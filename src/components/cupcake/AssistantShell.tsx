import { personalStorage } from './personalStorage';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { ArrowLeft, Headphones, Library, MessageCircle, Mic, Minus, X } from 'lucide-react';
import { AssistantPortrait } from './AssistantPersona';
import type { Persona } from './assistantAppearance';
import { ACCOUNT_SESSIONS } from './accountMode';
import './assistant-shell.css';
import './noir/assistant/noir-assistant.css';

export type AssistantMode = 'text' | 'voice' | 'record';
type Position = { side: 'left' | 'right'; ratio: number };
const positionKey = 'cupcake-assistant-position-v1';
const hiddenKey = 'cupcake-assistant-hidden-v1';
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const readPosition = (): Position => {
  try { const p = JSON.parse(personalStorage('localStorage').getItem(positionKey) || 'null'); if (p && ['left', 'right'].includes(p.side) && Number.isFinite(p.ratio)) return { side: p.side, ratio: clamp(p.ratio, 0, 1) }; } catch { /* Device storage is optional. */ }
  return { side: 'right', ratio: .72 };
};
// Account navigation already carries the assistant's portrait, so its floating
// companion starts tucked away; an explicit Show/Hide choice is still remembered.
const readHidden = () => { try { const saved = personalStorage('localStorage').getItem(hiddenKey); return saved === '1' || (ACCOUNT_SESSIONS && saved !== '0'); } catch { return ACCOUNT_SESSIONS; } };
const save = (key: string, value: string) => { try { personalStorage('localStorage').setItem(key, value); } catch { /* Still usable for this visit. */ } };
const modes = [{ key: 'text', label: 'Text', Icon: MessageCircle }, { key: 'voice', label: 'Live voice', Icon: Headphones }, { key: 'record', label: 'Record', Icon: Mic }] as const;

export function AssistantShell({ open, library, mode, onMode, onOpen, onMinimize, onLibrary, busy, activity, persona, name, children }: {
  open: boolean; library: boolean; mode: AssistantMode; onMode: (mode: AssistantMode) => void; onOpen: () => void; onMinimize: () => void; onLibrary: () => void;
  busy: boolean; activity: { kind: 'voice'|'record'|'library'|null; label: string }; persona: Persona; name: string; children: ReactNode;
}) {
  const [position, setPosition] = useState(readPosition);
  const [hidden, setHidden] = useState(readHidden);
  const [placement, setPlacement] = useState({ x: 0, y: 0, safe: false });
  const [viewport, setViewport] = useState({ top: 0, height: window.innerHeight });
  const [obscured, setObscured] = useState(false);
  const [dragging, setDragging] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const shell = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; x: number; y: number; moved: boolean } | null>(null);
  const ignoreClick = useRef(false);
  const latestPosition = useRef(position); latestPosition.current = position;
  const showCompanion = () => { setHidden(false); save(hiddenKey, '0'); };
  const hideCompanion = () => { setHidden(true); save(hiddenKey, '1'); };
  const remember = (p: Position) => { setPosition(p); save(positionKey, JSON.stringify(p)); };
  const bounds = useCallback(() => {
    const vv = window.visualViewport;
    const top = Math.max(vv?.offsetTop || 0, 0);
    const height = vv?.height || window.innerHeight;
    const width = window.innerWidth;
    const nav = document.querySelector('.cc-nav')?.getBoundingClientRect();
    const header = document.querySelector('.cc-top')?.getBoundingClientRect();
    const headerBottom = header && header.height > 0 && header.height < height * 0.35 ? Math.max(header.bottom, header.height) : 68;
    const minY = Math.round(Math.max(top + 12, Math.min(top + height * 0.35, headerBottom + 12)));
    const maxY = Math.round(Math.max(minY, Math.min(top + height - 96, nav && nav.width > width / 2 ? nav.top - 86 : top + height - 96)));
    const left = Math.round(nav && nav.height > height / 2 && nav.width < width / 2 ? nav.right + 10 : 10);
    return { top, height, width, minY, maxY, left };
  }, []);
  useLayoutEffect(() => {
    let frame = 0, lastWidth = 0;
    const checkBlockers = () => {
      const blockers = [...document.querySelectorAll<HTMLElement>('dialog[open],.cc-photo-viewer,.cc-detail,.cc-settings[open]')].some(el => el.getClientRects().length > 0);
      setObscured(prev => (prev === blockers ? prev : blockers));
    };
    // Placement is anchored strictly to the user's chosen edge and ratio within stable viewport
    // bounds—never recalculated on scroll, DOM mutations, or Labs toggles—so it never drifts.
    const place = (force = false) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const b = bounds();
        if (open) setViewport(prev => (prev.top === b.top && prev.height === b.height ? prev : { top: b.top, height: b.height }));
        checkBlockers();
        if (drag.current) return;
        const widthChanged = lastWidth !== 0 && Math.abs(b.width - lastWidth) > 2;
        if (!force && !widthChanged) {
          // On vertical-only resizes (e.g. mobile browser address bar), keep current y unless out of bounds.
          setPlacement(prev => {
            if (!prev.safe) return prev;
            const clampedY = Math.round(clamp(prev.y, b.minY, b.maxY));
            const nextX = latestPosition.current.side === 'left' ? b.left : Math.round(b.width - 78);
            return prev.x === nextX && prev.y === clampedY ? prev : { x: nextX, y: clampedY, safe: true };
          });
          return;
        }
        lastWidth = b.width;
        const x = latestPosition.current.side === 'left' ? b.left : Math.round(b.width - 78);
        const y = Math.round(b.minY + latestPosition.current.ratio * (b.maxY - b.minY));
        setPlacement(prev => (prev.x === x && prev.y === y && prev.safe ? prev : { x, y, safe: true }));
      });
    };
    place(true);
    const onMutate = () => checkBlockers();
    const observer = new MutationObserver(onMutate);
    observer.observe(document.querySelector('.cc-app') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden'] });
    const onResize = () => place(false);
    const onViewportScroll = () => {
      if (!open) return;
      const b = bounds();
      setViewport(prev => (prev.top === b.top && prev.height === b.height ? prev : { top: b.top, height: b.height }));
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onViewportScroll);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onViewportScroll);
    };
  }, [bounds, position, open, library, hidden]);
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    heading.current?.focus({ preventScroll: true });
    return () => {
      if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
      else document.querySelector<HTMLButtonElement>('.cc-nav button:last-child')?.focus({ preventScroll: true });
    };
  }, [open]);
  // On phones the open assistant covers the whole page: keep TalkBack/VoiceOver and the keyboard
  // inside it (the tab bar stays reachable) instead of wandering through the hidden screen behind.
  useEffect(() => {
    const el = shell.current, main = el?.closest('main');
    if (!ACCOUNT_SESSIONS || !open || library || !el || !main) return;
    const phone = window.matchMedia('(max-width: 600px)'), marked: HTMLElement[] = [];
    const release = () => { marked.splice(0).forEach(node => { node.inert = false; }); };
    const apply = () => {
      release();
      if (!phone.matches) return;
      const behind = [...Array.from(main.children), document.querySelector('.cc-top')]
        .filter((node): node is HTMLElement => node instanceof HTMLElement && !node.contains(el) && !node.inert);
      behind.forEach(node => { node.inert = true; marked.push(node); });
    };
    apply(); phone.addEventListener('change', apply);
    return () => { phone.removeEventListener('change', apply); release(); };
  }, [open, library]);
  const finishDrag =(cancelled = false) => {
    const d = drag.current; if (!d) return;
    drag.current = null; setDragging(false);
    if (d.moved) {
      ignoreClick.current = true;
      if (!cancelled) { const b = bounds(); remember({ side: d.x + 34 < b.width / 2 ? 'left' : 'right', ratio: b.maxY === b.minY ? 0 : clamp((d.y - b.minY) / (b.maxY - b.minY), 0, 1) }); }
      else setPosition(p => ({ ...p }));
    }
  };
  return <>
    <section ref={shell} id="cupcake-assistant" hidden={!open && !library} className={`cc-assistant-workspace ${library ? 'is-library' : 'is-panel'}`} aria-label={library ? 'Private Library' : `${name} assistant`} style={{ '--assistant-vh': `${viewport.height}px`, '--assistant-vtop': `${viewport.top}px` } as CSSProperties} onKeyDown={e => { if (e.key === 'Escape' && open && !e.defaultPrevented && !document.querySelector('dialog[open],.cc-photo-viewer,.cc-detail')) { e.preventDefault(); onMinimize(); } }}>
      <header className="cc-assistant-head" hidden={library}><AssistantPortrait persona={persona} name={name} small busy={busy}/><div><h2 ref={heading} tabIndex={-1}>{name}</h2>{(!ACCOUNT_SESSIONS || busy) && <p>{busy ? activity.label : 'Here with you · choose how to connect'}</p>}</div><button type="button" className="cc-assistant-icon" aria-label="Minimize assistant" onClick={onMinimize}><Minus size={20}/></button></header>
      {ACCOUNT_SESSIONS ? (
        !library && mode !== 'text' && <div className="cc-assistant-mode-bar" role="group" aria-label="Assistant mode">
          <button type="button" className="cc-assistant-back" onClick={() => onMode('text')}><ArrowLeft size={15} aria-hidden="true"/>Back to chat</button>
          {mode === 'voice'
            ? <button type="button" className="cc-assistant-switch" disabled={busy && activity.kind !== 'record'} onClick={() => onMode('record')}><Mic size={15} aria-hidden="true"/>Record</button>
            : <button type="button" className="cc-assistant-switch" disabled={busy && activity.kind !== 'voice'} onClick={() => onMode('voice')}><Headphones size={15} aria-hidden="true"/>Live voice</button>}
        </div>
      ) : (
        <div className="cc-assistant-modes" role="group" aria-label="Assistant mode" hidden={library} style={{ '--mode-index': Math.max(0, modes.findIndex(m => m.key === mode)) } as CSSProperties}><span className="cc-assistant-modes-thumb" aria-hidden="true"/>{modes.map(({ key, label, Icon }) => <button key={key} type="button" aria-pressed={mode === key} disabled={busy && key !== 'text' && activity.kind !== key} onClick={() => onMode(key)}><Icon size={17}/>{label}</button>)}</div>
      )}
      <div className="cc-assistant-body">{children}</div>
      <footer className="cc-assistant-footer" hidden={library}><button type="button" onClick={onLibrary}><Library size={15}/>Private Library & originals</button>{hidden && <button type="button" onClick={showCompanion}>Show floating companion</button>}<span>{ACCOUNT_SESSIONS ? 'Audio keeps running when minimized' : 'Minimizing keeps active audio running.'}</span></footer>
    </section>
    {busy && !open && !library && <button type="button" className="cc-assistant-status" onClick={onOpen}><span className="cc-dot"/>{activity.label || `${name} is working`}<span>Open controls</span></button>}
    {!open && !hidden && !obscured && (placement.safe || dragging) && <div className={`cc-assistant-launcher ${dragging ? 'is-dragging' : ''}`} style={{ left: placement.x, top: placement.y }}>
      <button type="button" className="cc-assistant-bubble" aria-label={`Open ${name} assistant. Drag to move; arrow keys reposition.`} aria-controls="cupcake-assistant" aria-expanded={open} onPointerDown={e => { if (e.button !== 0) return; ignoreClick.current = false; drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, x: placement.x, y: placement.y, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { const d = drag.current; if (!d || d.id !== e.pointerId) return; const dx = e.clientX - d.startX, dy = e.clientY - d.startY; if (Math.hypot(dx, dy) > 7) d.moved = true; if (!d.moved) return; const b = bounds(); d.x = clamp(d.x + dx, b.left, b.width - 78); d.y = clamp(d.y + dy, b.minY, b.maxY); d.startX = e.clientX; d.startY = e.clientY; setDragging(true); setPlacement({ x: d.x, y: d.y, safe: true }); }} onPointerUp={() => finishDrag()} onPointerCancel={() => finishDrag(true)} onLostPointerCapture={() => finishDrag(true)} onClick={e => { if (ignoreClick.current) { ignoreClick.current = false; e.preventDefault(); return; } onOpen(); }} onKeyDown={e => { if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return; e.preventDefault(); remember({ side: ['ArrowLeft','Home'].includes(e.key) ? 'left' : ['ArrowRight','End'].includes(e.key) ? 'right' : position.side, ratio: clamp(position.ratio + (e.key === 'ArrowUp' ? -.12 : e.key === 'ArrowDown' ? .12 : 0), 0, 1) }); }}><AssistantPortrait persona={persona} name={name} small busy={busy}/>{busy && <span className="cc-assistant-active-dot"/>}</button>
      <button type="button" className="cc-assistant-hide" aria-label="Hide floating companion" onClick={hideCompanion}><X size={13}/></button>
    </div>}
  </>;
}
