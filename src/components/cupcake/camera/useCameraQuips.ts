import { useEffect, useRef, useState, type RefObject } from 'react';
import { sameScene, sceneFor, type SceneGuess } from './sceneGuess';
import { pickQuip } from './quipLines';

/**
 * Labs "camera comments": guesses what the live camera is looking at, on this device, and picks
 * one of the assistant's lines. No frame leaves the phone and nothing is saved; the only network
 * use is downloading the model files once (about 15 MB, then cached by the browser).
 *
 * Models: EfficientNet-Lite0 (ImageNet, int8) for things and food, BlazeFace short range for
 * "someone is in frame". Both run in Google's MediaPipe Tasks (WebAssembly, CPU).
 */
const BASE = '/cupcake-vision/0.10.17/';
/** Pause between the end of one look and the start of the next. Slow phones never queue up. */
export const LOOK_EVERY_MS = 550;
/** A new line waits at least this long after the last one, so she comments instead of chattering. */
export const MIN_GAP_MS = 2600;
/** The same scene gets another line only after this long. */
export const REPEAT_AFTER_MS = 12_000;
/** How long a line stays up. */
export const SHOW_MS = 4200;
/** Real faces score 0.8 to 0.97 in our checks; a burger once scored 0.55. */
const FACE_SCORE = 0.75;

type Looker = { look(frame: HTMLCanvasElement, wide: HTMLCanvasElement): { guess: SceneGuess | null } };
let loading: Promise<Looker> | null = null;

function loadLooker(): Promise<Looker> {
  loading ??= (async () => {
    const vision = await import('@mediapipe/tasks-vision');
    const files = { wasmLoaderPath: BASE + 'vision_wasm_internal.js', wasmBinaryPath: BASE + 'vision_wasm_internal.wasm' };
    const [classifier, faces] = await Promise.all([
      vision.ImageClassifier.createFromOptions(files, { baseOptions: { modelAssetPath: BASE + 'efficientnet_lite0_int8.tflite', delegate: 'CPU' }, runningMode: 'IMAGE', maxResults: 5 }),
      vision.FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: BASE + 'blaze_face_short_range.tflite', delegate: 'CPU' }, runningMode: 'IMAGE', minDetectionConfidence: FACE_SCORE }),
    ]);
    return {
      look(frame, wide) {
        const top = classifier.classify(frame).classifications[0]?.categories.map(c => ({ index: c.index, score: c.score })) ?? [];
        const seen = faces.detect(wide).detections.filter(d => (d.categories[0]?.score ?? 0) >= FACE_SCORE).length;
        return { guess: sceneFor(top, seen) };
      },
    };
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

export type Quip = { line: string; key: number };
export type QuipStats = { loadMs: number | null; lookMs: number | null };

const voiceNow = (): 'cupcake' | 'calm' => typeof document !== 'undefined' && document.querySelector('.cc-app')?.getAttribute('data-appearance') === 'caribbean' ? 'cupcake' : 'calm';

export function useCameraQuips(active: boolean, video: RefObject<HTMLVideoElement | null>) {
  const [quip, setQuip] = useState<Quip | null>(null);
  const stats = useRef<QuipStats>({ loadMs: null, lookMs: null });

  useEffect(() => {
    if (!active) { setQuip(null); return; }
    let stopped = false, timer = 0, hide = 0;
    let previous: SceneGuess | null = null, shown: SceneGuess | null = null, shownAt = -Infinity, lastLine = '';
    const frame = document.createElement('canvas'), wide = document.createElement('canvas');
    frame.width = frame.height = 224;
    const started = performance.now();

    const tick = (looker: Looker) => {
      if (stopped) return;
      const el = video.current;
      if (el && el.videoWidth && !el.paused && document.visibilityState === 'visible') {
        const t0 = performance.now();
        // Centre square: what sits in the reticle is what she comments on.
        const side = Math.min(el.videoWidth, el.videoHeight);
        frame.getContext('2d')?.drawImage(el, (el.videoWidth - side) / 2, (el.videoHeight - side) / 2, side, side, 0, 0, 224, 224);
        wide.width = 320; wide.height = Math.round(320 * el.videoHeight / el.videoWidth);
        wide.getContext('2d')?.drawImage(el, 0, 0, wide.width, wide.height);
        let guess: SceneGuess | null = null;
        try { guess = looker.look(frame, wide).guess; } catch { guess = null; }
        const now = performance.now();
        stats.current.lookMs = stats.current.lookMs === null ? now - t0 : stats.current.lookMs * .7 + (now - t0) * .3;
        // Two looks in a row must agree before she says anything.
        if (guess && sameScene(guess, previous) && now - shownAt >= MIN_GAP_MS && (!sameScene(guess, shown) || now - shownAt >= REPEAT_AFTER_MS)) {
          lastLine = pickQuip(voiceNow(), guess, lastLine);
          shown = guess; shownAt = now;
          setQuip({ line: lastLine, key: now });
          window.clearTimeout(hide);
          hide = window.setTimeout(() => { if (!stopped) setQuip(null); }, SHOW_MS);
        }
        previous = guess;
      }
      timer = window.setTimeout(() => tick(looker), LOOK_EVERY_MS);
    };

    loadLooker().then(looker => {
      if (stopped) return;
      stats.current.loadMs ??= performance.now() - started;
      tick(looker);
    }, () => undefined); // No comments is the fallback; the camera works the same without them.

    return () => { stopped = true; window.clearTimeout(timer); window.clearTimeout(hide); setQuip(null); };
  }, [active, video]);

  return { quip, stats };
}
