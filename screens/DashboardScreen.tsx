import React from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { useAuth } from '../contexts/AuthContext';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { DashboardScreenContent } from './HomeScreen';

/** Signed-in dashboard screen, kept separate from the public Home experience. */
export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();

  if (!user?.id) return null;
  return (
    <DashboardScreenContent
      userId={user.id}
      onGoProgress={() => navigation.navigate('Progress')}
    />
  );
}
