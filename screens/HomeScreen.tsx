import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import HomeSkeleton from '../components/skeleton/HomeSkeleton';

import AccountButton from '../components/AccountButton';
import type { AppStackParamList } from '../navigation/AppNavigator';
import AccountSheet from '../components/AccountSheet';
import Card from '../components/Card';
import FadeInView from '../components/FadeInView';
import LimeButton from '../components/LimeButton';
import { useDashboard } from '../hooks/useDashboard';
import { colors } from '../theme';

const MOODS = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'Okay' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Great' },
] as const;

type GoalIcon = keyof typeof Feather.glyphMap;

function goalDetails(goal: string): { icon: GoalIcon; pillar: string } {
  const normalized = goal.toLowerCase();
  if (normalized.includes('physically') || normalized.includes('fitness') || normalized.includes('healthier')) {
    return { icon: 'activity', pillar: 'Body' };
  }
  if (normalized.includes('tough') || normalized.includes('struggling') || normalized.includes('present')) {
    return { icon: 'heart', pillar: 'Mind' };
  }
  if (normalized.includes('kids') || normalized.includes('dad')) {
    return { icon: 'users', pillar: 'Bond' };
  }
  return { icon: 'star', pillar: 'Today' };
}

function weekDates(): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function SectionTitle({ children }: { children: string }) {
  return <Text className="font-heading-bold text-white text-[22px] leading-[24px] tracking-[0.5px] uppercase">{children}</Text>;
}

export default function HomeScreen() {
  return <PublicHome />;
}

