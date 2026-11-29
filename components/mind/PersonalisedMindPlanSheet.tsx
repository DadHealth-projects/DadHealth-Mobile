import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import LimeButton from '../LimeButton';
import MindPlanLockedCard from './MindPlanLockedCard';
import { colors } from '../../theme';
import type { PlanView } from '../../lib/mindPlan';

type Props = {
  visible: boolean; view: PlanView | null; offline: boolean; userId: string;
  onClose(): void; onDismiss(): void; onShow(): void; onStart(): void;
  onComplete(planId: string, actionNumber: number): void; onActivity(actionNumber: number): void; onUnlock(): void;
};
const body = 'font-body text-white text-[14px] leading-[21px]';
export default function PersonalisedMindPlanSheet({ visible, view, offline, userId, onClose, onDismiss,
  onShow, onStart, onComplete, onActivity, onUnlock }: Props) {
  const [review, setReview] = useState<number | null>(null);
  const wasVisible = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'ios' && wasVisible.current && !visible) onDismiss();
    wasVisible.current = visible;
    if (!visible) setReview(null);
  }, [visible, onDismiss]);
  const result = view?.result;
  const available = view?.verified && result?.state === 'available' ? result : null;
  const plan = available?.plan;
  const completedCount = plan?.completions.length ?? 0;
  const number = review && review <= completedCount ? review : plan?.canComplete ? plan.nextAction : null;
  const action = number ? plan?.actions[number - 1] : null;
  const blocked = !view?.verified || view.busy || offline || Boolean(view.uncertain && !view.canRetryOperation);
  return (
    <Modal visible={visible} transparent animationType={Platform.OS === 'ios' ? 'slide' : 'none'}
      statusBarTranslucent onRequestClose={onClose} onDismiss={onDismiss} onShow={onShow}>
      <View className="flex-1 justify-end">
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss personalised Mind plan" className="absolute inset-0 bg-black/75" />
        <SafeAreaView edges={['bottom']} className="max-h-[85%] rounded-t-[28px] border-t border-lime/25 bg-dark px-lg pt-lg">
          <View className="flex-row items-start justify-between gap-md pb-md">
            <View className="flex-1 gap-xs">
              <Text className="font-heading-bold text-[11px] text-lime tracking-label uppercase">Personalised</Text>
              <Text className="font-heading text-[26px] leading-[29px] text-white uppercase">Mind Plan</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close personalised Mind plan" hitSlop={8} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center">
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-lg pb-lg">
            {result?.state === 'locked' ? <MindPlanLockedCard userId={userId} onUnlock={onUnlock} /> : null}
            {!result && !view?.error && !offline ? <View className="flex-row items-center gap-sm"><ActivityIndicator size="small" color={colors.lime} /><Text className={body + ' flex-1'}>Checking your plan...</Text></View> : null}
            {offline ? <Text className={body}>Your plan is temporarily unavailable.</Text> : view?.error ? <Text accessibilityRole="alert" className={body}>{view.error}</Text> : null}
            {view?.verified && result?.state === 'not_started' ? <>
              <Text className={body}>A seven-day plan shaped around your goals.</Text>
              <LimeButton label="Start my plan" onPress={onStart} disabled={blocked} />
            </> : null}
            {plan ? <>
              <Text className={body}>{completedCount} of 7 actions completed</Text>
              {plan.completed ? <Text className="font-heading-bold text-[22px] leading-[26px] text-white uppercase">Plan complete</Text>
                : !plan.canComplete ? <Text className={body}>{plan.completions[completedCount - 1]?.completedOn === available?.currentDate
                  ? 'Your action is saved for today. Your next action is available tomorrow.'
                  : 'Your next action will be available after your last completed day.'}</Text> : null}
              {action && number ? <View className="gap-md border-b border-border pb-lg">
                <Text className="font-heading-bold text-[11px] text-lime tracking-label uppercase">Action {number}{number <= completedCount ? ' - Completed' : ''}</Text>
                <Text className="font-heading-bold text-[22px] leading-[26px] text-white uppercase">{action.title}</Text>
                <Text className={body}>{action.instruction}</Text>
                <LimeButton label={action.route === 'Journal' ? 'Open Journal' : 'Open Mind Reset'} disabled={blocked || Boolean(view?.uncertain)} onPress={() => onActivity(number)} />
                {number === plan.nextAction && plan.canComplete ? <Pressable onPress={() => onComplete(plan.id, number)} disabled={blocked}
                  accessibilityRole="button" accessibilityState={{ disabled: blocked, busy: view?.busy }}
                  className="min-h-[44px] rounded-button border border-lime px-md py-sm items-center justify-center">
                  <Text className="font-heading-bold text-[14px] text-lime uppercase">Mark as done</Text>
                </Pressable> : null}
              </View> : null}
              {plan.actions.map((item, index) => {
                const done = index < completedCount;
                const current = index + 1 === plan.nextAction && plan.canComplete;
                return <Pressable key={item.id} disabled={!done && !current} onPress={() => setReview(done ? index + 1 : null)}
                  accessibilityRole="button" accessibilityState={{ disabled: !done && !current }}
                  accessibilityLabel={`Action ${index + 1}: ${item.title}. ${done ? 'Completed. Review action' : current ? 'Current action' : 'Not yet available'}`}
                  className="min-h-[44px] flex-row items-center gap-sm border-b border-border pb-sm">
                  <Feather name={done ? 'check-circle' : current ? 'circle' : 'lock'} size={18} color={done || current ? colors.lime : colors.mutedText} />
                  <Text className={body + ' flex-1'}>{index + 1}. {item.title}</Text>
                </Pressable>;
              })}
            </> : null}
            {view?.busy && view.uncertain?.kind !== 'start' ? <ActivityIndicator accessibilityLabel="Saving progress" size="small" color={colors.lime} /> : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
