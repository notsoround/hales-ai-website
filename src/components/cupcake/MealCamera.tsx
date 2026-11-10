import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import './account-camera.css';

/**
 * Account-app meal camera: one tap opens a live viewfinder with a plate frame and
 * "Take a photo of your meal", so the capture moment looks intentional. The photo
 * stays in memory and goes to the same account photo flow as before. If the browser
 * has no camera access (refused, missing, or unsupported), the phone's own camera
 * is one tap away, so photo logging never gets harder than it was.
 */
type State = 'starting' | 'live' | 'blocked';

export function MealCamera({ open, onClose, onPhoto }: { open: boolean; onClose: () => void; onPhoto: (file: File) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), video = useRef<HTMLVideoElement>(null), native = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>('starting');
  const [flash, setFlash] = useState(false);
  const stop = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };

  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    let alive = true;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!node.open) node.showModal();
    setState('starting'); setFlash(false);
    if (!navigator.mediaDevices?.getUserMedia) setState('blocked');
    else void navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } } })
      .then(media => {
        if (!alive) { media.getTracks().forEach(track => track.stop()); return; }
        stream.current = media;
        const el = video.current;
        if (!el) return;
        el.srcObject = media;
        void el.play().catch(() => undefined);
        setState('live');
      })
      .catch(() => { if (alive) setState('blocked'); });
    return () => { alive = false; stop(); if (node.open) node.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, [open]);

  const shoot = () => {
    const el = video.current;
    if (state !== 'live' || !el || !el.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = el.videoWidth; canvas.height = el.videoHeight;
    canvas.getContext('2d')?.drawImage(el, 0, 0, canvas.width, canvas.height);
    setFlash(true);
    canvas.toBlob(blob => {
      if (!blob) { setState('blocked'); return; }
      const now = Date.now();
      onPhoto(new File([blob], `meal-${now}.jpg`, { type: 'image/jpeg', lastModified: now }));
      onClose();
    }, 'image/jpeg', 0.9);
  };

  if (!open) return null;
  return <dialog ref={dialog} className="cc-meal-camera" aria-label="Meal camera" onCancel={event => { event.preventDefault(); onClose(); }}>
    <video ref={video} className="cc-meal-camera-feed" playsInline muted autoPlay aria-hidden="true" data-live={state === 'live'}/>
    <div className="cc-meal-camera-scrim" aria-hidden="true"/>
    <div className="cc-meal-camera-guide">
      <h2>Take a photo of your meal</h2>
      <p>{state === 'blocked' ? 'Camera access is off for this page. Use your phone’s camera instead.' : 'Fit the whole plate inside the frame'}</p>
    </div>
    <div className="cc-meal-camera-frame" aria-hidden="true" data-state={state}><i/><i/><i/><i/></div>
    {flash && <div className="cc-meal-camera-flash" aria-hidden="true"/>}
    <div className="cc-meal-camera-bar">
      <button type="button" className="cc-meal-camera-side" aria-label="Close camera" onClick={onClose}><X size={24}/></button>
      {state === 'blocked'
        ? <button type="button" className="cc-primary cc-meal-camera-native" onClick={() => native.current?.click()}><Camera size={20}/>Open phone camera</button>
        : <button type="button" className="cc-meal-camera-shutter" aria-label="Take meal photo" disabled={state !== 'live'} onClick={shoot}><span/></button>}
      {state === 'blocked' ? <span className="cc-meal-camera-side" aria-hidden="true"/> : <button type="button" className="cc-meal-camera-side cc-meal-camera-alt" aria-label="Use phone camera" onClick={() => native.current?.click()}><Camera size={22}/><small>Phone</small></button>}
    </div>
    <input ref={native} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden aria-label="Take meal photo file" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) { onPhoto(file); onClose(); } }}/>
  </dialog>;
}
