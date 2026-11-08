import { accountVoice, AccountRequestError, assertGeneration, sessionSnapshot } from './accountSession';
import { personalStorage } from './personalStorage';
export { AccountRequestError } from './accountSession';

export type VoiceConfig = { available: boolean; maxSeconds: number; reservedMicros: number };
export type VoiceRecovery = { requestId: string; sessionId?: string };
export type VoiceMessage = { role: 'user'|'assistant'|'bot'; message: string; time?: unknown; secondsFromStart?: unknown; providerMessageOrdinal?: number; providerMessageId?: string };
export type VoiceResult = {
  source: 'vapi_authenticated_call_read'; evidenceType: 'speech-to-text estimate'; providerCallId: string;
  startedAt: string|null; endedAt: string|null; transcript: string|null; messages: VoiceMessage[];
  billing: 'held'|'provider-reported'; billingReport: Record<string, unknown>;
};
export type VoiceSession = {
  sessionId: string; state: 'prepared'|'dispatching'|'live'|'ending'|'uncertain'|'ended'|'failed';
  expiresAt: number; maxSeconds: number; reason?: string; result?: VoiceResult;
  callId?: string; webCallUrl?: string; createdAt?: number; documentId?: string;
};
const KEY = 'live-voice-v1';
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const states = new Set(['prepared','dispatching','live','ending','uncertain','ended','failed']);
const validSeconds = (v: unknown): v is number => Number.isInteger(v) && Number(v) >= 10 && Number(v) <= 180;
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const invalid = () => new AccountRequestError('The voice service returned an incomplete response. Check this conversation before starting another.', 'voice_invalid_response');
const bytes = (text: string) => new TextEncoder().encode(text).length;

function recovery(value: unknown): VoiceRecovery {
  if (!object(value) || Object.keys(value).some(k => k !== 'requestId' && k !== 'sessionId')
    || typeof value.requestId !== 'string' || !UUID.test(value.requestId)
    || (value.sessionId !== undefined && (typeof value.sessionId !== 'string' || !UUID.test(value.sessionId)))) throw invalid();
  return { requestId: value.requestId, ...(value.sessionId ? { sessionId: value.sessionId as string } : {}) };
}

function savedResult(value: unknown): VoiceResult {
  if (!object(value) || value.source !== 'vapi_authenticated_call_read' || value.evidenceType !== 'speech-to-text estimate'
    || typeof value.providerCallId !== 'string' || !UUID.test(value.providerCallId)
    || !['held','provider-reported'].includes(String(value.billing)) || !object(value.billingReport)
    || !(value.transcript === null || (typeof value.transcript === 'string' && bytes(value.transcript) <= 524288))
    || !Array.isArray(value.messages) || value.messages.length > 10000) throw invalid();
  for (const key of ['startedAt','endedAt']) if (!(value[key] === null || (typeof value[key] === 'string' && Number.isFinite(Date.parse(value[key] as string))))) throw invalid();
  let total = typeof value.transcript === 'string' ? bytes(value.transcript) : 0;
  const messages: VoiceMessage[] = value.messages.map(item => {
    if (!object(item) || !['user','assistant','bot'].includes(String(item.role)) || typeof item.message !== 'string') throw invalid();
    total += bytes(item.message); if (total > 1048576) throw invalid();
    if (item.providerMessageOrdinal !== undefined && (!Number.isSafeInteger(item.providerMessageOrdinal) || Number(item.providerMessageOrdinal) < 0)) throw invalid();
    if (item.providerMessageId !== undefined && (typeof item.providerMessageId !== 'string' || item.providerMessageId.length > 200)) throw invalid();
    return { role: item.role as VoiceMessage['role'], message: item.message,
      ...('time' in item ? {time:item.time} : {}), ...('secondsFromStart' in item ? {secondsFromStart:item.secondsFromStart} : {}),
      ...(item.providerMessageOrdinal === undefined ? {} : {providerMessageOrdinal:item.providerMessageOrdinal as number}),
      ...(item.providerMessageId === undefined ? {} : {providerMessageId:item.providerMessageId as string}) };
  });
  return {source:value.source,evidenceType:value.evidenceType,providerCallId:value.providerCallId,
    startedAt:value.startedAt as string|null,endedAt:value.endedAt as string|null,transcript:value.transcript as string|null,
    messages,billing:value.billing as VoiceResult['billing'],billingReport:value.billingReport};
}

