import { useCallback, useMemo } from 'react';

import { canAccessFeature, type ProFeatureKey } from '../lib/proEntitlementAccess';

export type EntitlementState = {
  isPro: boolean | null;
  trialActive: boolean | null;
  loading: boolean;
};

/** Adapts the existing authenticated dashboard entitlement state for feature gates. */
export function useEntitlement(state: EntitlementState) {
  const { isPro, trialActive, loading } = state;
  const can = useCallback(
    (featureKey: ProFeatureKey) => canAccessFeature(featureKey, isPro, trialActive),
    [isPro, trialActive],
  );

  return useMemo(() => ({
    isPro,
    trialActive,
    can,
    loading,
    unknown: isPro === null,
  }), [can, isPro, loading, trialActive]);
}
