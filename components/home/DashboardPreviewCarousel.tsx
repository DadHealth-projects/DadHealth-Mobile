import React, { memo, useCallback, useMemo, useState } from 'react';
import { Dimensions, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import Card from '../Card';
import DadScoreCard from '../dashboard/DadScoreCard';
import SectionHeader from '../dashboard/SectionHeader';
import StatCard from '../dashboard/StatCard';
import { DASHBOARD_SECTION } from '../../lib/homeContent';

const GAP = 12;
const SCREEN_PADDING = 24;
const CARD_WIDTH = Dimensions.get('window').width - SCREEN_PADDING * 2;

/** Logged-out score breakdown — the same zeroed bars the web preview renders. */
const EMPTY_SCORE_ITEMS = [
  { label: 'MIND', value: null },
  { label: 'BODY', value: null },
  { label: 'BOND', value: null },
];

function Kicker({ children }: { children: string }) {
  return (
    <Text className="font-heading-semibold text-lime text-[11px] tracking-label uppercase">
      {children}
    </Text>
  );
}

function ScreenTitle({ children }: { children: string }) {
  return (
    <Text className="font-heading text-white text-[24px] leading-[26px] uppercase mt-xs mb-md">
      {children}
    </Text>
  );
}

function SubLabel({ children }: { children: string }) {
  return (
    <Text className="font-heading-semibold text-muted-text text-[11px] tracking-label uppercase mb-sm">
      {children}
    </Text>
  );
}

function Muted({ children }: { children: string }) {
  return <Text className="font-body text-muted-text text-[13px] leading-[19px]">{children}</Text>;
}

function LinkText({ children }: { children: string }) {
  return (
    <Text className="font-heading-bold text-lime text-[11px] tracking-[1px] uppercase mt-sm">
      {children}
    </Text>
  );
}

function PreviewBody({
  screen,
  monthLabel,
  dadsCount,
}: {
  screen: string;
  monthLabel: string;
  dadsCount: number;
}) {
  switch (screen) {
    case 'HOME':
      return (
        <>
          <Kicker>HOME</Kicker>
          <ScreenTitle>Good morning dads</ScreenTitle>
          <View className="flex-row items-center gap-sm mb-md">
            <View className="h-[4px] w-[4px] rounded-full bg-lime" />
            <Text className="font-body text-muted-text text-[13px]">
              {dadsCount > 0 ? dadsCount.toLocaleString() : '0'} dads in community
            </Text>
          </View>
          <DadScoreCard score={null} items={EMPTY_SCORE_ITEMS} />
        </>
      );
    case 'FITNESS':
      return (
        <>
          <Kicker>FITNESS</Kicker>
          <ScreenTitle>Today's workout</ScreenTitle>
          <View className="gap-sm">
            <View className="flex-row gap-sm">
              <StatCard value="—" label="WORKOUTS" />
              <StatCard value="—" label="WEIGHT" />
            </View>
            <View className="flex-row gap-sm">
              <StatCard value="—" label="LAST SESSION" />
              <StatCard value="—" label="ACTIVE" />
            </View>
          </View>
          <View className="mt-md">
            <Muted>Log your first workout to populate this card.</Muted>
          </View>
        </>
      );
    case 'MIND':
      return (
        <>
          <Kicker>MIND</Kicker>
          <ScreenTitle>Mental health</ScreenTitle>
          <View className="rounded-card border border-lime/20 p-md">
            <Text className="font-heading-bold text-lime text-[12px] tracking-[1px] uppercase mb-sm">
              4-4-4 breathing
            </Text>
            <Muted>Inhale 4 - Hold 4 - Exhale 4. Helps lower stress.</Muted>
            <LinkText>Begin session →</LinkText>
          </View>
        </>
      );
    case 'BOND':
      return (
        <>
          <Kicker>BOND</Kicker>
          <ScreenTitle>Parenting</ScreenTitle>
          <SubLabel>DAD DATE IDEAS</SubLabel>
          <Muted>No dad dates yet</Muted>
          <View className="border-l-[3px] border-l-lime pl-md mt-md">
            <Text className="font-body text-muted-text text-[13px] leading-[19px] italic">
              "What made you laugh the hardest today?"
            </Text>
            <Text className="font-body text-muted-text text-[11px] mt-xs">Conversation starter</Text>
          </View>
        </>
      );
    case 'COMMUNITY':
      return (
        <>
          <Kicker>COMMUNITY</Kicker>
          <ScreenTitle>Community feed</ScreenTitle>
          <SubLabel>RECENT POSTS</SubLabel>
          <Muted>Sign in to see the live feed.</Muted>
          <View className="mt-md">
            <SubLabel>DAD CIRCLES</SubLabel>
            <Muted>No circles yet</Muted>
          </View>
        </>
      );
    case 'PROGRESS':
    default:
      return (
        <>
          <Kicker>PROGRESS</Kicker>
          <ScreenTitle>Your Dad Health score</ScreenTitle>
          <View className="bg-lime rounded-card p-md flex-row items-center gap-md">
            <View className="items-center">
              <Text className="font-heading text-dark text-[42px] leading-[42px]">0</Text>
              <Text className="font-heading-semibold text-dark/60 text-[9px] tracking-[1px] uppercase">
                out of 100
              </Text>
            </View>
            <View className="flex-1 gap-sm">
              {EMPTY_SCORE_ITEMS.map((item) => (
                <View key={item.label}>
                  <Text className="font-heading-bold text-dark/70 text-[10px] tracking-[0.5px] uppercase mb-xs">
                    {item.label}
                  </Text>
                  <View className="h-[4px] rounded-full bg-dark/15" />
                </View>
              ))}
            </View>
          </View>
          <View className="mt-md">
            <SubLabel>{`${monthLabel} REPORT`}</SubLabel>
            <View className="flex-row gap-sm">
              <StatCard value="—" label="Workouts" />
              <StatCard value="—" label="Journal" />
              <StatCard value="—" label="Dad dates" />
            </View>
          </View>
        </>
      );
  }
}

/**
 * Web `components/home/DashboardPreview.tsx` (preview variant). Web switches
 * screens from a sidebar; mobile swipes through the same six screens with the
 * same logged-out placeholder values and wording.
 */
function DashboardPreviewCarousel({ dadsCount }: { dadsCount: number }) {
  const [index, setIndex] = useState(0);
  const monthLabel = useMemo(
    () => new Date().toLocaleDateString('en-GB', { month: 'long' }).toUpperCase(),
    [],
  );

  const onMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + GAP));
    setIndex(next);
  }, []);

  return (
    <View>
      <SectionHeader
        label={DASHBOARD_SECTION.label}
        title={DASHBOARD_SECTION.heading}
        className="mb-md"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + GAP}
        snapToAlignment="start"
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={{ gap: GAP }}
      >
        {DASHBOARD_SECTION.screens.map((screen) => (
          <View key={screen} style={{ width: CARD_WIDTH }}>
            <Card>
              <PreviewBody screen={screen} monthLabel={monthLabel} dadsCount={dadsCount} />
            </Card>
          </View>
        ))}
      </ScrollView>

      <View className="flex-row justify-center gap-sm mt-md">
        {DASHBOARD_SECTION.screens.map((screen, dotIndex) => (
          <View
            key={screen}
            className={`h-[6px] rounded-full ${
              dotIndex === index ? 'w-[18px] bg-lime' : 'w-[6px] bg-border'
            }`}
          />
        ))}
      </View>
    </View>
  );
}

export default memo(DashboardPreviewCarousel);
