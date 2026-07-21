import React from 'react';

import { useAuth } from './AuthContext';
import AppNavigator from '../navigation/AppNavigator';
import BiometricEnrollmentModal from '../components/BiometricEnrollmentModal';
import Splash from '../components/Splash';

export default function RootNavigator() {
  const { loading, pendingBiometricEnrollment } = useAuth();

  if (loading) {
    return <Splash />;
  }

  return (
    <>
      <AppNavigator />

      {pendingBiometricEnrollment && (
        <BiometricEnrollmentModal />
      )}
    </>
  );
}