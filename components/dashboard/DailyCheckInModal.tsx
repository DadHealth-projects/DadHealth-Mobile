import React, { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { InputAccessoryView, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import InlineFormError from '../InlineFormError';
import { MOOD_OPTIONS } from '../mockup/MoodCheckInRow';
import { colors } from '../../theme';

type CheckInAnswers = {
  moodValue: number | null;
  energyLevel: number | null;
  connectionLevel: number | null;
};

type CompletedCheckInAnswers = {
  moodValue: number;
  energyLevel: number;
  connectionLevel: number;
  sleepHours: number | null;
};

type SaveResult = { error: string | null; queued?: boolean; warning?: string; inFlight?: boolean };

type DailyCheckInModalProps = {
  visible: boolean;
  reminderMessage?: string | null;
  initialAnswers: CheckInAnswers;
  saving: boolean;
  onClose: () => void;
  onSave: (answers: CompletedCheckInAnswers) => Promise<SaveResult>;
};

type Stage = 'intro' | 'mind' | 'body' | 'bond' | 'complete';

const BODY_OPTIONS = ['Exhausted', 'Tired', 'Okay', 'Good', 'Energised'];
const BOND_OPTIONS = ['Disconnected', 'Distant', 'Neutral', 'Connected', 'Very connected'];
const SLEEP_INPUT_ACCESSORY_ID = 'daily-check-in-sleep-input';

export default function DailyCheckInModal({ visible, reminderMessage, initialAnswers, saving, onClose, onSave }: DailyCheckInModalProps) {
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const modalHeight = height * 0.85;
  const initialAnswersRef = useRef(initialAnswers);
  if (!visible) initialAnswersRef.current = initialAnswers;

  const [stage, setStage] = useState<Stage>('intro');
  const [moodValue, setMoodValue] = useState<number | null>(initialAnswers.moodValue);
  const [energyLevel, setEnergyLevel] = useState<number | null>(initialAnswers.energyLevel);
  const [connectionLevel, setConnectionLevel] = useState<number | null>(initialAnswers.connectionLevel);
  const [sleep, setSleep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const initial = initialAnswersRef.current;
    setStage('intro');
    setMoodValue(initial.moodValue);
    setEnergyLevel(initial.energyLevel);
    setConnectionLevel(initial.connectionLevel);
    setSleep('');
    setError(null);
    setCompletionMessage(null);
  }, [visible]);

  const close = () => {
    if (!saving) onClose();
  };

  const save = async () => {
    setError(null);
    const sleepHours = sleep.trim() ? Number(sleep) : null;
    if (sleep.trim() && (sleepHours == null || !Number.isFinite(sleepHours) || sleepHours < 0 || sleepHours > 12)) {
      setError('Enter sleep between 0 and 12 hours, or leave it blank.');
      return;
    }
    if (moodValue === null || energyLevel === null || connectionLevel === null) {
      setError('Answer the Mind, Body and Bond questions before saving.');
      return;
    }

    const result = await onSave({ moodValue, energyLevel, connectionLevel, sleepHours });
    if (result.inFlight) return;
    if (result.error) {
      setError(result.error);
      return;
    }
    setCompletionMessage(result.warning ?? (result.queued
      ? "Saved on this device. It will sync when you're back online."
      : 'Check-in saved for Mind, Body and Bond.'));
    onClose();
  };

  const stepNumber = stage === 'mind' ? 1 : stage === 'body' ? 2 : stage === 'bond' ? 3 : 0;
  const selectedMood = MOOD_OPTIONS.find((option) => option.value === moodValue);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <SafeAreaProvider>
        <SafeAreaView
          edges={['top', 'bottom', 'left', 'right']}
          className="flex-1 items-center justify-center bg-black/70"
          style={{ paddingHorizontal: compact ? 8 : 16, paddingVertical: compact ? 8 : 16 }}
        >
          <KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ width: '100%', height: modalHeight }}
          >
            <View
  className="w-full flex-1 overflow-hidden rounded-card bg-lime"
