import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import Card from '../Card';
import MiniBarChart from './MiniBarChart';
import SectionHeader from './SectionHeader';

type MoodWeekCardProps = {
  values: number[];
  labels: string[];
  /** From `getMoodSummary` — mood is shown as an approved label, not a fraction. */
  summary: { label: string; scoreText: string };
  flat?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Preview state for members without Pro. Renders the shape of the chart and
   * the real weekday labels only — never a mood value, and never a stand-in
   * figure that could be read as this member's own data.
   */
  locked?: boolean;
};

/** Web "MOOD THIS WEEK" chart + average-mood line. */
function MoodWeekCard({ values, labels, summary, flat = false, locked = false, actionLabel, onAction }: MoodWeekCardProps) {
  const content = (
    <>
      <MiniBarChart
        values={values}
        labels={labels}
        maxValue={4}
        locked={locked}
        lockedAccessibilityLabel="Seven-day mood trend, locked"
      />
      <Text className="font-body text-muted-text text-[14px] mt-md">
        Avg mood:{' '}
        {locked ? (
          <Text className="font-body-semibold text-tertiary-text">Locked</Text>
        ) : (
          <Text className="font-body-semibold text-lime">
            {summary.label}
            {summary.scoreText}
          </Text>
        )}
      </Text>
    </>
  );

  const action = actionLabel && onAction ? (
    <Pressable
      onPress={onAction}
      accessibilityRole="button"
      accessibilityLabel={actionLabel}
      className="min-h-[44px] self-start justify-center border-b border-lime mt-md active:opacity-70"
    >
      <Text className="font-heading-bold text-lime text-[11px] uppercase">{actionLabel}</Text>
    </Pressable>
  ) : null;

  return (
    <View>
      <SectionHeader title="Mood this week" />
      {flat ? <View className="border-b border-border pb-lg">{content}{action}</View> : <Card>{content}{action}</Card>}
    </View>
  );
}

export default memo(MoodWeekCard);
