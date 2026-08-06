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
import LimeButton from '../../components/LimeButton';
import PillarSkeleton from '../../components/skeleton/PillarSkeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useFitnessLibrary } from '../../hooks/useFitnessLibrary';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

export default function ActiveWorkoutScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'ActiveWorkout'>>();
  const { user } = useAuth();
  const library = useFitnessLibrary(user?.id, true);
  const workout = useMemo(
    () => library.workouts.find((item) => item.id === route.params?.workoutId)
      ?? (route.params?.workoutId ? null : library.workouts[0])
      ?? null,
    [library.workouts, route.params?.workoutId],
  );
  const close = useCallback(() => navigation.goBack(), [navigation]);
  const requireAuth = useCallback(() => navigation.navigate('Login'), [navigation]);

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
              accessibilityLabel="Close active workout"
              hitSlop={8}
              className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          }
        />

        {library.loading ? (
          <PillarSkeleton cards={3} />
        ) : library.error ? (
          <View accessibilityRole="alert" className="gap-md rounded-button border border-red-400/40 bg-red-400/10 p-md">
            <Text className="font-body text-red-300 text-[13px] leading-[19px]">{library.error}</Text>
            <LimeButton label="Retry workout" onPress={() => void library.refresh()} />
          </View>
        ) : !workout && library.proError ? (
          <View accessibilityRole="alert" className="gap-md rounded-button border border-red-400/40 bg-red-400/10 p-md">
            <Text className="font-body text-red-300 text-[13px] leading-[19px]">{library.proError}</Text>
            <LimeButton label="Retry access" onPress={() => void library.refresh()} />
          </View>
        ) : !workout ? (
          <View className="gap-md border-y border-border py-lg">
            <Text className="font-body text-white/45 text-[13px] leading-[19px]">No workout is available to start.</Text>
            <LimeButton label="Back to Fitness" onPress={close} />
          </View>
        ) : (
          <ActiveWorkout
            userId={user?.id}
            workout={workout}
            onRequireAuth={requireAuth}
            onElapsedChange={() => {}}
          />
        )}
      </ScrollView>

    </SafeAreaView>
  );
}
