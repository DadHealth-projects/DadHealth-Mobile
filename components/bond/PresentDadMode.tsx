import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import LimeButton from '../LimeButton';
import { usePresentDadMode, type PresentDadSession } from '../../hooks/usePresentDadMode';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme';

type Phase = 'closed' | 'loading' | 'intro' | 'error' | 'timer' | 'complete';

function timerLine(minutesLeft: number) {
  if (minutesLeft <= 5) return 'A few more minutes, fully present.';
  if (minutesLeft <= 15) return 'Stay with this moment.';
  if (minutesLeft <= 30) return 'You’re giving them your attention.';
  if (minutesLeft <= 45) return 'Keep making room for this time together.';
  return 'One hour. Just the two of you.';
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes} minutes.` : `${minutes} minutes ${remainder} seconds.`;
}

export default function PresentDadMode({ userId, onScoreRefresh, onViewBondScore }: { userId?: string; onScoreRefresh: () => void; onViewBondScore: () => void }) {
  const mode = usePresentDadMode(userId);
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('closed');
  const [remainingSeconds, setRemainingSeconds] = useState(60 * 60);
  const [finishedSession, setFinishedSession] = useState<PresentDadSession | null>(null);
  const [introError, setIntroError] = useState<string | null>(null);
  const finishingId = useRef<string | null>(null);
  const autoFinishAttempted = useRef<string | null>(null);

  const persistIntroSeen = useCallback(async () => {
    if (!userId) throw new Error('Sign in to save your Present Dad preference.');
    const result = await supabase.from('present_dad_preferences').upsert({
      user_id: userId,
      intro_seen_at: new Date().toISOString(),
    });
    if (result.error) throw result.error;
  }, [userId]);

  const finishSession = useCallback(async (session: PresentDadSession) => {
    if (finishingId.current === session.id) return;
    finishingId.current = session.id;
    const result = await mode.finish(session.id);
    finishingId.current = null;
    if (!result) return;
    setFinishedSession(result);
    setPhase('complete');
    if (result.status === 'completed') onScoreRefresh();
  }, [mode.finish, onScoreRefresh]);

  const open = useCallback(async () => {
    setPhase('loading');
    setFinishedSession(null);
    setIntroError(null);
    finishingId.current = null;
    autoFinishAttempted.current = null;
    try {
      const existing = await mode.refresh();
      if (existing?.status === 'active') {
        await persistIntroSeen();
        setPhase('timer');
        return;
      }
      if (existing?.status === 'completed') {
        await persistIntroSeen();
        setFinishedSession(existing);
        setPhase('complete');
        return;
      }
      if (!userId) throw new Error('Sign in to start Present Dad Mode.');

      const preference = await supabase.from('present_dad_preferences')
        .select('intro_seen_at').eq('user_id', userId).maybeSingle();
      if (preference.error) throw preference.error;
      if (preference.data?.intro_seen_at) {
        const started = await mode.start();
        if (!started) {
          setPhase('error');
          return;
        }
        setRemainingSeconds(Math.max(0, Math.ceil((new Date(started.ends_at).getTime() - Date.now()) / 1000)));
        setPhase('timer');
        return;
      }
      setPhase('intro');
    } catch {
      setIntroError('We could not load Present Dad Mode. Please try again.');
      setPhase('error');
    }
  }, [mode.refresh, mode.start, persistIntroSeen, userId]);

  useEffect(() => {
    if (phase !== 'timer' || mode.session?.status !== 'active') return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(mode.session!.ends_at).getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0 && autoFinishAttempted.current !== mode.session!.id) {
        autoFinishAttempted.current = mode.session!.id;
        void finishSession(mode.session!);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [finishSession, mode.session, phase]);

  useEffect(() => {
    if (phase === 'timer' && mode.session?.status === 'completed') {
      setFinishedSession(mode.session);
      setPhase('complete');
      onScoreRefresh();
    }
  }, [mode.session, onScoreRefresh, phase]);

  const start = useCallback(async () => {
    const session = await mode.start();
    if (session) {
      try {
        await persistIntroSeen();
      } catch {
        setIntroError('Your session started, but we could not save this preference. Retry to continue.');
        setPhase('error');
        return;
      }
      autoFinishAttempted.current = null;
      setRemainingSeconds(Math.max(0, Math.ceil((new Date(session.ends_at).getTime() - Date.now()) / 1000)));
      setPhase('timer');
    }
  }, [mode.start, persistIntroSeen]);

  const endEarly = useCallback(() => {
    if (!mode.session) return;
    Alert.alert(
      'End this session?',
      'Your time will be saved. Sessions under 5 minutes do not affect your Bond score.',
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'End session', style: 'destructive', onPress: () => void finishSession(mode.session!) },
      ],
    );
  }, [finishSession, mode.session]);

  const dismiss = useCallback(async () => {
    if (phase === 'complete' && finishedSession) {
      await mode.acknowledge(finishedSession.id);
    }
    setPhase('closed');
  }, [finishedSession, mode.acknowledge, phase]);

  const viewBondScore = useCallback(async () => {
    await dismiss();
    onViewBondScore();
  }, [dismiss, onViewBondScore]);

  const scoreEligible = finishedSession?.status === 'completed';
  const durationSeconds = finishedSession?.completed_duration_seconds ?? 0;
  const minutesLeft = Math.ceil(remainingSeconds / 60);
  const sessionActive = mode.session?.status === 'active';
  const sessionComplete = mode.session?.status === 'completed';

  return (
    <>
      <Pressable onPress={() => void open()} accessibilityRole="button" className="gap-sm border-b border-border pb-lg active:opacity-75">
        <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Present Dad Mode</Text>
        <Text className="font-heading text-white text-[21px] leading-[24px] uppercase mt-xs">60 minutes. Phone down. Just you and them.</Text>
        <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-sm">
          {sessionActive ? 'Your session is in progress. Tap to return to the countdown.' : sessionComplete ? 'Your session is complete.' : 'Logs to your Bond score on completion.'}
        </Text>
        <View className="self-start flex-row items-center gap-xs mt-md">
          <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
            {sessionActive ? 'Resume session' : sessionComplete ? 'View session completion' : 'Start session'}
          </Text>
          <Feather name="arrow-right" size={15} color={colors.lime} />
        </View>
      </Pressable>

      <Modal visible={phase !== 'closed'} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => void dismiss()}>
        <SafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-dark">
          <ScrollView
            contentContainerClassName="flex-grow px-lg pb-xl"
            contentContainerStyle={{ paddingTop: Math.max(insets.top, 0) + 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="mb-xl flex-row justify-start">
              <Pressable onPress={() => void dismiss()} accessibilityRole="button" accessibilityLabel={sessionActive ? 'Back to Bond; session continues' : 'Back to Bond'} className="h-[44px] w-[44px] items-center justify-center">
                <Feather name="chevron-left" size={26} color={colors.text} />
              </Pressable>
            </View>

            {phase === 'loading' ? <View className="flex-1 items-center justify-center"><Text className="font-body text-muted-text">Loading session…</Text></View> : null}

            {phase === 'error' ? (
              <View className="flex-1 justify-center gap-md">
                <Text className="font-heading-bold text-lime text-[12px] tracking-label uppercase">Present Dad Mode</Text>
                <Text accessibilityRole="alert" className="font-body text-red-300 text-[14px] leading-[21px]">{introError ?? mode.error ?? 'We could not start this session. Please try again.'}</Text>
                <LimeButton label="Retry" onPress={() => void open()} loading={mode.busy} />
              </View>
            ) : null}

            {phase === 'intro' ? (
              <View className="flex-1 justify-center gap-md">
                <Text className="font-heading-bold text-lime text-[12px] tracking-label uppercase">Present Dad Mode</Text>
                <Text className="font-heading text-white text-[34px] leading-[38px] uppercase">60 minutes.{ '\n' }Phone down.{ '\n' }Just you and them.</Text>
                <Text className="font-body text-white text-[16px] leading-[25px]">For the next hour your phone stays face down and your full attention is on your child. No notifications. No scrolling. Just presence.</Text>
                <Text className="font-body text-muted-text text-[14px] leading-[21px]">When the session ends it logs automatically to your Bond score.</Text>
                <Text className="font-heading-bold text-white text-[18px] leading-[25px] mt-sm">Your child won’t remember the toys.{ '\n' }They’ll remember the time.</Text>
                <FocusNote />
                {introError ? <Text accessibilityRole="alert" className="font-body text-red-300 text-[13px]">{introError}</Text> : null}
                {mode.error ? <Text accessibilityRole="alert" className="font-body text-red-300 text-[13px]">{mode.error}</Text> : null}
                {introError ? <Pressable onPress={() => void open()} className="min-h-[40px] justify-center"><Text className="font-heading-bold text-lime text-[11px] uppercase">Retry loading</Text></Pressable> : null}
                <LimeButton label="I'm ready. Let's go. →" onPress={() => void start()} loading={mode.busy} />
              </View>
            ) : null}

            {phase === 'timer' && mode.session?.status === 'active' ? (
              <View className="flex-1 justify-center items-center gap-lg">
                <Text className="font-heading-bold text-lime text-[12px] tracking-label uppercase">Present Dad Mode</Text>
                <Text accessibilityLiveRegion="polite" className="font-heading text-white text-[70px] leading-[78px]">{`${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`}</Text>
                <Text className="font-body text-muted-text text-[16px] text-center">{timerLine(minutesLeft)}</Text>
                {mode.error ? <Text accessibilityRole="alert" className="font-body text-red-300 text-[13px] text-center">{mode.error}</Text> : null}
                {mode.error || remainingSeconds === 0 ? <LimeButton label="Retry saving session" onPress={() => void finishSession(mode.session!)} loading={mode.busy} /> : null}
                <Pressable onPress={endEarly} disabled={mode.busy} accessibilityRole="button" className="min-h-[44px] justify-center px-md">
                  <Text className="font-heading-bold text-muted-text text-[11px] tracking-label uppercase">End session early</Text>
                </Pressable>
              </View>
            ) : null}

            {phase === 'complete' && finishedSession ? (
              <View className="flex-1 justify-center gap-md">
                <Text className="font-heading-bold text-lime text-[12px] tracking-label uppercase">Session complete</Text>
                <Text className="font-heading text-white text-[42px] leading-[46px] uppercase">{durationSeconds >= 3600 ? '60 minutes.' : formatDuration(durationSeconds)}</Text>
                <Text className="font-heading-bold text-white text-[22px] uppercase">Well done, Dad.</Text>
                {scoreEligible ? (
                  <>
                    <Text className="font-body text-white text-[16px] leading-[24px]">{durationSeconds >= 3600 ? 'You just gave your child something no one else can. Sixty minutes of you.' : `You just gave your child ${formatDuration(durationSeconds).replace(/\.$/, '')} of you.`}</Text>
                    <Text className="font-heading-bold text-lime text-[13px] uppercase">↑ Your Bond score has been updated.</Text>
                    <LimeButton label="View Bond score" onPress={() => void viewBondScore()} />
                  </>
                ) : (
                  <>
                    <Text className="font-body text-white text-[16px] leading-[24px]">Your time has been saved. Come back whenever it works for you.</Text>
                    <Text className="font-body text-muted-text text-[13px]">Sessions under 5 minutes do not affect your Bond score.</Text>
                  </>
                )}
                {mode.error ? <Text accessibilityRole="alert" className="font-body text-red-300 text-[13px]">{mode.error}</Text> : null}
                <Pressable onPress={() => void dismiss()} accessibilityRole="button" className="min-h-[44px] items-center justify-center">
                  <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Done</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function FocusNote() {
  return (
    <View className="rounded-button border border-border px-md py-sm">
      <Text className="font-body text-muted-text text-[12px] leading-[18px]">
        Want fewer interruptions? You can turn on a Focus from Control Center. Dad Health can’t activate iPhone Focus for you.
      </Text>
    </View>
  );
}
