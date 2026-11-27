import type { Conversation } from './library';

export const callHistoryUrl = '/cupcake/account?tab=library&view=calls&callFilter=missed';
export function openMissedCalls() {
  const state = { scroll: 0 };
  if (location.pathname + location.search !== callHistoryUrl) {
    history.replaceState({ ...history.state, scroll: window.scrollY }, '');
    history.pushState(state, '', callHistoryUrl);
  }
  window.dispatchEvent(new PopStateEvent('popstate', { state }));
}


const labels: Record<string, string> = {
  voicemail: 'Voicemail', 'customer-voicemail': 'Voicemail', 'customer-did-not-answer': 'No answer', 'customer-busy': 'Busy line',
  'silence-timed-out': 'Ended after silence', 'customer-ended-call': 'Caller ended the call',
  'assistant-ended-call': 'Assistant ended the call',
};

export function callDisposition(call: Conversation) {
  return call.providerEndedReason && Object.prototype.hasOwnProperty.call(labels, call.providerEndedReason)
    ? labels[call.providerEndedReason] : call.providerEndedReason?.replace(/-/g, ' ') || 'Outcome not recorded';
}

/** Phone source versions without a separate summary field include their recap in the saved projection. */
export function savedCallRecap(call: Conversation): string {
  if (call.summary?.trim()) return call.summary.trim();
  const text = call.text || '';
  const marker = '\nAI/provider summary (interpretation, separate from original):\n';
  const start = text.lastIndexOf(marker);
  if (start >= 0) return text.slice(start + marker.length).split('\n\nAI-reported owner commitments')[0].trim();
  if (call.sourceApp === 'Cupcake phone call memory') return text.trim();
  return '';
}

/** Saved phone records: the transcript itself, or the older recap-only memory. */
export function isPhoneCall(record: Conversation) {
  return /^Cupcake phone /.test(record.sourceApp || '') || !!record.providerEndedReason;
}

export type CallOutcome = 'answered' | 'voicemail' | 'no-message' | 'unclear';
const outcomes: Record<string, CallOutcome> = {
  voicemail: 'voicemail', 'customer-voicemail': 'voicemail',
  'customer-did-not-answer': 'no-message', 'customer-busy': 'no-message',
  'customer-ended-call': 'answered', 'assistant-ended-call': 'answered',
};
export const callOutcomeLabels: Record<CallOutcome, string> = {
  answered: 'Answered', voicemail: 'Missed · voicemail', 'no-message': 'Missed · no message', unclear: 'Unclear outcome',
};
/** Only the provider's own end reason decides the outcome. Silence, an unknown reason or no reason stay unclear. */
export function callOutcome(call: Conversation): CallOutcome {
  const reason = call.providerEndedReason;
  return reason && Object.prototype.hasOwnProperty.call(outcomes, reason) ? outcomes[reason] : 'unclear';
}
/** The recorded end reason, when it adds to the outcome label. */
export function callOutcomeDetail(call: Conversation) {
  return ['voicemail', 'customer-voicemail', 'customer-did-not-answer'].includes(call.providerEndedReason || '') ? '' : callDisposition(call);
}

/** Length only when the record carries one. */
export function callDuration(call: Conversation) {
  const total = Math.round(Number(call.durationSeconds));
  if (!Number.isFinite(total) || total <= 0) return '';
  const minutes = Math.floor(total / 60), seconds = total % 60;
  return minutes ? `${minutes} min${seconds ? ` ${seconds} sec` : ''}` : `${seconds} sec`;
}

/** 'saved' with a recap; 'pending' while the record is still being prepared; 'none' when a finished record has no
 *  summary; 'unknown' when this row does not carry summary or text fields at all (nothing is claimed then). */
export function callSummaryState(call: Conversation): 'saved' | 'pending' | 'none' | 'unknown' {
  if (savedCallRecap(call)) return 'saved';
  if (call.status && call.status !== 'ready') return 'pending';
  return 'summary' in call || 'text' in call ? 'none' : 'unknown';
}
