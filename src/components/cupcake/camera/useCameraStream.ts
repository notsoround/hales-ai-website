import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type CameraState = 'starting' | 'live' | 'blocked';
export type Facing = 'environment' | 'user';

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
/** Focus, exposure and still-photo controls from the Image Capture spec; present on Android Chrome, absent on iOS Safari. */
type FocusCapabilities = MediaTrackCapabilities & { focusMode?: string[]; exposureMode?: string[]; whiteBalanceMode?: string[] };
type StillCamera = { takePhoto(settings?: { imageWidth?: number }): Promise<Blob>; getPhotoCapabilities?(): Promise<{ imageWidth?: { min: number; max: number; step: number } }> };
const stillCamera = (track: MediaStreamTrack): StillCamera | null => {
  const Ctor = (window as unknown as { ImageCapture?: new (track: MediaStreamTrack) => StillCamera }).ImageCapture;
  try { return Ctor ? new Ctor(track) : null; } catch { return null; }
};
/** Where the browser has no still-photo API the video frame IS the photo, so ask for the sharpest preview it offers. */
const FRAME_ONLY = typeof window !== 'undefined' && !('ImageCapture' in window);
const STILL_WIDTH = 2400, STILL_TIMEOUT = 4500;
const focusCaps = (track: MediaStreamTrack): FocusCapabilities => { try { return (track.getCapabilities?.() as FocusCapabilities | undefined) || {}; } catch { return {}; } };

/**
 * Phones expose several rear lenses, and "environment" can land on an ultra-wide or other fixed-focus one that
 * cannot focus on a plate or a receipt. When the lens we were given cannot autofocus (or is labelled wide/tele/macro)
 * and another rear lens exists, return the id of the main one. Labels are only readable once camera access is granted.
 */
async function betterRearLens(track: MediaStreamTrack): Promise<string | null> {
  const current = track.getSettings?.().deviceId, caps = focusCaps(track);
  const special = (label: string) => /ultra|wide|tele|macro|depth|infrared|\bir\b/i.test(label);
  const fixedFocus = Array.isArray(caps.focusMode) && !caps.focusMode.includes('continuous');
  if (!fixedFocus && !special(track.label)) return null;
  const devices = (await navigator.mediaDevices.enumerateDevices?.()) || [];
  const rear = devices.filter(d => d.kind === 'videoinput' && d.deviceId && d.deviceId !== current && /back|rear|environment/i.test(d.label) && !special(d.label));
  if (!rear.length) return null;
  // Android names them "camera2 0, facing back": the lowest index is the main camera.
  const index = (label: string) => { const m = /(\d+)/.exec(label); return m ? Number(m[1]) : 99; };
  return rear.sort((a, b) => index(a.label) - index(b.label))[0]!.deviceId;
}
/** Keep the lens focusing and exposing on its own; ignored where the track has no such controls. */
function keepFocusing(track: MediaStreamTrack) {
  const caps = focusCaps(track), set: Record<string, string> = {};
  if (caps.focusMode?.includes('continuous')) set.focusMode = 'continuous';
  if (caps.exposureMode?.includes('continuous')) set.exposureMode = 'continuous';
  if (caps.whiteBalanceMode?.includes('continuous')) set.whiteBalanceMode = 'continuous';
  if (Object.keys(set).length) void track.applyConstraints({ advanced: [set as MediaTrackConstraintSet] }).catch(() => undefined);
}

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
  // A specific rear lens chosen after the first look at what the phone offers; cleared on flip and close.
  const [lens, setLens] = useState<string | null>(null);
  const lensTried = useRef(false);
  const [canFocus, setCanFocus] = useState(false);

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
    const size = FRAME_ONLY ? { width: { ideal: 3840 }, height: { ideal: 2160 } } : { width: { ideal: 1920 }, height: { ideal: 1440 } };
    void navigator.mediaDevices.getUserMedia({ audio: false, video: lens && facing === 'environment' ? { deviceId: { exact: lens }, ...size } : { facingMode: { ideal: facing }, ...size } })
      .then(media => {
        if (!alive) { media.getTracks().forEach(track => track.stop()); return; }
        const track = media.getVideoTracks()[0];
        if (!track) { media.getTracks().forEach(t => t.stop()); setState('blocked'); return; }
        stop();
        stream.current = media;
        try { setTorchAvailable(Boolean((track.getCapabilities?.() as TorchCapabilities | undefined)?.torch)); } catch { setTorchAvailable(false); }
        keepFocusing(track);
        setCanFocus(Boolean(focusCaps(track).focusMode?.length));
        if (facing === 'environment' && !lens && !lensTried.current) {
          lensTried.current = true;
          void betterRearLens(track).then(id => { if (alive && id) setLens(id); }).catch(() => undefined);
        }
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
      // A chosen lens that will not open falls back to whatever "environment" gives.
      .catch(() => { if (!alive) return; if (lens) setLens(null); else setState('blocked'); });
    return () => { alive = false; stop(); };
  }, [active, facing, lens, stop, video]);
  useEffect(() => { if (!active) { lensTried.current = false; setLens(null); } }, [active]);

  const flip = useCallback(() => { setLens(null); setFacing(current => current === 'environment' ? 'user' : 'environment'); }, []);

  /** A real still photo at sensor quality (the phone focuses and exposes for it). Null where unsupported, on error or after 4.5 s; the caller then keeps its video frame. */
  const takeStill = useCallback(async (): Promise<Blob | null> => {
    const track = stream.current?.getVideoTracks()[0], still = track && track.readyState === 'live' ? stillCamera(track) : null;
    if (!still) return null;
    try {
      let settings: { imageWidth?: number } | undefined;
      try { const range = (await still.getPhotoCapabilities?.())?.imageWidth; if (range && range.max > STILL_WIDTH) { const step = range.step || 1; settings = { imageWidth: Math.min(range.max, range.min + Math.ceil((STILL_WIDTH - range.min) / step) * step) }; } } catch { settings = undefined; }
      const photo = await Promise.race([still.takePhoto(settings), new Promise<null>(resolve => window.setTimeout(() => resolve(null), STILL_TIMEOUT))]);
      return photo && photo.size > 0 && /^image\//.test(photo.type) ? photo : null;
    } catch { return null; }
  }, []);

  /** Tap to focus: x and y are 0–1 across the camera frame. Returns to continuous focus afterwards. */
  const focusAt = useCallback((x: number, y: number) => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    const modes = focusCaps(track).focusMode || [];
    if (!modes.length) return;
    const point = { pointsOfInterest: [{ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }] };
    void track.applyConstraints({ advanced: [{ ...point, focusMode: modes.includes('single-shot') ? 'single-shot' : 'continuous' } as MediaTrackConstraintSet] })
      .then(() => { if (modes.includes('continuous')) window.setTimeout(() => { if (stream.current?.getVideoTracks()[0] === track) void track.applyConstraints({ advanced: [{ ...point, focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined); }, 1600); })
      .catch(() => undefined);
  }, []);

  const toggleTorch = useCallback(() => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    void track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => setTorchAvailable(false));
  }, [torchOn]);

  return { state, setState, facing, canFlip, flip, torchAvailable, torchOn, toggleTorch, stop, takeStill, focusAt, canFocus, frameOnly: FRAME_ONLY };
}
