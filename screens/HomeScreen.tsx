import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import DadScoreCard from '../components/dashboard/DadScoreCard';
import FadeInView from '../components/FadeInView';
import LimeButton from '../components/LimeButton';
import MoodCheckInRow, { type MoodKey } from '../components/mockup/MoodCheckInRow';
import PillarCard from '../components/mockup/PillarCard';
import ScreenHero from '../components/mockup/ScreenHero';
import StatTile from '../components/mockup/StatTile';
import PublicHomeSkeleton from '../components/skeleton/PublicHomeSkeleton';
import { usePublicHome } from '../hooks/usePublicHome';
import { STATS_EXTENDED, PILLARS, type PillarTab } from '../lib/homeContent';
import type { AppStackParamList } from '../navigation/AppNavigator';
import type { BottomTabsParamList } from '../navigation/BottomTabNavigator';
import { colors } from '../theme';

/** Logged-out pillar cards — emoji per pillar, matching the mockups' icon style. */
const PILLAR_EMOJI: Record<PillarTab, string> = {
  Mind: '🧠',
  Fit: '💪',
  Bond: '👨‍👧',
};

type HomeNavigation = NavigationProp<AppStackParamList & BottomTabsParamList>;

/** Logged-out: the score ring shows `—` and the bars are zeroed, like the web. */
const EMPTY_SCORE_ITEMS = [
  { label: 'MIND', value: null },
  { label: 'BODY', value: null },
  { label: 'BOND', value: null },
];

/**
 * Public Home — a native first screen in the mockup design language (Mockup 1:
 * the Dad Health Score screen). Not a marketing landing page: a lime score-ring
 * card (with the 5-emotion check-in row as a preview) and the pillars as
 * tappable cards, so a logged-out dad sees the app the way it works.
 */
export default function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const { data, loading, refresh } = usePublicHome();
  // Logged-out preview — the row is disabled and leads to sign-in.
  const [moodKey, setMoodKey] = useState<MoodKey>('good');

  const openSignIn = useCallback(() => navigation.navigate('Login'), [navigation]);
  const openTab = useCallback(
    (tab: PillarTab) => navigation.navigate(tab as keyof BottomTabsParamList),
    [navigation],
  );

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
        <PublicHomeSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.lime} />
        }
      >
        <View className="items-start">
          <View className="flex-row items-baseline">
            <Text className="font-heading text-lime text-[26px] uppercase">
              Dad
            </Text>

            <Text className="font-heading text-white text-[26px] uppercase">
              {' '}Health
            </Text>
          </View>
        </View>

        <FadeInView>
          <ScreenHero
            eyebrow="Your weekly score"
            headline={"Know exactly\nhow you're"}
            accent="doing."
            sub="Mind. Body. Bond. One honest score. Updated every week."
          />
        </FadeInView>

        <FadeInView delay={90}>
          <DadScoreCard score={null} items={EMPTY_SCORE_ITEMS}>
            <MoodCheckInRow selectedKey={moodKey} onSelect={setMoodKey} disabled />
          </DadScoreCard>
        </FadeInView>

        <FadeInView delay={140}>
          <View className="rounded-card border border-lime/15 bg-lime/[0.05] p-lg">
            <View className="flex-row items-end gap-sm">
              <Text className="font-heading text-lime text-[30px] leading-[30px]">
                {data.dadsCount > 0 ? data.dadsCount.toLocaleString() : 'Join'}
              </Text>

              <Text className="font-heading-bold text-white text-[13px] leading-[18px] uppercase tracking-[0.8px]">
                {data.dadsCount > 0 ? 'dads already improving' : 'the Dad Health community'}
              </Text>
            </View>

            <Text className="font-body text-white/50 text-[14px] leading-[21px] mt-sm">
              Create your free account and receive your first Dad Health Score.
            </Text>

            <View className="mt-md">
              <LimeButton label="Start free" onPress={openSignIn} />
            </View>

            <Pressable
              onPress={openSignIn}
              accessibilityRole="button"
              accessibilityLabel="Sign in to your existing account"
              className="self-center mt-md px-md py-sm active:opacity-70"
            >
              <Text className="font-heading-bold text-white/55 text-[11px] uppercase tracking-[1px]">
                Already have an account? Sign in
              </Text>
            </Pressable>
          </View>
        </FadeInView>

        <FadeInView delay={190}>
          <View className="flex-row flex-wrap justify-between gap-y-sm">
            {STATS_EXTENDED.map((stat) => (
              <View key={stat.label} className="w-[48.5%]">
                <StatTile
                  value={`${stat.value}${stat.sub ? ` ${stat.sub}` : ''}`}
                  label={stat.label}
                />
              </View>
            ))}
          </View>
        </FadeInView>

        <FadeInView delay={240}>
          <View className="gap-md">
            <Text className="font-heading-bold text-white/50 text-[11px] tracking-[2px] uppercase">
              Pillars
            </Text>
            {PILLARS.map((pillar, index) => (
              <PillarCard
                key={pillar.tag}
                emoji={PILLAR_EMOJI[pillar.tab]}
                title={pillar.tag}
                description={pillar.description}
                lime={index === 0}
                onPress={() => openTab(pillar.tab)}
                accessibilityLabel={`${pillar.tag} — open`}
              />
            ))}
          </View>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}