export function validateVoiceSession(value: unknown, roomAllowed = false): VoiceSession {
  if (!object(value) || typeof value.sessionId !== 'string' || !UUID.test(value.sessionId)
    || !states.has(String(value.state)) || !positive(value.expiresAt) || !validSeconds(value.maxSeconds)
    || (value.reason !== undefined && (typeof value.reason !== 'string' || value.reason.length > 200))) throw invalid();
  const out: VoiceSession = {sessionId:value.sessionId,state:value.state as VoiceSession['state'],expiresAt:value.expiresAt,maxSeconds:value.maxSeconds};
  if (value.reason !== undefined) out.reason = value.reason as string;
  if (value.createdAt !== undefined) {if (!positive(value.createdAt)) throw invalid();out.createdAt=value.createdAt;}
  if (value.documentId !== undefined) {if (typeof value.documentId !== 'string' || !/^doc_[a-f0-9]{32}$/.test(value.documentId)) throw invalid();out.documentId=value.documentId;}
  if (value.result !== undefined) {
    if (value.state !== 'ended') throw invalid();
    out.result=savedResult(value.result);
  }
  if (value.webCallUrl !== undefined || value.callId !== undefined) {
    if (!roomAllowed || value.state !== 'live' || typeof value.webCallUrl !== 'string' || value.webCallUrl.length > 8192
      || typeof value.callId !== 'string' || !UUID.test(value.callId)) throw invalid();
    let room: URL; try {room=new URL(value.webCallUrl);} catch {throw invalid();}
    if (room.origin !== 'https://vapi.daily.co' || room.username || room.password || room.hash || !/^\/[A-Za-z0-9_-]+\/?$/.test(room.pathname)) throw invalid();
    out.webCallUrl=room.href;out.callId=value.callId;
  }
  return out;
}

const errors: Record<string,string> = {
  account_voice_not_ready: 'Live voice is not available right now. Your saved conversations remain available.',
  account_budget_exceeded: 'Your account’s AI allowance is used or reserved. Wait for the next allowance period before starting voice.',
  account_budget_unavailable: 'Your AI allowance could not be checked. No new conversation is confirmed.',
  account_budget_reconciliation_required: 'An earlier AI charge needs checking before another conversation can start.',
  voice_dispatch_uncertain: 'The connection result is uncertain. Check the saved request; starting it again automatically could create another charge.',
  voice_session_not_found: 'This request was not found in the current sign-in. Check your saved conversations before sending the same request.',
  voice_session_expired: 'This conversation reached its time limit. Check its final status and saved transcript.',
  voice_active_session: 'A voice conversation is already active. Resume or end it before starting another.',
  voice_not_dispatched: 'This request was not sent to the voice provider. You can start a new conversation.',
  voice_invalid_response: 'The voice service returned an incomplete response. Check this conversation before starting another.',
};
export function voiceError(error: unknown) {
  if (error instanceof AccountRequestError) return errors[error.code] || error.message;
  return error instanceof Error ? error.message.replace(/(?:https?|wss?):\/\/\S+/gi, '[connection address withheld]').slice(0,400)
    : 'The voice request could not be confirmed. Check its status before starting another.';
}

