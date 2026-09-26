import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';

import { useAuth } from './AuthContext';
import AppNavigator, { type AppStackParamList } from '../navigation/AppNavigator';
import GlobalCrisisHelpButton from '../components/GlobalCrisisHelpButton';
import BiometricEnrollmentModal from '../components/BiometricEnrollmentModal';
import DeepLinkManager from '../components/DeepLinkManager';
import Splash from '../components/Splash';
import { ScreenContentReadyContext } from './ScreenContentReadyContext';

export default function RootNavigator({
  navigationRef,
}: {
  navigationRef: NavigationContainerRef<AppStackParamList>;
}) {
  const { loading, session, onboardingComplete, pendingBiometricEnrollment } = useAuth();
  const [screenContentReady, setScreenContentReady] = useState(false);
  const isOnboarding = !onboardingComplete;
  const waitingForSession = loading || (session && onboardingComplete === null);
  const reportScreenContentReady = useCallback((ready: boolean) => {
    setScreenContentReady(ready);
  }, []);

  useEffect(() => {
    if (waitingForSession) setScreenContentReady(false);
    else if (!session) setScreenContentReady(true);
  }, [session, waitingForSession]);

  return (
    <ScreenContentReadyContext.Provider value={reportScreenContentReady}>
      <View className="flex-1">
        {waitingForSession ? <Splash /> : !session ? (
          <>
            <AppNavigator key="tabs" initialRouteName="Tabs" />
            <DeepLinkManager navigationRef={navigationRef} />
          </>
        ) : (
          <>
            <AppNavigator
              key={isOnboarding ? 'onboarding' : 'tabs'}
              initialRouteName={isOnboarding ? 'Welcome' : 'Tabs'}
            />
            <DeepLinkManager navigationRef={navigationRef} />

            {pendingBiometricEnrollment && <BiometricEnrollmentModal />}
          </>
        )}
        {!waitingForSession ? (
          <GlobalCrisisHelpButton
            navigationRef={navigationRef}
            screenContentReady={screenContentReady}
          />
        ) : null}
      </View>
    </ScreenContentReadyContext.Provider>
  );
}
