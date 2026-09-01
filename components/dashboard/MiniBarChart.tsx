import React, { memo } from 'react';
import { Text, View } from 'react-native';

type MiniBarChartProps = {
  values: number[];
  labels: string[];
  maxValue: number;
  height?: number;
  /**
   * Preview state for members without Pro. Draws the chart's tracks and the
   * real weekday labels, but no bar — so nothing on screen can be read as this
   * member's own figure.
   */
  locked?: boolean;
  lockedAccessibilityLabel?: string;
};

/** Native port of web `components/dashboard/MiniBarChart.tsx`. */
function MiniBarChart({
  values,
  labels,
  maxValue,
  height = 92,
  locked = false,
  lockedAccessibilityLabel = 'Chart locked',
}: MiniBarChartProps) {
  if (locked) {
    return (
      <View
        accessible
        accessibilityLabel={lockedAccessibilityLabel}
        className="flex-row items-end justify-between gap-sm"
        style={{ height: height + 28 }}
      >
        {labels.map((label, index) => (
          <View key={`${label}-${index}`} className="flex-1 items-center gap-sm">
            <View className="w-full max-w-[24px] rounded-full bg-muted opacity-40" style={{ height }} />
            <Text className="font-heading-semibold text-muted-text text-[11px] uppercase">{label}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="flex-row items-end justify-between gap-sm" style={{ height: height + 28 }}>
      {values.map((value, index) => {
        const ratio = maxValue > 0 ? Math.min(1, Math.max(0, value / maxValue)) : 0;
        const barHeight = value > 0 ? Math.max(8, Math.round(ratio * height)) : 6;
        return (
          <View key={`${labels[index] ?? index}-${index}`} className="flex-1 items-center gap-sm">
            <View
              className="w-full max-w-[24px] rounded-full bg-muted justify-end overflow-hidden"
              style={{ height }}
            >
              <View
                className={`w-full rounded-full ${value > 0 ? 'bg-lime' : 'bg-border'}`}
                style={{ height: barHeight }}
              />
            </View>
            <Text className="font-heading-semibold text-muted-text text-[11px] uppercase">
              {labels[index] ?? ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default memo(MiniBarChart);
