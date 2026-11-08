export const NATIVE_CLIENT = 'cupcake-android-health-preview-v1';
export const NATIVE_REDIRECT = 'ai.hales.cupcake.health.preview:/oauth/callback';
export const NATIVE_IOS_CLIENT = 'cupcake-ios-health-preview-v1';
export const NATIVE_IOS_REDIRECT = 'ai.hales.cupcake.health.preview.ios:/oauth/callback';

const CLIENTS = {
  [NATIVE_CLIENT]: {
    device: 'Android', name: 'Cupcake Android preview', source: 'Health Connect',
    redirect: NATIVE_REDIRECT, healthRedirect: 'ai.hales.cupcake.health.preview:/health/callback',
  },
  [NATIVE_IOS_CLIENT]: {
    device: 'iPhone', name: 'Cupcake iPhone preview', source: 'HealthKit',
    redirect: NATIVE_IOS_REDIRECT, healthRedirect: 'ai.hales.cupcake.health.preview.ios:/health/callback',
  },
} as const;

/** Client identity selects a fixed callback; a caller-supplied URL is never a destination. */
export function nativeClient(value: unknown) {
  if (value === NATIVE_CLIENT || value === NATIVE_IOS_CLIENT) return CLIENTS[value];
  return null;
}
