import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import AppTopBar from '../AppTopBar';
import InlineFormError from '../InlineFormError';
import LimeButton from '../LimeButton';
import { useAuth } from '../../contexts/AuthContext';
import { useJournalEntries } from '../../hooks/useJournalEntries';
import { colors } from '../../theme';

export type MindSessionKind = 'reset' | 'reflection';

type MindSessionModalProps = {
  kind: MindSessionKind;
  onClose: () => void;
  onWriteToJournal: () => void;
};

// Provisional copy lives here so client-approved replacements do not change the flow.
const RESET_STEPS = [
  { title: 'Settle', instruction: 'Take a moment to settle. Let your breathing slow at a comfortable pace.' },
  { title: 'Release tension', instruction: 'Notice any physical tension. If it feels comfortable, relax your shoulders, jaw and hands.' },
  { title: 'Ground yourself', instruction: 'Notice what you can see, hear and feel around you.' },
  { title: 'Name what is here', instruction: 'Name what is taking up your attention, without judging it.' },
  { title: 'Choose one next step', instruction: 'Choose one small thing you can do next.' },
] as const;

const WEEKLY_REFLECTION_PROMPTS = [
  { day: 'Sunday', prompts: [
    'What would help me feel ready for the week ahead?',
    'What is one thing from this week I want to remember?',
    'What can I leave behind as this week ends?',
    'What would make tomorrow feel a little easier?',
    'What is one small thing I want to make time for next week?',
  ] },
  { day: 'Monday', prompts: [
    'What am I feeling as this week begins?',
    'What is taking up most of my attention today?',
    'What is one thing I would like to focus on this week?',
    'What support or resource could help me with that?',
    'What is one small first step I can take today?',
  ] },
  { day: 'Tuesday', prompts: [
    'What has felt important to me today?',
    'When did I feel most present today?',
    'What took more energy than I expected?',
    'What could I make simpler tomorrow?',
    'What is one thing I handled today in my own way?',
  ] },
  { day: 'Wednesday', prompts: [
    'What has been going well so far this week?',
    'What would I like to give more attention to?',
    'What is one thing I can influence today?',
    'What could I ask someone for help with?',
    'What is one manageable next step?',
  ] },
  { day: 'Thursday', prompts: [
    'What has been on my mind today?',
    'What kind of connection would feel good right now?',
    'What is one thing I would like someone to understand?',
    'What can I communicate clearly today?',
    'What small action could help me feel connected?',
  ] },
  { day: 'Friday', prompts: [
    'What am I carrying with me into the end of the week?',
    'What is one thing I made time for this week?',
    'What can wait until another day?',
    'What would help me switch off or slow down today?',
    'What is one thing I appreciate about how I showed up this week?',
  ] },
  { day: 'Saturday', prompts: [
    'What would I like more of in my day today?',
    'What is one moment I want to be present for?',
    'What can I do at my own pace today?',
    'What has brought me a little ease or enjoyment recently?',
    'What is one small thing I want to carry into tomorrow?',
  ] },
] as const;

