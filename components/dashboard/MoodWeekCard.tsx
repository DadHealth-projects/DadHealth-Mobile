import React, { memo } from 'react';
import { Text, View } from 'react-native';

import Card from '../Card';
import MiniBarChart from './MiniBarChart';
import SectionHeader from './SectionHeader';

type MoodWeekCardProps = {
  values: number[];
  labels: string[];
  /** From `getMoodSummary` — e.g. `{ label: 'Good', scoreText: ' (3.2/4)' }`. */
  summary: { label: string; scoreText: string };
  flat?: boolean;
  /**
   * Preview state for members without Pro. Renders the shape of the chart and
   * the real weekday labels only — never a mood value, and never a stand-in
   * figure that could be read as this member's own data.
   */
  locked?: boolean;
};

/** Web "MOOD THIS WEEK" chart + average-mood line. */
function MoodWeekCard({ values, labels, summary, flat = false, locked = false }: MoodWeekCardProps) {
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

  return (
    <View>
      <SectionHeader title="Mood this week" />
      {flat ? <View className="border-b border-border pb-lg">{content}</View> : <Card>{content}</Card>}
    </View>
  );
}

export default memo(MoodWeekCard);
