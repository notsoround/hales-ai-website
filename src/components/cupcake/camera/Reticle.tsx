import type { TrackState } from './useStillness';

/**
 * The tracking reticle: four hairline corner brackets, a slow bezel ring (watch-face
 * tick marks) and a soft scan sweep. It breathes while searching, tightens and takes
 * the accent colour when locked. Pure SVG + CSS transforms/opacity; all motion is off
 * under prefers-reduced-motion.
 */
const corner = 'M 2 30 V 14 A 12 12 0 0 1 14 2 H 30';
const TICKS = Array.from({ length: 60 }, (_, i) => i);

export function Reticle({ track, live }: { track: TrackState; live: boolean }) {
  return <div className="cc-cam-reticle" data-track={track} data-live={live} aria-hidden="true">
    <div className="cc-cam-reticle-frame">
      {[0, 90, 180, 270].map(angle => <svg key={angle} className="cc-cam-corner" data-corner={angle} viewBox="0 0 32 32">
        <path d={corner}/>
      </svg>)}
      <svg className="cc-cam-bezel" viewBox="0 0 200 200">
        {TICKS.map(i => <line key={i} x1="100" y1={i % 5 === 0 ? 7 : 9} x2="100" y2="12" transform={`rotate(${i * 6} 100 100)`} data-major={i % 15 === 0}/>)}
      </svg>
      <div className="cc-cam-scan"/>
      <div className="cc-cam-lockring"/>
      <i className="cc-cam-center"/>
    </div>
  </div>;
}