/** One account and one durable request binding. Room credentials stay in memory only. */
export class AccountVoiceClient {
  private snapshot = sessionSnapshot();
  private storage = personalStorage('localStorage');
  private disposed = false;
  private terminal = new Set<string>();
  get identity() { this.assert(); return this.snapshot.identity!; }
  assert() {
    assertGeneration(this.snapshot.generation);
    if (this.disposed) throw new DOMException('Voice view closed.', 'AbortError');
    if (!this.snapshot.identity) throw Error('Sign in before opening voice.');
    return this.snapshot.identity.account_id;
  }
  dispose() { this.disposed = true; }
  private async request(route: 'config'|'list'|'start'|'recover'|'status'|'end', body: Record<string,unknown>) {
    this.assert(); const value = await accountVoice<unknown>(route,body,this.snapshot);this.assert();return value;
  }
  readRecovery(): VoiceRecovery|null {
    this.assert();
    try {const raw=this.storage.getItem(KEY);return raw === null ? null : recovery(JSON.parse(raw));}
    catch {throw new AccountRequestError('Voice recovery could not be read on this browser. Keep this tab open and check saved conversations before starting another call.', 'voice_recovery_unavailable');}
  }
  private save(value: VoiceRecovery) {
    this.assert();
    try {this.storage.setItem(KEY,JSON.stringify(value));if (JSON.stringify(this.readRecovery()) !== JSON.stringify(value)) throw Error();}
    catch {throw new AccountRequestError('This browser cannot save voice recovery. Enable local storage before starting a conversation.', 'voice_recovery_unavailable');}
  }
  prepare(): VoiceRecovery {
    const held=this.readRecovery();if (held) return held;
    const value={requestId:crypto.randomUUID()};this.save(value);return value;
  }
  clearRecovery(sessionId?: string) {
    const held=this.readRecovery();if (!held) return;
    if (!held.sessionId || (sessionId !== undefined && sessionId !== held.sessionId) || !this.terminal.has(held.sessionId)) throw Error('Check the final voice status before starting another conversation.');
    this.storage.removeItem(KEY);
  }
  private accept(value: unknown, roomAllowed=false, requestId?: string) {
    const session=validateVoiceSession(value,roomAllowed);
    if (session.state==='ended' || (session.state==='failed' && session.reason==='voice_not_dispatched')) this.terminal.add(session.sessionId);
    if (requestId) {
      const held=this.readRecovery();
      if (!held || held.requestId!==requestId || (held.sessionId && held.sessionId!==session.sessionId)) throw invalid();
      this.save({requestId,sessionId:session.sessionId});
    }
    return session;
  }
  async config(): Promise<VoiceConfig> {
    const value=await this.request('config',{});
    if (!object(value) || typeof value.available !== 'boolean' || !validSeconds(value.maxSeconds)
      || !Number.isSafeInteger(value.reservedMicros) || !positive(value.reservedMicros)) throw invalid();
    return {available:value.available,maxSeconds:value.maxSeconds,reservedMicros:value.reservedMicros};
  }
  async list(): Promise<VoiceSession[]> {
    const value=await this.request('list',{});
    if (!object(value) || !Array.isArray(value.sessions) || value.sessions.length>25) throw invalid();
    const sessions=value.sessions.map(item=>this.accept(item));
    if (sessions.some(s=>s.state!=='ended') || new Set(sessions.map(s=>s.sessionId)).size!==sessions.length) throw invalid();
    return sessions;
  }
  async start(requestId: string) {
    const held=this.readRecovery();if (!held || held.requestId!==requestId || !UUID.test(requestId)) throw invalid();
    return this.accept(await this.request('start',{request_id:requestId}),true,requestId);
  }
  async recover(requestId: string) {
    if (!UUID.test(requestId)) throw invalid();
    return this.accept(await this.request('recover',{request_id:requestId}),true,requestId);
  }
  async status(sessionId: string) {
    if (!UUID.test(sessionId)) throw invalid();
    return this.accept(await this.request('status',{session_id:sessionId}));
  }
  async end(sessionId: string) {
    if (!UUID.test(sessionId)) throw invalid();
    return this.accept(await this.request('end',{session_id:sessionId}));
  }
  endOnPageHide(sessionId: string) {
    try {
      const owner=this.assert();if (!UUID.test(sessionId)) return;
      void fetch('https://automate.hales.ai/api/account/voice/end', {method:'POST',credentials:'include',cache:'no-store',keepalive:true,
        headers:{'Content-Type':'application/json','X-Cupcake-Request':'account','X-Cupcake-Account-Context':owner},
        body:JSON.stringify({session_id:sessionId})}).catch(()=>{});
    } catch { /* Independent server cleanup and provider duration survive a closed or switched tab. */ }
  }
}
