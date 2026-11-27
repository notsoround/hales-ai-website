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
