import React, { useEffect, useRef, useState } from 'react';
import { shareWeeklyDadHealthReport } from '../../lib/weeklyReportSharing';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import { trackEvent } from '../../lib/analytics';
import DadScoreCard from './DadScoreCard';
import SectionHeader from './SectionHeader';
import { reportDates, type SavedMeasurement, type SavedWeeklyReport } from '../../lib/weeklyReport';

const value = (measurement: SavedMeasurement) => measurement.state === 'available' ? String(Math.round(measurement.value)) : '—';
type Props = { visible: boolean; report: SavedWeeklyReport | null; loading: boolean; error: string | null;
  empty: boolean; userId: string; onClose: () => void; onDismiss: () => void;
  onRetry: () => void; onUpgrade: () => void };

export default function WeeklyReportSheet({ visible, report, error, empty,
  userId, onClose, onDismiss, onUpgrade }: Props) {
  const text = colors.text;
  const divider = colors.border;
  const lockKey = useRef('');
  const [preparingExport, setPreparingExport] = useState(false);

  const exportSequence = useRef(0);
  const exportInFlight = useRef(false);
  const exportMounted = useRef(false);

  useEffect(() => {
    exportMounted.current = true;

    return () => {
      exportMounted.current = false;
    };
  }, []);

  useEffect(() => {
    ++exportSequence.current;

    return () => {
      ++exportSequence.current;
    };
  }, [visible, userId, report]);

  const saveReport = async () => {
    if (!visible || !report || exportInFlight.current) return;

    const sequence = ++exportSequence.current;
    const isCurrent = () => sequence === exportSequence.current;

    exportInFlight.current = true;
    setPreparingExport(true);

    try {
      await shareWeeklyDadHealthReport(report, isCurrent);
    } finally {
      exportInFlight.current = false;

      if (exportMounted.current) setPreparingExport(false);
    }
  };
  useEffect(() => {
    const key = `${userId}:${report?.weekStart}`;
    if (visible && report?.access === 'free' && lockKey.current !== key) {
      lockKey.current = key;
      trackEvent('lock_viewed', { feature: 'weekly_report', source: 'weeklyReport' }, userId);
    }
  }, [visible, report, userId]);
  // Android's non-animated modal is removed on the closing commit; iOS uses
  // native onDismiss for its slide transition. No timer-based navigation.
  const wasVisible = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'ios' && wasVisible.current && !visible) onDismiss();
    wasVisible.current = visible;
  }, [visible, onDismiss]);
  const detail = report?.access === 'pro' ? report.details : undefined;
  return <Modal visible={visible} transparent animationType={Platform.OS === 'ios' ? 'slide' : 'none'}
    onRequestClose={onClose} onDismiss={onDismiss}>
    <View className="flex-1 justify-end bg-black/55">
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close weekly report"
        className="h-[10%]"
      />
      <SafeAreaView
        edges={['bottom']}
        className="h-[70%] rounded-t-[28px] bg-[#111214]"
      >
        <View className="flex-row items-center justify-between px-lg pt-lg pb-sm gap-md">
          <View className="flex-1">
            <Text className="font-heading-bold text-lime text-[19px] tracking-[1px] uppercase">
              Weekly report
            </Text>
            {report ? (
              <Text className="font-body text-muted-text text-[14px] mt-xs">
                {reportDates(report.weekStart, report.weekEndExclusive)}
                {report.comparisonAvailable ? ' · vs last week' : ''}
              </Text>
            ) : (
              <Text className="font-body text-muted-text text-[14px] mt-xs">
                Your weekly summary.
              </Text>
            )}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={4}
            className="h-[42px] w-[42px] items-center justify-center rounded-full bg-white/5"
          >
            <Feather name="x" size={20} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerClassName="px-lg pb-xl gap-lg" showsVerticalScrollIndicator={false}>
          {!report ? (
            <View className="min-h-[160px] justify-center gap-sm">
              <Feather name="file-text" size={24} color={colors.lime} />
              <Text className="font-heading-bold text-white text-[22px] uppercase">
                {empty ? 'Your weekly report' : 'Report unavailable'}
              </Text>
              <Text className="font-body text-muted-text text-[14px] mt-sm">
                {empty
                  ? 'Reports are published Sundays at 6am UK time.'
                  : 'We couldn’t load your report. Please check back later.'}
              </Text>
            </View>
          ) : <>
            <View className="rounded-t-[18px] bg-lime">
              <DadScoreCard
                title="Weekly Dad Health Score"
                score={
  report.totalScore?.state === 'available'
    ? report.totalScore.value
    : null
}
                missingScore="—"
                scoreLabel="of 100"
                missingItemValue="—"
                compactBottom
                items={report.pillars.map(pillar => ({
                  label: pillar.name,
                  value: pillar.score.state === 'available' ? Math.round(pillar.score.value) : null,
                  trend: report.comparisonAvailable && pillar.change.state === 'available'
                    ? Math.round(pillar.change.value) : null,
                }))}
              />
              {report.pillars.some(pillar => pillar.trendMessage === 'Building first 7 day trend') ? (
                <Text className="font-body text-dark text-[14px] text-center px-xl pb-lg">
                  Building first 7 day trend
                </Text>
              ) : null}
            </View>
            {detail ? <>
              <View>
                <SectionHeader title="Your week" className="mb-sm" />
                {([['Workouts', detail.workouts, 'workouts'], ['Bond', detail.bondSessions, 'sessions'], ['Check-ins', detail.checkins, 'days']] as const).map(([label, measurement, unit]) =>
                  <View key={label} className="flex-row items-baseline gap-md border-b border-border py-sm">
                    <Text className="w-[72px] font-heading-bold text-lime text-[10px] uppercase">{label}</Text>
                    <Text className="flex-1 font-body text-[14px]" style={{ color: text }}>
                      {value(measurement)}{measurement.state === 'available' ? ` ${unit}` : ''}
                    </Text>
                  </View>)}
              </View>
              <View className="flex-row flex-wrap items-start gap-md pb-lg border-b" style={{ borderColor: divider }}>
                <View className="flex-row items-center gap-sm flex-1">
                  <MaterialCommunityIcons name="snowflake" size={27} color="#9DDFFF" />
                  <View className="flex-1">
                    <Text className="font-heading-bold text-[22px] uppercase leading-[24px]" style={{ color: text }}>
                      {detail.streak.days.state === 'available' ? `${Math.round(detail.streak.days.value)}-day streak` : 'Streak unavailable'}
                    </Text>
                    <Text className="font-body text-[14px]" style={{ color: text }}>At report time</Text>
                  </View>
                </View>
                {detail.streak.protectedDates.length ? <View className="gap-xs">
                  <View className="flex-row items-center gap-xs"><MaterialCommunityIcons name="snowflake" size={20} color={text} />
                    <Text className="font-heading-bold text-[22px] leading-[24px]" style={{ color: text }}>Streak protected</Text></View>
                  {detail.streak.protectedDates.map(date => <Text key={date} className="font-body text-[14px]" style={{ color: text }}>
                    {new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })}
                  </Text>)}
                </View> : null}
              </View>
              {detail.focus ? <View>
                <SectionHeader title="Next week" className="mb-sm" />
                <Text className="font-body text-[14px]" style={{ color: text }}>{detail.focus.text}</Text>
                <Text className="font-body text-muted-text text-[14px] mt-xs">A small step for {detail.focus.pillar}.</Text>
              </View> : null}
            </> : <View className="border-t pt-md" style={{ borderColor: divider }}>
              <Text className="font-body text-[14px]" style={{ color: text }}>Activity totals, streak details and next-week focus are included with Dad Health Pro.</Text>
              <Pressable onPress={onUpgrade} accessibilityRole="button" className="min-h-[44px] self-start justify-center">
                <Text className="font-heading-bold text-[11px] underline leading-[24px]" style={{ color: colors.lime }}>Explore Dad Health Pro</Text>
              </Pressable>
            </View>}
            <View className="border-t border-border pt-md">
              <Pressable
                onPress={() => void saveReport()}
                disabled={preparingExport}
                accessibilityRole="button"
                accessibilityLabel="Save report"
                accessibilityState={{
                  disabled: preparingExport,
                  busy: preparingExport,
                }}
                className="min-h-[44px] flex-row items-center gap-sm self-start border-b border-lime"
              >
                <Feather name="download" size={15} color={colors.lime} />
                <Text className="font-heading-bold text-lime text-[11px] uppercase">
                  Save report
                </Text>
              </Pressable>

            </View>
            {error ? (
              <Text className="font-body text-muted-text text-[14px]">
                Showing your saved report.
              </Text>
            ) : null}
          </>}
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}
