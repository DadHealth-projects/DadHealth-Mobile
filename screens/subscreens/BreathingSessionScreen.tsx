import { useNotificationPresentation } from '../../contexts/NotificationInboxContext';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import { useAuth } from '../../contexts/AuthContext';
import { useMindResetSound } from '../../hooks/useMindResetSound';
import { useMindResetSession } from '../../hooks/useMindResetSession';
import { trackEvent } from '../../lib/analytics';
import { subscribeOfflineSync } from '../../lib/offlineStorage';
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
  const { user } = useAuth();
  useNotificationPresentation(Boolean(user), false, 'mind-reset');
  const preference = useMindResetSound(user?.id);
  const session = useMindResetSession();
  // Honest save state: shown only while a finished reset could not be stored or sent yet.
  const [saveProblem, setSaveProblem] = useState<string | null>(null);
  useEffect(() => {
    setSaveProblem(null);
    return subscribeOfflineSync((event) => {
      if (event.userId !== user?.id || event.kind !== 'mind_reset_complete') return;
      if (event.status === 'failed') setSaveProblem(event.message ?? null);
      if (event.status === 'synced' || event.status === 'cleared') setSaveProblem(null);
    });
  }, [user?.id]);
  const elapsedSeconds = session.seconds;
  const active = session.running;
  const scale = useRef(new Animated.Value(1)).current;

  const phase = getMindResetPhase(elapsedSeconds);
  const breathSecond = elapsedSeconds % 12;
  const breathPhase: BreathPhase = breathSecond < 4 ? 'inhale' : breathSecond < 8 ? 'hold' : 'exhale';
  const breathCount = 4 - (breathSecond % 4);
  const resetStepIndex = getMindResetStepIndex(elapsedSeconds);

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

  const startSession = () => {
    if (!session.started) {
      trackEvent('breath_session_started', { pattern: '4-4-4' }, user?.id);
    }
    session.start();
  };
  const finishHere = () => { session.stop(); navigation.goBack(); };

  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')} / 5:00`;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-xl gap-xl flex-grow">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"><Feather name="chevron-left" size={20} color={colors.text} /></Pressable>} />
        <View className="gap-sm">
  <Text className="font-heading-bold text-lime text-[12px] tracking-label uppercase">
    5-minute Mind Reset
  </Text>

   <View className="flex-row items-start gap-md">
    <Text className="flex-1 font-heading-bold text-white text-[36px] leading-[40px] uppercase">
      {'Slow down.\nBreathe.'}
    </Text>

    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Mind Reset sound"
      accessibilityState={{
        checked: preference.sound,
        disabled: !preference.ready,
      }}
      disabled={!preference.ready}
      onPress={() => preference.setSound(!preference.sound)}
      className="h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border border-border active:opacity-70"
      style={{
  opacity: preference.ready ? 1 : 0.5,
  transform: [{ translateY: -4 }],
}}
    >
      <Feather
        name={preference.sound ? 'volume-2' : 'volume-x'}
        size={22}
        color={colors.lime}
      />
    </Pressable>
  </View>

  <Text className="font-body text-muted-text text-[16px] leading-[24px]">
    One minute of 4-4-4 breathing, then four minutes of guided reset.
  </Text>

  {preference.error ? (
    <Text accessibilityRole="alert" className="font-body text-white text-[14px]">
      Sound preference could not be saved or loaded on this device.
    </Text>
  ) : null}
</View>

        <View className="items-center justify-center flex-1 py-xl">
          {phase === 'breathing' ? (
            <>
              <Animated.View style={{ transform: [{ scale }] }} className="h-[220px] w-[220px] rounded-full border-[4px] border-lime items-center justify-center bg-lime/5">
                <Text accessibilityLiveRegion="polite" className="font-heading-bold text-lime text-[15px] tracking-label uppercase">{breathPhase}</Text>
                <Text className="font-heading text-lime text-[72px] leading-[76px]">{breathCount}</Text>
              </Animated.View>
              <Text className="font-body text-muted-text text-[14px] mt-xl">Inhale 4 · Hold 4 · Exhale 4</Text>
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
          {session.error ? <Text accessibilityRole="alert" className="font-body text-white text-[14px]">{session.error}</Text> : null}
          {saveProblem ? <Text accessibilityRole="alert" className="font-body text-white text-[14px]">{saveProblem}</Text> : null}
          {phase === 'complete' ? (
            <>
              <LimeButton label="Done" onPress={finishHere} />
              <SecondaryAction label="Write it down" onPress={() => { session.stop(); navigation.navigate('Journal'); }} />
            </>
          ) : (
            <>
              <LimeButton
                label={active ? 'Pause' : session.started ? 'Resume' : 'Begin Mind Reset'}
                onPress={active ? session.pause : startSession}
                disabled={!preference.ready || session.preparing}
              />
              {session.started ? <SecondaryAction label="End session" onPress={finishHere} /> : null}
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
