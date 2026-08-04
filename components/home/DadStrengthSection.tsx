import React, { memo } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import LimeButton from '../LimeButton';
import StatCard from '../dashboard/StatCard';
import TagPill from '../dashboard/TagPill';
import { DAD_STRENGTH, IMAGES, type DadStrengthMove } from '../../lib/homeContent';

type DadStrengthSectionProps = {
  /** Newest admin workout title, or null → the web "DAD STRENGTH" fallback. */
  workoutTitle: string | null;
  moves: DadStrengthMove[];
  /** Four values in `DAD_STRENGTH.statLabels` order; `—` when unavailable. */
  statValues: readonly [string, string, string, string];
  onStart: () => void;
  onViewFitness: () => void;
};

/** Web `components/home/DadStrengthSection.tsx` — banner, timer, moves, stats. */
function DadStrengthSection({
  workoutTitle,
  moves,
  statValues,
  onStart,
  onViewFitness,
}: DadStrengthSectionProps) {
  return (
    <View className="gap-lg">
      <View className="rounded-card overflow-hidden">
        <ImageBackground source={{ uri: IMAGES.workout }} resizeMode="cover">
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(10,10,10,0.6)' }]} />
          <View className="px-md pt-[96px] pb-md">
            <Text className="font-heading-semibold text-lime text-[11px] tracking-label uppercase">
              {DAD_STRENGTH.label}
            </Text>
            <Text className="font-heading text-white text-[38px] leading-[38px] uppercase mt-xs">
              {workoutTitle ?? DAD_STRENGTH.fallbackTitle}
            </Text>
            <Text className="font-body text-white/60 text-[13px] mt-sm">
              {moves.length} moves · full-body session
            </Text>
          </View>
        </ImageBackground>
      </View>

      {/* Timer */}
      <View>
        <Text className="font-heading text-white text-[52px] leading-[52px] tracking-[1px]">
          {DAD_STRENGTH.timerValue}
        </Text>
        <Text className="font-heading-semibold text-muted-text text-[11px] tracking-[1px] uppercase mt-xs">
          {DAD_STRENGTH.timerLabel} · {moves.length} MOVES
        </Text>
        <View className="gap-sm mt-md">
          <LimeButton label={DAD_STRENGTH.startCta} onPress={onStart} />
          <Pressable
            onPress={onStart}
            accessibilityRole="button"
            accessibilityLabel={DAD_STRENGTH.nextCta}
            className="rounded-button border border-white py-md items-center active:opacity-70"
          >
            <Text className="font-heading-bold text-white text-[13px] tracking-[1px] uppercase">
              {DAD_STRENGTH.nextCta}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Moves */}
      <View>
        <Text className="font-heading-semibold text-muted-text text-[11px] tracking-label uppercase mb-sm">
          {DAD_STRENGTH.movesLabel}
        </Text>
        <View className="border-t border-border">
          {moves.map((move, index) => (
            <View
              key={`${move.title}-${index}`}
              className="flex-row items-center gap-md py-md border-b border-border"
            >
              <View className="h-[28px] w-[28px] bg-lime/10 items-center justify-center">
                <Text className="font-heading text-lime text-[13px]">{index + 1}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-heading-bold text-white text-[15px] tracking-[0.5px] uppercase">
                  {move.title}
                </Text>
                <Text className="font-body text-muted-text text-[11px] mt-xs">{move.detail}</Text>
              </View>
              {move.tag ? <TagPill label={move.tag} /> : null}
            </View>
          ))}
        </View>
      </View>

      {/* Progress this month */}
      <View>
        <Text className="font-heading-semibold text-muted-text text-[11px] tracking-label uppercase mb-sm">
          {DAD_STRENGTH.progressLabel}
        </Text>
        <View className="gap-sm">
          <View className="flex-row gap-sm">
            <StatCard value={statValues[0]} label={DAD_STRENGTH.statLabels[0]} />
            <StatCard value={statValues[1]} label={DAD_STRENGTH.statLabels[1]} />
          </View>
          <View className="flex-row gap-sm">
            <StatCard value={statValues[2]} label={DAD_STRENGTH.statLabels[2]} />
            <StatCard value={statValues[3]} label={DAD_STRENGTH.statLabels[3]} />
          </View>
        </View>
        <View className="mt-lg">
          <LimeButton label={DAD_STRENGTH.viewCta} onPress={onViewFitness} />
        </View>
      </View>
    </View>
  );
}

export default memo(DadStrengthSection);
