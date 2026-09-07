export type MicFailure = { name?: string; message?: string };

export function microphoneMessage(error: MicFailure) {
  if (error?.name === 'NotAllowedError' || /permission denied|permission dismissed/i.test(error?.message || '')) return 'Microphone is blocked. Allow it for hales.ai in this browser. On Mac, also open System Settings → Privacy & Security → Microphone and allow this browser.';
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') return 'That microphone is unavailable. Connect it or choose another input.';
  if (error?.name === 'NotReadableError' || error?.name === 'AbortError') return 'The microphone is allowed but could not start. Close another app using it, reconnect it, or choose another input.';
  return error?.message || 'The microphone could not start.';
}

export function microphoneConstraints(deviceId?: string): MediaStreamConstraints {
  return { audio: deviceId ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true } : true };
}

export function readInputDevice() { try { return localStorage.getItem('cupcake-voice-input') || ''; } catch { return ''; } }
export function saveInputDevice(deviceId: string) { try { localStorage.setItem('cupcake-voice-input', deviceId); } catch { /* Selection still works for this page. */ } }

export function hasAudibleSignal(samples: Uint8Array, threshold = 0.003) {
  const rms = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / Math.max(1, samples.length));
  return { rms, heard: rms > threshold };
}
