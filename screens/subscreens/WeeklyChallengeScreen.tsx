import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTopBar from '../../components/AppTopBar';
import GlobalErrorToastReporter from '../../components/GlobalErrorToastReporter';
import InlineFormError from '../../components/InlineFormError';
import LimeButton from '../../components/LimeButton';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { refreshDashboardForUser, type DashboardData } from '../../hooks/useDashboard';
import { readDashboardCache } from '../../lib/offlineStorage';
import {
  deriveWeeklyChallengeParticipationState,
  isCurrentWeeklyChallengeContext,
  isCurrentWeeklyChallengeRequest,
} from '../../lib/weeklyChallengeState';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type WeeklyChallenge = {
  id: string;
  title: string;
  description: string | null;
};

type ParticipationState = 'not_joined' | 'joined' | 'started' | 'completed';

function startedKey(userId: string, challengeId: string) {
  return `dadhealth.weekly-challenge.started.${userId}.${challengeId}`;
}

function participationKey(userId: string, challengeId: string) {
  return `dadhealth.weekly-challenge.participation.${userId}.${challengeId}`;
}

function isCachedParticipationState(value: string | null): value is Exclude<ParticipationState, 'started'> {
  return value === 'not_joined' || value === 'joined' || value === 'completed';
}

function completionErrorMessage(message?: string) {
  return message?.includes('challenge_not_active')
    ? 'This Weekly Challenge has ended and can no longer be completed.'
    : "We couldn't mark this challenge as completed. Please try again.";
}

