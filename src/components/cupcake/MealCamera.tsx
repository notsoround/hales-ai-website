import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Flashlight, FlashlightOff, Images, SwitchCamera, X } from 'lucide-react';
import { Reticle } from './camera/Reticle';
import { CameraQuip } from './camera/CameraQuip';
import { useLab } from './labsFlags';
import { useCameraStream } from './camera/useCameraStream';
import { useStillness } from './camera/useStillness';
import { clockTime, mealForTime, wholeNumber } from './camera/mealContext';
import './account-camera.css';

/**
 * Account-app meal camera. Opens straight into a full-bleed live viewfinder with a
 * quiet HUD: meal + time on top, a tracking reticle that locks when the view is held
 * still, the day's remaining numbers above a single shutter. Close with X, Escape,
 * a tap outside (desktop) or a downward swipe. The photo stays in memory and goes to
 * the same account photo flow as before. Without camera access (refused, missing,
 * insecure page) the shutter opens the phone's own camera, and the library is always
 * one tap away, so photo logging never gets harder than it was.
 */
export type MealCameraContext = {
  /** Overrides the meal name derived from the time of day ("Lunch"). */
  mealLabel?: string;
  /** Calories still available today; hidden when null/undefined. */
  caloriesLeft?: number | null;
  /** Protein grams still to go today; hidden when null/undefined. */
  proteinLeftG?: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPhoto: (file: File) => void;
  context?: MealCameraContext;
  /** Shows a "Food log" button bottom-right when provided. Called after the camera closes. */
  onOpenFoodLog?: () => void;
};

const ACCEPT = 'image/jpeg,image/png,image/webp';
const SWIPE_CLOSE = 90;
// Cupcake talks with attitude; Matthieu stays composed. The persona is the app's appearance.
const STATUS = {
  cupcake: { search: 'Whoa, slow down, cowboy', steady: 'Hold it…', locked: 'Got it. Shoot.' },
  calm: { search: 'Center your plate', steady: 'Hold steady', locked: 'Ready' },
} as const;
const statusVoice = () => typeof document !== 'undefined' && document.querySelector('.cc-app')?.getAttribute('data-appearance') === 'caribbean' ? STATUS.cupcake : STATUS.calm;

