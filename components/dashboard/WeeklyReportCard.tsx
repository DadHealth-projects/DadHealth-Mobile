import React, { memo, useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

import SectionHeader from './SectionHeader';
import { PRO_MOMENTS } from '../../lib/proMoments';
import { formatPillarChange, type WeeklyReport } from '../../lib/weeklyReport';
import { trackEvent } from '../../lib/analytics';

/**
 * Moment 5 — the weekly Dad Health report. Pro members see their own week;
 * Free members see their current score and a compact locked preview.
 */
function WeeklyReportCard({
  report,
  reportAccess,
  currentScore,
  onUpgrade,
  loading = false,
  error = false,
  userId,
}: {
  report: WeeklyReport | null;
  reportAccess: boolean | null;
  currentScore: number | null;
  onUpgrade: () => void;
  loading?: boolean;
  error?: boolean;
  userId?: string;
}) {
  const lockViewed = useRef(false);
  useEffect(() => {
    if (reportAccess !== false || lockViewed.current) return;
    lockViewed.current = true;
    trackEvent('lock_viewed', { feature: 'weekly_report', source: 'weeklyReport' }, userId);
  }, [reportAccess, userId]);
  if (reportAccess === false) {
    return (
      <View>
        <SectionHeader title="Your week in Dad Health" className="mb-md" />
        <View className="border-b border-border pb-lg">
          <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
            Current Dad Health Score
          </Text>
          <Text accessibilityLabel={`Current Dad Health Score ${currentScore ?? 'unavailable'} out of 100`} className="font-heading-bold text-white text-[22px] mt-xs mb-sm">
            {currentScore === null ? '—' : `${Math.round(currentScore)} / 100`}
          </Text>
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
        {reportAccess === null ? (
          <Text className="font-body text-muted-text text-[12px]">Checking Dad Health Pro access.</Text>
        ) : loading ? (
          <Text className="font-body text-muted-text text-[12px]">Preparing your weekly report…</Text>
        ) : error ? (
          <Text className="font-body text-muted-text text-[12px]">Your weekly report is unavailable right now. Please try again.</Text>
        ) : report ? (
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
            <Text className="font-heading text-lime text-[20px] leading-[22px] mt-xs">
              {pillar.score}% {formatPillarChange(pillar.change)}
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
