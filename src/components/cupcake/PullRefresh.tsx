/** Pull down at the top of Today to refresh every screen's data, the way installed phone apps do. Account entry only, and
 *  only in the installed app (display-mode: standalone); in a browser tab the browser's own refresh applies. It never
 *  starts or fires while a sheet, dialog or the camera is open, and it reads no account data itself: it only asks every
 *  listener to reload once through notifyAllDataChanged(). Reduced motion: the indicator appears in place, without
 *  following the finger or spinning. Styles are inline and use only --nx-* tokens, so both themes follow the tokens and
 *  no Cupcake stylesheet (or the generated light layer) changes. */
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { RotateCw } from 'lucide-react';
import { ACCOUNT_SESSIONS } from './accountMode';
import { notifyAllDataChanged } from './dataChanges';
import { haptic, openLayerCount } from './nativeFeel';
import { canPull, judgeGesture, openLayerPresent, pullDistance, pullLabel, pullPhase, PULL_TRIGGER } from './pullRefreshModel';

const REFRESH_SHOW_MS = 900;
const reducedMotion = () => { try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const installed = () => { try { return !!window.matchMedia?.('(display-mode: standalone)').matches; } catch { return false; } };
/** True when neither the page nor any scrolling box around `el` has been scrolled down. */
function atTop(el: HTMLElement) {
  if ((document.scrollingElement?.scrollTop ?? window.scrollY) > 0) return false;
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) if (node.scrollTop > 0) return false;
  return true;
}
const layerOpen = () => openLayerPresent(document, openLayerCount());

export function PullRefresh({ target }: { target: RefObject<HTMLElement | null> }) {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false), icon = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = icon.current;
    if (!refreshing || !el || reducedMotion() || typeof el.animate !== 'function') return;
    const spin = el.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 800, iterations: Infinity });
    return () => spin.cancel();
  }, [refreshing]);
  useEffect(() => {
    const el = target.current;
    if (!ACCOUNT_SESSIONS || !el) return;
    let start: { id: number; x: number; y: number } | null = null, mode: 'pending' | 'pull' | 'other' = 'pending', pulled = 0, timer = 0;
    const reset = () => { start = null; mode = 'pending'; pulled = 0; setDistance(0); };
    const gate = () => canPull({ accountSessions: ACCOUNT_SESSIONS, standalone: installed(), layerOpen: layerOpen(), atTop: atTop(el), refreshing: busy.current });
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !gate()) { start = null; return; }
      const t = e.touches[0]!; start = { id: t.identifier, x: t.clientX, y: t.clientY }; mode = 'pending'; pulled = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const t = [...e.touches].find(x => x.identifier === start!.id);
      if (!t || e.touches.length !== 1) { reset(); return; }
      const dx = t.clientX - start.x, dy = t.clientY - start.y;
      if (mode === 'pending') mode = judgeGesture(dx, dy);
      if (mode === 'other') { start = null; return; }
      if (mode !== 'pull') return;
      if (layerOpen() || !atTop(el)) { reset(); return; }
      pulled = pullDistance(dy); setDistance(pulled);
    };
    const onEnd = () => {
      const fire = !!start && mode === 'pull' && pulled >= PULL_TRIGGER && !layerOpen() && installed() && !busy.current;
      reset();
      if (!fire) return;
      busy.current = true; setRefreshing(true); haptic('confirm');
      notifyAllDataChanged();
      timer = window.setTimeout(() => { busy.current = false; setRefreshing(false); }, REFRESH_SHOW_MS);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', reset, { passive: true });
    return () => {
      window.clearTimeout(timer); busy.current = false;
      el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd); el.removeEventListener('touchcancel', reset);
    };
  }, [target]);
  const phase = pullPhase(distance, refreshing);
  if (!ACCOUNT_SESSIONS || phase === 'idle') return null;
  const still = reducedMotion(), offset = still ? 0 : (refreshing ? PULL_TRIGGER : distance) - 8;
  const box: CSSProperties = {
    position: 'fixed', left: '50%', top: 'calc(env(safe-area-inset-top, 0px) + 6px)', zIndex: 30, transform: `translate(-50%, ${offset}px)`,
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, pointerEvents: 'none',
    font: '500 13px/1.3 var(--nx-text)', color: 'var(--nx-ink)', background: 'var(--nx-surface)', border: '1px solid var(--nx-hair)',
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', opacity: phase === 'pull' ? 0.55 : 1,
  };
  const turn: CSSProperties = { display: 'inline-flex', flex: 'none', color: 'var(--nx-a)', transform: still || refreshing ? 'none' : `rotate(${Math.round(distance / PULL_TRIGGER * 270)}deg)` };
  return <div className="nx-ptr" data-phase={phase} data-motion={still ? 'reduce' : 'full'} role="status" style={box}>
    <span ref={icon} className="nx-ptr-icon" style={turn}><RotateCw size={16} strokeWidth={1.9} aria-hidden="true" /></span><span>{pullLabel(phase)}</span>
  </div>;
}
