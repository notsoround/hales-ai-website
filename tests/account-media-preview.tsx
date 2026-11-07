/* eslint-disable react-refresh/only-export-components -- Isolated development fixture. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SnapView } from '../src/pages/cupcake/sandbox/cupcakegpt/page';
import ReceiptWorkspace from '../src/components/cupcake/ReceiptWorkspace';
import { ACCOUNT_SESSIONS } from '../src/components/cupcake/accountMode';
import { restoreSession } from '../src/components/cupcake/accountSession';
import { libraryRequest } from '../src/components/cupcake/library';
import '../src/index.css';

if (!import.meta.env.DEV) throw Error('Synthetic media preview is development only.');
const identity = { account_id: 'acc_synthetic_media', email: 'media@example.invalid', name: 'Synthetic media' };
const now = new Date().toISOString();
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ioAAAAASUVORK5CYII=';
const meal = { id: 'meal_' + 'a'.repeat(32), status: 'ready', description: 'Synthetic saved lunch', createdAt: now, consumedAt: now, sheetLoggedAt: now, imageStored: true, total: { calories: 500, carbs_g: 60, protein_g: 20, fat_g: 15, sugar_g: 4 }, items: [] };
const pending = { ...meal, id: 'meal_' + 'b'.repeat(32), description: 'Synthetic pending lunch', sheetLoggedAt: undefined, items: [{ id: 'synthetic-item', name: 'Saved item', nutrition: { calories: 500 }, provenance: 'visual_estimate' }] };
const failed = { ...pending, id: 'meal_' + 'c'.repeat(32), description: 'Synthetic failed photo', status: 'analysis_failed' };
const meals = [meal, pending, failed];
const receipts = [
  { id: 'receipt_' + 'a'.repeat(32), status: 'extracted', merchant: 'Synthetic unmatched receipt', createdAt: now, date: now.slice(0, 10), total: 12, currency: 'USD', tip: 1, tax: 0, lineItems: [], matchedTransactionId: null as string | null },
  { id: 'receipt_' + 'b'.repeat(32), status: 'extraction_failed', merchant: 'Synthetic failed receipt', createdAt: now, date: now.slice(0, 10), total: null, currency: null, tip: null, tax: null, lineItems: [], matchedTransactionId: null as string | null },
  { id: 'receipt_' + 'c'.repeat(32), status: 'matched', merchant: 'Synthetic matched receipt', createdAt: now, date: now.slice(0, 10), total: 8, currency: 'USD', tip: 0, tax: 0, lineItems: [], matchedTransactionId: 'synthetic-confirmed' },
];
const fixture = { requests: [] as Record<string, unknown>[], blocked: [] as string[], mediaRequests: 0, inputClicks: 0, request: libraryRequest };
(window as unknown as { mediaFixture: typeof fixture }).mediaFixture = fixture;
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin === location.origin || url.protocol === 'data:') return nativeFetch(input, init);
  const body = JSON.parse(String(init?.body || '{}'));
  const response = (data: object) => Response.json({ ok: true, ...data, ...(ACCOUNT_SESSIONS ? { identity } : {}) });
  if (ACCOUNT_SESSIONS && url.href === 'https://automate.hales.ai/api/account/session') return response({});
  if (url.href !== (ACCOUNT_SESSIONS ? 'https://automate.hales.ai/api/account/data' : 'https://automate.hales.ai/cupcake-library')) {
    if (!ACCOUNT_SESSIONS && url.href.startsWith('https://automate.hales.ai/webhook/cupcake-feed')) return response({ items: [], coverage: { scope: 'food-history', complete: true } });
    fixture.blocked.push(url.href); throw Error('External request blocked in isolated media preview.');
  }
  fixture.requests.push(body);
  if (body.action === 'food_list') return response({ meals });
  if (body.action === 'food_history') return response({ meals: [meal], total: 1, pendingCount: 2, undatedLoggedCount: 0, hasMore: false });
  if (body.action === 'food_settings_get') return response({ settings: { calorieTarget: null, expenditureEstimate: null, effectiveFrom: null } });
  if (body.action === 'food_get') return response({ meal: meals.find(item => item.id === body.mealId) });
  if (body.action === 'food_photo') return response({ photo: { dataUrl: image } });
  if (body.action === 'receipt_list') return response({ receipts });
  if (body.action === 'receipt_get') return response({ receipt: receipts.find(item => item.id === body.receiptId), ...(body.includeImage ? { image } : {}) });
  if (body.action === 'receipt_confirm_match') return response({ receipt: { ...receipts[0], status: 'matched', matchedTransactionId: body.transactionId } });
  if (ACCOUNT_SESSIONS) throw Error('Unsupported synthetic account action: ' + body.action);
  if (['food_analyze', 'food_refine', 'food_retry', 'food_log'].includes(body.action)) return response({ meal });
  if (['receipt_extract', 'receipt_retry'].includes(body.action)) return response({ receipt: receipts[0] });
  if (body.action === 'receipt_match_candidates') return response({ receipt: receipts[0], candidates: [{ transactionId: 'synthetic-charge', merchant: 'Synthetic bank charge', date: now.slice(0, 10), amount: 12, currency: 'USD', pending: false, exactAmount: true, exactCurrency: true }], coverage: { complete: true } });
  throw Error('Unknown action in isolated media preview: ' + body.action);
};
const click = HTMLInputElement.prototype.click;
HTMLInputElement.prototype.click = function () { if (this.type === 'file') fixture.inputClicks++; return click.call(this); };
navigator.mediaDevices.getUserMedia = async () => { fixture.mediaRequests++; throw Error('No real media capture in synthetic preview.'); };
if (ACCOUNT_SESSIONS) await restoreSession();
function Preview() {
  const [view, setView] = useState('food');
  return <div className="cc-app"><main style={{ maxWidth: 900, margin: 'auto', padding: 20 }}>
    <p>Isolated synthetic {ACCOUNT_SESSIONS ? 'account' : 'legacy'} media preview. No live records or providers.</p>
    <nav aria-label="Synthetic preview"><button onClick={() => setView('food')}>Food preview</button><button onClick={() => setView('receipts')}>Receipts preview</button></nav>
    {view === 'food' ? <SnapView/> : <ReceiptWorkspace/>}
  </main></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
