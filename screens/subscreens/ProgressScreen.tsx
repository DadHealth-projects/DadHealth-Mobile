import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import type { DashboardSection } from '../../components/AccountSheet';
import AppTopBar from '../../components/AppTopBar';
import DadScoreCard from '../../components/dashboard/DadScoreCard';
import FadeInView from '../../components/FadeInView';
import ScreenHero from '../../components/mockup/ScreenHero';
import SectionHeader from '../../components/dashboard/SectionHeader';
import StatCard from '../../components/dashboard/StatCard';
import { useAuth } from '../../contexts/AuthContext';
import { useProgressScore } from '../../hooks/useProgressScore';
import { useProgressReport } from '../../hooks/useProgressReport';
import { useProgressBadges } from '../../hooks/useProgressBadges';
import { useProgressSleep } from '../../hooks/useProgressSleep';
import { colors } from '../../theme';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { syncAppleHealthIfConnected } from '../../lib/appleHealth';

/**
 * Progress — the web dashboard PROGRESS screen's features
 * (`dashboardPreview/ProgressScreen.tsx`: score card, `{MONTH} REPORT` stats,
 * badges), in the mockups' native layout. Pushed from the dashboard's
 * "Take action" button, so it keeps a close control.
 */
export default function ProgressScreen({
  dashboardSection,
  onSelectDashboardSection,
}: {
  dashboardSection?: DashboardSection;
  onSelectDashboardSection?: (section: DashboardSection) => void;
} = {}) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const progressScore = useProgressScore(user?.id);
  const progressReport = useProgressReport(user?.id);
  const progressBadges = useProgressBadges(user?.id);
  const progressSleep = useProgressSleep(user?.id);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  const refreshing = progressScore.loading || progressReport.loading || progressBadges.loading || progressSleep.loading;
  const onRefresh = useCallback(() => {
    void (async () => {
      if (user?.id) {
        try {
          await syncAppleHealthIfConnected(user.id, { force: true, days: 7 });
        } catch {}
      }
      await Promise.all([progressScore.refresh(), progressReport.refresh(), progressBadges.refresh(), progressSleep.refresh()]);
    })();
  }, [progressBadges.refresh, progressReport.refresh, progressScore.refresh, progressSleep.refresh, user?.id]);
  const onClose = useCallback(() => navigation.goBack(), [navigation]);

  const scoreItems = useMemo(() => {
    const breakdown = progressScore.data.breakdown;
    return [
      { label: 'Mind', value: breakdown.mind },
      { label: 'Body', value: breakdown.body },
      { label: 'Bond', value: breakdown.bond },
    ];
  }, [progressScore.data.breakdown]);

  const reportStats = useMemo(() => progressReport.report ? [
    [String(progressReport.report.workouts), 'Workouts'],
    [String(progressReport.report.journal), 'Journal entries'],
    [String(progressReport.report.dadDates), 'Dad dates'],
    [progressReport.report.avgSleep == null ? '—' : `${progressReport.report.avgSleep}h`, 'Avg sleep'],
    [String(progressReport.report.streak), 'Day streak'],
    [progressReport.report.avgMood ?? '—', 'Avg mood'],
  ] as const : [], [progressReport.report]);
  const monthLabel = useMemo(
    () => new Date().toLocaleDateString('en-GB', { month: 'long' }).toUpperCase(),
    [],
  );
  const shareReport = useCallback(async () => {
    setReportMessage(null);
    if (!progressReport.report) {
      setReportMessage('Your monthly report is not available yet.');
      return;
    }
    try {
      const html = buildReportHtml(monthLabel, progressScore.data.score ?? 0, progressReport.report);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save or share Dad Health report' });
        setReportMessage('Report ready.');
      } else {
        await Share.share({ title: 'My Dad Health Report', message: buildReportTable(monthLabel, progressScore.data.score ?? 0, progressReport.report) });
        setReportMessage('Report shared.');
      }
    } catch {
      setReportMessage('We could not share your report. Please try again.');
    }
  }, [monthLabel, progressReport.report, progressScore.data.score]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl"
        refreshControl={
          user?.id ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.lime} />
          ) : undefined
        }
      >
        <AppTopBar
          showNavigation={Boolean(dashboardSection)}
          activeSection={dashboardSection}
          onSelectSection={onSelectDashboardSection}
          rightAccessory={dashboardSection ? undefined : (
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          )}
        />

        {!user?.id ? (
          <>
            <FadeInView><ScreenHero eyebrow="Progress" headline={'Your Dad\nHealth score'} /></FadeInView>
            <View className="gap-md border-y border-border py-xl">
              <Feather name="log-in" size={22} color={colors.lime} />
              <Text className="font-heading-bold text-white text-[18px] uppercase">Log in to view progress</Text>
              <Text className="font-body text-muted-text text-[13px] leading-[19px]">Your score, reports and health patterns are private to your account.</Text>
              <Pressable onPress={() => navigation.navigate('Login')} accessibilityRole="button" className="min-h-[44px] self-start justify-center border-b border-lime"><Text className="font-heading-bold text-lime text-[11px] uppercase">Log in</Text></Pressable>
            </View>
          </>
        ) : (
          <>
            <FadeInView>
              <ScreenHero eyebrow="Progress" headline={'Your Dad\nHealth score'} />
            </FadeInView>

            <FadeInView delay={90}>
              {progressScore.error ? (
                <View className="gap-sm border-y border-red-400/30 py-lg">
                  <Text accessibilityRole="alert" className="font-body text-red-300 text-[13px]">{progressScore.error}</Text>
                  <Pressable onPress={() => void progressScore.refresh()} accessibilityRole="button">
                    <Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text>
                  </Pressable>
                </View>
              ) : progressScore.loading ? (
                <View className="h-[174px] bg-white/5" />
              ) : (
                <>
                  <DadScoreCard
                    score={progressScore.data.score}
                    missingScore={0}
                    items={progressScore.data.isPro ? scoreItems : []}
                    lockedLabel={progressScore.data.isPro ? undefined : 'Breakdown with Dad Health Pro'}
                    missingItemValue="—"
                    scoreLabel="out of 100"
                    title=""
                  />
                  {!progressScore.data.isPro ? (
                    <Pressable onPress={() => navigation.navigate('ProSubscription')} accessibilityRole="button" className="min-h-[44px] self-start justify-center border-b border-lime">
                      <Text className="font-heading-bold text-lime text-[11px] uppercase">View Dad Health Pro</Text>
                    </Pressable>
                  ) : null}
                  <View className="mt-lg border-t border-border">
                    <ProgressDataRow label="Sync status" value={formatSyncStatus(progressScore.data.integration)} />
                    <ProgressDataRow label="Steps" value={progressScore.data.latestSteps == null ? 'No wearable data' : Math.round(progressScore.data.latestSteps).toLocaleString()} />
                    <ProgressDataRow label="Active minutes" value={progressScore.data.latestActiveMins == null ? 'No wearable data' : `${Math.round(progressScore.data.latestActiveMins)} min`} />
                  </View>
                </>
              )}
            </FadeInView>

            <FadeInView delay={140}>
              <SectionHeader title={`${monthLabel} report`} className="mb-md" />
              {progressReport.loading ? (
                <View className="flex-row flex-wrap gap-sm">{[0, 1, 2, 3, 4, 5].map((item) => <View key={item} className="h-[92px] basis-[48%] grow-0 bg-white/5" />)}</View>
              ) : progressReport.error ? (
                <View className="gap-sm border-y border-red-400/30 py-lg"><Text accessibilityRole="alert" className="font-body text-red-300 text-[13px]">{progressReport.error}</Text><Pressable onPress={() => void progressReport.refresh()} accessibilityRole="button"><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable></View>
              ) : (
                <>
                  <View className="flex-row flex-wrap gap-sm">
                    {reportStats.map(([value, label]) => <StatCard key={label} value={value} label={label} className="basis-[48%] grow-0 min-h-[92px]" />)}
                  </View>
                  <Pressable onPress={() => void shareReport()} accessibilityRole="button" className="min-h-[48px] flex-row items-center gap-sm self-start border-b border-lime mt-md">
                    <Feather name="share-2" size={16} color={colors.lime} />
                    <Text className="font-heading-bold text-lime text-[11px] uppercase">Share report</Text>
                  </Pressable>
                  {reportMessage ? <Text className="font-body text-muted-text text-[12px] mt-sm">{reportMessage}</Text> : null}
                </>
              )}
            </FadeInView>

            <FadeInView delay={190}>
              <SectionHeader title="Badges" className="mb-md" />
              {progressBadges.loading ? (
                <View className="flex-row flex-wrap gap-sm">{[0, 1, 2, 3, 4, 5].map((item) => <View key={item} className="h-[94px] basis-[31%] grow-0 bg-white/5" />)}</View>
              ) : progressBadges.error ? (
                <View className="gap-sm border-y border-red-400/30 py-lg"><Text accessibilityRole="alert" className="font-body text-red-300 text-[13px]">{progressBadges.error}</Text><Pressable onPress={() => void progressBadges.refresh()} accessibilityRole="button"><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable></View>
              ) : progressBadges.badges.length === 0 ? (
                <Text className="font-body text-muted-text text-[13px] leading-[19px]">No badges earned yet.</Text>
              ) : (
                <View className="flex-row flex-wrap gap-sm">
                  {progressBadges.badges.map((badge) => (
                    <View
                      key={badge.name}
                      accessibilityLabel={badge.name}
                      className="min-h-[94px] basis-[31%] grow-0 border border-lime/20 bg-lime/[0.04] items-center justify-center p-sm"
                    >
                      <Text className="text-[22px]">{badge.icon}</Text>
                      <Text numberOfLines={2} className="font-heading-bold text-lime text-[9px] uppercase text-center mt-sm">{badge.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </FadeInView>

            <FadeInView delay={230}>
              <SectionHeader title="Sleep quality this week" className="mb-md" />
              {progressScore.error ? null : !progressScore.data.isPro ? (
                <View className="gap-md border-y border-border py-lg">
                  <Feather name="lock" size={20} color={colors.lime} />
                  <Text className="font-heading-bold text-white text-[16px] uppercase">Sleep tracker</Text>
                  <Text className="font-body text-muted-text text-[13px] leading-[19px]">Your sleep is connected to your mood, your patience and your energy. This shows you exactly how.</Text>
                  <Pressable onPress={() => navigation.navigate('ProSubscription')} accessibilityRole="button" className="min-h-[42px] self-start justify-center border-b border-lime"><Text className="font-heading-bold text-lime text-[11px] uppercase">View Dad Health Pro</Text></Pressable>
                </View>
              ) : progressSleep.loading ? (
                <View className="h-[132px] bg-white/5" />
              ) : progressSleep.error ? (
                <View className="gap-sm border-y border-red-400/30 py-lg"><Text accessibilityRole="alert" className="font-body text-red-300 text-[13px]">{progressSleep.error}</Text><Pressable onPress={() => void progressSleep.refresh()} accessibilityRole="button"><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable></View>
              ) : (
                <>
                  <View className="h-[78px] flex-row border-y border-border">
                    {progressSleep.days.map((day, index) => {
                      const statusColor = day.hours == null ? colors.border : day.hours >= 7 ? colors.lime : day.hours >= 6 ? 'rgba(200,245,90,0.45)' : '#5A5A5A';
                      return <View key={day.key} className={`flex-1 items-center justify-center gap-xs ${index < progressSleep.days.length - 1 ? 'border-r border-border' : ''}`}><Text className="font-heading-bold text-white text-[12px]">{day.hours == null ? '-' : day.hours.toFixed(1)}</Text><View className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: statusColor }} /><Text className="font-heading-bold text-tertiary-text text-[8px] uppercase">{day.label}</Text></View>;
                    })}
                  </View>
                  <View className="flex-row items-start gap-sm border-b border-border py-md">
                    <Feather name="zap" size={15} color={colors.lime} />
                    <Text className="flex-1 font-body text-tertiary-text text-[12px] leading-[18px]"><Text className="font-heading-bold text-lime text-[11px] uppercase">Pattern spotted: </Text>{progressSleep.pattern}</Text>
                  </View>
                </>
              )}
            </FadeInView>

            <FadeInView delay={270}>
              <SectionHeader title="Mood correlation" className="mb-md" />
              {progressSleep.loading ? (
                <View className="h-[132px] bg-white/5" />
              ) : progressSleep.error ? null : (
                <View className="border-t border-border">
                  <View className="flex-row items-center gap-lg py-sm border-b border-border">
                    <View className="flex-row items-center gap-xs"><View className="h-[3px] w-[18px] bg-lime" /><Text className="font-heading-bold text-muted-text text-[9px] uppercase">Sleep</Text></View>
                    <View className="flex-row items-center gap-xs"><View className="h-[3px] w-[18px] bg-white/35" /><Text className="font-heading-bold text-muted-text text-[9px] uppercase">Mood</Text></View>
                  </View>
                  <View>
                    {progressSleep.days.map((day) => {
                      const sleepWidth = day.hours == null ? 0 : Math.min(100, Math.round((day.hours / 10) * 100));
                      const moodWidth = day.mood == null ? 0 : Math.min(100, Math.round((day.mood / 4) * 100));
                      return (
                        <View key={day.key} className="min-h-[48px] flex-row items-center gap-sm border-b border-border py-xs">
                          <Text className="w-[30px] font-heading-bold text-muted-text text-[9px] uppercase">{day.label}</Text>
                          <View className="flex-1 gap-xs">
                            <View className="h-[4px] bg-white/[0.06]"><View className="h-full bg-lime" style={{ width: `${sleepWidth}%` }} /></View>
                            <View className="h-[4px] bg-white/[0.06]"><View className="h-full bg-white/35" style={{ width: `${moodWidth}%` }} /></View>
                          </View>
                          <Text className="w-[62px] font-body text-tertiary-text text-[9px] text-right">{day.hours == null ? '-' : `${day.hours}h`} / {day.mood == null ? '-' : `${day.mood}/4`}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </FadeInView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgressDataRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-[54px] flex-row items-center justify-between gap-md border-b border-border py-sm">
      <Text className="font-heading-bold text-muted-text text-[10px] uppercase">{label}</Text>
      <Text className="flex-1 font-body text-white text-[13px] text-right">{value}</Text>
    </View>
  );
}

function formatSyncStatus(integration: { provider: string | null; last_sync_at: string | null } | null) {
  if (!integration) return 'No wearable connected.';
  if (!integration.last_sync_at) return 'Wearable connected. First sync pending.';
  const date = new Date(integration.last_sync_at);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const day = date.toDateString() === today.toDateString()
    ? 'today'
    : date.toDateString() === yesterday.toDateString()
      ? 'yesterday'
      : date.toLocaleDateString();
  const provider = integration.provider === 'fitbit'
    ? 'Fitbit'
    : integration.provider === 'garmin'
      ? 'Garmin'
      : integration.provider === 'apple_health'
        ? 'Apple Health'
        : integration.provider === 'health_connect'
          ? 'Health Connect'
          : 'wearable';
  return `Last synced: ${day} ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} via ${provider}`;
}

function buildReportTable(month: string, score: number, report: { workouts: number; journal: number; dadDates: number; avgSleep: number | null; streak: number; avgMood: string | null }) {
  const rows = [
    ['Dad Health Score', `${score}/100`],
    ['Workouts', String(report.workouts)],
    ['Journal entries', String(report.journal)],
    ['Dad dates', String(report.dadDates)],
    ['Average sleep', report.avgSleep == null ? 'Not available' : `${report.avgSleep}h`],
    ['Day streak', String(report.streak)],
    ['Average mood', report.avgMood ?? 'Not available'],
  ];
  const labelWidth = Math.max('Metric'.length, ...rows.map(([label]) => label.length));
  const valueWidth = Math.max('Value'.length, ...rows.map(([, value]) => value.length));
  const divider = `+-${'-'.repeat(labelWidth)}-+-${'-'.repeat(valueWidth)}-+`;
  const tableRows = rows.map(([label, value]) => `| ${label.padEnd(labelWidth)} | ${value.padEnd(valueWidth)} |`);
  return [
    `DAD HEALTH - ${month} REPORT`,
    '',
    divider,
    `| ${'Metric'.padEnd(labelWidth)} | ${'Value'.padEnd(valueWidth)} |`,
    divider,
    ...tableRows,
    divider,
    '',
    'Track your dad health at Dad Health.',
  ].join('\n');
}

function buildReportHtml(month: string, score: number, report: { workouts: number; journal: number; dadDates: number; avgSleep: number | null; streak: number; avgMood: string | null }) {
  const rows = [
    ['Workouts', String(report.workouts)],
    ['Journal entries', String(report.journal)],
    ['Dad dates', String(report.dadDates)],
    ['Average sleep', report.avgSleep == null ? 'Not available' : `${report.avgSleep}h`],
    ['Day streak', String(report.streak)],
    ['Average mood', report.avgMood ?? 'Not available'],
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 0; } * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0; padding: 0; background-color: #080808 !important; color: #f7f7f2; font-family: Arial, sans-serif; }
    .report { padding: 18mm; background-color: #080808 !important; page-break-inside: avoid; break-inside: avoid; }
    .eyebrow { color: #c8f55a; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
    h1 { margin: 10px 0 28px; font-size: 34px; line-height: 1; text-transform: uppercase; } .score { background-color: #c8f55a !important; color: #080808; padding: 22px; margin-bottom: 24px; }
    .score-label { font-size: 11px; font-weight: 700; text-transform: uppercase; } .score-value { font-size: 48px; font-weight: 800; line-height: 1; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; } th { color: #c8f55a; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; text-align: left; padding: 12px; border-bottom: 2px solid #c8f55a; }
    td { padding: 14px 12px; border-bottom: 1px solid #303030; font-size: 14px; } td:last-child { color: #c8f55a; font-weight: 700; text-align: right; }
    .footer { color: #777; font-size: 10px; margin-top: 28px; }
  </style></head><body><main class="report"><div class="eyebrow">DAD HEALTH</div><h1>${month} report</h1><section class="score"><div class="score-label">Dad Health Score</div><div class="score-value">${score}<span style="font-size:18px"> / 100</span></div></section><table><thead><tr><th>Metric</th><th style="text-align:right">Value</th></tr></thead><tbody>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('')}</tbody></table><div class="footer">Track your dad health at Dad Health.</div></main></body></html>`;
}
