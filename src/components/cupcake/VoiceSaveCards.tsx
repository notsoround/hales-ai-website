import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { libraryRequest } from './library';
import { personalStorage } from './personalStorage';
import { AssistantSuggestions } from './AssistantSuggestions';
import { currentAppState } from './assistantAppState';
import { replyText, voiceCardsRequest, wrapMessage } from './assistantActionsModel';

type Turn = { id: string; status: string; error?: string; response?: { reply: string } };
type Thread = { id: string; turns: Turn[] };
const key = (sessionId: string) => `cupcake-voice-cards-${sessionId}`;
const working = (turn?: Turn) => !!turn && !turn.response?.reply && ['queued', 'running'].includes(turn.status);
function problem(turn?: Turn): string {
  if (turn?.error?.startsWith('account_budget')) return 'There is no reply allowance for this right now. Nothing was saved.';
  return 'The assistant did not finish reading this conversation. Nothing was saved. Try again.';
}

/** Labs (voice-save-cards): one tap sends a saved voice transcript, with the same app data the
 *  typed chat sees, through the chat's suggestion protocol. Replies become the chat's Save cards;
 *  nothing is written until the owner taps Save on a card. One reply per conversation is kept on
 *  this device so reopening it never asks (or charges) again. */
export default function VoiceSaveCards({ sessionId, transcriptText }: { sessionId: string; transcriptText: string }) {
  const [storage] = useState(() => personalStorage('localStorage'));
  const [thread, setThread] = useState<Thread | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async (id: string) => {
    const data = await libraryRequest<{ thread: Thread }>({ action: 'quick_chat_get', threadId: id });
    if (mounted.current) setThread(data.thread);
    return data.thread;
  }, []);
  useEffect(() => {
    let id: string | null = null;
    try { id = storage.getItem(key(sessionId)); } catch { /* Nothing saved on this device. */ }
    if (id) load(id).catch(() => { if (mounted.current) setError('The earlier cards could not be loaded. Tap Get Save cards to ask again.'); });
  }, [storage, sessionId, load]);
  const last = thread?.turns[thread.turns.length - 1];
  useEffect(() => {
    if (!thread || !working(last)) return;
    let cancelled = false, timer = 0, delay = 2000;
    const poll = async () => {
      try { await load(thread.id); } catch { delay = Math.min(delay * 2, 20000); }
      finally { if (!cancelled) timer = window.setTimeout(poll, delay); }
    };
    timer = window.setTimeout(poll, delay);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [thread, last, load]);

  const ask = async () => {
    if (busy || working(last)) return;
    setBusy(true); setError('');
    try {
      const snapshot = await currentAppState();
      const threadId = crypto.randomUUID();
      await libraryRequest({ action: 'quick_chat_create', threadId, title: 'Save cards from a voice conversation' });
      try { storage.setItem(key(sessionId), threadId); } catch { /* Cards still show while this page is open. */ }
      const begun = await libraryRequest<{ thread: Thread }>({ action: 'quick_chat_begin', threadId, turnId: crypto.randomUUID(), text: wrapMessage(voiceCardsRequest(transcriptText), snapshot), parentTurnId: null });
      if (mounted.current) setThread(begun.thread);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error && /budget/.test(cause.message) ? 'There is no reply allowance for this right now. Nothing was saved.' : 'Could not ask the assistant right now. Nothing was saved.');
    } finally { if (mounted.current) setBusy(false); }
  };

  const reply = last?.response?.reply || '';
  const failed = !!last && !reply && !working(last);
  return <section className="nx-voice-updates" aria-label="Save cards from this conversation">
    <div className="nx-voice-updates-head">
      <div>
        <strong><span className="cc-labs-badge">Labs</span> Save cards from this talk</strong>
        <small>The assistant reads what you said with your current app data. Nothing changes until you tap Save.</small>
      </div>
      {(!thread || failed) && <button type="button" className="nx-voice-updates-scan" disabled={busy} onClick={() => void ask()}>
        {busy ? <><Loader2 size={14} className="cc-spin" aria-hidden="true" /> Asking…</> : <><Sparkles size={14} aria-hidden="true" /> {failed ? 'Try again' : 'Get Save cards'}</>}
      </button>}
    </div>
    {working(last) && <p role="status" className="nx-voice-updates-status"><Loader2 size={14} className="cc-spin" aria-hidden="true" /> Reading your conversation…</p>}
    {reply && <>
      <p className="nx-voice-updates-status">{replyText(reply)}</p>
      <AssistantSuggestions reply={reply} seed={`voice:${thread!.id}:${last!.id}`} enabled />
    </>}
    {failed && <p role="alert" className="nx-voice-updates-status">{problem(last)}</p>}
    {error && <p role="alert" className="nx-voice-updates-status">{error}</p>}
  </section>;
}
