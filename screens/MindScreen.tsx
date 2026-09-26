import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import type { DashboardSection } from '../components/AccountSheet';
import FadeInView from '../components/FadeInView';
import InlineFormError from '../components/InlineFormError';
import LimeButton from '../components/LimeButton';
import MoodWeekCard from '../components/dashboard/MoodWeekCard';
import MiniBarChart from '../components/dashboard/MiniBarChart';
import SectionHeader from '../components/dashboard/SectionHeader';
import MindSessionModal, { type MindSessionKind } from '../components/mind/MindSessionModal';
import PersonalisedMindPlanSheet from '../components/mind/PersonalisedMindPlanSheet';
import StatTile from '../components/mockup/StatTile';
import PillarScreen from '../components/PillarScreen';
import PillarSkeleton from '../components/skeleton/PillarSkeleton';
import ProUpgradeSection from '../components/ProUpgradeSection';
import ScreenHero from '../components/mockup/ScreenHero';
import { useAuth } from '../contexts/AuthContext';
import { useNetworkStatus } from '../contexts/NetworkContext';
import { useDashboard } from '../hooks/useDashboard';
import { useProgressSleep } from '../hooks/useProgressSleep';
import { PRO_LOCKS } from '../lib/proMoments';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';
import { STATS_EXTENDED } from '../lib/homeContent';
import {
  MOOD_WEEK_LABELS,
  getCurrentWeekDayKeys,
  getMoodSummary,
  getMoodWeek,
} from '../lib/dashboard.utils';

