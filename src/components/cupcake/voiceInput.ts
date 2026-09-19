export type MicFailure = { name?: string; message?: string };

export function microphoneMessage(error: MicFailure) {
  if (error?.name === 'MicrophoneTimeoutError') return 'Microphone permission or startup did not finish. Check the browser permission prompt and Mac microphone access, then try again.';
  if (error?.name === 'NotAllowedError' || /permission denied|permission dismissed/i.test(error?.message || '')) return 'Microphone is blocked. Allow it for hales.ai in this browser. On Mac, also open System Settings → Privacy & Security → Microphone and allow this browser.';
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') return 'That microphone is unavailable. Connect it or choose another input.';
  if (error?.name === 'NotReadableError' || error?.name === 'AbortError') return 'The microphone is allowed but could not start. Close another app using it, reconnect it, or choose another input.';
  return error?.message || 'The microphone could not start.';
}

export async function acquireMicrophone(getUserMedia:(constraints:MediaStreamConstraints)=>Promise<MediaStream>,constraints:MediaStreamConstraints,timeoutMs=12000,signal?:AbortSignal) {
  const cancelled=()=>{const error=new Error('Audio startup cancelled');error.name='MicrophoneCancelledError';return error;};
  if(signal?.aborted)throw cancelled();
  let abandoned=false;let timer:ReturnType<typeof setTimeout>|undefined;let rejectCancellation:(reason:Error)=>void=()=>{};
  const cancellation=new Promise<MediaStream>((_,reject)=>{rejectCancellation=reject;});
  const abort=()=>{abandoned=true;rejectCancellation(cancelled());};
  signal?.addEventListener('abort',abort,{once:true});
  try {
    const pending=getUserMedia(constraints).then(stream=>{if(abandoned||signal?.aborted){stream.getTracks().forEach(track=>track.stop());throw cancelled();}return stream;});
    return await Promise.race([pending,cancellation,new Promise<MediaStream>((_,reject)=>{timer=setTimeout(()=>{abandoned=true;const error=new Error('Microphone acquisition timed out');error.name='MicrophoneTimeoutError';reject(error);},timeoutMs);})]);
  } finally {if(timer)clearTimeout(timer);signal?.removeEventListener('abort',abort);}
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
