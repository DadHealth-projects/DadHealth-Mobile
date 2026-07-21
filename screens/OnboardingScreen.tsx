import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  PARENT_TYPE_OPTIONS,
  PRONOUN_OPTIONS,
  CUSTODY_OPTIONS,
  KIDS_AGES_OPTIONS,
} from '../lib/onboarding';
import { colors } from '../theme';

const TOTAL_STEPS = 5;

/**
 * Phase 1 onboarding — five questions written incrementally to public.user_profile
 * (same contract as the web Phase1OnboardingModal). Shown by RootNavigator when a
 * signed-in user hasn't completed onboarding; on finish it refreshes auth state
 * and the app swaps to the tabs.
 *
 * No dedicated onboarding mockup was provided, so this follows the app's existing
 * visual language (eyebrow + Barlow Condensed headline + lime controls).
 */
export default function OnboardingScreen() {
  const { user, refreshOnboarding } = useAuth();
  const userId = user?.id;

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [parentType, setParentType] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [custody, setCustody] = useState('');
  const [kidsAges, setKidsAges] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleKidsAge = (value: string) =>
    setKidsAges((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );

  // Incremental save — write only the field(s) for the current step.
  const saveStep = async (updates: Record<string, unknown>): Promise<boolean> => {
    if (!userId) {
      setError('You’re not signed in. Please sign in again.');
      return false;
    }
    setError(null);
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from('user_profile')
        .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });
      if (err) throw err;
      return true;
    } catch (e) {
      console.warn(
        '[onboarding]',
        JSON.stringify({ op: 'saveStep', message: e instanceof Error ? e.message : String(e) })
      );
      setError('Could not save. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const next = (n: number) => setStep(n);

  const handleName = async () => {
    if (!displayName.trim()) return;
    if (await saveStep({ display_name: displayName.trim() })) next(2);
  };
  const handleParentType = async () => {
    if (!parentType) return;
    if (await saveStep({ parent_type: parentType })) next(3);
  };
  const handlePronouns = async () => {
    // Q3 optional.
    if (await saveStep({ pronouns: pronouns || null })) next(4);
  };
  const handleCustody = async () => {
    if (!custody) return;
    if (await saveStep({ custody_arrangement: custody })) next(5);
  };
  const handleFinish = async () => {
    if (kidsAges.length === 0) return;
    if (await saveStep({ kids_ages: kidsAges })) {
      // Onboarding now complete → refresh gate → RootNavigator shows the tabs.
      await refreshOnboarding();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="grow px-lg pt-lg pb-xl"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Progress */}
          <View className="flex-row gap-xs mb-lg">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                className={`h-[6px] flex-1 rounded-full ${i < step ? 'bg-lime' : 'bg-border'}`}
              />
            ))}
          </View>

          <Text className="font-heading-semibold text-lime text-[11px] tracking-label uppercase mb-lg">
            Phase 1 of 3 · Who you are
          </Text>

          {step === 1 ? (
            <StepShell title="What should we call you?" helper="First name is fine. We’ll use it in your check-ins and reminders.">
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={colors.tertiaryText}
                maxLength={40}
                autoFocus
                editable={!saving}
                className="bg-muted/40 border border-border rounded-button px-md py-md text-white text-[16px] font-body focus:border-lime"
              />
            </StepShell>
          ) : null}

          {step === 2 ? (
            <StepShell title="What type of parent are you?" helper="We use this to surface the right Dad Circles and content for you.">
              <OptionList options={PARENT_TYPE_OPTIONS} value={parentType} onSelect={setParentType} />
            </StepShell>
          ) : null}

          {step === 3 ? (
            <StepShell title="What are your pronouns?" helper="Used to personalise notifications. Optional — you can skip.">
              <OptionList options={PRONOUN_OPTIONS} value={pronouns} onSelect={setPronouns} />
            </StepShell>
          ) : null}

          {step === 4 ? (
            <StepShell title="How often do you see your children?" helper="This shapes how your Bond score is calculated — pick the closest fit.">
              <OptionList options={CUSTODY_OPTIONS} value={custody} onSelect={setCustody} />
            </StepShell>
          ) : null}

          {step === 5 ? (
            <StepShell title="How old are your children?" helper="Select all that apply.">
              <View className="flex-row flex-wrap gap-sm">
                {KIDS_AGES_OPTIONS.map((opt) => {
                  const selected = kidsAges.includes(opt.value);
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => toggleKidsAge(opt.value)}
                      className={`px-md py-sm rounded-button border ${
                        selected ? 'border-lime bg-lime/10' : 'border-border'
                      }`}
                    >
                      <Text
                        className={`font-heading-semibold text-[13px] tracking-[0.5px] uppercase ${
                          selected ? 'text-lime' : 'text-white'
                        }`}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </StepShell>
          ) : null}

          {error ? (
            <Text className="font-body text-[#F87171] text-[14px] mt-md">{error}</Text>
          ) : null}

          <View className="mt-auto pt-xl gap-sm">
            <PrimaryButton
              label={step === TOTAL_STEPS ? 'Finish' : 'Continue'}
              saving={saving}
              onPress={
                step === 1
                  ? handleName
                  : step === 2
                  ? handleParentType
                  : step === 3
                  ? handlePronouns
                  : step === 4
                  ? handleCustody
                  : handleFinish
              }
            />
            {step === 3 ? (
              <Pressable onPress={handlePronouns} disabled={saving} className="items-center py-sm active:opacity-70">
                <Text className="font-heading-semibold text-muted-text text-[12px] tracking-label uppercase">
                  Skip for now
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepShell({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text className="font-heading text-white text-[34px] leading-[36px] uppercase mb-sm">
        {title}
      </Text>
      {helper ? (
        <Text className="font-body text-muted-text text-[15px] leading-[22px] mb-lg">{helper}</Text>
      ) : null}
      {children}
    </View>
  );
}

function OptionList({
  options,
  value,
  onSelect,
}: {
  options: { value: string; label: string; hint?: string }[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View className="gap-sm">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            className={`px-md py-md rounded-button border ${
              selected ? 'border-lime bg-lime/10' : 'border-border'
            } active:border-lime`}
          >
            <Text
              className={`font-heading-semibold text-[15px] tracking-[0.5px] uppercase ${
                selected ? 'text-lime' : 'text-white'
              }`}
            >
              {opt.label}
            </Text>
            {opt.hint ? (
              <Text className="font-body text-muted-text text-[12px] mt-xs">{opt.hint}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function PrimaryButton({
  label,
  saving,
  onPress,
}: {
  label: string;
  saving: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={saving}
      className="bg-lime rounded-button px-lg py-md items-center justify-center active:bg-lime-hover active:opacity-90 disabled:opacity-60"
    >
      {saving ? (
        <ActivityIndicator color={colors.dark} />
      ) : (
        <Text className="font-heading-bold text-dark text-[15px] tracking-[1px] uppercase">
          {label} →
        </Text>
      )}
    </Pressable>
  );
}
