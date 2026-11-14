/**
 * In-memory handoff for Today's one-tap meal camera. The photo never touches
 * storage here: Food's existing account photo flow takes it once and runs the
 * same preserve → estimate → readback path as its own Take meal photo button.
 */
let queued: File | null = null;
export const MEAL_PHOTO_QUEUED = 'cc-account-meal-photo-queued';
export function queueAccountMealPhoto(file: File) { queued = file; if (typeof window !== 'undefined') window.dispatchEvent(new Event(MEAL_PHOTO_QUEUED)); }
export function takeQueuedAccountMealPhoto() { const file = queued; queued = null; return file; }

/** Opening Food from the tab bar goes straight to the live camera once; closing it shows the food log. */
export const FOOD_CAMERA_REQUESTED = 'cc-account-food-camera-requested';
let cameraRequested = false;
export function requestFoodCamera() { cameraRequested = true; if (typeof window !== 'undefined') window.dispatchEvent(new Event(FOOD_CAMERA_REQUESTED)); }
export function takeFoodCameraRequest() { const requested = cameraRequested; cameraRequested = false; return requested; }
