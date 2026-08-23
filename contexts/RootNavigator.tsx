import React from 'react';
import type { NavigationContainerRef } from '@react-navigation/native';

import { useAuth } from './AuthContext';
import AppNavigator, { type AppStackParamList } from '../navigation/AppNavigator';
import BiometricEnrollmentModal from '../components/BiometricEnrollmentModal';
import DeepLinkManager from '../components/DeepLinkManager';
import Splash from '../components/Splash';

export default function RootNavigator({
  navigationRef,
}: {
  navigationRef: NavigationContainerRef<AppStackParamList>;
}) {
  const { loading, session, onboardingComplete, pendingBiometricEnrollment } = useAuth();

  if (loading || (session && onboardingComplete === null)) {
    return <Splash />;
  }

  if (!session) {
    return (
      <>
        <AppNavigator key="tabs" initialRouteName="Tabs" />
        <DeepLinkManager navigationRef={navigationRef} />
      </>
    );
  }

  const isOnboarding = !onboardingComplete;

  return (
    <>
      <AppNavigator
        key={isOnboarding ? 'onboarding' : 'tabs'}
        initialRouteName={isOnboarding ? 'Welcome' : 'Tabs'}
      />
      <DeepLinkManager navigationRef={navigationRef} />

      {pendingBiometricEnrollment && (
        <BiometricEnrollmentModal />
      )}
    </>
  );
}
