import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useIsFocused, useNavigation, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { trackEvent } from '../../lib/analytics';
import {
  BREATHING_DURATION_SECONDS,
  getMindResetPhase,
  getMindResetStepIndex,
  MIND_RESET_DURATION_SECONDS,
  RESET_STEPS,
} from '../../lib/mindReset';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type BreathPhase = 'inhale' | 'hold' | 'exhale';

export default function BreathingSessionScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [active, setActive] = useState(false);
  const [appIsActive, setAppIsActive] = useState(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  const elapsedRef = useRef(0);
  const runStartedAtRef = useRef<number | null>(null);
  const runBaseRef = useRef(0);
  const scale = useRef(new Animated.Value(1)).current;

  const phase = getMindResetPhase(elapsedSeconds);
  const breathSecond = elapsedSeconds % 12;
  const breathPhase: BreathPhase = breathSecond < 4 ? 'inhale' : breathSecond < 8 ? 'hold' : 'exhale';
  const breathCount = 4 - (breathSecond % 4);
  const resetStepIndex = getMindResetStepIndex(elapsedSeconds);

  const pauseSession = useCallback(() => {
    const startedAt = runStartedAtRef.current;
    if (startedAt !== null) {
      const nextElapsed = Math.min(
        MIND_RESET_DURATION_SECONDS,
        runBaseRef.current + Math.floor((Date.now() - startedAt) / 1000),
      );
      elapsedRef.current = nextElapsed;
      setElapsedSeconds(nextElapsed);
      runStartedAtRef.current = null;
    }
    setActive(false);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const foreground = state === 'active';
      setAppIsActive(foreground);
      if (!foreground) pauseSession();
    });
    return () => subscription.remove();
  }, [pauseSession]);

  useEffect(() => {
    if (!isFocused) pauseSession();
  }, [isFocused, pauseSession]);

  useEffect(() => {
    if (!active || !isFocused || !appIsActive || phase === 'complete') return;
    const startedAt = Date.now();
    const base = elapsedRef.current;
    runStartedAtRef.current = startedAt;
    runBaseRef.current = base;
    const timer = setInterval(() => {
      const nextElapsed = Math.min(
        MIND_RESET_DURATION_SECONDS,
        base + Math.floor((Date.now() - startedAt) / 1000),
      );
      if (nextElapsed !== elapsedRef.current) {
        elapsedRef.current = nextElapsed;
        setElapsedSeconds(nextElapsed);
      }
    }, 200);
    return () => {
      clearInterval(timer);
      if (runStartedAtRef.current === startedAt) runStartedAtRef.current = null;
    };
  }, [active, appIsActive, isFocused, phase]);

  useEffect(() => {
    const breathing = phase === 'breathing';
    const target = !active || !breathing ? 1 : breathPhase === 'exhale' ? 0.94 : 1.12;
    const animation = Animated.timing(scale, {
      toValue: target,
      duration: !active || !breathing || breathPhase === 'hold' ? 250 : 3900,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, breathPhase, phase, scale]);

  const startSession = useCallback(() => {
    if (elapsedRef.current === 0) trackEvent('breath_session_started', { pattern: '4-4-4' }, user?.id);
    setActive(true);
  }, [user?.id]);

  const finishHere = useCallback(() => {
    pauseSession();
    navigation.goBack();
  }, [navigation, pauseSession]);

  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')} / 5:00`;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-xl gap-xl flex-grow">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"><Feather name="chevron-left" size={20} color={colors.text} /></Pressable>} />
        <ScreenHero eyebrow="5-minute Mind Reset" headline={'Slow down.\nBreathe.'} sub="One minute of 4-4-4 breathing, then four minutes of guided reset." />

        <View className="items-center justify-center flex-1 py-xl">
          {phase === 'breathing' ? (
            <>
              <Animated.View style={{ transform: [{ scale }] }} className="h-[220px] w-[220px] rounded-full border-[4px] border-lime items-center justify-center bg-lime/5">
                <Text accessibilityLiveRegion="polite" className="font-heading-bold text-lime text-[15px] tracking-label uppercase">{breathPhase}</Text>
                <Text className="font-heading text-lime text-[72px] leading-[76px]">{breathCount}</Text>
              </Animated.View>
              <Text className="font-body text-muted-text text-[12px] mt-xl">Inhale 4 · Hold 4 · Exhale 4</Text>
            </>
          ) : phase === 'reset' && resetStepIndex !== null ? (
            <View className="w-full rounded-button border border-lime/25 bg-lime/5 p-lg gap-md">
              <Text className="font-heading-bold text-lime text-[12px] tracking-label uppercase">{elapsedLabel}</Text>
              <Text className="font-heading-bold text-white text-[24px] uppercase">{RESET_STEPS[resetStepIndex].title}</Text>
              <Text className="font-body text-muted-text text-[16px] leading-[24px]">{RESET_STEPS[resetStepIndex].instruction}</Text>
              <View className="h-[4px] overflow-hidden rounded-full bg-white/10">
                <View className="h-full rounded-full bg-lime" style={{ width: `${(elapsedSeconds / MIND_RESET_DURATION_SECONDS) * 100}%` }} />
              </View>
            </View>
          ) : (
            <View className="w-full items-center gap-md rounded-button border border-lime/25 bg-lime/5 p-lg">
              <Text className="font-heading-bold text-lime text-[12px] tracking-label uppercase">5 minutes complete</Text>
              <Text className="font-body text-muted-text text-[16px] leading-[24px] text-center">You made space to slow down and reset.</Text>
            </View>
          )}
        </View>

        <View className="gap-md">
          {phase === 'complete' ? (
            <>
              <LimeButton label="Done" onPress={() => navigation.goBack()} />
              <SecondaryAction label="Write it down" onPress={() => navigation.navigate('Journal')} />
            </>
          ) : (
            <>
              <LimeButton
                label={active ? 'Pause' : elapsedSeconds > 0 ? 'Resume' : 'Begin Mind Reset'}
                onPress={active ? pauseSession : startSession}
              />
              {elapsedSeconds >= BREATHING_DURATION_SECONDS ? (
                <SecondaryAction label="Finish here" onPress={finishHere} />
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SecondaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="min-h-[48px] items-center justify-center rounded-button border border-border px-md active:opacity-70">
      <Text className="font-heading-bold text-lime text-[12px] tracking-[1px] uppercase">{label}</Text>
    </Pressable>
  );
}
