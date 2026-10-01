export const PENDING_OUTCOME_KEY = 'cupcake-pending-personal-outcome';
export type OutcomeRequest = {
  action: 'outcome_record'; id: string; date: string; title: string; outcome: 'win' | 'loss'; note: string;
  source: { type: 'owner-request'; reference: string; description: string }; metrics: Record<string, never>;
};

export function readPendingOutcome(storage: Pick<Storage, 'getItem'>): { pending: OutcomeRequest | null; error: string } {
  try {
    const raw = storage.getItem(PENDING_OUTCOME_KEY);
    if (!raw) return { pending: null, error: '' };
    const p = JSON.parse(raw);
    if (p?.action !== 'outcome_record' || typeof p.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id) || !['win', 'loss'].includes(p.outcome) || typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || typeof p.title !== 'string' || !p.title.trim() || p.title.length > 160 || typeof p.note !== 'string' || p.note.length > 2000 || p.source?.type !== 'owner-request' || p.source.reference !== `cupcake-web:${p.id}` || typeof p.source.description !== 'string' || p.source.description.length > 300 || !p.metrics || Object.keys(p.metrics).length) throw new Error('Invalid pending outcome');
    return { pending: p as OutcomeRequest, error: '' };
  } catch { return { pending: null, error: 'Cupcake could not read the saved retry details. Keep this tab open and reconnect before creating another outcome.' }; }
}

export function keepPendingOutcome(storage: Pick<Storage, 'getItem' | 'setItem'>, request: OutcomeRequest) {
  const existing = readPendingOutcome(storage);
  if (existing.error) throw new Error(existing.error);
  const raw = JSON.stringify(request);
  if (existing.pending && JSON.stringify(existing.pending) !== raw) throw new Error('Another outcome is waiting for confirmation. Reopen this form and retry that entry first.');
  try {
    storage.setItem(PENDING_OUTCOME_KEY, raw);
    if (storage.getItem(PENDING_OUTCOME_KEY) !== raw) throw new Error('Not retained');
  } catch { throw new Error('Cupcake could not keep the retry details on this device, so nothing was submitted. Keep this draft open and allow browser storage before retrying.'); }
}

export function clearPendingOutcome(storage: Pick<Storage, 'getItem' | 'removeItem'>, id: string) {
  const existing = readPendingOutcome(storage);
  if (existing.error) throw new Error(existing.error);
  if (existing.pending?.id === id) storage.removeItem(PENDING_OUTCOME_KEY);
}
