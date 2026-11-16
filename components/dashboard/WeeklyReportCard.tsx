import React, { memo } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import { reportDates, type SavedWeeklyReport } from '../../lib/weeklyReport';

function WeeklyReportCard({ report, onOpen }: {
  report: SavedWeeklyReport | null;
  onOpen: () => void;
}) {
  return <View>
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open your weekly report"
      className="min-h-[76px] flex-row items-center gap-md border-y border-border py-md">
      <View className="h-[44px] w-[44px] rounded-full bg-lime items-center justify-center">
        <Feather name="file-text" size={21} color={colors.dark} />
      </View>
      <View className="flex-1">
        <Text className="font-heading-bold text-white text-[22px] uppercase leading-[26px]">Your weekly report</Text>
        <Text className="font-body text-white text-[14px] leading-[20px] mt-xs">
          {report
            ? `${reportDates(report.weekStart, report.weekEndExclusive)} · View your week`
            : 'View your weekly summary'}
        </Text>
      </View>
      <Feather name="arrow-right" size={24} color={colors.lime} />
    </Pressable>
  </View>;
}
export default memo(WeeklyReportCard);
