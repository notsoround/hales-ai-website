import fastingScene from './scenes/fasting.webp';
import glucoseScene from './scenes/glucose.webp';
import sleepScene from './scenes/sleep.webp';
import type { DialMetric } from './MultiDial';
import './dial-scene.css';

const illustrations = { fast: fastingScene, glucose: glucoseScene, sleep: sleepScene };

export function DialScene({ tone, photos }: { tone: DialMetric['tone']; photos: string[] }) {
  const sources = tone === 'cal' ? photos : [illustrations[tone]];
  if (!sources.length) return null;
  return <div key={tone} aria-hidden="true" className="nx-dial-scene" data-scene={tone} data-count={sources.length}>
    <div className="nx-scene-images">
      {sources.map((src, index) => <img key={index} src={src} alt="" draggable={false} decoding="async" />)}
    </div>
  </div>;
}
