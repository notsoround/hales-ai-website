import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountRecordingClient, type ArchivedRecording } from './accountRecording';
import { subscribeSession } from './accountSession';
import { transcriptionRecovery } from './accountTranscription';
import AccountRecordingTranscription from './AccountRecordingTranscription';
import AccountRecordingSummary from './AccountRecordingSummary';
import './noir/noir-plan.css';

function initialTranscriptBadge(row: ArchivedRecording): { label: string; tone: string } {
  try {
    if (row.originalStored && row.originalSha256 && transcriptionRecovery(row).load()) {
      return { label: 'Transcript requested', tone: 'pending' };
    }
  } catch { /* Ignore invalid local recovery. */ }
  return { label: 'Original saved', tone: 'saved' };
}

export default function AccountRecordingArchive({active, version, requested, showAllowance = false}: {active: boolean; version: number; requested: {id:string} | null; showAllowance?: boolean}) {
  const [rows, setRows] = useState<ArchivedRecording[]>([]), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<ArchivedRecording | null>(null), [url, setUrl] = useState('');
  const [statuses, setStatuses] = useState<Record<string, { label: string; tone: string }>>({});
  const [transcriptsReady, setTranscriptsReady] = useState<Record<string, boolean>>({});
  const audio = useRef<HTMLAudioElement | null>(null), client = useRef<AccountRecordingClient | null>(null);
  const stopAudio = useCallback(() => { const player = audio.current; if (player) { player.pause(); player.removeAttribute('src'); player.load(); } }, []);
  const attachAudio = useCallback((node: HTMLAudioElement | null) => { if (!node) stopAudio(); audio.current = node; }, [stopAudio]);
  useEffect(() => {
    const transport = new AccountRecordingClient(); client.current = transport;
    const stop = () => { stopAudio(); setUrl(''); setOpened(null); setRows([]); setStatuses({}); setTranscriptsReady({}); };
    const unsubscribe = subscribeSession(stop);
    return () => { unsubscribe(); transport.dispose(); stopAudio(); };
  }, [stopAudio]);
  const refresh = useCallback(async () => {
    if (!client.current) return;
    setBusy(true); setMessage('Loading saved audio…');
    try { const data = await client.current.request<{recordings: ArchivedRecording[]}>('list', {}); setRows(data.recordings); setMessage(data.recordings.length ? `${data.recordings.length} saved ${data.recordings.length === 1 ? 'recording' : 'recordings'}.` : 'No audio saved to this account yet.'); }
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
  const onTranscriptStatus = useCallback((id: string, badge: { label: string; tone: string }) => {
    setStatuses(prev => (prev[id]?.label === badge.label && prev[id]?.tone === badge.tone ? prev : { ...prev, [id]: badge }));
  }, []);
  const onTranscriptReady = useCallback((id: string, ready: boolean) => {
    setTranscriptsReady(prev => (!!prev[id] === ready ? prev : { ...prev, [id]: ready }));
  }, []);
  function close() { stopAudio(); setUrl(''); setOpened(null); }
  return <section aria-label="Account audio archive" className="cc-audio-archive">
    <div className="cc-audio-archive-head">
      <div><h3>Saved audio</h3><p className="cc-muted">Your saved originals (latest 100). Listen, transcribe, summarize, and log updates in one place.</p></div>
      <button className="cc-secondary" disabled={busy} onClick={() => void refresh()}>Refresh saved audio</button>
    </div>
    <p role="status" className="cc-muted cc-audio-archive-status">{message}</p>
    <div className="cc-audio-list">
      {rows.map(row => {
        const badge = statuses[row.id] || initialTranscriptBadge(row);
        const playingThis = opened?.id === row.id && !!url;
        return <article className="cc-card cc-audio-row nx-audio-flow" key={`${row.id}:${row.originalSha256}`}>
          <div className="cc-audio-row-head">
            <div className="cc-audio-row-meta">
              <strong>{row.title}</strong>
              <span className="cc-muted">{new Date(row.createdAt).toLocaleDateString()} · {(row.totalBytes / (1024 * 1024)).toFixed(1)} MiB</span>
            </div>
            <span className={`cc-audio-badge cc-audio-badge-${badge.tone}`}>{badge.label}</span>
          </div>
          <div className="cc-action-row">
            <button className="cc-secondary" disabled={busy} onClick={() => playingThis ? close() : void open(row.id, 'play')}>{playingThis ? 'Close saved audio' : 'Listen to saved audio'}</button>
            <button className="cc-secondary" disabled={busy} onClick={() => void open(row.id, 'download')}>Download saved original</button>
          </div>
          {playingThis && <div className="cc-audio-player nx-audio-inline-player">
            <audio ref={attachAudio} controls crossOrigin="use-credentials" preload="metadata" src={url} aria-label="Saved original audio" style={{width: '100%'}} onError={() => setMessage('Playback could not continue. Open the saved audio again for a fresh link.')} />
          </div>}
          <AccountRecordingTranscription recording={row} active={active} showAllowance={showAllowance} onStatusChange={badge => onTranscriptStatus(row.id, badge)} onTranscriptReady={ready => onTranscriptReady(row.id, ready)}/>
          <AccountRecordingSummary recording={row} active={active} transcriptReady={showAllowance && !!transcriptsReady[row.id]} onListen={() => void open(row.id, 'play')}/>
        </article>;
      })}
    </div>
  </section>;
}
