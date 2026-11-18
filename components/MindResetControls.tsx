import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { useMindResetSession } from '../hooks/useMindResetSession';

export default function MindResetControls({ navigationRef }: { navigationRef: NavigationContainerRef<AppStackParamList> }) {
  const session = useMindResetSession();
  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState(navigationRef.getCurrentRoute()?.name);
  useEffect(() => navigationRef.addListener('state', () => setRoute(navigationRef.getCurrentRoute()?.name)), [navigationRef]);
  if (!session.started || session.finished || route === 'BreathingSession') return null;
  return <View style={{ paddingBottom: Math.max(8, insets.bottom) }} className="bg-card border-t border-border px-md py-sm flex-row flex-wrap items-center gap-sm">
    <Pressable accessibilityRole="button" accessibilityLabel="Return to Mind Reset" className="flex-1 min-h-[44px] justify-center"
      onPress={() => { if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name !== 'BreathingSession') navigationRef.navigate('BreathingSession'); }}>
      <Text className="font-heading-bold text-lime text-[16px]">Mind Reset · {Math.floor(session.seconds / 60)}:{String(session.seconds % 60).padStart(2, '0')}</Text>
      {session.error ? <Text accessibilityRole="alert" className="font-body text-white text-[14px]">{session.error}</Text> : null}
    </Pressable>
    <Pressable accessibilityRole="button" disabled={session.preparing} onPress={session.running ? session.pause : session.start} className="min-h-[44px] justify-center px-sm">
      <Text className="font-heading-bold text-white text-[16px]">{session.running ? 'Pause' : 'Resume'}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="End Mind Reset session" onPress={session.stop} className="min-h-[44px] justify-center px-sm">
      <Text className="font-heading-bold text-white text-[16px]">End</Text>
    </Pressable>
  </View>;
}
