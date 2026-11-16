import type { RefObject } from 'react';
import { useCameraQuips } from './useCameraQuips';
import type { QuipContext } from './quipLines';
import './camera-quips.css';

/** Labs: the assistant's one-line reaction to what the live camera sees, above the reticle. */
export function CameraQuip({ active, video, context }: { active: boolean; video: RefObject<HTMLVideoElement | null>; context?: QuipContext }) {
  const { quip, stats } = useCameraQuips(active, video, context);
  return <p className="cc-cam-quip" role="status" aria-live="polite" data-empty={!quip}
    data-look-ms={stats.current.lookMs === null ? undefined : Math.round(stats.current.lookMs)}
    data-load-ms={stats.current.loadMs === null ? undefined : Math.round(stats.current.loadMs)}>
    {quip && <span key={quip.key}>{quip.line}</span>}
  </p>;
}
