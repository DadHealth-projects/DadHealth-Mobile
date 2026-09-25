import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { AppStackParamList } from '../../navigation/AppNavigator';

/** Compatibility route for old Score/Progress links. Score now lives in Today. */
export default function LegacyScoreRedirect() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  useEffect(() => {
    navigation.replace('Tabs', {
      screen: 'Home',
      params: { openScoreDetail: true },
    });
  }, [navigation]);

  return null;
}
