import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import ActivityCard from '../components/mockup/ActivityCard';
import BondScoreCard from '../components/bond/BondScoreCard';
import type { DashboardSection } from '../components/AccountSheet';
import FadeInView from '../components/FadeInView';
import PillarCard from '../components/mockup/PillarCard';
import PillarScreen from '../components/PillarScreen';
import PillarSkeleton from '../components/skeleton/PillarSkeleton';
import ScreenHero from '../components/mockup/ScreenHero';
import FilterChips from '../components/mockup/FilterChips';
import SectionHeader from '../components/dashboard/SectionHeader';
import ToggleRow from '../components/mockup/ToggleRow';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { dashboardIcon } from '../lib/dashboardIcons';
import { trackEvent } from '../lib/analytics';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import type { AppStackParamList } from '../navigation/AppNavigator';

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
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data, loading, error, refresh } = useDashboard(user?.id);
  // Web keeps Present Dad Mode in local state too (app/bond/BondPageContent.tsx).
  const [presentMode, setPresentMode] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [dadDatesOpen, setDadDatesOpen] = useState(false);
  const [startersOpen, setStartersOpen] = useState(false);
  const [conversationStarters, setConversationStarters] = useState<string[]>([]);
  const [startersLoading, setStartersLoading] = useState(Boolean(user?.id));
  const [startersError, setStartersError] = useState(false);

  const hasUser = Boolean(user?.id);
  const onRefresh = useCallback(() => void refresh(), [refresh]);
  const togglePresentMode = useCallback(() => {
    const enabled = !presentMode;
    setPresentMode(enabled);
    trackEvent('present_dad_mode_toggled', { enabled }, user?.id);
  }, [presentMode, user?.id]);

  const loadConversationStarters = useCallback(async () => {
    if (!user?.id) {
      setConversationStarters([]);
      setStartersLoading(false);
      return;
    }
    setStartersLoading(true);
    setStartersError(false);
    const { data: prompts, error: promptError } = await supabase.from('age_prompts').select('prompt');
    if (promptError) {
      setStartersError(true);
      setConversationStarters([]);
    } else {
      setConversationStarters((prompts ?? []).flatMap((row: { prompt: unknown }) => typeof row.prompt === 'string' && row.prompt.trim() ? [row.prompt] : []));
    }
    setStartersLoading(false);
  }, [user?.id]);

  useEffect(() => { void loadConversationStarters(); }, [loadConversationStarters]);

  const bondScore = useMemo(
    () => (typeof data?.bondScore === 'number' ? Math.round(data.bondScore) : null),
    [data?.bondScore],
  );

  const dadDates = useMemo(() => data?.dadDates ?? [], [data?.dadDates]);
  const dateFilters = useMemo(() => {
    const options = [{ value: 'all', label: 'All' }];
    if (dadDates.some((item) => item.budget?.toLowerCase() === 'free')) options.push({ value: 'free', label: 'Free' });
    if (dadDates.some((item) => item.budget?.includes('£') && Number.parseInt(item.budget, 10) <= 15)) options.push({ value: 'under-15', label: 'Under £15' });
    if (dadDates.some((item) => item.time?.includes('1 hr'))) options.push({ value: 'one-hour', label: '1 hr' });
    if (dadDates.some((item) => item.time?.toLowerCase().includes('evening'))) options.push({ value: 'evening', label: 'Evening' });
    return options;
  }, [dadDates]);
  const filteredDadDates = useMemo(() => dadDates.filter((item) => {
    if (dateFilter === 'all') return true;
    if (dateFilter === 'free') return item.budget?.toLowerCase() === 'free';
    if (dateFilter === 'under-15') return item.budget?.includes('£') && Number.parseInt(item.budget, 10) <= 15;
    if (dateFilter === 'one-hour') return item.time?.includes('1 hr');
    if (dateFilter === 'evening') return item.time?.toLowerCase().includes('evening');
    return true;
  }), [dadDates, dateFilter]);

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
          eyebrow="The Bond"
          headline="Parenting"
          sub="Built for dads, by dads. Kill the old version of you."
        />
      </FadeInView>

      <FadeInView delay={90}>
        <BondScoreCard score={bondScore ?? 0} />
      </FadeInView>

      <FadeInView delay={140}>
        <Pressable
          onPress={() => navigation.navigate('DadDaysSearch')}
          accessibilityRole="button"
          accessibilityLabel="Find Dad Days near you"
          className="min-h-[86px] flex-row items-center gap-md rounded-button border border-lime/25 bg-lime/5 px-md py-md active:opacity-75"
        >
          <View className="h-[42px] w-[42px] rounded-full bg-lime items-center justify-center">
            <Feather name="map-pin" size={19} color={colors.dark} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="font-heading-bold text-white text-[17px] uppercase">Find Dad Days near you</Text>
            <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-xs">Search by age, budget and distance.</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.lime} />
        </Pressable>
      </FadeInView>

      <FadeInView delay={190}>
        <Pressable onPress={() => setDadDatesOpen((open) => !open)} accessibilityRole="button" accessibilityState={{ expanded: dadDatesOpen }} accessibilityLabel="Dad date ideas" className="min-h-[44px] flex-row items-center justify-between mb-md active:opacity-75">
          <Text className="font-heading-bold text-white text-[22px] leading-[24px] tracking-[0.5px] uppercase">Dad date ideas</Text>
          <Feather name={dadDatesOpen ? 'chevron-down' : 'chevron-right'} size={22} color={colors.lime} />
        </Pressable>
        {dadDatesOpen ? (
          <View>
            {dateFilters.length > 1 ? <View className="mb-md"><FilterChips options={dateFilters} selected={dateFilter} onSelect={setDateFilter} /></View> : null}
            {filteredDadDates.length === 0 ? (
              <Text className="font-body text-muted-text text-[14px]">No dad dates yet</Text>
            ) : (
              <View className="gap-sm">
                {filteredDadDates.map((dadDate) => (
                  <Pressable key={dadDate.id} onPress={() => trackEvent('dad_date_clicked', { name: dadDate.name, age_range: dadDate.age_range, budget: dadDate.budget }, user?.id)} accessibilityRole="button" accessibilityLabel={dadDate.name} className="active:opacity-75">
                    <ActivityCard
                      leading={<Feather name={dashboardIcon(dadDate.icon ?? 'gaming')} size={20} color={colors.lime} />}
                      name={dadDate.name}
                      badges={[`Age ${dadDate.age_range ?? 0}`, dadDate.budget ?? '0', ...(dadDate.time ? [dadDate.time] : [])]}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </FadeInView>

      <FadeInView delay={240}>
        <SectionHeader title="Cook together" className="mb-md" />
        <Pressable onPress={() => navigation.navigate('CookTogether')} accessibilityRole="button" accessibilityLabel="Open Cook Together recipes" className="min-h-[92px] flex-row items-center gap-md rounded-button border border-lime/25 bg-card px-md py-md active:opacity-75">
          <View className="h-[42px] w-[42px] rounded-full bg-lime items-center justify-center"><Feather name="coffee" size={19} color={colors.dark} /></View>
          <View className="flex-1"><Text className="font-heading-bold text-white text-[17px] uppercase">Meals that matter</Text><Text className="font-body text-muted-text text-[12px] leading-[18px] mt-xs">Cook with your kids and build connection.</Text></View>
          <Feather name="chevron-right" size={20} color={colors.lime} />
        </Pressable>
      </FadeInView>

      <FadeInView delay={290}>
        <PillarCard
          emoji="📅"
          title="Co-parenting calendar"
          description="Every day, 50/50, weekends — Bond score adapts to your situation"
          onPress={() => navigation.navigate('SharedCalendar')}
          accessibilityLabel="Open co-parenting calendar"
        />
      </FadeInView>

      <FadeInView delay={320}>
        <PillarCard
          emoji="🏆"
          title="Milestone tracker"
          description="Log the moments that matter. First bike ride. Said I love you unprompted."
          onPress={() => navigation.navigate('MilestoneTracker')}
          accessibilityLabel="Open milestone tracker"
        />
      </FadeInView>

      <FadeInView delay={350}>
        <ToggleRow
          title="Present Dad Mode"
          subtitle="Block distractions for 60 minutes"
          value={presentMode}
          onToggle={togglePresentMode}
        />
      </FadeInView>

      <FadeInView delay={380}>
        <Pressable onPress={() => setStartersOpen((open) => !open)} accessibilityRole="button" accessibilityState={{ expanded: startersOpen }} accessibilityLabel="Conversation starters" className="min-h-[44px] flex-row items-center justify-between active:opacity-75">
          <Text className="font-heading-bold text-white text-[22px] leading-[24px] uppercase">Conversation starters</Text>
          <Feather name={startersOpen ? 'chevron-down' : 'chevron-right'} size={22} color={colors.lime} />
        </Pressable>
        {startersOpen ? <View className="mt-md gap-sm">{startersLoading ? <View className="h-[56px] bg-white/5" /> : startersError ? <View className="gap-md border-l-[3px] border-l-red-300 pl-md"><Text className="font-body text-muted-text text-[13px]">Conversation starters are unavailable.</Text><Pressable onPress={() => void loadConversationStarters()}><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable></View> : conversationStarters.length === 0 ? <Text className="font-body text-muted-text text-[14px]">No conversation starters yet.</Text> : conversationStarters.map((prompt) => <View key={prompt} className="border-b border-border border-l-[3px] border-l-lime py-md pl-md"><Text className="font-body text-tertiary-text text-[14px] leading-[20px] italic">"{prompt}"</Text></View>)}</View> : null}
      </FadeInView>
    </PillarScreen>
  );
}
