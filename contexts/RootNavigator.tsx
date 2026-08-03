import React from 'react';

import { useAuth } from './AuthContext';
import AppNavigator from '../navigation/AppNavigator';
import BiometricEnrollmentModal from '../components/BiometricEnrollmentModal';
import Splash from '../components/Splash';

export default function RootNavigator() {
  const { loading, session, onboardingComplete, pendingBiometricEnrollment } = useAuth();

  if (loading || (session && onboardingComplete === null)) {
    return <Splash />;
  }

  if (!session) {
    return <AppNavigator key="tabs" initialRouteName="Tabs" />;
  }

  const isOnboarding = !onboardingComplete;

  return (
    <>
      <AppNavigator
        key={isOnboarding ? 'onboarding' : 'tabs'}
        initialRouteName={isOnboarding ? 'Welcome' : 'Tabs'}
      />

      {pendingBiometricEnrollment && (
        <BiometricEnrollmentModal />
      )}
    </>
  );
}
