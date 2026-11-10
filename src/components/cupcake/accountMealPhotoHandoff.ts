/**
 * In-memory handoff for Today's one-tap meal camera. The photo never touches
 * storage here: Food's existing account photo flow takes it once and runs the
 * same preserve → estimate → readback path as its own Take meal photo button.
 */
let queued: File | null = null;
export function queueAccountMealPhoto(file: File) { queued = file; }
export function takeQueuedAccountMealPhoto() { const file = queued; queued = null; return file; }
