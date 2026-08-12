import React, { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import type { DashboardSection } from '../components/AccountSheet';
import CrisisSupportRow from '../components/mockup/CrisisSupportRow';
import FadeInView from '../components/FadeInView';
import LimeButton from '../components/LimeButton';
import MoodWeekCard from '../components/dashboard/MoodWeekCard';
import PillarScreen from '../components/PillarScreen';
import PillarSkeleton from '../components/skeleton/PillarSkeleton';
import ScreenHero from '../components/mockup/ScreenHero';
import StatTile from '../components/mockup/StatTile';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';
import {
  MOOD_WEEK_LABELS,
  getLastSevenDayKeys,
  getMoodSummary,
  getMoodWeek,
} from '../lib/dashboard.utils';

/**
 * Mind tab — the web dashboard MIND screen's features
 * (`dashboardPreview/MindScreen.tsx`: 4-4-4 breathing, evening journal, crisis
 * support, mood this week) in Mockup 2's layout, with the mockup's copy and
 * stat tiles.
 */
export default function MindScreen({
  dashboardSection,
  onSelectDashboardSection,
}: {
  dashboardSection?: DashboardSection;
  onSelectDashboardSection?: (section: DashboardSection) => void;
} = {}) {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data, loading, error, refresh } = useDashboard(user?.id);

  const hasUser = Boolean(user?.id);
  const onRefresh = useCallback(() => void refresh(), [refresh]);

  const moodWeek = useMemo(
    () => getMoodWeek(data?.moodLogs ?? [], getLastSevenDayKeys()),
    [data?.moodLogs],
  );
  const moodSummary = useMemo(() => getMoodSummary(moodWeek, Boolean(data)), [moodWeek, data]);

  return (
    <PillarScreen
      loading={loading && !data}
      skeleton={<PillarSkeleton cards={3} />}
      refreshing={loading}
      onRefresh={hasUser ? onRefresh : undefined}
      error={data ? null : error}
      onRetry={onRefresh}
      dashboardSection={dashboardSection}
      onSelectDashboardSection={onSelectDashboardSection}
    >
      <FadeInView>
        <ScreenHero
          eyebrow="Mental health"
          headline={"It's okay to\nnot be okay."}
          sub="Opening up about feelings and seeking help is not a sign of weakness, but of strength."
        />
      </FadeInView>

      <FadeInView delay={90}>
        <View className="flex-row gap-sm">
          <StatTile value="1 in 8" label="UK men experiencing mental health symptoms" />
          <StatTile value="4 in 10" label="won't tell a single person" />
        </View>
      </FadeInView>

      <FadeInView delay={140}>
        {!user ? (
          <MoodAccessPanel
            title="Login required"
            description="Log in to view your seven-day mood trend."
            actionLabel="Log in"
            onPress={() => navigation.navigate('Login')}
          />
        ) : !data?.isPro ? (
          <MoodAccessPanel
            title="Mood this week"
            description="Seven-day mood trends are included with Dad Health Pro."
            actionLabel="View Dad Health Pro"
            onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
          />
        ) : (
          <MoodWeekCard values={moodWeek} labels={MOOD_WEEK_LABELS} summary={moodSummary} />
        )}
      </FadeInView>

      <FadeInView delay={190}>
        <View className="gap-sm">
          <MindFeatureRow
            icon="wind"
            title="4-4-4 Breathing"
            description="Inhale 4. Hold 4. Exhale 4."
            onPress={() => navigation.navigate('BreathingSession')}
            accessibilityLabel="Open 4-4-4 breathing session"
            featured
          />
          <MindFeatureRow
            icon="edit-3"
            title="Journal"
            description="Daily prompts. Private entries. Just for you."
            onPress={() => navigation.navigate('Journal')}
            accessibilityLabel="Open private journal"
          />
          <MindFeatureRow
            icon="heart"
            title="Find a therapist"
            description="Filtered for dads. Evening and weekend slots. People who get it."
            onPress={() => navigation.navigate('TherapistDirectory')}
            accessibilityLabel="Open therapist directory"
          />
        </View>
      </FadeInView>

      <FadeInView delay={290}>
        <CrisisSupportRow />
      </FadeInView>
    </PillarScreen>
  );
}

function MoodAccessPanel({
  title,
  description,
  actionLabel,
  onPress,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View className="gap-md rounded-button border border-border bg-card p-md">
      <View className="flex-row items-start gap-md">
        <View className="h-[40px] w-[40px] rounded-full bg-lime/10 items-center justify-center">
          <Feather name="bar-chart-2" size={18} color={colors.lime} />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="font-heading-bold text-white text-[17px] uppercase">{title}</Text>
          <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-xs">{description}</Text>
        </View>
        <Feather name="lock" size={17} color={colors.lime} />
      </View>
      <LimeButton label={actionLabel} onPress={onPress} />
    </View>
  );
}

function MindFeatureRow({
  icon,
  title,
  description,
  featured = false,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  featured?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const content = (
    <View className={`min-h-[86px] flex-row items-center gap-md rounded-button border px-md py-md ${featured ? 'border-lime/25 bg-lime/5' : 'border-border bg-card'}`}>
      <View className={`h-[42px] w-[42px] rounded-full items-center justify-center ${featured ? 'bg-lime' : 'bg-white/5'}`}>
        <Feather name={icon} size={19} color={featured ? colors.dark : colors.lime} />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="font-heading-bold text-white text-[17px] uppercase">{title}</Text>
        <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-xs">{description}</Text>
      </View>
      {onPress ? <Feather name="chevron-right" size={20} color={colors.lime} /> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} className="active:opacity-75">
      {content}
    </Pressable>
  );
}
