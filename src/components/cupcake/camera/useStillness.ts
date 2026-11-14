import { useEffect, useState, type RefObject } from 'react';

/** search → steady (view stopped moving) → locked (held still ~1s). */
export type TrackState = 'search' | 'steady' | 'locked';

const W = 32, H = 24, TICK = 250, STILL = 7, LOCK_TICKS = 4, MOVE_TICKS = 2;

/**
 * Cheap "is the phone being held still?" check: every 250 ms the live frame is drawn
 * into a 32×24 canvas and compared with the previous one (mean absolute luma change).
 * No ML, about 3k pixel reads a tick. Hysteresis keeps the state from flickering.
 * The timer stops as soon as `running` is false or the component unmounts.
 */
export function useStillness(running: boolean, video: RefObject<HTMLVideoElement>): TrackState {
  const [track, setTrack] = useState<TrackState>('search');

  useEffect(() => {
    if (!running) { setTrack('search'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let previous: Uint8ClampedArray | null = null, still = 0, moving = 0, state: TrackState = 'search';
    const set = (next: TrackState) => { if (next !== state) { state = next; setTrack(next); } };
    const tick = () => {
      const el = video.current;
      if (!ctx || !el || el.readyState < 2 || document.hidden) return;
      let frame: Uint8ClampedArray;
      try { ctx.drawImage(el, 0, 0, W, H); frame = ctx.getImageData(0, 0, W, H).data; }
      catch { still += 1; set(still >= LOCK_TICKS ? 'locked' : 'steady'); return; }
      if (previous) {
        let diff = 0;
        for (let i = 0; i < frame.length; i += 4) {
          diff += Math.abs((frame[i] * 3 + frame[i + 1] * 6 + frame[i + 2]) - (previous[i] * 3 + previous[i + 1] * 6 + previous[i + 2]));
        }
        const mean = diff / (W * H * 10);
        if (mean < STILL) { still += 1; moving = 0; } else { moving += 1; still = 0; }
        if (moving >= MOVE_TICKS) set('search');
        else if (still >= LOCK_TICKS) set('locked');
        else if (still >= 1 && state === 'search') set('steady');
      }
      previous = frame.slice();
    };
    const timer = window.setInterval(tick, TICK);
    return () => { window.clearInterval(timer); previous = null; };
  }, [running, video]);

  return track;
}
