import React, { useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DadScoreCard, { type ScoreItem } from './DadScoreCard';
import SectionHeader from './SectionHeader';
import { useProgressBadges } from '../../hooks/useProgressBadges';
import { useProgressReport } from '../../hooks/useProgressReport';
import { useDadScoreHistory } from '../../hooks/useDadScoreHistory';
import { PRO_MOMENTS } from '../../lib/proMoments';
import { shareDadHealthReport } from '../../lib/reportSharing';
import { colors } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  score: number | null;
  items: ScoreItem[];
  isPro: boolean;
  userId: string;
  onUpgrade: () => void;
};

export default function ScoreDetailSheet({ visible, onClose, score, items, isPro, userId, onUpgrade }: Props) {
  const sheetUserId = visible ? userId : undefined;
  const report = useProgressReport(sheetUserId);
  const badgeData = useProgressBadges(sheetUserId);
  const history = useDadScoreHistory(isPro ? sheetUserId : undefined);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const month = useMemo(() => new Date().toLocaleDateString('en-US', { month: 'long' }), []);
  const reportStats = report.report ? [
    [String(report.report.workouts), 'Workouts'],
    [String(report.report.journal), 'Journal entries'],
    [String(report.report.dadDates), 'Dad Days'],
    [report.report.avgSleep == null ? '—' : `${report.report.avgSleep}h`, 'Avg sleep'],
    [String(report.report.streak), 'Day streak'],
    [report.report.avgMood ?? '—', 'Avg mood'],
  ] : [];

  const shareReport = async () => {
    if (!report.report) {
      setShareMessage('Your monthly report is not available yet.');
      return;
    }
    setShareMessage(await shareDadHealthReport(month, score ?? 0, report.report));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/55">
        <Pressable accessibilityRole="button" accessibilityLabel="Close score details" onPress={onClose} className="flex-1" />
        <SafeAreaView edges={['bottom']} className="flex-1 rounded-t-[28px] bg-[#111214]">
          <View className="flex-row items-center justify-between px-lg pt-lg pb-sm">
            <View>
              <Text className="font-heading-bold text-lime text-[19px] tracking-[1px] uppercase">Score details</Text>
              <Text className="font-body text-muted-text text-[12px] mt-xs">Your health, in context.</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" className="h-[42px] w-[42px] items-center justify-center rounded-full bg-white/5">
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pb-xl gap-lg">
            <DadScoreCard score={score} items={items} title="Dad Health Score" scoreLabel="of 100" compactBottom />

            <View>
              <SectionHeader title="What feeds each pillar" className="mb-sm" />
              <PillarSource name="Mind" detail="Daily mood and stress check-ins." />
              <PillarSource name="Body" detail="Workouts, sleep and connected activity." />
              <PillarSource name="Bond" detail="Bond logs, journaling and Present Dad sessions." />
            </View>

            {!isPro ? <View className="border-y border-border py-md">
              <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">{PRO_MOMENTS.score.eyebrow}</Text>
              <Text className="font-heading-bold text-white text-[16px] uppercase mt-xs">{PRO_MOMENTS.score.heading}</Text>
              <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-xs">{PRO_MOMENTS.score.body}</Text>
              <Pressable onPress={onUpgrade} accessibilityRole="button" className="min-h-[42px] self-start justify-center border-b border-lime mt-sm">
                <Text className="font-heading-bold text-lime text-[11px] uppercase">{PRO_MOMENTS.score.cta}</Text>
              </Pressable>
            </View> : null}

            <View>
              <SectionHeader title="Score trends" className="mb-sm" />
              {isPro ? (
                history.loading ? <Text className="font-body text-muted-text text-[12px]">Loading your score history…</Text> : history.points.length > 0 ? (
                  <View className="h-[90px] flex-row items-end justify-between gap-xs border-b border-border pb-xs">
                    {history.points.slice(-8).map((point) => (
                      <View key={point.week_start} className="flex-1 items-center justify-end gap-xs">
                        <Text className="font-heading-bold text-lime text-[9px]">{point.total_score}</Text>
                        <View className="w-full max-w-[22px] rounded-t-[3px] bg-lime" style={{ height: Math.max(6, Math.round(point.total_score * 0.65)) }} />
                        <Text className="font-heading-bold text-muted-text text-[8px]">{formatWeek(point.week_start)}</Text>
                      </View>
                    ))}
                  </View>
                ) : <Text className="font-body text-muted-text text-[12px]">Your score history will appear after you have a week with logged activity.</Text>
              ) : <LockedPreview title="See your score history" onUpgrade={onUpgrade} />}
            </View>

            <View>
              <SectionHeader title={`${month} report`} className="mb-sm" />
              {isPro ? (
                report.loading ? <Text className="font-body text-muted-text text-[12px]">Loading your report…</Text> : (
                  <View className="flex-row flex-wrap gap-sm">
                    {reportStats.map(([value, label]) => (
                      <View key={label} className="min-h-[72px] basis-[31%] grow border border-border px-sm py-sm">
                        <Text className="font-heading-bold text-lime text-[18px]">{value}</Text>
                        <Text className="font-heading-bold text-muted-text text-[9px] uppercase mt-xs">{label}</Text>
                      </View>
                    ))}
                  </View>
                )
              ) : <LockedPreview title="Your monthly report" onUpgrade={onUpgrade} />}
            </View>

            <View>
              <SectionHeader title="Badges" className="mb-sm" />
              {badgeData.loading ? <Text className="font-body text-muted-text text-[12px]">Loading badges…</Text> : badgeData.earnedCount === 0 ? (
                <View className="flex-row items-center gap-sm border-y border-border py-sm">
                  <Text className="text-[22px]">{badgeData.badges[0]?.icon ?? '🏅'}</Text>
                  <View className="flex-1">
                    <Text className="font-heading-bold text-lime text-[10px] uppercase">{badgeData.badges[0]?.name ?? 'Your first badge'}</Text>
                    <Text className="font-body text-muted-text text-[11px] leading-[16px] mt-xs">Complete a check-in or log an activity to earn your first badge.</Text>
                  </View>
                </View>
              ) : (
                <View className="flex-row flex-wrap gap-sm">
                  {badgeData.badges.slice(0, 6).map((badge) => (
                    <View key={badge.name} className="min-h-[66px] basis-[31%] grow items-center justify-center border border-lime/20 px-xs py-xs">
                      <Text className="text-[18px]">{badge.icon}</Text>
                      <Text numberOfLines={2} className="font-heading-bold text-lime text-[9px] uppercase text-center mt-xs">{badge.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View>
              <Pressable onPress={() => void shareReport()} accessibilityRole="button" className="min-h-[44px] flex-row items-center gap-sm self-start border-b border-lime">
                <Feather name="share-2" size={15} color={colors.lime} />
                <Text className="font-heading-bold text-lime text-[11px] uppercase">Share report</Text>
              </Pressable>
              {shareMessage ? <Text className="font-body text-muted-text text-[11px] mt-sm">{shareMessage}</Text> : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function PillarSource({ name, detail }: { name: string; detail: string }) {
  return (
    <View className="flex-row items-baseline gap-md border-b border-border py-sm">
      <Text className="w-[54px] font-heading-bold text-lime text-[10px] uppercase">{name}</Text>
      <Text className="flex-1 font-body text-muted-text text-[12px] leading-[17px]">{detail}</Text>
    </View>
  );
}

function LockedPreview({ title, onUpgrade }: { title: string; onUpgrade: () => void }) {
  return (
    <View className="flex-row items-center gap-sm border-y border-border py-md">
      <Feather name="lock" size={15} color={colors.lime} />
      <Text className="flex-1 font-body text-muted-text text-[12px]">{title} is included with Dad Health Pro.</Text>
      <Pressable onPress={onUpgrade} accessibilityRole="button" className="min-h-[40px] justify-center">
        <Text className="font-heading-bold text-lime text-[10px] uppercase">Unlock</Text>
      </Pressable>
    </View>
  );
}

function formatWeek(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