export default function WeeklyChallengeScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'WeeklyChallenge'>>();
  const { user } = useAuth();
  const { isOffline, showOfflineAction } = useNetworkStatus();
  const [challenge, setChallenge] = useState<WeeklyChallenge | null>(null);
  const [participationState, setParticipationState] = useState<ParticipationState>('not_joined');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const currentContextRef = useRef({ challengeId: route.params.challengeId, userId: user?.id });
  currentContextRef.current = { challengeId: route.params.challengeId, userId: user?.id };

  const loadCachedState = useCallback(async (isCurrent: () => boolean) => {
    if (!user?.id) return false;
    const challengeId = route.params.challengeId;
    const [dashboard, locallyStarted, cachedParticipation] = await Promise.all([
      readDashboardCache<DashboardData>(user.id).catch(() => null),
      SecureStore.getItemAsync(startedKey(user.id, challengeId)).catch(() => null),
      SecureStore.getItemAsync(participationKey(user.id, challengeId)).catch(() => null),
    ]);
    if (!isCurrent()) return false;
    const cachedChallenge = dashboard?.challenge?.id === challengeId ? dashboard.challenge : null;
    if (cachedChallenge) {
      setChallenge({
        id: cachedChallenge.id,
        title: cachedChallenge.title,
        description: cachedChallenge.description,
      });
    }
    const serverState = isCachedParticipationState(cachedParticipation) ? cachedParticipation : 'not_joined';
    setParticipationState(deriveWeeklyChallengeParticipationState({
      challengeId,
      userId: user.id,
      expectedChallengeId: challengeId,
      expectedUserId: user.id,
      joined: serverState !== 'not_joined',
      completedAt: serverState === 'completed' ? 'cached' : null,
      locallyStarted: locallyStarted === 'true',
    }));
    return Boolean(cachedChallenge);
  }, [route.params.challengeId, user?.id]);

  const load = useCallback(async (showLoading = true) => {
    const requestId = ++loadRequestIdRef.current;
    const requestContext = { challengeId: route.params.challengeId, userId: user?.id };
    const isCurrent = () => isCurrentWeeklyChallengeRequest(
      requestId,
      loadRequestIdRef.current,
      requestContext,
      currentContextRef.current,
    );
    if (showLoading) setLoading(true);
    setLoadError(null);

    if (!user?.id) {
      setChallenge(null);
      setParticipationState('not_joined');
      setLoadError('Sign in to view and join this Weekly Challenge.');
      setLoading(false);
      return;
    }

    if (isOffline) {
      await loadCachedState(isCurrent);
      if (isCurrent()) setLoading(false);
      return;
    }

    try {
      const localStartedKey = startedKey(user.id, route.params.challengeId);
      const [challengeResult, participationResult, locallyStarted] = await Promise.all([
        supabase
          .from('weekly_challenges')
          .select('id,title,description')
          .eq('id', route.params.challengeId)
          .eq('active', true)
          .maybeSingle(),
        supabase
          .from('weekly_challenge_participants')
          .select('challenge_id,user_id,completed_at')
          .eq('challenge_id', route.params.challengeId)
          .eq('user_id', user.id)
          .maybeSingle(),
        SecureStore.getItemAsync(localStartedKey).catch(() => null),
      ]);
      if (!isCurrent()) return;

      if (challengeResult.error) {
        const restored = await loadCachedState(isCurrent);
        if (!isCurrent()) return;
        if (!restored) setChallenge(null);
        setLoadError("We couldn't load this Weekly Challenge. Check your connection and try again.");
      } else if (!challengeResult.data) {
        setChallenge(null);
        setParticipationState('not_joined');
        setLoadError('This Weekly Challenge is no longer available. Return to Home to see the latest challenge.');
      } else if (participationResult.error) {
        setChallenge(challengeResult.data);
        await loadCachedState(isCurrent);
        if (!isCurrent()) return;
        setLoadError("We couldn't check your challenge status. Please try again.");
      } else {
        setChallenge(challengeResult.data);
        const nextState = deriveWeeklyChallengeParticipationState({
          challengeId: participationResult.data?.challenge_id,
          userId: participationResult.data?.user_id,
          expectedChallengeId: route.params.challengeId,
          expectedUserId: user.id,
          joined: Boolean(participationResult.data),
          completedAt: participationResult.data?.completed_at,
          locallyStarted: locallyStarted === 'true',
        });
        setParticipationState(nextState);
        if (nextState === 'completed') {
          await SecureStore.setItemAsync(participationKey(user.id, route.params.challengeId), 'completed');
          void SecureStore.deleteItemAsync(localStartedKey).catch(() => undefined);
        } else if (nextState !== 'not_joined') {
          await SecureStore.setItemAsync(participationKey(user.id, route.params.challengeId), 'joined');
        } else {
          await SecureStore.setItemAsync(participationKey(user.id, route.params.challengeId), 'not_joined');
          void SecureStore.deleteItemAsync(localStartedKey).catch(() => undefined);
        }
      }
    } catch {
      if (!isCurrent()) return;
      const restored = await loadCachedState(isCurrent);
      if (!isCurrent()) return;
      if (!restored) setChallenge(null);
      setLoadError("We couldn't load this Weekly Challenge. Check your connection and try again.");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [isOffline, loadCachedState, route.params.challengeId, user?.id]);

  useEffect(() => {
    void load();
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [load]);

  useEffect(() => {
    setBusy(false);
    setActionError(null);
  }, [route.params.challengeId, user?.id]);

  const changeParticipation = useCallback(async (join: boolean) => {
    if (!user?.id || !challenge || busy) return;
    if (join && participationState !== 'not_joined') return;
    if (!join && participationState !== 'joined') return;
    if (isOffline) {
      showOfflineAction('weekly_challenge');
      return;
    }

    setBusy(true);
    setActionError(null);
    const result = join
      ? await supabase
          .from('weekly_challenge_participants')
          .upsert(
            { challenge_id: challenge.id, user_id: user.id },
            { onConflict: 'challenge_id,user_id', ignoreDuplicates: true },
          )
      : await supabase
          .from('weekly_challenge_participants')
          .delete()
          .eq('challenge_id', challenge.id)
          .eq('user_id', user.id);

    const isCurrent = () => isCurrentWeeklyChallengeContext(
      { challengeId: challenge.id, userId: user.id },
      currentContextRef.current,
    );

    if (result.error) {
      if (isCurrent()) {
        setActionError(
          join
            ? "We couldn't add you to this week's challenge. Please try again."
            : "We couldn't remove you from this week's challenge. Please try again.",
        );
      }
    } else {
      if (!join) {
        await SecureStore.deleteItemAsync(startedKey(user.id, challenge.id)).catch(() => undefined);
      }
      await SecureStore.setItemAsync(
        participationKey(user.id, challenge.id),
        join ? 'joined' : 'not_joined',
      );
      if (isCurrent()) await load(false);
      void refreshDashboardForUser(user.id);
    }
    if (isCurrent()) setBusy(false);
  }, [busy, challenge, isOffline, load, participationState, showOfflineAction, user?.id]);

  const startChallenge = useCallback(async () => {
    if (!user?.id || !challenge || busy || participationState !== 'joined') return;
    const context = { challengeId: challenge.id, userId: user.id };

    setBusy(true);
    setActionError(null);
    try {
      await SecureStore.setItemAsync(startedKey(user.id, challenge.id), 'true');
      if (isCurrentWeeklyChallengeContext(context, currentContextRef.current)) {
        setParticipationState('started');
      }
    } catch {
      if (isCurrentWeeklyChallengeContext(context, currentContextRef.current)) {
        setActionError("We couldn't remember that you started this challenge. Please try again.");
      }
    } finally {
      if (isCurrentWeeklyChallengeContext(context, currentContextRef.current)) setBusy(false);
    }
  }, [busy, challenge, participationState, user?.id]);

  const completeChallenge = useCallback(async () => {
    if (!user?.id || !challenge || busy || participationState !== 'started') return;
    if (isOffline) {
      showOfflineAction('weekly_challenge');
      return;
    }

    setBusy(true);
    setActionError(null);
    const context = { challengeId: challenge.id, userId: user.id };
    const { error } = await supabase.rpc('complete_weekly_challenge', {
      p_challenge_id: challenge.id,
    });

    if (error) {
      if (isCurrentWeeklyChallengeContext(context, currentContextRef.current)) {
        setActionError(completionErrorMessage(error.message));
      }
    } else {
      await SecureStore.deleteItemAsync(startedKey(user.id, challenge.id)).catch(() => undefined);
      await SecureStore.setItemAsync(participationKey(user.id, challenge.id), 'completed');
      if (isCurrentWeeklyChallengeContext(context, currentContextRef.current)) {
        setParticipationState('completed');
      }
      void refreshDashboardForUser(user.id);
    }
    if (isCurrentWeeklyChallengeContext(context, currentContextRef.current)) setBusy(false);
  }, [busy, challenge, isOffline, participationState, showOfflineAction, user?.id]);

  const experienceCopy = participationState === 'completed'
    ? {
        title: 'Challenge completed',
        description: 'You showed up this week.',
      }
    : participationState === 'started'
      ? {
          title: 'Challenge on',
          description: "Go do it. Come back when you're done.",
        }
      : participationState === 'joined'
        ? {
            title: "You're in",
            description: 'You made the commitment. Now make it count.',
          }
        : {
            title: 'Ready for this week?',
            description: 'One challenge. One week. A chance to show up where it matters.',
          };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-lg pt-lg pb-[80px] gap-xl"
      >
        <AppTopBar
          leftAccessory={(
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
              className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"
            >
              <Feather name="arrow-left" size={20} color={colors.text} />
            </Pressable>
          )}
        />
        <GlobalErrorToastReporter message={loadError} />

        {loading ? (
          <View className="gap-lg" accessibilityLabel="Loading Weekly Challenge">
            <View className="h-[12px] w-[150px] rounded-full bg-white/10" />
            <View className="h-[94px] rounded-button bg-white/5" />
            <View className="h-[180px] rounded-button bg-white/5" />
          </View>
        ) : challenge ? (
          <>
            <View className="border-b border-border pb-xl">
              <Text className="font-heading-bold text-lime text-[12px] tracking-[3px] uppercase">
                This week&apos;s challenge
              </Text>
              <Text className="font-heading text-white text-[48px] leading-[48px] uppercase mt-md">
                {experienceCopy.title}
              </Text>
              <Text className="font-body text-muted-text text-[16px] leading-[26px] mt-xl">
                {experienceCopy.description}
              </Text>
            </View>

            <View className="gap-lg">
              {participationState === 'not_joined' ? (
                <View className="gap-md">
                  <Text className="font-heading-bold text-lime text-[13px] tracking-[2px] uppercase">
                    This week&apos;s mission
                  </Text>
                  <Text className="font-heading text-white text-[28px] leading-[30px] uppercase">
                    {challenge.title}
                  </Text>
                  {challenge.description ? (
                    <Text className="font-body text-muted-text text-[16px] leading-[26px]">
                      {challenge.description}
                    </Text>
                  ) : null}
                  <LimeButton
                    label="I'm in"
                    onPress={() => void changeParticipation(true)}
                    loading={busy}
                  />
                </View>
              ) : participationState === 'completed' ? (
                <View className="gap-md">
                  <Feather name="check-circle" size={34} color={colors.lime} />
                </View>
              ) : participationState === 'started' ? (
                <View className="gap-md">
                  <Text className="font-heading-bold text-lime text-[13px] tracking-[2px] uppercase">
                    Your challenge
                  </Text>
                  <Text className="font-heading text-white text-[28px] leading-[30px] uppercase">
                    {challenge.title}
                  </Text>
                  {challenge.description ? (
                    <Text className="font-body text-white text-[16px] leading-[26px]">
                      {challenge.description}
                    </Text>
                  ) : null}
                  <LimeButton
                    label="I did it"
                    onPress={() => void completeChallenge()}
                    loading={busy}
                  />
                </View>
              ) : (
                <View className="gap-md">
                  <Text className="font-heading-bold text-lime text-[13px] tracking-[2px] uppercase">
                    Your challenge
                  </Text>
                  <Text className="font-heading text-white text-[28px] leading-[30px] uppercase">
                    {challenge.title}
                  </Text>
                  {challenge.description ? (
                    <Text className="font-body text-muted-text text-[16px] leading-[26px]">
                      {challenge.description}
                    </Text>
                  ) : null}
                  <LimeButton
                    label="Start challenge"
                    onPress={() => void startChallenge()}
                    loading={busy}
                  />
                  <Pressable
                    onPress={() => void changeParticipation(false)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Leave Weekly Challenge"
                    className="self-start border border-border rounded-button px-lg py-md active:opacity-70 disabled:opacity-50"
                  >
                    <Text className="font-heading-bold text-muted-text text-[13px] uppercase tracking-[1px]">
                      {busy ? 'Updating…' : 'Leave challenge'}
                    </Text>
                  </Pressable>
                </View>
              )}

              <InlineFormError message={isOffline ? null : actionError} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
