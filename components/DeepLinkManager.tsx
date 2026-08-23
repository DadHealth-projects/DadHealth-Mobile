import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';

import { useAuth } from '../contexts/AuthContext';
import { useNetworkStatus } from '../contexts/NetworkContext';
import {
  readPendingCoParentInvite,
  wasCoParentInviteHandled,
} from '../lib/deepLinks';
import {
  attachPushNavigation,
  setPushNavigationLifecycleReady,
} from '../lib/pushNotifications';
import type { AppStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigationRef: NavigationContainerRef<AppStackParamList>;
};

const RESUME_ERROR =
  'Dad Health could not reopen your calendar invite. Open the invite again and try once more.';

export default function DeepLinkManager({ navigationRef }: Props) {
  const { user, onboardingComplete } = useAuth();
  const { isOffline, showErrorNotice } = useNetworkStatus();
  const lastResumedInvite = useRef<string | null>(null);
  const previousOffline = useRef(isOffline);
  const mounted = useRef(true);

  const updatePushReadiness = useCallback(() => {
    attachPushNavigation(navigationRef);
    const navigationReady = navigationRef.isReady();
    const appDestinationReady = !user || onboardingComplete === true;
    setPushNavigationLifecycleReady(
      navigationReady && appDestinationReady,
      Boolean(user && onboardingComplete === true),
    );
  }, [navigationRef, onboardingComplete, user]);

  const resumePendingInvite = useCallback(async () => {
    if (
      Platform.OS === 'web'
      || AppState.currentState !== 'active'
      || isOffline
      || !user?.id
      || onboardingComplete !== true
      || !navigationRef.isReady()
    ) {
      return;
    }

    try {
      const pending = await readPendingCoParentInvite();
      if (!mounted.current || !pending) return;
      if (pending.blockedUserId === user.id) return;
      if (wasCoParentInviteHandled(pending.token)) return;

      const resumeKey = `${user.id}:${pending.token}`;
      if (lastResumedInvite.current === resumeKey) return;
      lastResumedInvite.current = resumeKey;
      navigationRef.navigate('SharedCalendar', { token: pending.token });
    } catch {
      if (mounted.current) showErrorNotice(RESUME_ERROR);
    }
  }, [isOffline, navigationRef, onboardingComplete, showErrorNotice, user?.id]);

  useEffect(() => {
    mounted.current = true;
    updatePushReadiness();
    void resumePendingInvite();

    const unsubscribeNavigation = navigationRef.addListener('state', () => {
      updatePushReadiness();
      void resumePendingInvite();
    });

    return () => {
      mounted.current = false;
      unsubscribeNavigation();
      setPushNavigationLifecycleReady(false, false);
    };
  }, [navigationRef, resumePendingInvite, updatePushReadiness]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      lastResumedInvite.current = null;
      updatePushReadiness();
      void resumePendingInvite();
    });
    return () => subscription.remove();
  }, [resumePendingInvite, updatePushReadiness]);

  useEffect(() => {
    if (previousOffline.current && !isOffline) {
      lastResumedInvite.current = null;
      void resumePendingInvite();
    }
    previousOffline.current = isOffline;
  }, [isOffline, resumePendingInvite]);

  return null;
}
