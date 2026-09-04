import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import SectionHeader from './SectionHeader';
import { PRO_MOMENTS } from '../../lib/proMoments';
import { formatPillarChange, type WeeklyReport } from '../../lib/weeklyReport';

/**
 * Moment 5 — the weekly Dad Health report. Pro members see their own week;
 * free members see a compact non-data preview, with no invented or exposed numbers.
 */
function WeeklyReportCard({
  report,
  isPro,
  onUpgrade,
}: {
  report: WeeklyReport | null;
  isPro: boolean;
  onUpgrade: () => void;
}) {
  if (!isPro) {
    return (
      <View>
        <SectionHeader title="Your week in Dad Health" className="mb-md" />
        <View className="border-b border-border pb-lg">
          <Text className="font-body text-muted-text text-[13px] leading-[19px]">
            {PRO_MOMENTS.weeklyReport.body}
          </Text>
          <Pressable
            onPress={onUpgrade}
            accessibilityRole="button"
            accessibilityLabel="Learn about weekly Dad Health reports"
            className="min-h-[44px] self-start justify-center border-b border-lime mt-md active:opacity-70"
          >
            <Text className="font-heading-bold text-lime text-[11px] uppercase">
              {PRO_MOMENTS.weeklyReport.cta}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View>
      <SectionHeader title="Your week in Dad Health" className="mb-md" />
      <View className="border-b border-border pb-lg">
        {report ? (
          <WeeklyReportBody report={report} />
        ) : (
          <Text className="font-body text-muted-text text-[13px] leading-[19px]">
            Your first weekly report arrives after a full week of check-ins.
          </Text>
        )}
      </View>
    </View>
  );
}

function WeeklyReportBody({ report }: { report: WeeklyReport }) {
  return (
    <View className="gap-md">
      <View className="flex-row">
        {report.pillars.map((pillar) => (
          <View key={pillar.label} className="flex-1">
            <Text className="font-heading-bold text-muted-text text-[10px] tracking-[0.5px] uppercase">
              {pillar.label}
            </Text>
            <Text className="font-heading text-lime text-[24px] leading-[26px] mt-xs">
              {formatPillarChange(pillar.change)}
            </Text>
          </View>
        ))}
      </View>

      <View className="gap-xs">
        <Text className="font-body text-white text-[14px] leading-[21px]">{report.summary}</Text>
        <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
          {report.nextWeek}
        </Text>
      </View>
    </View>
  );
}

export default memo(WeeklyReportCard);