>
              {stage === 'intro' ? (
                <View className={`flex-1 justify-center rounded-card bg-lime px-lg ${compact ? 'py-md' : 'py-xl'}`}>
                  <View className="items-center">
                    <View className={`${compact ? 'h-[64px] w-[64px] mb-md' : 'h-[88px] w-[88px] mb-lg'} items-center justify-center rounded-full bg-dark`}>
                      <Feather name="calendar" size={compact ? 28 : 38} color={colors.lime} />
                    </View>
                    <Text className={`font-heading-bold text-dark uppercase text-center ${compact ? 'text-[27px] leading-[31px]' : 'text-[32px] leading-[36px]'}`}>
                      Daily check-in
                    </Text>
                    <Text className={`font-body text-dark text-center ${compact ? 'text-[15px] leading-[21px] mt-sm' : 'text-[17px] leading-[25px] mt-md'}`}>
                      {reminderMessage ?? 'A quick check-in for your Mind, Body and Bond.'}
                    </Text>
                  </View>

                  <View className={`flex-row justify-around ${compact ? 'mt-lg mb-lg' : 'mt-xl mb-xl'}`}>
                    <IntroPillar icon="wind" label="Mind" compact={compact} />
                    <IntroPillar icon="activity" label="Body" compact={compact} />
                    <IntroPillar icon="heart" label="Bond" compact={compact} />
                  </View>

                  <View className={`${compact ? 'mt-md' : 'mt-lg'} gap-[4px]`}>
                    <Pressable
                      onPress={() => setStage('mind')}
                      accessibilityRole="button"
                      className={`${compact ? 'min-h-[52px]' : 'min-h-[58px]'} flex-row items-center justify-center gap-sm rounded-button bg-dark px-lg`}
                    >
                      <Text className="font-heading-bold text-lime text-[16px]">
                        Start Check-in
                      </Text>
                      <Feather name="arrow-right" size={21} color={colors.lime} />
                    </Pressable>

                    <Pressable
  onPress={close}
  disabled={saving}
  accessibilityRole="button"
  accessibilityLabel="Skip daily check-in"
  className="min-h-[44px] w-full items-center justify-center"
>
  <Text
  className="font-body text-dark text-[15px] text-center"
  style={{ transform: [{ translateX: -10 }] }}
>
  Skip for now
</Text>
</Pressable>
                  </View>
                </View>
              ) : stage === 'complete' ? (
                <View className={`flex-1 justify-center rounded-card bg-lime px-lg ${compact ? 'py-md' : 'py-xl'}`}>
                  <View className="items-center">
                    <View className="h-[88px] w-[88px] items-center justify-center rounded-full border-[3px] border-dark mb-lg">
                      <Feather name="check" size={48} color={colors.dark} />
                    </View>
                    <Text className="font-heading-bold text-dark text-[28px] leading-[32px] uppercase text-center">
                      Check-in complete
                    </Text>
                    <Text className="font-body text-dark text-[16px] leading-[23px] text-center mt-md">
                      You&apos;ve taken a moment for yourself today.
                    </Text>
                  </View>

                  <View className="rounded-card border border-dark/20 mt-xl">
                    <AnswerSummary icon="wind" label="Mind" answer={selectedMood?.label ?? ''} />
                    <AnswerSummary icon="activity" label="Body" answer={BODY_OPTIONS[(energyLevel ?? 1) - 1]} />
                    <AnswerSummary icon="heart" label="Bond" answer={BOND_OPTIONS[(connectionLevel ?? 1) - 1]} last />
                  </View>
                  {completionMessage ? (
                    <Text accessibilityLiveRegion="polite" className="font-body text-dark/70 text-[13px] leading-[19px] text-center mt-md">
                      {completionMessage}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <ScrollView
                  style={{ flexShrink: 1 }}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  showsVerticalScrollIndicator={false}
                >
                <View className={`rounded-card bg-lime px-lg ${compact ? 'py-md' : 'py-lg'}`}>
                  <View className="flex-row items-center justify-end gap-md">
                    <Text className="font-heading-bold text-dark text-[14px] uppercase">{stepNumber} of 3</Text>
                  </View>
                  <View className="flex-row gap-xs mt-xs">
                    {[1, 2, 3].map((step) => (
                      <View key={step} className={`h-[8px] flex-1 rounded-full ${step <= stepNumber ? 'bg-dark' : 'bg-dark/15'}`} />
                    ))}
                  </View>

                  <View className={compact ? 'pt-md pb-sm' : 'pt-lg pb-md'}>
                    <Text className="font-heading-bold text-dark text-[16px] uppercase">
                      {stage === 'mind' ? 'Mind' : stage === 'body' ? 'Body' : 'Bond'}
                    </Text>
                    <Text className={`font-heading-bold text-dark uppercase mt-xs ${compact ? 'text-[22px] leading-[26px]' : 'text-[26px] leading-[30px]'}`}>
                      {stage === 'mind' ? "How's your head today?" : stage === 'body' ? 'How are you feeling physically?' : 'How connected do you feel today?'}
                    </Text>
                    <Text className={`font-body text-dark/65 text-[14px] leading-[20px] mt-xs ${compact ? 'mb-sm' : 'mb-md'}`}>
                      Choose the answer that feels closest to you.
                    </Text>

                    {stage === 'mind' ? (
                      <View accessibilityRole="radiogroup" className={compact ? 'gap-xs' : 'gap-sm'}>
                        {MOOD_OPTIONS.map((option) => (
                          <AnswerOption
                            key={option.key}
                            label={option.label}
                            emoji={option.emoji}
                            compact={compact}
                            selected={moodValue === option.value}
                            onPress={() => { setMoodValue(option.value); setError(null); }}
                          />
                        ))}
                      </View>
                    ) : null}
                    {stage === 'body' ? (
                      <View accessibilityRole="radiogroup" className={compact ? 'gap-xs' : 'gap-sm'}>
                        {BODY_OPTIONS.map((label, index) => (
                          <AnswerOption key={label} label={label} compact={compact} selected={energyLevel === index + 1} onPress={() => { setEnergyLevel(index + 1); setError(null); }} />
                        ))}
                      </View>
                    ) : null}
                    {stage === 'bond' ? (
                      <>
                        <View accessibilityRole="radiogroup" className={compact ? 'gap-xs' : 'gap-sm'}>
                          {BOND_OPTIONS.map((label, index) => (
                            <AnswerOption key={label} label={label} compact={compact} selected={connectionLevel === index + 1} onPress={() => { setConnectionLevel(index + 1); setError(null); }} />
                          ))}
                        </View>
                        <View className={compact ? 'mt-md' : 'mt-lg'}>
                          <Text className="font-heading-bold text-dark/70 text-[11px] tracking-label uppercase mb-xs">Sleep</Text>
                          <TextInput
                            value={sleep}
                            onChangeText={(value) => { setSleep(value.replace(/[^0-9.]/g, '')); setError(null); }}
                            placeholder="Add sleep hours (optional)"
                            placeholderTextColor="rgba(10,10,10,0.4)"
                            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}
                            returnKeyType="done"
                            inputAccessoryViewID={Platform.OS === 'ios' ? SLEEP_INPUT_ACCESSORY_ID : undefined}
                            onSubmitEditing={() => Keyboard.dismiss()}
                            maxLength={4}
                            accessibilityLabel="Optional hours slept last night"
                            className={`${compact ? 'h-[44px]' : 'h-[48px]'} rounded-button border border-dark/20 px-md text-dark text-[16px] font-body`}
                          />
                        </View>
                      </>
                    ) : null}
                  </View>
                </View>
              <InlineFormError message={error} surface="lime" className="mx-lg mb-sm" />

              {stage === 'mind' || stage === 'body' ? (
                <View className="px-lg pb-sm pt-xs">
                  <View className="flex-row gap-sm">
                    {stage === 'body' ? <ActionButton label="Back" compact={compact} secondary onPress={() => setStage('mind')} /> : null}
                    <ActionButton
                      label="Continue"
                      compact={compact}
                      onPress={() => setStage(stage === 'mind' ? 'body' : 'bond')}
                      disabled={stage === 'mind' ? moodValue === null : energyLevel === null}
                    />
                  </View>
                </View>
              ) : null}

              {stage === 'bond' ? (
                <View className="px-lg pb-sm pt-xs">
                  <View className="flex-row gap-sm">
                    <ActionButton label="Back" compact={compact} secondary onPress={() => setStage('body')} disabled={saving} />
                    <ActionButton label="Save check-in" compact={compact} onPress={() => void save()} disabled={connectionLevel === null || saving} loading={saving} />
                  </View>
                </View>
              ) : null}

                <Pressable
                  onPress={close}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Skip for now"
                  className="min-h-[44px] items-center justify-center px-lg"
                >
                  <Text className="font-body text-dark text-[14px]">
                    Skip for now
                  </Text>
                </Pressable>
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
          {Platform.OS === 'ios' ? (
            <InputAccessoryView nativeID={SLEEP_INPUT_ACCESSORY_ID}>
              <View className="flex-row justify-end border-t border-border bg-dark px-lg py-xs">
                <Pressable
                  onPress={() => Keyboard.dismiss()}
                  accessibilityRole="button"
                  className="min-h-[44px] justify-center px-md"
                >
                  <Text className="font-heading-bold text-lime text-[14px]">Done</Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          ) : null}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function IntroPillar({ icon, label, compact }: { icon: keyof typeof Feather.glyphMap; label: string; compact: boolean }) {
  return (
    <View className={`items-center ${compact ? 'gap-[2px]' : 'gap-xs'}`}>
      <View className={`${compact ? 'h-[52px] w-[52px]' : 'h-[68px] w-[68px]'} items-center justify-center rounded-full border-[2px] border-dark/20`}>
        <Feather name={icon} size={compact ? 25 : 31} color={colors.dark} />
      </View>
      <Text className={`font-heading-bold text-dark uppercase ${compact ? 'text-[12px]' : 'text-[14px]'}`}>{label}</Text>
    </View>
  );
}

function AnswerOption({ label, emoji, selected, compact, onPress }: { label: string; emoji?: string; selected: boolean; compact: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      className={`${compact ? 'min-h-[44px]' : 'min-h-[58px]'} flex-row items-center rounded-button border px-md ${selected ? 'border-dark bg-dark' : 'border-dark/25 bg-transparent'}`}
    >
      {emoji ? <Text className={`${compact ? 'text-[22px]' : 'text-[25px]'} mr-md`}>{emoji}</Text> : null}
      <Text className={`flex-1 font-heading-bold ${compact ? 'text-[15px]' : 'text-[16px]'} ${selected ? 'text-lime' : 'text-dark'}`}>
        {label}
      </Text>
      {selected ? <Feather name="check-circle" size={21} color={colors.lime} /> : null}
    </Pressable>
  );
}

function AnswerSummary({ icon, label, answer, last = false }: { icon: keyof typeof Feather.glyphMap; label: string; answer: string; last?: boolean }) {
  return (
    <View className={`min-h-[54px] flex-row items-center gap-md px-md ${last ? '' : 'border-b border-dark/15'}`}>
      <Feather name={icon} size={22} color={colors.dark} />
      <Text className="font-heading-bold text-dark text-[14px]">{label}:</Text>
      <Text className="flex-1 font-body text-dark text-[15px]">{answer}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, disabled = false, secondary = false, loading = false, compact = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; loading?: boolean; compact?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      className={`${compact ? 'min-h-[48px]' : 'min-h-[58px]'} flex-1 flex-row items-center justify-center gap-sm rounded-button px-md ${secondary ? 'border border-lime/50 bg-transparent' : 'bg-dark'} ${disabled ? 'opacity-40' : ''}`}
    >
      {loading ? <Text className="font-heading-bold text-lime text-[15px]">Saving...</Text> : <Text className={`font-heading-bold text-[15px] ${secondary ? 'text-dark' : 'text-lime'}`}>{label}</Text>}
      {!loading && !secondary && label !== 'Save check-in' ? <Feather name="arrow-right" size={19} color={colors.lime} /> : null}
    </Pressable>
  );
}