/**
 * Mind tab — the web dashboard MIND screen's features
 * (`dashboardPreview/MindScreen.tsx`: 4-4-4 breathing, evening journal,
 * mood this week) in Mockup 2's layout, with the mockup's copy and
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
  const { isOffline } = useNetworkStatus();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data, loading, error, refresh } = useDashboard(user?.id);
  const sleepInsights = useProgressSleep(user?.id);
  const refreshInFlight = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mindSession, setMindSession] = useState<MindSessionKind | null>(null);
  const [mindPlanOpen, setMindPlanOpen] = useState(false);

  const hasUser = Boolean(user?.id);
  const onRefresh = useCallback(async () => {
    if (!hasUser || refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await Promise.all([refresh(), sleepInsights.refresh()]);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [hasUser, refresh, sleepInsights.refresh]);

  const moodWeek = useMemo(
    () => getMoodWeek(data?.moodLogs ?? [], getCurrentWeekDayKeys()),
    [data?.moodLogs],
  );
  const moodSummary = useMemo(() => getMoodSummary(moodWeek, Boolean(data)), [moodWeek, data]);

  if (mindSession) {
    return (
      <MindSessionModal
        kind={mindSession}
        onClose={() => setMindSession(null)}
        onWriteToJournal={() => {
          setMindSession(null);
          navigation.navigate('Journal');
        }}
      />
    );
  }

  return (
    <PillarScreen
      loading={loading && !data}
      skeleton={<PillarSkeleton cards={3} />}
      refreshing={refreshing}
      onRefresh={hasUser ? onRefresh : undefined}
      errorMessage="We couldn't load Mind. Please try again."
      dashboardSection={dashboardSection}
      onSelectDashboardSection={onSelectDashboardSection}
    >
      <FadeInView>
        <ScreenHero
          eyebrow="Mental health"
          headline={"How are you feeling\nright now?"}
          sub="Opening up about feelings and seeking help is not a sign of weakness, but of strength."
        />
      </FadeInView>

      <FadeInView delay={80}>
        <View className="gap-md">
          <SectionHeader title="Mind facts" />
          <View className="flex-row gap-md">
            <StatTile value="1 in 8" label="UK men have experienced mental health symptoms" />
            <StatTile value={STATS_EXTENDED[2].value} label={STATS_EXTENDED[2].label} />
          </View>
        </View>
      </FadeInView>

      {user ? (
        <FadeInView delay={110}>
          <View className="gap-md border-b border-border pb-lg">
            <SectionHeader title="Sleep quality this week" />
            <MiniBarChart
              values={sleepInsights.days.map((day) => day.hours ?? 0)}
              labels={MOOD_WEEK_LABELS}
              maxValue={12}
            />
            <Text className="font-body text-muted-text text-[14px]">
              {sleepInsights.days.some((day) => day.hours != null)
                ? `Average sleep: ${(sleepInsights.days.reduce((sum, day) => sum + (day.hours ?? 0), 0) / Math.max(1, sleepInsights.days.filter((day) => day.hours != null).length)).toFixed(1)} hours`
                : 'Log sleep with your daily check-in to see this week.'}
            </Text>
          </View>
        </FadeInView>
      ) : null}

      <FadeInView delay={140}>
        <View className="gap-sm">
          <MindFeatureRow
            icon="wind"
            eyebrow="2 minutes"
            title="4-4-4 Breathing"
            description="Inhale 4. Hold 4. Exhale 4."
            onPress={() => navigation.navigate('BreathingSession')}
            accessibilityLabel="Open 4-4-4 breathing session"
            featured
          />
          <MindFeatureRow
            icon="refresh-cw"
            eyebrow="5 minutes"
            title="Reset exercise"
            description="A short, guided reset at your own pace."
            onPress={() => setMindSession('reset')}
            accessibilityLabel="Start the five-minute reset exercise"
          />
          <MindFeatureRow
            icon="book-open"
            eyebrow="10 minutes"
            title="Guided reflection"
            description="Step through a few prompts and write what feels useful."
            onPress={() => setMindSession('reflection')}
            accessibilityLabel="Start the ten-minute guided reflection"
          />
          <MindFeatureRow
            icon="edit-3"
            eyebrow="Private journal"
            title="Journal"
            description="Daily prompts. Private entries. Just for you."
            onPress={() => navigation.navigate('Journal')}
            accessibilityLabel="Open private journal"
          />
          <MindFeatureRow
            icon="heart"
            eyebrow="Talk to someone"
            title="Find a therapist"
            description="Filtered for dads. Evening and weekend slots. People who get it."
            onPress={() => navigation.navigate('TherapistDirectory')}
            accessibilityLabel="Open therapist directory"
          />
          <MindFeatureRow
            icon="users"
            eyebrow="I just need to talk"
            title="Community"
            description="Connect with dads going through the same chapter as you."
            onPress={() => navigation.navigate('CommunityFeed')}
            accessibilityLabel="Open Dad Health Community"
          />
        </View>
      </FadeInView>

      {user ? (
        <FadeInView delay={170}>
          {data?.isPro ? (
            <Pressable
              onPress={() => setMindPlanOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open your personalised Mind plan"
              className="gap-sm border-b border-border pb-lg active:opacity-75"
            >
              <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Pro</Text>
              <Text className="font-heading text-white text-[20px] leading-[22px] uppercase">Personalised Mind Plan</Text>
              <Text className="font-body text-muted-text text-[12px] leading-[18px]">
                Designed around your mood, Dad Health Score and history.
              </Text>
              <Text className="font-heading-bold text-lime text-[11px] uppercase">Open plan</Text>
            </Pressable>
          ) : (
            <ProUpgradeSection
              moment={PRO_LOCKS.mindPlan}
              onPress={() => navigation.navigate('ProSubscription')}
              size="sm"
            />
          )}
        </FadeInView>
      ) : null}

      {mindPlanOpen ? <PersonalisedMindPlanSheet onClose={() => setMindPlanOpen(false)} /> : null}

      {!isOffline && error ? <InlineFormError message={error} /> : null}

      <FadeInView delay={210}>
        {!user ? (
          <MoodAccessPanel
            title="Login required"
            description="Log in to view your mood and sleep this week."
            actionLabel="Log in"
            onPress={() => navigation.navigate('Login')}
          />
        ) : (
          <MoodWeekCard
            values={moodWeek}
            labels={MOOD_WEEK_LABELS}
            summary={moodSummary}
            flat
            actionLabel={!data?.isPro ? 'View mood trends' : undefined}
            onAction={!data?.isPro ? () => navigation.navigate('ProSubscription') : undefined}
          />
        )}
      </FadeInView>

      {user ? (
        <FadeInView delay={270}>
          <View className="gap-md border-b border-border pb-lg">
            <SectionHeader title="Mood correlation" caption="Pattern spotted" />
            {data?.isPro ? (
              <Text className="font-body text-muted-text text-[14px] leading-[21px]">{sleepInsights.pattern}</Text>
            ) : (
              <Pressable
                onPress={() => navigation.navigate('ProSubscription')}
                accessibilityRole="button"
                accessibilityLabel="Unlock mood correlation and pattern insights with Pro"
                className="flex-row items-center justify-between rounded-button border border-border bg-card px-md py-md active:opacity-75"
              >
                <View className="flex-1 gap-xs">
                  <Text className="font-heading-bold text-white text-[15px] uppercase">Pattern spotted</Text>
                  <Text className="font-body text-muted-text text-[12px] leading-[18px]">See how your mood and sleep patterns connect with Pro.</Text>
                </View>
                <Feather name="lock" size={18} color={colors.lime} />
              </Pressable>
            )}
          </View>
        </FadeInView>
      ) : null}

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
    <View className="gap-md border-b border-border pb-md">
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
  eyebrow,
  title,
  description,
  featured = false,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Feather.glyphMap;
  eyebrow?: string;
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
        {eyebrow ? (
          <Text className="font-body-semibold text-lime text-[10px] tracking-[1.4px] uppercase mb-xs">
            {eyebrow}
          </Text>
        ) : null}
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
