import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountRecordingClient, type ArchivedRecording } from './accountRecording';
import { subscribeSession } from './accountSession';
import AccountRecordingTranscription from './AccountRecordingTranscription';
import AccountRecordingSummary from './AccountRecordingSummary';

export default function AccountRecordingArchive({active, version, requested}: {active: boolean; version: number; requested: {id:string} | null}) {
  const [rows, setRows] = useState<ArchivedRecording[]>([]), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<ArchivedRecording | null>(null), [url, setUrl] = useState('');
  const audio = useRef<HTMLAudioElement | null>(null), client = useRef<AccountRecordingClient | null>(null);
  const stopAudio = useCallback(() => { const player = audio.current; if (player) { player.pause(); player.removeAttribute('src'); player.load(); } }, []);
  const attachAudio = useCallback((node: HTMLAudioElement | null) => { if (!node) stopAudio(); audio.current = node; }, [stopAudio]);
  useEffect(() => {
    const transport = new AccountRecordingClient(); client.current = transport;
    const stop = () => { stopAudio(); setUrl(''); setOpened(null); setRows([]); };
    const unsubscribe = subscribeSession(stop);
    return () => { unsubscribe(); transport.dispose(); stopAudio(); };
  }, [stopAudio]);
  const refresh = useCallback(async () => {
    if (!client.current) return;
    setBusy(true); setMessage('Loading saved audio…');
    try { const data = await client.current.request<{recordings: ArchivedRecording[]}>('list', {}); setRows(data.recordings); setMessage(data.recordings.length ? 'Saved audio is up to date.' : 'No audio saved to this account yet.'); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage((error as Error).message); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { if (active) void refresh(); }, [active, version, refresh]); // Provider-free owned archive read only.
  const open = useCallback(async (id: string, purpose: 'play' | 'download') => {
    if (!client.current) return;
    setBusy(true); setMessage('Opening saved original…');
    try {
      const data = await client.current.request<{recording: ArchivedRecording}>('get', {id});
      if (data.recording.status !== 'stored' || !data.recording.originalStored) throw Error('This original is not ready to open.');
      const link = await client.current.original(id, purpose);
      if (purpose === 'play') { audio.current?.pause(); setOpened(data.recording); setUrl(link.url); setMessage('Original audio. If playback expires, open it again.'); }
      else { const anchor = document.createElement('a'); anchor.href = link.url; anchor.rel = 'noreferrer'; anchor.click(); setMessage('Original download requested.'); }
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage((error as Error).message); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { if (requested) void open(requested.id, 'play'); }, [requested, open]);
  function close() { stopAudio(); setUrl(''); setOpened(null); }
  return <section aria-label="Account audio archive" className="cc-fold">
    <h3>Saved audio</h3><p className="cc-muted">Your latest 100 saved originals. Transcribe a complete clip up to ten minutes, then summarize its saved transcript when available. For a microphone conversation, choose Live voice.</p>
    <button className="cc-secondary" disabled={busy} onClick={() => void refresh()}>Refresh saved audio</button>
    <p role="status" className="cc-muted">{message}</p>
    {rows.map(row => <article className="cc-card" key={`${row.id}:${row.originalSha256}`}><strong>{row.title}</strong><p className="cc-muted">{new Date(row.createdAt).toLocaleDateString()} · {(row.totalBytes / (1024 * 1024)).toFixed(1)} MiB · Original saved</p><div className="cc-action-row"><button className="cc-secondary" disabled={busy} onClick={() => void open(row.id, 'play')}>Listen to saved audio</button><button className="cc-secondary" disabled={busy} onClick={() => void open(row.id, 'download')}>Download saved original</button></div><AccountRecordingTranscription recording={row} active={active}/><AccountRecordingSummary recording={row} active={active} onListen={() => void open(row.id, 'play')}/></article>)}
    {opened && <div className="cc-card"><strong>{opened.title}</strong><audio ref={attachAudio} controls crossOrigin="use-credentials" preload="metadata" src={url || undefined} aria-label="Saved original audio" style={{width: '100%'}} onError={() => setMessage('Playback could not continue. Open the saved audio again for a fresh link.')} /><button className="cc-text-button" onClick={close}>Close saved audio</button></div>}
  </section>;
}
