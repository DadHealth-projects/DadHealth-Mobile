import React, { memo } from 'react';
import { Text, View } from 'react-native';

import ProLockedPreview from '../ProLockedPreview';
import SectionHeader from './SectionHeader';
import { PRO_MOMENTS } from '../../lib/proMoments';
import { formatPillarChange, type WeeklyReport, type WeeklyReportPillar } from '../../lib/weeklyReport';

const PLACEHOLDER_PILLARS: WeeklyReportPillar[] = [
  { label: 'Mind', change: null },
  { label: 'Body', change: null },
  { label: 'Bond', change: null },
];

/**
 * Moment 5 — the weekly Dad Health report. Pro members see their own week;
 * free members see the same layout behind a lock, with no invented numbers.
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
        <ProLockedPreview lock={PRO_MOMENTS.weeklyReport} onPress={onUpgrade}>
          <WeeklyReportBody report={report} />
        </ProLockedPreview>
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

function WeeklyReportBody({ report }: { report: WeeklyReport | null }) {
  const pillars = report?.pillars ?? PLACEHOLDER_PILLARS;

  return (
    <View className="gap-md">
      <View className="flex-row">
        {pillars.map((pillar) => (
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

      {report ? (
        <View className="gap-xs">
          <Text className="font-body text-white text-[14px] leading-[21px]">{report.summary}</Text>
          <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
            {report.nextWeek}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default memo(WeeklyReportCard);
