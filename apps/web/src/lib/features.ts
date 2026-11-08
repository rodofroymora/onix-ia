/** Feature flags de producto (v1 / v1.5). */

export function isFeatureEnabled(flag: 'FEATURE_V1_5' | 'FEATURE_ASSISTANT'): boolean {
  const raw = process.env[flag];
  if (!raw) return false;
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

export const FEATURES = {
  get v15() {
    return isFeatureEnabled('FEATURE_V1_5');
  },
  get assistant() {
    return isFeatureEnabled('FEATURE_ASSISTANT');
  },
};
