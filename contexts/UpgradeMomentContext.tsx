import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { StackActions, type NavigationContainerRef } from '@react-navigation/native';

import ProPromptModal from '../components/ProPromptModal';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { PRO_MOMENTS } from '../lib/proMoments';
import { createUpgradeMomentSession, type UpgradeMomentRequest } from '../lib/upgradeMomentManager';
import { trackEvent } from '../lib/analytics';

type MomentRequest = UpgradeMomentRequest & { lead?: string | null; feature: string; userId?: string; lockTapped?: boolean };
type UpgradeMomentContextValue = { requestMoment(request: MomentRequest): boolean };
const UpgradeMomentContext = createContext<UpgradeMomentContextValue | null>(null);

export function UpgradeMomentProvider({
  children,
  navigationRef,
}: {
  children: React.ReactNode;
  navigationRef: NavigationContainerRef<AppStackParamList>;
}) {
  const [manager] = useState(() => createUpgradeMomentSession());
  const [active, setActive] = useState<MomentRequest | null>(null);

  const requestMoment = useCallback((request: MomentRequest) => {
    if (!manager.request(request)) return false;
    if (request.lockTapped !== false) {
      trackEvent('lock_tapped', { feature: request.feature, source: request.id }, request.userId);
    }
    setActive(request);
    trackEvent('upgrade_moment_shown', { feature: request.feature, source: request.id }, request.userId);
    return true;
  }, [manager]);

  const dismiss = useCallback(() => {
    if (!active) return;
    if (!manager.dismiss(active.screen)) return;
    trackEvent('upgrade_moment_dismissed', { feature: active.feature, source: active.id }, active.userId);
    setActive(null);
  }, [active, manager]);

  const upgrade = useCallback(() => {
    if (!active) return;
    const request = active;
    if (!manager.dismiss(request.screen)) return;
    setActive(null);
    trackEvent('paywall_opened', { feature: request.feature, source: request.id }, request.userId);
    navigationRef.dispatch(StackActions.push('ProSubscription', {
      source: request.id,
      context: request.lead ?? PRO_MOMENTS[request.id].body,
    }));
  }, [active, manager, navigationRef]);

  const value = useMemo(() => ({ requestMoment }), [requestMoment]);
  return (
    <UpgradeMomentContext.Provider value={value}>
      {children}
      {active ? (
        <ProPromptModal
          visible
          moment={PRO_MOMENTS[active.id]}
          lead={active.lead}
          onUpgrade={upgrade}
          onDismiss={dismiss}
        />
      ) : null}
    </UpgradeMomentContext.Provider>
  );
}

export function useUpgradeMomentManager() {
  const context = useContext(UpgradeMomentContext);
  if (!context) throw new Error('useUpgradeMomentManager must be used inside UpgradeMomentProvider');
  return context;
}
