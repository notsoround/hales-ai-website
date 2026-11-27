import type { CaptureKind } from '../accountMealPhotoHandoff';
import { loadLooker } from './useCameraQuips';

/** A price on a poster or a lottery ticket alone is not a receipt. */
export function receiptText(text: string) {
  if (/\b(powerball|mega millions|lottery ticket)\b/i.test(text)) return false;
  const money = /\b\d{1,6}[.,]\d{2}\b/.test(text);
  const markers = text.match(/\b(sub[\s-]?total|total|receipt|sales tax|tax|cashier|tendered|change due|gratuity|amount paid|payment|balance due)\b/gi) || [];
  return money && (new Set(markers.map(word => word.toLowerCase())).size >= 2 ||
    /\b(grand total|amount paid|total due|sales receipt)\b/i.test(text));
}

type LocalTextDetector = new () => { detect(canvas: HTMLCanvasElement): Promise<Array<{ rawValue: string }>> };
export async function classifyCapture(file: File, signal: AbortSignal): Promise<CaptureKind> {
  const image = new Image(), url = URL.createObjectURL(file);
  try {
    image.src = url; await image.decode(); signal.throwIfAborted();
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!width || !height || width * height > 64_000_000) return 'other';
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1500 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'other';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const Detector = (window as Window & { TextDetector?: LocalTextDetector }).TextDetector;
    if (Detector) {
      const blocks = await new Detector().detect(canvas).catch(() => []);
      signal.throwIfAborted();
      if (receiptText(blocks.map(block => block.rawValue).join('\n'))) return 'receipt';
    }
    // A flat frame has no usable visual signal. A light paper-like frame can go
    // straight to text recognition without loading the separate visual models.
    const sample = document.createElement('canvas'); sample.width = sample.height = 64;
    const probe = sample.getContext('2d');
    probe?.drawImage(canvas, 0, 0, 64, 64);
    const pixels = probe?.getImageData(0, 0, 64, 64).data;
    let light = 0, min = 255, max = 0;
    if (pixels) for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i+1], b = pixels[i+2], y = (r+2*g+b)/4;
      min = Math.min(min,y); max = Math.max(max,y);
      if (y > 170 && Math.max(r,g,b)-Math.min(r,g,b) < 40) light++;
    }
    if (pixels && max-min < 20) return 'other';
    async function looksLikeReceipt() {
      try {
        const { readCaptureText } = await import('./captureOCR'); signal.throwIfAborted();
        return receiptText(await readCaptureText(canvas, signal));
      } catch { signal.throwIfAborted(); return false; }
    }
    const paperLike = light > 64 * 64 * .6;
    if (paperLike && await looksLikeReceipt()) return 'receipt';
    try {
      const small = document.createElement('canvas'); small.width = small.height = 224;
      const side = Math.min(width, height);
      small.getContext('2d')?.drawImage(image, (width-side)/2, (height-side)/2, side, side, 0, 0, 224, 224);
      const classifier = await loadLooker(); signal.throwIfAborted();
      const scene = classifier.look(small, small).guess?.scene;
      if (scene === 'person') return 'other';
      if (scene === 'food' || scene === 'drink' || scene === 'coffee' || scene === 'booze') return 'meal';
    } catch { signal.throwIfAborted(); }
    return !paperLike && await looksLikeReceipt() ? 'receipt' : 'other';
  } finally { URL.revokeObjectURL(url); }
}
