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

  // No session → show the tabs with "?" avatar. The Account Sheet provides
  // "Sign In" which navigates to the Login screen already registered in
  // AppNavigator. After sign-in the session flips and the tree re-renders.
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
