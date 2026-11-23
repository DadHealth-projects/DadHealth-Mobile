import React, { useEffect, useRef, useState } from 'react';
import { shareWeeklyDadHealthReport } from '../../lib/weeklyReportSharing';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import { trackEvent } from '../../lib/analytics';
import { displayReportValue, reportHeadline, reportChange, overallReportChange, reportFocus, reportProtection, hasReportChanges, reportStreakLabel, reportReadMessage, MISSING_REPORT_MESSAGE, UNRELEASED_REPORT_MESSAGE, type ReportFocusPillar } from '../../lib/weeklyReportPresentation';
import { reportDates, type SavedWeeklyReport } from '../../lib/weeklyReport';
import type { EmptyReason } from '../../hooks/useWeeklyReport';

type Props = { visible: boolean; report: SavedWeeklyReport | null; loading: boolean; error: string | null;
  empty: boolean; emptyReason?: EmptyReason | null; userId: string; accountName?: string; onClose: () => void; onDismiss: () => void; onShow?: () => void;
  onRetry: () => void; onUpgrade: () => void; onFocus: (pillar: ReportFocusPillar) => void };

export default function WeeklyReportSheet({ visible, report, loading, error, empty, emptyReason,
  userId, accountName, onClose, onDismiss, onShow, onRetry, onUpgrade, onFocus }: Props) {
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
  const headline = report ? reportHeadline(report) : null;
  const headlineTitle = headline?.title.replace(/, Dad\./g, () =>
    accountName?.trim() ? `, ${accountName.trim()}.` : '.');
  const focus = report ? reportFocus(report) : null;
  const total = report?.totalScore?.state === 'available' ? report.totalScore.value : null;
  const overall = report ? overallReportChange(report) : null;
  return <Modal visible={visible} transparent animationType={Platform.OS === 'ios' ? 'slide' : 'none'}
    onRequestClose={onClose} onDismiss={onDismiss} onShow={onShow}>
    <View className="flex-1 justify-end bg-black/55">
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close weekly report" className="h-[10%]" />
      <SafeAreaView edges={['bottom']} className="h-[80%] rounded-t-[28px] bg-[#111214]">
        <View className="flex-row items-center justify-between px-lg pt-lg pb-sm gap-md">
          <View className="flex-1">
            <Text className="font-heading-bold text-lime text-[19px] tracking-[1px] uppercase">Your week in Dad Health</Text>
            <Text className="font-body text-white text-[14px] leading-[20px] mt-xs">
              {report ? reportDates(report.weekStart, report.weekEndExclusive) : 'Your weekly summary.'}
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={4}
            className="h-[42px] w-[42px] items-center justify-center rounded-full bg-white/5">
            <Feather name="x" size={20} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerClassName="px-lg pb-xl gap-lg" showsVerticalScrollIndicator={false}>
          {!report ? <View className="min-h-[160px] justify-center gap-sm">
            {loading ? <View accessibilityLabel="Preparing weekly report" className="h-[4px] w-[64px] rounded-full bg-card" />
              : error || (empty && emptyReason === 'snapshot_missing') ? <>
                <Text accessibilityRole={error ? 'alert' : 'text'} className="font-body text-white text-[14px] leading-[20px]">
                  {error ? reportReadMessage(error) : MISSING_REPORT_MESSAGE}
                </Text>
                <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry loading your weekly report"
                  className="min-h-[44px] self-start justify-center border-b border-lime">
                  <Text className="font-heading-bold text-lime text-[11px] uppercase">Retry</Text>
                </Pressable>
              </>
              : <Text className="font-body text-white text-[14px] leading-[20px]">
                {empty ? UNRELEASED_REPORT_MESSAGE
                  : 'Your report will appear here soon. Pull down on Today to refresh.'}
              </Text>}
          </View> : <>
            <View className="gap-sm">
              <Text className="font-heading-bold text-white text-[22px] leading-[26px] tracking-[0.5px] uppercase">{headlineTitle}</Text>
              {headline?.body ? <Text className="font-body text-white text-[14px] leading-[20px]">{headline.body}</Text> : null}
            </View>
            <View className="rounded-[24px] bg-card p-md flex-row items-center gap-md">
              <View className="w-[120px] h-[120px] items-center justify-center" accessibilityLabel={`Dad Health score ${displayReportValue(report.totalScore)} out of 100`}>
                <ReportRing score={total} />
                <Text numberOfLines={1} adjustsFontSizeToFit className="font-heading text-white text-[52px] leading-[52px]">{displayReportValue(report.totalScore)}</Text>
                <Text className="font-heading-bold text-white text-[11px] tracking-[1.5px] uppercase">/100</Text>
              </View>
              <View className="flex-1 gap-sm">
                <Text className="font-heading-bold text-white text-[14px] uppercase tracking-[1px]">Dad Health score</Text>
                {overall ? <Text className="font-heading-bold text-[16px] leading-[20px]" style={{ color: report.overallChange?.state === 'available' && report.overallChange.value > 0 ? colors.lime : colors.text }}>{overall}</Text> : null}
              </View>
            </View>
                              {report.access === 'pro' || hasReportChanges(report) ? <View className={report.access === 'free' ? 'flex-row gap-sm' : 'rounded-[24px] bg-card px-md'}>
              {report.pillars.map(pillar => { const change = reportChange(report, pillar.change); return <View key={pillar.name}
                className={report.access === 'free' ? 'flex-1 rounded-[20px] bg-card p-sm items-center gap-sm' : 'flex-row items-center gap-md py-md border-b border-border'}>
                <Text className="font-heading-bold text-white text-[13px] uppercase flex-1">{pillar.name}</Text>
                {report.access === 'pro' ? <Text className="font-heading-bold text-white text-[18px]">{displayReportValue(pillar.score)}<Text className="font-body text-[11px]"> /100</Text></Text> : null}
                {change ? <Text className="font-body-semibold text-[14px]" style={{ color: pillar.change.state === 'available' && pillar.change.value > 0 ? colors.lime : colors.text }}>{change}</Text> : null}
              </View>; })}
            </View> : null}
            {detail ? <>
              <View className="flex-row gap-sm">
                {([[detail.workouts, 'workout', 'workouts'], [detail.bondSessions, 'Bond session', 'Bond sessions'], [detail.checkins, 'check-in', 'check-ins']] as const).map(([measurement, singular, plural]) =>
                  <View key={plural} className="flex-1 rounded-[20px] bg-card px-sm py-md items-center gap-xs">
                    <Text className="font-heading-bold text-white text-[18px]">{displayReportValue(measurement)}</Text>
                    <Text className="font-body text-white text-[14px] leading-[20px] text-center">{measurement.state === 'available' && measurement.value === 1 ? singular : plural}</Text>
                  </View>)}
              </View>
              <View className="rounded-[24px] bg-card p-md gap-sm">
                <Text className="font-heading-bold text-white text-[22px] leading-[26px]">{reportStreakLabel(detail.streak.days)}</Text>
                <Text className="font-body text-white text-[14px] leading-[20px]">At report time</Text>
                {detail.streak.protectedDates.length ? <>
                  <View className="flex-row items-center gap-xs">
                    <MaterialCommunityIcons name="snowflake" size={22} color="#9DDFFF" />
                    <Text className="font-heading-bold text-[19px]" style={{ color: '#9DDFFF' }}>Streak protected</Text>
                  </View>
                  {detail.streak.protectedDates.map(date => <View key={date}>
                    <Text className="font-body text-white text-[14px] leading-[20px]">{reportProtection(date)}</Text>
                    <Text className="font-body text-white text-[12px] mt-xs">{new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</Text>
                  </View>)}
                </> : null}
              </View>
            </> : report.access === 'free' ? <>
              <View className="min-h-[240px] rounded-[24px] bg-card p-lg gap-md overflow-hidden items-center justify-center">
                <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="absolute inset-0 justify-center px-lg gap-lg opacity-20">
                  <View className="h-[24px] w-3/4 rounded-full bg-white/10" style={{ shadowColor: colors.text, shadowOpacity: 1, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } }} />
                  <View className="h-[24px] w-1/2 rounded-full bg-white/10" style={{ shadowColor: colors.text, shadowOpacity: 1, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } }} />
                  <View className="h-[48px] rounded-full bg-lime/20" style={{ shadowColor: colors.lime, shadowOpacity: 1, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } }} />
                </View>
                <Text className="font-heading-bold text-white text-[22px] leading-[26px] uppercase text-center">See what drove your week</Text>
                <Text className="font-body text-white text-[14px] leading-[20px] text-center">Workouts, Bond sessions, your streak and your one focus for next week.</Text>
                <View className="flex-row items-center gap-sm"><Feather name="lock" size={18} color={colors.lime} /><Text className="font-heading-bold text-lime text-[14px]">PRO</Text></View>
              </View>
              <Pressable onPress={onUpgrade} accessibilityRole="button" className="min-h-[48px] rounded-[20px] bg-lime px-lg py-md items-center">
                <Text className="font-heading-bold text-dark text-[18px] leading-[26px] uppercase">See my full week →</Text>
              </Pressable>
            </> : null}
            <Pressable onPress={() => void saveReport()} disabled={preparingExport} accessibilityRole="button"
              accessibilityLabel="Save report" accessibilityState={{ disabled: preparingExport, busy: preparingExport }}
              className="min-h-[44px] flex-row items-center gap-sm self-start border-b border-lime">
              <Feather name="download" size={15} color={colors.lime} />
              <Text className="font-heading-bold text-lime text-[11px] uppercase">Save report</Text>
            </Pressable>
            {focus ? <View className="rounded-[24px] bg-lime p-lg gap-md">
              <Text className="font-heading-bold text-dark text-[14px] tracking-[1px] uppercase">Your one focus for next week</Text>
              <Text className="font-heading-bold text-dark text-[22px] leading-[26px] tracking-[0.5px] uppercase">{focus.title}</Text>
              <Text className="font-body text-dark text-[14px] leading-[20px]">{focus.explanation}</Text>
              <Pressable onPress={() => onFocus(focus.pillar)} accessibilityRole="button" className="min-h-[48px] rounded-[20px] bg-dark px-md py-md items-center">
                <Text className="font-heading-bold text-lime text-[11px] uppercase">{focus.button} →</Text>
              </Pressable>
            </View> : null}
          </>}
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}