/** Authenticated dashboard content. Mounted only by DashboardScreen. */
export function DashboardScreenContent({
  userId,
  onGoProgress,
}: {
  userId: string;
  onGoProgress?: () => void;
}) {
  const { data, loading, error: dashboardError, checkingIn, refresh, saveCheckIn } = useDashboard(userId);
  const [accountOpen, setAccountOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [sleep, setSleep] = useState('');
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [completedGoals, setCompletedGoals] = useState<Record<string, boolean>>({});

  const now = useMemo(() => new Date(), []);
  const todayLabel = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const displayName = data?.displayName?.trim().split(/\s+/)[0] || 'Dad';
  const score = data ? Math.round((data.mindScore + data.bodyScore + data.bondScore) / 3) : 0;
  const dates = useMemo(weekDates, []);
  const moodByDate = useMemo(() => new Map(data?.moodLogs.map((mood) => [mood.date, mood.mood_value]) ?? []), [data?.moodLogs]);
  const weekMoodValues = dates.map((date) => moodByDate.get(dateKey(date)) ?? 0);
  const recordedMoods = weekMoodValues.filter((value) => value > 0);
  const averageMood = recordedMoods.length > 0
    ? recordedMoods.reduce((sum, value) => sum + value, 0) / recordedMoods.length
    : null;

  const handleCheckIn = async () => {
    setCheckInError(null);
    if (selectedMood === null) {
      setCheckInError('Choose how you are feeling today.');
      return;
    }
    const sleepHours = Number(sleep);
    if (!sleep.trim() || !Number.isFinite(sleepHours)) {
      setCheckInError('Enter the hours you slept last night.');
      return;
    }
    const result = await saveCheckIn(selectedMood, sleepHours);
    if (result.error) {
      setCheckInError(result.error);
      return;
    }
    setSelectedMood(null);
    setSleep('');
  };

  if (loading && !data) {
  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.dark }}
    >
      <HomeSkeleton />
    </SafeAreaView>
  );
}

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
<ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl"
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void refresh()}
              tintColor={colors.lime}
            />
          }
        >
          <View className="flex-row justify-end">
            <AccountButton onPress={() => setAccountOpen(true)} />
          </View>

          {dashboardError && !data ? (
            <Card className="border-lime/30 gap-md">
              <Text className="font-heading-bold text-white text-[20px] uppercase">Couldn't load today's dashboard</Text>
              <Text className="font-body text-muted-text text-[14px] leading-[21px]">{dashboardError}</Text>
              <LimeButton label="Try again" onPress={() => void refresh()} />
            </Card>
          ) : null}

          {data ? (
            <>
              <FadeInView>
                <Text className="font-heading-semibold text-lime text-[12px] tracking-label uppercase">Good morning dads</Text>
                <Text className="font-heading text-white text-[44px] leading-[44px] uppercase mt-sm">
                  {displayName}{'\n'}{weekday}
                </Text>
                <View className="flex-row items-center gap-sm mt-md">
                  <Text className="font-body text-muted-text text-[14px]">{todayLabel}</Text>
                  <View className="h-[4px] w-[4px] rounded-full bg-lime" />
                  <Text className="font-body text-muted-text text-[14px]">{data.dadsCount.toLocaleString()} dads in community</Text>
                </View>
              </FadeInView>

              {!data.checkedInToday ? (
                <FadeInView delay={80}>
                  <Card className="border-lime/30 gap-md">
                    <Text className="font-heading-bold text-lime text-[17px] tracking-[0.5px] uppercase">Daily check-in</Text>
                    <View>
                      <Text className="font-heading-semibold text-muted-text text-[12px] tracking-[0.5px] uppercase mb-sm">Mood</Text>
                      <View className="flex-row gap-sm">
                        {MOODS.map((mood) => {
                          const selected = selectedMood === mood.value;
                          return (
                            <Pressable
                              key={mood.value}
                              onPress={() => { setSelectedMood(mood.value); setCheckInError(null); }}
                              disabled={checkingIn}
                              accessibilityRole="radio"
                              accessibilityState={{ checked: selected }}
                              accessibilityLabel={`Mood: ${mood.label}`}
                              className={`flex-1 min-h-[52px] rounded-button border items-center justify-center ${selected ? 'bg-lime border-lime' : 'border-border bg-muted/40'} disabled:opacity-50`}
                            >
                              <Text className={`font-heading-bold text-[16px] uppercase ${selected ? 'text-dark' : 'text-white'}`}>{mood.value}</Text>
                              <Text className={`font-body text-[10px] ${selected ? 'text-dark/70' : 'text-muted-text'}`}>{mood.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View className="flex-row items-end gap-md">
                      <View className="w-[104px]">
                        <Text className="font-heading-semibold text-muted-text text-[12px] tracking-[0.5px] uppercase mb-sm">Sleep (h)</Text>
                        <TextInput
                          value={sleep}
                          onChangeText={(value) => { setSleep(value); setCheckInError(null); }}
                          placeholder="7.5"
                          placeholderTextColor={colors.tertiaryText}
                          keyboardType="decimal-pad"
                          editable={!checkingIn}
                          maxLength={4}
                          className="h-[48px] rounded-button border border-border bg-muted/40 px-md text-white text-[16px] font-body"
                        />
                      </View>
                      <View className="flex-1">
                        <LimeButton label="Save" onPress={() => void handleCheckIn()} loading={checkingIn} />
                      </View>
                    </View>
                    {checkInError ? <Text className="font-body text-[#F87171] text-[14px] leading-[20px]">{checkInError}</Text> : null}
                  </Card>
                </FadeInView>
              ) : null}

              <FadeInView delay={130}>
                <View className="bg-lime rounded-card p-lg">
                  <Text className="font-heading-bold text-dark text-[15px] tracking-[1px] uppercase mb-md">Dad score</Text>
                  <View className="flex-row gap-lg items-center">
                    <View className="h-[92px] w-[92px] rounded-full border-[5px] border-dark items-center justify-center">
                      <Text className="font-heading text-dark text-[42px] leading-[42px]">{score}</Text>
                      <Text className="font-heading-semibold text-dark/60 text-[9px] tracking-[1px] uppercase">Score</Text>
                    </View>
                    <View className="flex-1 gap-sm">
                      {([
                        ['Mind', data.mindScore],
                        ['Body', data.bodyScore],
                        ['Bond', data.bondScore],
                      ] as Array<[string, number]>).map(([label, value]) => (
                        <View key={label as string}>
                          <View className="flex-row justify-between mb-xs">
                            <Text className="font-heading-bold text-dark/70 text-[11px] tracking-[0.5px] uppercase">{label}</Text>
                            <Text className="font-heading-bold text-dark/70 text-[11px]">{value}%</Text>
                          </View>
                          <View className="h-[6px] rounded-full bg-dark/15 overflow-hidden">
                            <View className="h-[6px] rounded-full bg-dark" style={{ width: `${value}%` as `${number}%` }} />
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </FadeInView>

              <FadeInView delay={180}>
                <SectionTitle>Today's plan</SectionTitle>
                {data.goals.length === 0 ? (
                  <Text className="font-body text-muted-text text-[14px] leading-[21px] mt-md">Start by adding your first goal.

Small daily wins build momentum.</Text>
                ) : (
                  <View className="mt-md border-t border-lime/20">
                    {data.goals.map((goal) => {
                      const detail = goalDetails(goal);
                      const complete = completedGoals[goal] === true;
                      return (
                        <View key={goal} className="flex-row items-center gap-md py-md border-b border-lime/20">
                          <View className="h-[42px] w-[42px] rounded-button bg-lime/10 items-center justify-center">
                            <Feather name={detail.icon} size={20} color={colors.lime} />
                          </View>
                          <View className="flex-1">
                            <Text className="font-heading-bold text-white text-[17px] leading-[19px] uppercase">{goal}</Text>
                            <Text className="font-body text-muted-text text-[11px] tracking-[0.5px] uppercase mt-xs">Today · {detail.pillar}</Text>
                          </View>
                          <Pressable
                            onPress={() => setCompletedGoals((current) => ({ ...current, [goal]: !complete }))}
                            accessibilityRole="button"
                            accessibilityLabel={`${complete ? 'Restart' : 'Complete'} ${goal}`}
                            className={`min-w-[68px] rounded-button border px-sm py-sm items-center ${complete ? 'bg-lime border-lime' : 'border-lime'}`}
                          >
                            <Text className={`font-heading-bold text-[10px] tracking-[0.5px] uppercase ${complete ? 'text-dark' : 'text-lime'}`}>{complete ? 'Done' : 'Start'}</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </FadeInView>

              <FadeInView delay={230}>
                <SectionTitle>Mood this week</SectionTitle>
                <Card className="mt-md">
                  <View className="h-[120px] flex-row items-end justify-between gap-sm">
                    {dates.map((date, index) => {
                      const value = weekMoodValues[index];
                      const height: `${number}%` = value > 0 ? `${Math.max(20, value * 25)}%` : '8%';
                      return (
                        <View key={dateKey(date)} className="flex-1 items-center h-full justify-end gap-sm">
                          <View className="w-full max-w-[24px] h-[92px] rounded-full bg-muted justify-end overflow-hidden">
                            <View className={`w-full rounded-full ${value > 0 ? 'bg-lime' : 'bg-border'}`} style={{ height }} />
                          </View>
                          <Text className="font-heading-semibold text-muted-text text-[11px] uppercase">{date.toLocaleDateString('en-GB', { weekday: 'short' }).charAt(0)}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <Text className="font-body text-muted-text text-[14px] mt-md">
                    Avg mood: <Text className="font-body-semibold text-lime">{averageMood === null ? 'No check-ins yet' : `${averageMood.toFixed(1)} / 4`}</Text>
                  </Text>
                </Card>
              </FadeInView>

              <FadeInView delay={280}>
                <SectionTitle>Smart reminders</SectionTitle>
                {data.reminders.length === 0 ? (
                  <Text className="font-body text-muted-text text-[14px] mt-md">You're all caught up today.

New reminders will appear here.</Text>
                ) : (
                  <View className="mt-md gap-sm">
                    {data.reminders.map((reminder) => (
                      <Card key={reminder.id} className="flex-row items-center gap-md py-md">
                        <Feather name="bell" size={19} color={colors.lime} />
                        <Text className="flex-1 font-body text-white text-[14px] leading-[20px]">{reminder.text}</Text>
                        {reminder.time ? <Text className="font-heading-semibold text-muted-text text-[11px] uppercase">{reminder.time.slice(0, 5)}</Text> : null}
                      </Card>
                    ))}
                  </View>
                )}
              </FadeInView>

              <FadeInView delay={330}>
                <Card className="border-lime/30">
                  <Text className="font-heading-bold text-lime text-[13px] tracking-label uppercase">This week's challenge</Text>
                  <Text className="font-heading-bold text-white text-[24px] leading-[26px] uppercase mt-sm">{data.challenge?.title ?? 'Next challenge coming soon.'}</Text>
                  <Text className="font-body text-muted-text text-[14px] mt-sm">{data.challenge ? `${data.challenge.participants_count ?? 0} dads taking part` : "We'll notify you when the next challenge goes live."}</Text>
                  <Pressable
                    onPress={onGoProgress}
                    className="self-start border border-lime rounded-button px-md py-sm mt-md active:bg-lime/10"
                    accessibilityRole="button"
                    accessibilityLabel="Take action"
                  >
                    <Text className="font-heading-bold text-lime text-[12px] tracking-[0.5px] uppercase">Take action →</Text>
                  </Pressable>
                </Card>
              </FadeInView>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <AccountSheet visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </SafeAreaView>
  );
}

function PublicHome() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const openSignIn = () => navigation.navigate('Login');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-baseline">
            <Text className="font-heading text-lime text-[24px] leading-[25px] uppercase">Dad</Text>
            <Text className="font-heading text-white text-[24px] leading-[25px] uppercase"> Health</Text>
          </View>
          <Pressable
            onPress={openSignIn}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            className="border border-lime rounded-button px-md py-sm active:bg-lime/10"
          >
            <Text className="font-heading-bold text-lime text-[12px] tracking-[0.5px] uppercase">Sign in</Text>
          </Pressable>
        </View>

        <FadeInView>
          <Text className="font-heading-semibold text-lime text-[13px] tracking-label uppercase mb-md">Built for dads, by dads</Text>
          <Text className="font-heading text-white text-[48px] leading-[46px] uppercase">Show up for{`\n`}yourself too.</Text>
          <Text className="font-body text-muted-text text-[16px] leading-[24px] mt-md">A daily home for your mind, body and bond with the people who matter most.</Text>
        </FadeInView>

        <FadeInView delay={90}>
          <View className="flex-row gap-sm">
            {[
              ['Mind', 'heart'],
              ['Fitness', 'activity'],
              ['Bond', 'users'],
            ].map(([title, icon]) => (
              <View key={title} className="flex-1 h-[116px] rounded-card border border-border bg-card p-md justify-between">
                <View className="h-[36px] w-[36px] rounded-button bg-lime/10 items-center justify-center">
                  <Feather name={icon as GoalIcon} size={18} color={colors.lime} />
                </View>
                <View>
                  <Text className="font-heading-bold text-white text-[19px] leading-[20px] uppercase">{title}</Text>
                </View>
              </View>
            ))}
          </View>
        </FadeInView>

        <FadeInView delay={160}>
          <View className="bg-lime rounded-card p-lg">
            <View className="flex-row items-start justify-between gap-md">
              <View className="flex-1">
                <Text className="font-heading text-dark text-[34px] leading-[34px] uppercase">Your daily hub is ready.</Text>
                <Text className="font-body text-dark/70 text-[15px] leading-[22px] mt-sm">Track how you are doing, keep a simple plan, and build momentum one day at a time.</Text>
              </View>
              <View className="h-[42px] w-[42px] rounded-button bg-dark/10 items-center justify-center">
                <Feather name="arrow-up-right" size={21} color={colors.dark} />
              </View>
            </View>
            <Pressable onPress={openSignIn} accessibilityRole="button" className="mt-lg self-start rounded-button bg-dark px-lg py-md active:opacity-80">
              <Text className="font-heading-bold text-lime text-[14px] tracking-[0.5px] uppercase">Create your account</Text>
            </Pressable>
          </View>
        </FadeInView>

        <FadeInView delay={230}>
          <View className="border-t border-border pt-lg">
            <Text className="font-heading-bold text-white text-[24px] leading-[25px] uppercase">Built around real life.</Text>
            <Text className="font-body text-muted-text text-[15px] leading-[23px] mt-sm">No perfect routine required. Just useful tools, honest progress, and a community that gets it.</Text>
            <View className="flex-row gap-md mt-lg">
              <View className="flex-1 border-l-2 border-lime pl-sm">
                <Text className="font-heading text-lime text-[26px] leading-[27px]">1 IN 8</Text>
                <Text className="font-body text-muted-text text-[12px] leading-[17px] mt-xs">UK men have experienced mental health symptoms.</Text>
              </View>
              <View className="flex-1 border-l-2 border-lime pl-sm">
                <Text className="font-heading text-lime text-[26px] leading-[27px]">ONE DAY</Text>
                <Text className="font-body text-muted-text text-[12px] leading-[17px] mt-xs">is all it takes to begin building momentum.</Text>
              </View>
            </View>
          </View>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}
