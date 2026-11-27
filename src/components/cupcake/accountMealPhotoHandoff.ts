import { assertStorageScope, captureStorageScope } from './personalStorage';

export type CaptureKind = 'meal' | 'receipt' | 'other';
export type CaptureIntent = 'auto' | 'meal' | 'receipt';
type Scope = ReturnType<typeof captureStorageScope>;
const labels = new WeakMap<File, { kind: CaptureKind; reviewId?: string }>();
export function labelCapture(file: File, kind: CaptureKind, reviewId?: string) {
  labels.set(file, { kind, reviewId });
}
export const captureLabel = (file: File) => labels.get(file);
export const MEAL_PHOTO_QUEUED = 'cc-account-meal-photo-queued';
export const RECEIPT_PHOTO_QUEUED = 'cc-account-receipt-photo-queued';
export const LOCAL_PHOTOS_CHANGED = 'cc-local-camera-photos-changed';
const pending: { file: File; kind: CaptureKind; scope: Scope }[] = [];

export function pendingCaptureKind(): CaptureKind | undefined {
  while (pending.length) {
    try { assertStorageScope(pending[0].scope); return pending[0].kind; }
    catch { pending.shift(); }
  }
}
/** Also used by Today's existing camera button before switching to Food. */
export function queueAccountMealPhoto(file: File) {
  const kind = captureLabel(file)?.kind || 'meal';
  if (kind !== 'other') pending.push({ file, kind, scope: captureStorageScope() });
  const url = new URL(location.href);
  if (url.searchParams.get('tab') === 'library' && kind !== 'receipt') {
    url.searchParams.set('tab', 'snap');
    for (const key of ['view','receipt','receiptTab','transaction']) url.searchParams.delete(key);
    history.pushState({ scroll: 0 }, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  window.dispatchEvent(new Event(kind === 'meal' ? MEAL_PHOTO_QUEUED : kind === 'receipt' ? RECEIPT_PHOTO_QUEUED : LOCAL_PHOTOS_CHANGED));
}
function take(kind: CaptureKind) {
  pendingCaptureKind();
  const index = pending.findIndex(row => row.kind === kind);
  if (index < 0) return null;
  const [row] = pending.splice(index,1);
  try { assertStorageScope(row.scope); return row.file; } catch { return null; }
}
export const takeQueuedAccountMealPhoto = () => take('meal');
export const takeQueuedReceiptPhoto = () => take('receipt');

export const FOOD_CAMERA_REQUESTED = 'cc-account-food-camera-requested';
let requested: CaptureIntent | null = null;
export function requestFoodCamera(intent: CaptureIntent = 'auto') {
  requested = intent;
  window.dispatchEvent(new Event(FOOD_CAMERA_REQUESTED));
}
export function takeFoodCameraRequest() {
  const value = requested; requested = null;
  return value;
}
