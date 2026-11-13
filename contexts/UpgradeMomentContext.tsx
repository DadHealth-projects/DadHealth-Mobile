import React, { createContext, useCallback, useContext, useMemo, useRef, useEffect, useState } from 'react';
import { StackActions, type NavigationContainerRef } from '@react-navigation/native';

import ProPromptModal from '../components/ProPromptModal';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { PRO_MOMENTS } from '../lib/proMoments';
import { createUpgradeMomentSession, type UpgradeMomentRequest } from '../lib/upgradeMomentManager';
import { useAuth } from './AuthContext';
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
  const { user } = useAuth();
  const scope = useMemo(() => ({ owner: user?.id, manager: createUpgradeMomentSession() }), [user?.id]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [active, setActive] = useState<MomentRequest | null>(null);
  const [closing, setClosing] = useState(false);
  const pending = useRef<{ request: MomentRequest; upgrade: boolean } | null>(null);
  useEffect(() => {
    currentScope.current = scope;
    setActive(null);
    setClosing(false);
    pending.current = null;
    return () => { if (currentScope.current === scope) currentScope.current = { ...scope, owner: undefined }; };
  }, [scope]);

  const requestMoment = useCallback((request: MomentRequest) => {
    if (currentScope.current !== scope || !scope.owner || (request.userId && request.userId !== scope.owner)) return false;
    if (!scope.manager.request(request)) return false;
    const ownedRequest = { ...request, userId: scope.owner };
    if (request.lockTapped !== false) {
      trackEvent('lock_tapped', { feature: request.feature, source: request.id }, scope.owner);
    }
    setActive(ownedRequest);
    trackEvent('upgrade_moment_shown', { feature: request.feature, source: request.id }, scope.owner);
    return true;
  }, [scope]);

  const close = useCallback((upgrade: boolean) => {
    if (currentScope.current !== scope || !active || active.userId !== scope.owner || pending.current) return;
    pending.current = { request: active, upgrade };
    setClosing(true);
    if (!upgrade) trackEvent('upgrade_moment_dismissed', { feature: active.feature, source: active.id }, active.userId);
  }, [active, scope]);

  const finishDismissal = useCallback(() => {
    if (currentScope.current !== scope) return;
    const next = pending.current;
    if (!next || next.request !== active || next.request.userId !== scope.owner) return;
    pending.current = null;
    if (!scope.manager.dismiss(next.request.screen)) return;
    setActive(null);
    setClosing(false);
    if (!next.upgrade || !navigationRef.isReady()) return;
    if (navigationRef.getCurrentRoute()?.name === 'ProSubscription') return;
    const request = next.request;
    trackEvent('paywall_opened', { feature: request.feature, source: request.id }, request.userId);
    navigationRef.dispatch(StackActions.push('ProSubscription', {
      source: request.id,
      context: request.lead ?? PRO_MOMENTS[request.id].body,
      feature: request.feature,
    }));
  }, [active, scope, navigationRef]);

  const value = useMemo(() => ({ requestMoment }), [requestMoment]);
  return (
    <UpgradeMomentContext.Provider value={value}>
      {children}
      {active && active.userId === user?.id ? (
        <ProPromptModal
          visible={!closing}
          moment={PRO_MOMENTS[active.id]}
          lead={active.lead}
          onUpgrade={() => close(true)}
          onDismiss={() => close(false)}
          onDismissed={finishDismissal}
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
