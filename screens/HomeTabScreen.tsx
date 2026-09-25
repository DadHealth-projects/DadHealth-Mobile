import React from 'react';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { useAuth } from '../contexts/AuthContext';
import DashboardScreen from './DashboardScreen';
import HomeScreen from './HomeScreen';
import type { BottomTabsParamList } from '../navigation/BottomTabNavigator';

/** Chooses the public Home or member Dashboard without mixing their UI concerns. */
export default function HomeTabScreen({ route, navigation }: BottomTabScreenProps<BottomTabsParamList, 'Home'>) {
  const { user } = useAuth();
  const openScoreDetail = route.params?.openScoreDetail === true;
  const consumeRequest = () => navigation.setParams({ openScoreDetail: undefined });
  return user?.id
    ? <DashboardScreen openScoreDetail={openScoreDetail} onScoreDetailRequestConsumed={consumeRequest} />
    : <HomeScreen />;
}
