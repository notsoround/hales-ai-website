/** Ambient top-of-Today Living Sky backdrop. Purely decorative (aria-hidden), GPU-composited only,
 *  reacts to time of day + behavioral mood, and honors Static mode and prefers-reduced-motion. */
import type { SkyPreference } from '../accountSkyPreference';
import type { DayPhase, SkyMood } from './livingSky';

const RAIN_DROPS = [
  { left: '8%', top: '-12px', delay: '0s', dur: '1.9s' },
  { left: '16%', top: '-26px', delay: '.7s', dur: '2.2s' },
  { left: '24%', top: '-18px', delay: '.3s', dur: '2.0s' },
  { left: '33%', top: '-32px', delay: '1.1s', dur: '2.3s' },
  { left: '41%', top: '-14px', delay: '.5s', dur: '1.85s' },
  { left: '50%', top: '-24px', delay: '1.4s', dur: '2.1s' },
  { left: '59%', top: '-16px', delay: '.2s', dur: '2.25s' },
  { left: '68%', top: '-28px', delay: '.9s', dur: '1.95s' },
  { left: '76%', top: '-20px', delay: '1.6s', dur: '2.15s' },
  { left: '84%', top: '-10px', delay: '.4s', dur: '2.05s' },
  { left: '91%', top: '-22px', delay: '1.2s', dur: '2.2s' },
  { left: '12%', top: '-30px', delay: '1.8s', dur: '2.1s' },
];

const STARS = [
  { left: '9%', top: '26px', delay: '0s' },
  { left: '19%', top: '54px', delay: '1.4s' },
  { left: '29%', top: '22px', delay: '2.6s' },
  { left: '42%', top: '42px', delay: '.8s' },
  { left: '54%', top: '18px', delay: '3.2s' },
  { left: '64%', top: '58px', delay: '1.9s' },
  { left: '73%', top: '30px', delay: '2.9s' },
  { left: '82%', top: '48px', delay: '.4s' },
  { left: '91%', top: '24px', delay: '2.1s' },
  { left: '36%', top: '76px', delay: '3.6s' },
];

export function LivingSkyCanvas({
  phase,
  mood,
  skyPref,
  burstKey,
}: {
  phase: DayPhase;
  mood: SkyMood;
  skyPref: SkyPreference;
  burstKey: number;
}) {
  return (
    <div
      className="nx-sky-stage"
      data-phase={phase}
      data-mood={mood}
      data-sky={skyPref}
      aria-hidden="true"
    >
      <div className="nx-sky-wash" />
      {mood !== 'rain' && <div className="nx-sky-orb" />}
      {skyPref === 'living' && (
        <>
          {(mood === 'mist' || mood === 'rain' || mood === 'sunbreak') && (
            <div className="nx-sky-mist">
              <span className="is-a" />
              <span className="is-b" />
              <span className="is-c" />
            </div>
          )}
          {mood === 'rain' && (
            <div className="nx-sky-rain">
              {RAIN_DROPS.map((d, i) => (
                <i
                  key={i}
                  style={{
                    left: d.left,
                    top: d.top,
                    animationDelay: d.delay,
                    animationDuration: d.dur,
                  }}
                />
              ))}
            </div>
          )}
          {(mood === 'sunbreak' || mood === 'clear' || mood === 'radiant') && (
            <div className="nx-sky-sunbeam">
              <span className="is-halo" />
              <span className="is-ray" />
            </div>
          )}
          {phase === 'night' && mood !== 'rain' && (
            <div className="nx-sky-stars">
              {STARS.map((s, i) => (
                <i key={i} style={{ left: s.left, top: s.top, animationDelay: s.delay }} />
              ))}
            </div>
          )}
          {burstKey > 0 && <div key={burstKey} className="nx-sky-burst" />}
        </>
      )}
    </div>
  );
}
