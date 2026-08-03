import React from 'react';

import { useAuth } from '../contexts/AuthContext';
import DashboardScreen from './DashboardScreen';
import HomeScreen from './HomeScreen';

/** Chooses the public Home or member Dashboard without mixing their UI concerns. */
export default function HomeTabScreen() {
  const { user } = useAuth();
  return user?.id ? <DashboardScreen /> : <HomeScreen />;
}
