import React, { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';

import Card from '../components/Card';
import type { DashboardSection } from '../components/AccountSheet';
import CrisisRow from '../components/mockup/CrisisRow';
import FadeInView from '../components/FadeInView';
import MoodWeekCard from '../components/dashboard/MoodWeekCard';
import PillarCard from '../components/mockup/PillarCard';
import PillarScreen from '../components/PillarScreen';
import PillarSkeleton from '../components/skeleton/PillarSkeleton';
import ScreenHero from '../components/mockup/ScreenHero';
import StatTile from '../components/mockup/StatTile';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
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
          sub="Opening up is not weakness. It's the strongest thing a dad can do."
        />
      </FadeInView>

      <FadeInView delay={90}>
        <View className="gap-md">
          <PillarCard
            lime
            emoji="🧘"
            title="4-4-4 Breathing"
            description="Inhale 4 - Hold 4 - Exhale 4. Helps lower stress."
          />
          <PillarCard
            emoji="✍️"
            title="Journal"
            description="Daily prompts. Private entries. Just for you."
          />
          <PillarCard
            emoji="🩺"
            title="Find a therapist"
            description="Filtered for dads. Evening and weekend slots. People who get it."
          />
        </View>
      </FadeInView>

      <FadeInView delay={140}>
        <View className="flex-row gap-sm">
          <StatTile value="1 in 8" label="UK men experiencing mental health symptoms" />
          <StatTile value="4 in 10" label="won't tell a single person" />
        </View>
      </FadeInView>

      <FadeInView delay={190}>
        <Card className="gap-sm">
          <Text className="font-heading-bold text-white/60 text-[11px] tracking-label uppercase">
            Evening journal
          </Text>
          <Text className="font-body text-white/50 text-[13px] leading-[19px]">
            "What's one moment today where you were the dad you want to be?"
          </Text>
        </Card>
      </FadeInView>

      <FadeInView delay={240}>
        <MoodWeekCard values={moodWeek} labels={MOOD_WEEK_LABELS} summary={moodSummary} />
      </FadeInView>

      <FadeInView delay={290}>
        <CrisisRow />
      </FadeInView>
    </PillarScreen>
  );
}
