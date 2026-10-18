import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import ActiveWorkout from '../../components/fitness/ActiveWorkout';
import ScreenErrorNotice from '../../components/ScreenErrorNotice';
import LimeButton from '../../components/LimeButton';
import PillarSkeleton from '../../components/skeleton/PillarSkeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../hooks/useDashboard';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useFitnessLibrary } from '../../hooks/useFitnessLibrary';
import ProUpgradeSection from '../../components/ProUpgradeSection';
import { PRO_LOCKS } from '../../lib/proMoments';
import { navigateToProSubscription } from '../../lib/proNavigation';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

export default function ActiveWorkoutScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'ActiveWorkout'>>();
  const { user } = useAuth();
  const { data, loading: entitlementLoading } = useDashboard(user?.id);
  const entitlement = useEntitlement({
    isPro: data?.isPro ?? null,
    trialActive: data?.trialActive ?? null,
    loading: entitlementLoading,
  });
  const library = useFitnessLibrary(user?.id, true);
  const workout = useMemo(
    () => library.workouts.find((item) => item.id === route.params?.workoutId)
      ?? null,
    [library.workouts, route.params?.workoutId],
  );
  const close = useCallback(() => navigation.goBack(), [navigation]);
  const requireAuth = useCallback(() => navigation.navigate('Login'), [navigation]);
  const aiWorkoutAccess = entitlement.can('ai_workout');
  const lockedAiWorkout = workout?.source === 'ai_generated' && aiWorkoutAccess !== true;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-lg pt-lg pb-xl gap-xl"
      >
        <AppTopBar
          leftAccessory={
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"
            >
              <Feather name="chevron-left" size={20} color={colors.text} />
            </Pressable>
          }
        />
        <ScreenErrorNotice message={library.error} />

        <View key={library.loading ? 'workout-skeleton' : 'workout-content'}>
          {library.loading ? (
            <PillarSkeleton cards={3} />
          ) : lockedAiWorkout && aiWorkoutAccess === false ? (
            <ProUpgradeSection
              moment={PRO_LOCKS.aiWorkout}
              source="ai_workout"
              feature="ai_workout"
              userId={user?.id}
              onPress={() => navigateToProSubscription(navigation, 'ai_workout', 'AI Workout', user?.id, 'lock')}
            />
          ) : lockedAiWorkout ? (
            <View className="gap-sm border-y border-border py-lg">
              <Text className="font-body text-muted-text text-[13px] leading-[19px]">Checking access to this workout.</Text>
              <LimeButton label="Back to Body" onPress={close} />
            </View>
          ) : !workout ? (
            <View className="gap-md border-y border-border py-lg">
              <Text className="font-body text-muted-text text-[13px] leading-[19px]">No workout is available to start.</Text>
              <LimeButton label="Back to Body" onPress={close} />
            </View>
          ) : (
            <ActiveWorkout
              userId={user?.id}
              workout={workout}
              onRequireAuth={requireAuth}
              onElapsedChange={() => {}}
            />
          )}
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}
