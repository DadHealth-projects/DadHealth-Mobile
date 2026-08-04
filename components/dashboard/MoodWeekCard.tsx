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
};

/** Web "MOOD THIS WEEK" chart + average-mood line. */
function MoodWeekCard({ values, labels, summary }: MoodWeekCardProps) {
  return (
    <View>
      <SectionHeader title="Mood this week" />
      <Card>
        <MiniBarChart values={values} labels={labels} maxValue={4} />
        <Text className="font-body text-muted-text text-[14px] mt-md">
          Avg mood:{' '}
          <Text className="font-body-semibold text-lime">
            {summary.label}
            {summary.scoreText}
          </Text>
        </Text>
      </Card>
    </View>
  );
}

export default memo(MoodWeekCard);