export default function MindSessionModal({ kind, onClose, onWriteToJournal }: MindSessionModalProps) {
  const { user } = useAuth();
  const journal = useJournalEntries(user?.id);
  const reflectionSet = WEEKLY_REFLECTION_PROMPTS[new Date().getDay()];
  const reflectionPrompts = reflectionSet.prompts;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [resetStarted, setResetStarted] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => reflectionPrompts.map(() => ''));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isReset = kind === 'reset';
  const resetStepIndex = Math.min(Math.floor(elapsedSeconds / 60), RESET_STEPS.length - 1);
  const resetComplete = elapsedSeconds >= 5 * 60;
  const reflectionComplete = promptIndex === reflectionPrompts.length;
  const hasReflectionAnswer = answers.some((answer) => answer.trim().length > 0);
  const reflectionContent = useMemo(() => reflectionPrompts
    .map((prompt, index) => answers[index].trim() ? `${prompt}\n${answers[index].trim()}` : null)
    .filter((answer): answer is string => Boolean(answer))
    .join('\n\n'), [answers, reflectionPrompts]);

  useEffect(() => {
    if (!isReset || !resetStarted || resetComplete) return;
    const timer = setInterval(() => setElapsedSeconds((seconds) => Math.min(seconds + 1, 5 * 60)), 1000);
    return () => clearInterval(timer);
  }, [isReset, resetStarted, resetComplete]);

  const saveReflection = async () => {
    if (!user?.id) {
      onWriteToJournal();
      return;
    }
    if (!reflectionContent || saving) return;
    setSaving(true);
    setError(null);
    try {
      await journal.createEntry(reflectionContent, `Guided reflection · ${reflectionSet.day}`);
      setSaved(true);
    } catch {
      setError('We could not save this reflection. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-dark">
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerClassName="flex-grow gap-xl px-lg pt-lg pb-xl">
        <View className="mt-xl">
          <AppTopBar leftAccessory={(
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close Mind session" hitSlop={8} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70">
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          )} />
        </View>

        <View className="gap-sm">
          <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
          {isReset ? '5 minutes' : `10 minutes · ${reflectionSet.day}`}
          </Text>
          <Text className="font-heading text-white text-[38px] leading-[40px] uppercase">
            {isReset ? 'Reset exercise' : 'Guided reflection'}
          </Text>
        </View>

        {isReset ? (
          <View className="flex-1 justify-center gap-xl">
            <View className="rounded-button border border-lime/25 bg-lime/5 p-lg gap-md">
              <Text className="font-heading-bold text-lime text-[12px] tracking-label uppercase">
                {`${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')} / 5:00`}
              </Text>
              <Text className="font-heading-bold text-white text-[24px] uppercase">{RESET_STEPS[resetStepIndex].title}</Text>
              <Text className="font-body text-muted-text text-[16px] leading-[24px]">{RESET_STEPS[resetStepIndex].instruction}</Text>
              <View className="h-[4px] overflow-hidden rounded-full bg-white/10">
                <View className="h-full rounded-full bg-lime" style={{ width: `${(elapsedSeconds / 300) * 100}%` }} />
              </View>
            </View>
            {!resetStarted ? (
              <LimeButton label="Begin reset" onPress={() => setResetStarted(true)} />
            ) : resetComplete ? (
              <View className="gap-md">
                <LimeButton label="Done" onPress={onClose} />
                <SecondaryAction label="Write it down" onPress={onWriteToJournal} />
              </View>
            ) : (
              <Text accessibilityLiveRegion="polite" className="font-body text-tertiary-text text-[13px] text-center">Stay with this step until the next minute.</Text>
            )}
          </View>
        ) : (
          <View className="flex-1 gap-lg">
            {!reflectionComplete ? (
              <View className="flex-1 gap-lg">
                <View className="flex-row items-center justify-between">
                  <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Prompt {promptIndex + 1} of {reflectionPrompts.length}</Text>
                  <Text className="font-heading-bold text-tertiary-text text-[11px] uppercase">At your pace</Text>
                </View>
                <View className="gap-md">
                  <Text className="font-heading-bold text-white text-[22px] leading-[28px] uppercase">{reflectionPrompts[promptIndex]}</Text>
                  <TextInput
                    value={answers[promptIndex]}
                    onChangeText={(value) => setAnswers((current) => current.map((answer, index) => index === promptIndex ? value : answer))}
                    placeholder="Write a note, or leave this blank..."
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    multiline
                    textAlignVertical="top"
                    accessibilityLabel={reflectionPrompts[promptIndex]}
                    className="min-h-[180px] rounded-button border border-border bg-card p-md font-body text-white text-[15px] leading-[23px]"
                  />
                </View>
                <View className="flex-row items-center gap-md">
                  {promptIndex > 0 ? <SecondaryAction label="Back" onPress={() => setPromptIndex((index) => index - 1)} /> : null}
                  <View className="flex-1">
                    <LimeButton label={promptIndex === reflectionPrompts.length - 1 ? 'Finish reflection' : 'Next'} onPress={() => setPromptIndex((index) => index + 1)} />
                  </View>
                </View>
              </View>
            ) : (
              <View className="flex-1 justify-center gap-lg">
                <Text className="font-body text-muted-text text-[16px] leading-[24px]">You’ve reached the end of this reflection.</Text>
                {saved ? (
                  <View accessibilityLiveRegion="polite" className="rounded-button border border-lime/25 bg-lime/5 p-md">
                    <Text className="font-body text-lime text-[14px]">Saved to your journal.</Text>
                  </View>
                ) : null}
                <InlineFormError message={error} />
                <View className="gap-md">
                  <LimeButton label={saved ? 'Done' : 'Save to journal'} onPress={saved ? onClose : () => void saveReflection()} loading={saving} disabled={!saved && !hasReflectionAnswer} />
                  {!saved ? <SecondaryAction label="Done" onPress={onClose} /> : null}
                </View>
              </View>
            )}
          </View>
        )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SecondaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="min-h-[48px] flex-1 items-center justify-center rounded-button border border-border px-md active:opacity-70">
      <Text className="font-heading-bold text-lime text-[12px] tracking-[1px] uppercase">{label}</Text>
    </Pressable>
  );
}
