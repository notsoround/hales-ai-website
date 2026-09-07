import { useEffect, useRef, useState } from 'react';
import { Mic, RefreshCw, Square } from 'lucide-react';
import { hasAudibleSignal, microphoneConstraints, microphoneMessage } from './voiceInput';

type Device = { deviceId: string; label: string };
export default function VoiceInputCheck({ deviceId, onDevice, onTesting, disabled = false }: { deviceId: string; onDevice: (id: string) => void; onTesting?: (active:boolean) => void; disabled?: boolean }) {
  const [devices, setDevices] = useState<Device[]>([]); const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('Choose Test microphone before starting a conversation on this device.'); const [level, setLevel] = useState(0);
  const stop = useRef<() => void>(() => {}); const generation=useRef(0);const mounted=useRef(true);
  useEffect(() => () => {mounted.current=false;stop.current();generation.current++;}, []);
  async function refresh() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const found = (await navigator.mediaDevices.enumerateDevices()).filter(x => x.kind === 'audioinput').map((x, i) => ({ deviceId: x.deviceId, label: x.label || `Microphone ${i + 1}` }));
    if(!mounted.current)return;setDevices(found); if (deviceId && !found.some(x => x.deviceId === deviceId)) onDevice('');
  }
  async function test() {
    if (testing) { stop.current(); return; } const token=++generation.current;setTesting(true);onTesting?.(true); setLevel(0); setStatus('Listening locally… say a few words. Nothing is sent.');
    let stream: MediaStream | null = null; let audio: AudioContext | null = null; let frame = 0; let timer = 0; let heard = false;
    const cleanup=()=>{cancelAnimationFrame(frame);clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());void audio?.close();};
    const finish = (message?: string) => { cleanup();if(token!==generation.current||!mounted.current)return;generation.current++;setTesting(false);onTesting?.(false);setStatus(message || (heard ? 'Audio detected. This input is ready.' : 'Permission is allowed, but no audio was detected. Check the selected input and the Mac input level.')); };
    stop.current = () => {if(token!==generation.current)return;generation.current++;cleanup();if(mounted.current){setTesting(false);onTesting?.(false);setStatus('Microphone test stopped.');}};
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot test a microphone here. Use a current browser over HTTPS.');
      stream = await navigator.mediaDevices.getUserMedia(microphoneConstraints(deviceId)); if(token!==generation.current||!mounted.current){stream.getTracks().forEach(t=>t.stop());return;} await refresh();
      const track = stream.getAudioTracks()[0]; if (track?.getSettings().deviceId && !deviceId) onDevice(track.getSettings().deviceId || '');
      audio = new AudioContext(); await audio.resume();if(token!==generation.current||!mounted.current){cleanup();return;} const analyser = audio.createAnalyser(); analyser.fftSize = 512; audio.createMediaStreamSource(stream).connect(analyser); const samples = new Uint8Array(analyser.fftSize);
      const measure = () => { analyser.getByteTimeDomainData(samples); const result = hasAudibleSignal(samples); heard ||= result.heard; setLevel(Math.min(1, result.rms * 8)); frame = requestAnimationFrame(measure); }; frame = requestAnimationFrame(measure); timer = window.setTimeout(() => finish(), 5000);
    } catch (error) { finish(microphoneMessage(error as Error)); }
  }
  return <section className="cc-card cc-mic-check"><div className="cc-heading-row"><div><strong>Microphone on this device</strong><small>Tested locally before Cupcake connects</small></div><button className="cc-secondary" disabled={disabled} onClick={() => void test()}>{testing ? <Square size={15}/> : <Mic size={16}/>} {testing ? 'Stop test' : 'Test microphone'}</button></div>{devices.length > 1 && <label className="cc-label">Input<select value={deviceId} disabled={disabled || testing} onChange={e => onDevice(e.target.value)}><option value="">System default</option>{devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></label>}<div className="cc-level" role="meter" aria-label="Microphone test level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}><i style={{width:`${Math.max(1, level * 100)}%`}}/></div><p role="status" className="cc-muted cc-small">{status}</p>{devices.length === 0 && <button className="cc-text-button" disabled={disabled || testing} onClick={() => void refresh()}><RefreshCw size={14}/>Check available inputs</button>}</section>;
}
