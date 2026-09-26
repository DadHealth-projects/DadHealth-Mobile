import React from 'react';
import { View } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';

import { useAuth } from './AuthContext';
import AppNavigator, { type AppStackParamList } from '../navigation/AppNavigator';
import GlobalCrisisHelpButton from '../components/GlobalCrisisHelpButton';
import BiometricEnrollmentModal from '../components/BiometricEnrollmentModal';
import DeepLinkManager from '../components/DeepLinkManager';
import Splash from '../components/Splash';

export default function RootNavigator({
  navigationRef,
}: {
  navigationRef: NavigationContainerRef<AppStackParamList>;
}) {
  const { loading, session, onboardingComplete, pendingBiometricEnrollment } = useAuth();
  const isOnboarding = !onboardingComplete;
  const waitingForSession = loading || (session && onboardingComplete === null);

  return (
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
      <GlobalCrisisHelpButton navigationRef={navigationRef} />
    </View>
  );
}