export function MealCamera({ open, onClose, onPhoto, context, onOpenFoodLog }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), video = useRef<HTMLVideoElement>(null);
  const native = useRef<HTMLInputElement>(null), library = useRef<HTMLInputElement>(null);
  const swipe = useRef<{ id: number; y: number; dy: number } | null>(null);
  const [capturing, setCapturing] = useState(false);
  // Between the tap and the photo: the phone is still focusing and exposing, so the view stays live and asks you to hold still.
  const [taking, setTaking] = useState(false);
  const [focus, setFocus] = useState<{ x: number; y: number; key: number } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const camera = useCameraStream(open, video);
  const { state } = camera;
  const quips = useLab('camera-quips');
  const track = useStillness(open && state === 'live' && !capturing && !taking, video);

  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!node.open) node.showModal();
    setCapturing(false); setTaking(false); setNow(new Date());
    const clock = window.setInterval(() => setNow(new Date()), 20_000);
    return () => { window.clearInterval(clock); if (node.open) node.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, [open]);

  const deliver = (file: File) => { onPhoto(file); onClose(); };

  const shoot = () => {
    const el = video.current;
    if (capturing || taking) return;
    if (state !== 'live' || !el || !el.videoWidth) { if (state === 'blocked') native.current?.click(); return; }
    navigator.vibrate?.(10);
    setTaking(true);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const settle = () => new Promise(resolve => window.setTimeout(resolve, reduced ? 0 : 430));
    // The frame on screen: shown frozen while the real photo is taken, and the fallback when the browser has no still-photo API.
    const frame = () => { const canvas = document.createElement('canvas'); canvas.width = el.videoWidth; canvas.height = el.videoHeight; canvas.getContext('2d')?.drawImage(el, 0, 0, canvas.width, canvas.height); return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92)); };
    // A real still (full sensor, focused for the shot) where the phone offers one. The preview keeps running until it returns.
    const photo = camera.frameOnly ? Promise.resolve(null) : camera.takeStill();
    void photo.then(async still => { const image = still || await frame(); el.pause(); setTaking(false); setCapturing(true); await settle(); return image; }).then(image => {
      if (!image) { setCapturing(false); void el.play().catch(() => undefined); return; }
      const stamp = Date.now();
      deliver(new File([image], `meal-${stamp}.jpg`, { type: image.type === 'image/png' ? 'image/png' : 'image/jpeg', lastModified: stamp }));
    });
  };

  const fromInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (file) deliver(file);
  };

  // Downward swipe anywhere on the viewfinder (not on a control) backs out.
  const swipeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (capturing || (event.target as Element).closest('button, input, a') || (event.pointerType === 'mouse' && event.button !== 0)) return;
    swipe.current = { id: event.pointerId, y: event.clientY, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.transition = 'none';
  };
  const swipeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    if (!s || s.id !== event.pointerId) return;
    s.dy = Math.max(0, event.clientY - s.y);
    const pull = s.dy < SWIPE_CLOSE ? s.dy * .6 : SWIPE_CLOSE * .6 + (s.dy - SWIPE_CLOSE) * .25;
    event.currentTarget.style.transform = `translate3d(0, ${pull}px, 0) scale(${1 - Math.min(s.dy, 240) / 2400})`;
    event.currentTarget.style.setProperty('--cc-cam-pull', String(Math.min(s.dy / SWIPE_CLOSE, 1)));
  };
  const swipeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    if (!s || s.id !== event.pointerId) return;
    swipe.current = null;
    const el = event.currentTarget;
    el.style.transition = '';
    if (s.dy > SWIPE_CLOSE && event.type === 'pointerup') { onClose(); return; }
    if (s.dy < 6 && event.type === 'pointerup' && state === 'live' && camera.canFocus) {
      const box = el.getBoundingClientRect(), x = (event.clientX - box.left) / box.width, y = (event.clientY - box.top) / box.height;
      camera.focusAt(x, y); setFocus({ x: event.clientX - box.left, y: event.clientY - box.top, key: Date.now() });
    }
    el.style.transform = '';
    el.style.removeProperty('--cc-cam-pull');
  };

  if (!open) return null;
  const meal = context?.mealLabel?.trim() || mealForTime(now);
  const kcal = wholeNumber(context?.caloriesLeft), protein = wholeNumber(context?.proteinLeftG);
  const live = state === 'live';
  const status = state === 'blocked' ? 'Camera off · tap the shutter' : state === 'starting' ? '' : taking ? 'Hold still…' : statusVoice()[track];
  const announce = state === 'blocked' ? 'Camera access is off. The shutter opens your phone camera.' : live ? 'Camera ready.' : '';

  return <dialog ref={dialog} className="cc-cam" aria-label="Meal camera" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="cc-cam-panel" data-state={state} data-track={track} data-capturing={capturing} data-taking={taking} data-facing={camera.facing}
      onPointerDown={swipeStart} onPointerMove={swipeMove} onPointerUp={swipeEnd} onPointerCancel={swipeEnd}>
      <div className="cc-cam-stage">
        <video ref={video} className="cc-cam-feed" playsInline muted autoPlay aria-hidden="true"/>
        <div className="cc-cam-shade" aria-hidden="true"/>
      </div>
      <Reticle track={state === 'blocked' ? 'search' : track} live={live}/>
      {quips && <CameraQuip active={open && state === 'live' && !capturing && !taking} video={video}/>}
      {capturing && <div className="cc-cam-flash" aria-hidden="true"/>}
      {focus && <i key={focus.key} className="cc-cam-focus" style={{ left: focus.x, top: focus.y }} aria-hidden="true" onAnimationEnd={() => setFocus(null)}/>}

      <header className="cc-cam-top">
        <button type="button" className="cc-cam-glass cc-cam-close" aria-label="Close camera" onClick={onClose}><X size={20} strokeWidth={1.75}/></button>
        <p className="cc-cam-context"><span>{meal}</span><span className="cc-cam-sep" aria-hidden="true"/><time dateTime={now.toISOString()}>{clockTime(now)}</time></p>
        <div className="cc-cam-top-end">
          {camera.torchAvailable && <button type="button" className="cc-cam-glass" aria-label="Light" aria-pressed={camera.torchOn} onClick={camera.toggleTorch}>{camera.torchOn ? <Flashlight size={19} strokeWidth={1.75}/> : <FlashlightOff size={19} strokeWidth={1.75}/>}</button>}
          {camera.canFlip && <button type="button" className="cc-cam-glass" aria-label={camera.facing === 'environment' ? 'Switch to front camera' : 'Switch to back camera'} onClick={camera.flip}><SwitchCamera size={19} strokeWidth={1.75}/></button>}
        </div>
      </header>

      <p className="cc-cam-status" aria-hidden="true" data-empty={!status}><i/>{status}</p>

      <div className="cc-cam-bottom">
        {(kcal !== null || protein !== null) && <ul className="cc-cam-chips" aria-label="Left today">
          {kcal !== null && <li><b>{kcal.toLocaleString()}</b> kcal left</li>}
          {protein !== null && <li><b>{protein.toLocaleString()}</b> g protein</li>}
        </ul>}
        <div className="cc-cam-controls">
          <button type="button" className="cc-cam-library" aria-label="Choose from library" onClick={() => library.current?.click()}><Images size={22} strokeWidth={1.6}/></button>
          <button type="button" className="cc-cam-shutter" aria-label={state === 'blocked' ? 'Open phone camera' : 'Take meal photo'} disabled={state === 'starting' || capturing || taking} onClick={shoot}><span/></button>
          {onOpenFoodLog
            ? <button type="button" className="cc-cam-text" onClick={() => { onClose(); onOpenFoodLog(); }}>Food log</button>
            : <span className="cc-cam-spacer" aria-hidden="true"/>}
        </div>
      </div>

      <span className="cc-cam-sr" role="status">{announce}</span>
      <input ref={native} type="file" accept={ACCEPT} capture="environment" hidden aria-label="Take meal photo file" onChange={fromInput}/>
      <input ref={library} type="file" accept={ACCEPT} hidden aria-label="Choose meal photo from library" onChange={fromInput}/>
    </div>
  </dialog>;
}
