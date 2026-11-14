import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type CameraState = 'starting' | 'live' | 'blocked';
export type Facing = 'environment' | 'user';

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

/**
 * Owns the getUserMedia stream for the meal camera: starts it when `active`, restarts
 * it on a camera flip, exposes torch only when the track reports it, and stops every
 * track on close, flip and unmount. Anything that fails (no API, insecure context,
 * permission refused, no device) lands in `blocked`, and the caller falls back to the
 * native file picker.
 */
export function useCameraStream(active: boolean, video: RefObject<HTMLVideoElement>) {
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('starting');
  const [facing, setFacing] = useState<Facing>('environment');
  const [canFlip, setCanFlip] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    const el = video.current;
    if (el) el.srcObject = null;
  }, [video]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    setState(current => current === 'live' ? 'live' : 'starting');
    setTorchAvailable(false); setTorchOn(false);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setState('blocked'); return; }
    void navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } } })
      .then(media => {
        if (!alive) { media.getTracks().forEach(track => track.stop()); return; }
        const track = media.getVideoTracks()[0];
        if (!track) { media.getTracks().forEach(t => t.stop()); setState('blocked'); return; }
        stop();
        stream.current = media;
        try { setTorchAvailable(Boolean((track.getCapabilities?.() as TorchCapabilities | undefined)?.torch)); } catch { setTorchAvailable(false); }
        const el = video.current;
        if (!el) return;
        el.srcObject = media;
        const ready = () => { if (alive) setState('live'); };
        if (el.readyState >= 2) ready(); else el.addEventListener('loadeddata', ready, { once: true });
        void el.play().catch(() => undefined);
        void navigator.mediaDevices.enumerateDevices?.()
          .then(devices => { if (alive) setCanFlip(devices.filter(device => device.kind === 'videoinput').length > 1); })
          .catch(() => undefined);
      })
      .catch(() => { if (alive) setState('blocked'); });
    return () => { alive = false; stop(); };
  }, [active, facing, stop, video]);

  const flip = useCallback(() => setFacing(current => current === 'environment' ? 'user' : 'environment'), []);

  const toggleTorch = useCallback(() => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    void track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => setTorchAvailable(false));
  }, [torchOn]);

  return { state, setState, facing, canFlip, flip, torchAvailable, torchOn, toggleTorch, stop };
}
