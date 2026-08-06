import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { trackEvent } from '../../lib/analytics';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type BreathPhase = 'inhale' | 'hold' | 'exhale';
const PHASES: BreathPhase[] = ['inhale', 'hold', 'exhale'];

export default function BreathingSessionScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [count, setCount] = useState(4);
  const [active, setActive] = useState(false);
  const cycleRef = useRef({ count: 4, phaseIndex: 0 });
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      cycleRef.current = { count: 4, phaseIndex: 0 };
      setPhase('inhale');
      setCount(4);
      return;
    }
    cycleRef.current = { count: 4, phaseIndex: 0 };
    setPhase('inhale');
    setCount(4);
    const timer = setInterval(() => {
      const current = cycleRef.current;
      const nextCount = current.count - 1;
      if (nextCount < 1) {
        const phaseIndex = (current.phaseIndex + 1) % PHASES.length;
        const nextPhase = PHASES[phaseIndex];
        cycleRef.current = { count: 4, phaseIndex };
        setPhase(nextPhase);
        setCount(4);
      } else {
        cycleRef.current = { ...current, count: nextCount };
        setCount(nextCount);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => {
    const target = !active ? 1 : phase === 'exhale' ? 0.94 : 1.12;
    Animated.timing(scale, { toValue: target, duration: !active || phase === 'hold' ? 250 : 3900, useNativeDriver: true }).start();
  }, [active, phase, scale]);

  const toggle = useCallback(() => {
    if (!active) trackEvent('breath_session_started', { pattern: '4-4-4' }, user?.id);
    setActive((current) => !current);
  }, [active, user?.id]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-xl gap-xl flex-grow">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close breathing session" hitSlop={8} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"><Feather name="x" size={20} color={colors.text} /></Pressable>} />
        <ScreenHero eyebrow="4-4-4 breathing" headline={'Slow down.\nBreathe.'} sub="Inhale for 4. Hold for 4. Exhale for 4." />
        <View className="items-center justify-center flex-1 py-xl">
          <Animated.View style={{ transform: [{ scale }] }} className="h-[220px] w-[220px] rounded-full border-[4px] border-lime items-center justify-center bg-lime/5">
            <Text accessibilityLiveRegion="polite" className="font-heading-bold text-lime text-[15px] tracking-label uppercase">{phase}</Text>
            <Text className="font-heading text-lime text-[72px] leading-[76px]">{count}</Text>
          </Animated.View>
          <Text className="font-body text-white/40 text-[12px] mt-xl">Inhale 4 · Hold 4 · Exhale 4</Text>
        </View>
        <View className="gap-md">
          <LimeButton label={active ? 'Stop' : 'Begin'} onPress={toggle} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
