import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import Card from '../components/Card';
import FadeInView from '../components/FadeInView';
import { useDashboard } from '../hooks/useDashboard';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';

/** Progress / report screen — mirrors the web dashboard Preview ProgressScreen.
 *  Reached from the Dashboard "Take action" button. Shows the Dad Score once
 *  more alongside the month's report stats and earned badges.
 */
export default function ProgressScreen() {
  const navigation = useNavigation<{ goBack: () => void }>();
  const { user } = useAuth();
  const { data, loading } = useDashboard(user?.id);

  const score = data ? Math.round((data.mindScore + data.bodyScore + data.bondScore) / 3) : 0;
const scoreItems: Array<{ label: string; value: number }> = [
    { label: 'Mind', value: data?.mindScore ?? 0 },
    { label: 'Body', value: data?.bodyScore ?? 0 },
    { label: 'Bond', value: data?.bondScore ?? 0 },
  ];

  const monthLabel = new Date().toLocaleDateString('en-GB', { month: 'long' }).toUpperCase();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-xl pb-[120px] gap-lg">
        {/* Close (modal/pushed) */}
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-sm">
            <View className="h-[18px] w-[4px] rounded-full bg-lime" />
            <Text className="font-heading-semibold text-muted-text text-[13px] tracking-label uppercase">Progress</Text>
          </View>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            className="h-[40px] w-[40px] rounded-full border border-border items-center justify-center active:opacity-70"
          >
            <Feather name="x" size={20} color={colors.text} />
          </Pressable>
        </View>

        <FadeInView>
          <Text className="font-heading text-white text-[36px] leading-[38px] uppercase">Your Dad Health Score</Text>
        </FadeInView>

        {loading && !data ? (
          <View className="flex-1 items-center justify-center py-xl">
            <View className="h-[54px] w-[54px] rounded-full border-[3px] border-lime border-t-transparent" />
            <Text className="font-heading-bold text-lime text-[18px] tracking-[0.5px] uppercase mt-md">Loading progress...</Text>
          </View>
        ) : null}

        {data ? (
          <>
            {/* Score ring */}
            <FadeInView delay={80}>
              <View className="bg-lime rounded-card p-lg">
                <View className="flex-row gap-lg items-center">
                  <View className="h-[92px] w-[92px] rounded-full border-[5px] border-dark items-center justify-center">
                    <Text className="font-heading text-dark text-[42px] leading-[42px]">{score}</Text>
                    <Text className="font-heading-semibold text-dark/60 text-[9px] tracking-[1px] uppercase">out of 100</Text>
                  </View>
                  <View className="flex-1 gap-sm">
{scoreItems.map((item) => (
                      <View key={item.label}>
                        <View className="flex-row justify-between mb-xs">
                          <Text className="font-heading-bold text-dark/70 text-[11px] tracking-[0.5px] uppercase">{item.label}</Text>
                          <Text className="font-heading-bold text-dark/70 text-[11px]">{item.value}%</Text>
                        </View>
                        <View className="h-[6px] rounded-full bg-dark/15 overflow-hidden">
                          <View className="h-[6px] rounded-full bg-dark" style={{ width: `${item.value}%` as `${number}%` }} />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </FadeInView>

            {/* Monthly report */}
            <FadeInView delay={140}>
              <Text className="font-heading-bold text-white text-[22px] leading-[24px] tracking-[0.5px] uppercase">
                {monthLabel} report
              </Text>
              <View className="flex-row gap-sm mt-md">
                <View className="flex-1 rounded-card border border-lime/25 bg-card p-md">
                  <Text className="font-heading text-lime text-[28px] leading-[28px]">{data.goals.length}</Text>
                  <Text className="font-body text-muted-text text-[11px] tracking-[0.5px] uppercase mt-xs">Goals</Text>
                </View>
                <View className="flex-1 rounded-card border border-lime/25 bg-card p-md">
                  <Text className="font-heading text-lime text-[28px] leading-[28px]">{data.moodLogs.length}</Text>
                  <Text className="font-body text-muted-text text-[11px] tracking-[0.5px] uppercase mt-xs">Check-ins</Text>
                </View>
                <View className="flex-1 rounded-card border border-lime/25 bg-card p-md">
                  <Text className="font-heading text-lime text-[28px] leading-[28px]">{data.reminders.length}</Text>
                  <Text className="font-body text-muted-text text-[11px] tracking-[0.5px] uppercase mt-xs">Reminders</Text>
                </View>
              </View>
            </FadeInView>

            {/* Badges — placeholder until earned_badges data lands */}
            <FadeInView delay={200}>
              <Text className="font-heading-bold text-white text-[22px] leading-[24px] tracking-[0.5px] uppercase">Badges</Text>
              <Card className="mt-md">
                <Text className="font-body text-muted-text text-[14px] leading-[21px]">
                  Earn badges by logging workouts, moods, and milestones.
                </Text>
              </Card>
            </FadeInView>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