/** Two clipped native semicircles; no new native dependency or score calculation. */
function ReportRing({ score }: { score: number | null }) {
  const degrees = score === null ? 0 : score * 3.6;
  return <View pointerEvents="none" accessible={false} style={{ position: 'absolute', width: 120, height: 120 }}>
    <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 9, borderColor: colors.border }} />
    {degrees > 0 ? <>
      {[true, false].map(right => <View key={String(right)} style={{ position: 'absolute', left: right ? 60 : 0, width: 60, height: 120, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: right ? -60 : 0, width: 120, height: 120,
          transform: [{ rotate: `${right ? Math.min(degrees, 180) - 180 : Math.max(degrees - 180, 0) + 180}deg` }] }}>
          <View style={{ position: 'absolute', left: right ? 60 : 0, width: 60, height: 120, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', left: right ? -60 : 0, width: 120, height: 120, borderRadius: 60, borderWidth: 9, borderColor: colors.lime }} />
          </View>
        </View>
      </View>)}
      {[0, degrees].map((angle, index) => <View key={index} style={{ position: 'absolute', width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.lime,
        left: 55.5 + 55.5 * Math.sin(angle * Math.PI / 180), top: 55.5 - 55.5 * Math.cos(angle * Math.PI / 180) }} />)}
    </> : null}
  </View>;
}
