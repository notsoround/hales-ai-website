// Fictional phone calls, one per outcome, layered over the loopback design preview. Local preview and tests only.
if (!import.meta.env.DEV) throw Error('Synthetic preview only.');

await import('./experience-review-preview');
type MockRead = (owner: string, body: Record<string, unknown>) => object | undefined;
const host = window as unknown as { syntheticReceiptNavigation: MockRead };
const earlier = host.syntheticReceiptNavigation;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600000).toISOString();
const base = { kind: 'transcript', status: 'ready', sourceApp: 'Cupcake phone transcript' };
export const fictionalCalls = [
  { ...base, id: 'fixture-call-answered', title: 'Dinner plan check-in', createdAt: hoursAgo(2),
    providerEndedReason: 'customer-ended-call', durationSeconds: 252,
    summary: 'Taylor chose the lentil soup for dinner and asked for a reminder at six.',
    text: 'Assistant: What sounds good for dinner?\nTaylor: The lentil soup. Remind me at six. (Fictional call.)',
    chat: [{ role: 'user', text: 'What did I pick for dinner?' }, { role: 'assistant', text: 'The lentil soup, with a reminder at six. (Fictional saved answer.)' }] },
  { ...base, id: 'fixture-call-voicemail', title: 'Grocery check-in', createdAt: hoursAgo(5),
    providerEndedReason: 'voicemail', durationSeconds: 38,
    summary: 'Voicemail left: check the grocery list before shopping.',
    text: 'Assistant: Check the grocery list before shopping. This is a fictional voicemail.' },
  { ...base, id: 'fixture-call-no-message', title: 'Evening walk reminder', createdAt: hoursAgo(26),
    sourceApp: 'Cupcake phone call memory', providerEndedReason: 'customer-did-not-answer',
    text: 'Nobody picked up and no message was left. (Fictional record.)' },
  { ...base, id: 'fixture-call-unclear', title: 'Weekly review call', createdAt: hoursAgo(50),
    providerEndedReason: 'silence-timed-out', durationSeconds: 12,
    summary: 'The line opened and closed after silence. Nothing was said by either side.',
    text: 'No speech was recorded on this fictional call.' },
  { ...base, id: 'fixture-call-pending', title: 'Coach follow-up', createdAt: hoursAgo(74), status: 'processing',
    providerEndedReason: 'assistant-ended-call', durationSeconds: 95, summary: '',
    provenance: { attribution: { participantIdentity: 'coach' } },
    text: 'Coach: Checking in about the week. (Fictional call; its summary is still being prepared.)' },
  { ...base, id: 'fixture-call-no-summary', title: 'Unlabelled call', createdAt: hoursAgo(98), summary: '',
    text: 'A fictional saved call with no end reason and no summary.' },
];
host.syntheticReceiptNavigation = (owner, body) => {
  if (owner !== 'acc_synthetic_a') return;
  if (body.action === 'list' && body.sourceFilter === 'phone-calls') return { documents: fictionalCalls, browseTotal: fictionalCalls.length, nextCursor: null };
  if (body.action === 'list' && body.sourceFilter === 'missed-phone-calls') {
    const missed = fictionalCalls.filter(call => ['voicemail', 'customer-did-not-answer'].includes(call.providerEndedReason || ''));
    return { documents: missed, browseTotal: missed.length, nextCursor: null };
  }
  if (body.action === 'fetch') { const document = fictionalCalls.find(call => call.id === body.id); if (document) return { document }; }
  return earlier(owner, body);
};
