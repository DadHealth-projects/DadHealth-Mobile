import React, { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ActivityCard from '../components/mockup/ActivityCard';
import type { DashboardSection } from '../components/AccountSheet';
import Card from '../components/Card';
import DadScoreCard from '../components/dashboard/DadScoreCard';
import FadeInView from '../components/FadeInView';
import PillarCard from '../components/mockup/PillarCard';
import PillarScreen from '../components/PillarScreen';
import PillarSkeleton from '../components/skeleton/PillarSkeleton';
import ScreenHero from '../components/mockup/ScreenHero';
import SectionHeader from '../components/dashboard/SectionHeader';
import TagPill from '../components/dashboard/TagPill';
import ToggleRow from '../components/mockup/ToggleRow';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { dashboardIcon } from '../lib/dashboardIcons';
import { CAPS } from '../lib/dashboardCaps';
import { getScoreBreakdown } from '../lib/dashboard.utils';
import { colors } from '../theme';

/** Mockup 3's feature rows — copy from the mockup, behaviour from the web Bond page. */
const BOND_FEATURES = [
  {
    emoji: '📅',
    title: 'Custody patterns',
    description: 'Every day, 50/50, weekends — Bond score adapts to your situation',
  },
  {
    emoji: '🏆',
    title: 'Milestone tracker',
    description: 'Log the moments that matter. First bike ride. Said I love you unprompted.',
  },
  {
    emoji: '📞',
    title: 'Non-contact days',
    description: "Score based on remote bonding — you're never penalised for time you don't have",
  },
] as const;

/**
 * Bond tab — the web dashboard BOND screen's features
 * (`dashboardPreview/BondScreen.tsx`: dad date ideas, cook together, milestones,
 * conversation starter) plus the web Bond page's Present Dad Mode, in Mockup 3's
 * layout (lime Bond-score bar → feature rows → toggle → content).
 */
export default function BondScreen({
  dashboardSection,
  onSelectDashboardSection,
}: {
  dashboardSection?: DashboardSection;
  onSelectDashboardSection?: (section: DashboardSection) => void;
} = {}) {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useDashboard(user?.id);
  // Web keeps Present Dad Mode in local state too (app/bond/BondPageContent.tsx).
  const [presentMode, setPresentMode] = useState(false);

  const hasUser = Boolean(user?.id);
  const onRefresh = useCallback(() => void refresh(), [refresh]);
  const togglePresentMode = useCallback(() => setPresentMode((current) => !current), []);

  const scoreItems = useMemo(() => {
    const breakdown = getScoreBreakdown(
      {
        mind_score: data?.mindScore ?? null,
        body_score: data?.bodyScore ?? null,
        bond_score: data?.bondScore ?? null,
      },
      Boolean(data),
    );
    return [
      { label: 'Mind', value: breakdown.mind },
      { label: 'Body', value: breakdown.body },
      { label: 'Bond', value: breakdown.bond },
    ];
  }, [data]);

  const bondScore = useMemo(
    () => (typeof data?.bondScore === 'number' ? Math.round(data.bondScore) : null),
    [data?.bondScore],
  );

  const dadDates = useMemo(() => (data?.dadDates ?? []).slice(0, CAPS.dadDates), [data?.dadDates]);
  const milestones = useMemo(
    () => (data?.milestones ?? []).slice(0, CAPS.milestones),
    [data?.milestones],
  );

  return (
    <PillarScreen
      loading={loading && !data}
      skeleton={<PillarSkeleton score cards={3} />}
      refreshing={loading}
      onRefresh={hasUser ? onRefresh : undefined}
      error={data ? null : error}
      onRetry={onRefresh}
      dashboardSection={dashboardSection}
      onSelectDashboardSection={onSelectDashboardSection}
    >
      <FadeInView>
        <ScreenHero
          eyebrow="Bond tracker"
          headline={'Track what\nactually'}
          accent="matters."
          sub="Quality time. Real conversations. Presence — not just proximity."
        />
      </FadeInView>

      <FadeInView delay={90}>
        <DadScoreCard
          score={bondScore}
          items={scoreItems}
          scoreLabel="Bond score"
          ring={false}
          missingScore={0}
        />
      </FadeInView>

      <FadeInView delay={140}>
        <View className="gap-sm">
          {BOND_FEATURES.map((feature) => (
            <PillarCard
              key={feature.title}
              emoji={feature.emoji}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </View>
      </FadeInView>

      <FadeInView delay={190}>
        <ToggleRow
          title="Present Dad Mode"
          subtitle="Block distractions. 60 minutes. Just you and them."
          value={presentMode}
          onToggle={togglePresentMode}
        />
      </FadeInView>

      <FadeInView delay={240}>
        <SectionHeader title="Dad date ideas" className="mb-md" />
        {dadDates.length === 0 ? (
          <Text className="font-body text-white/50 text-[14px]">No dad dates yet</Text>
        ) : (
          <View className="gap-sm">
            {dadDates.map((dadDate) => (
              <ActivityCard
                key={dadDate.id}
                leading={
                  <Feather name={dashboardIcon(dadDate.icon ?? 'gaming')} size={20} color={colors.lime} />
                }
                name={dadDate.name}
                badges={[
                  `Age ${dadDate.age_range ?? 0}`,
                  dadDate.budget ?? '0',
                  ...(dadDate.time ? [dadDate.time] : []),
                ]}
              />
            ))}
          </View>
        )}
      </FadeInView>

      {data?.mealPlan ? (
        <FadeInView delay={290}>
          <SectionHeader title="Cook together" className="mb-md" />
          <Card className="gap-xs">
            <Text className="font-heading-bold text-white text-[16px] tracking-[0.5px] uppercase">
              Cook Together: {data.mealPlan.title}
            </Text>
            <Text className="font-body text-white/45 text-[12px]">{data.mealPlan.time}</Text>
            {data.mealPlan.loggedDate ? (
              <Text className="font-body text-white/30 text-[11px]">
                Logged {data.mealPlan.loggedDate}
              </Text>
            ) : null}
          </Card>
        </FadeInView>
      ) : null}

      <FadeInView delay={330}>
        <SectionHeader title="Milestones" className="mb-md" />
        {milestones.length === 0 ? (
          <Text className="font-body text-white/50 text-[14px]">No milestones yet</Text>
        ) : (
          <View className="gap-sm">
            {milestones.map((milestone) => (
              <Card key={milestone.id} className="flex-row items-center gap-md py-md">
                <TagPill
                  label={new Date(milestone.date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                />
                <Text className="flex-1 font-body text-white/70 text-[13px] leading-[19px]">
                  {milestone.text}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </FadeInView>

      <FadeInView delay={380}>
        <View className="border-l-[3px] border-l-lime pl-md">
          <Text className="font-body text-white/50 text-[14px] leading-[20px] italic">
            "What made you laugh the hardest today?"
          </Text>
          <Text className="font-body text-white/30 text-[11px] mt-xs">Conversation starter</Text>
        </View>
      </FadeInView>
    </PillarScreen>
  );
}
