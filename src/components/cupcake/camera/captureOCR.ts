import { createWorker, OEM } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';
import corePath from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url';

/** The worker, language and WASM are served by this website. The scene is local. */
export async function readCaptureText(image: HTMLCanvasElement, signal: AbortSignal) {
  signal.throwIfAborted();
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath, corePath, langPath: '/cupcake-ocr/eng-v1', workerBlobURL: false, cacheMethod: 'none',
    errorHandler: () => undefined,
  });
  const stop = () => { void worker.terminate(); };
  signal.addEventListener('abort', stop, { once: true });
  try {
    signal.throwIfAborted();
    return (await worker.recognize(image)).data.text;
  } finally {
    signal.removeEventListener('abort', stop);
    if (!signal.aborted) await worker.terminate();
    else stop();
  }
}
