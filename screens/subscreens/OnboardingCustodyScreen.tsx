import useOnboardingProgress from '../../hooks/useOnboardingProgress';
import { beginInitialCheckIn } from '../../lib/onboardingHandoff';
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import Card from '../../components/Card';
import FadeInView from '../../components/FadeInView';
import LimeButton from '../../components/LimeButton';
import { useAuth } from '../../contexts/AuthContext';
import { CHILD_AGE_OPTIONS, CUSTODY_OPTIONS, LEGACY_CUSTODY_MAP, onboardingSaveErrorMessage, type CustodyPattern } from '../../lib/onboarding';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'OnboardingCustody'>;

export default function OnboardingCustodyScreen({ navigation, route }: Props) {
  const { user, refreshOnboarding } = useAuth();
  const progress = useOnboardingProgress(user?.id);
  const selection = progress.choices.custody as CustodyPattern | null;
  const ages = progress.choices.ages;
  const current = useRef(user?.id); current.current = user?.id;
  const writing = useRef(false);
  useEffect(() => { current.current = user?.id; return () => { current.current = undefined; }; }, [user?.id]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Goals chosen on the previous step — passed via route params (Phase 6) so the
  // custody step can write goals + custody + completion in ONE upsert.
  const goals = route.params?.goals ?? progress.choices.goals;

  const handleContinue = async () => {

    if (writing.current || !progress.ready) return;
    if (!selection) {
      setError('Select how often you see your kids to continue.');
      return;
    }
    if (selection !== 'no_children' && !ages.length) { setError('Select your children’s age groups to continue.'); return; }
    if (!user?.id) {
      setError("You're not signed in. Please sign in again to save your choices.");
      return;
    }

    const owner = user.id;
    writing.current = true;
    setSaving(true);
    setError(null);
    try {

      const { data: savedProfile, error: saveError } = await supabase
        .from('user_profile')
        .upsert({
          user_id: owner,
          // Phase 6 — write everything here: goals (from the previous step) +
          // custody pattern + legacy mapped value + completion flag.
          ...(goals && goals.length > 0 ? { goals } : {}),
          custody_pattern: selection,
          kids_ages: selection === 'no_children' ? [] : ages,
          custody_arrangement: LEGACY_CUSTODY_MAP[selection],
          onboarding_complete: true,
        }, { onConflict: 'user_id' })
        .select('goals,custody_pattern,kids_ages,onboarding_complete')
        .single();

      if (saveError) throw saveError;
      if (current.current !== owner) return;

      if (
        !savedProfile ||
        JSON.stringify(savedProfile.goals) !== JSON.stringify(goals) ||
        savedProfile.custody_pattern !== selection ||
        savedProfile.onboarding_complete !== true ||
        JSON.stringify(savedProfile.kids_ages) !== JSON.stringify(selection === 'no_children' ? [] : ages)
      ) {
        setError('We could not confirm that your choices were saved. Please try again.');
        return;
      }

      beginInitialCheckIn(owner);
      const complete = await refreshOnboarding();
      if (current.current !== owner) return;

      // Phase 2 — give immediate feedback. Once the context confirms completion,
      // reset the stack to Tabs so there's no back path into onboarding. The
      // RootNavigator `key` swap to 'tabs' is a belt-and-braces backstop.
      if (complete) {

        navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
      } else {
        setError('Your choices were saved, but we could not verify completion. Please close and reopen the app, then try again.');
      }
    } catch (saveError) {
      if (current.current === owner) setError(onboardingSaveErrorMessage(saveError));
    } finally {
      writing.current = false;
      if (current.current === owner) setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView
        contentContainerClassName="px-lg pt-lg pb-lg gap-lg"
        showsVerticalScrollIndicator={false}
      >
        <FadeInView>
          <Text className="font-heading-semibold text-lime text-[13px] tracking-label uppercase mb-sm">Family details</Text>
          <Text className="font-heading text-white text-[42px] leading-[44px] uppercase">Tell us about your family</Text>
        </FadeInView>

        <View className="gap-sm">
          <Text className="font-heading-bold text-white text-[22px] leading-[26px]">Time with your kids</Text>
          <Text className="font-body text-white text-[14px] leading-[20px]">Choose one.</Text>
          {CUSTODY_OPTIONS.map((option, index) => {
            const selected = selection === option.value;
            return (
              <FadeInView key={option.value} delay={80 + index * 55}>
                <Pressable
                  onPress={() => { progress.change({ custody: option.value }); setError(null); }}
                  disabled={saving || !progress.ready}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: saving || !progress.ready }}
                >
                  <Card className={`${selected ? 'border-lime bg-lime/10' : ''} flex-row gap-md items-start`}>
                    <Text className="text-[28px] leading-[32px]">{option.icon}</Text>
                    <View className="flex-1">
                      <Text className={`font-heading-bold text-[20px] leading-[22px] uppercase ${selected ? 'text-lime' : 'text-white'}`}>{option.label}</Text>
                      <Text className="font-body text-muted-text text-[14px] leading-[19px] mt-xs">{option.sub}</Text>
                    </View>
                    <Feather name={selected ? 'check-circle' : 'circle'} size={24} color={selected ? colors.lime : colors.text} />
                  </Card>
                </Pressable>
              </FadeInView>
            );
          })}
        </View>

        {selection !== 'no_children' ? <View className="gap-sm">
          <Text className="font-heading-bold text-white text-[22px]">Children’s ages</Text>
          <Text className="font-body text-white text-[14px]">Choose all that apply. Dad Days starts with your youngest child.</Text>
          {[...CHILD_AGE_OPTIONS, ...ages.filter(age => !CHILD_AGE_OPTIONS.some(o => o.value === age)).map(value => ({ value, label: value }))].map(option => (
            <Pressable key={option.value} accessibilityRole="checkbox" accessibilityState={{ checked: ages.includes(option.value) }}
              disabled={saving || !progress.ready} className={`min-h-[48px] flex-row items-center gap-md rounded-button border p-md ${ages.includes(option.value) ? 'border-lime bg-lime/10' : 'border-border bg-card'}`}
              onPress={() => progress.change({ ages: ages.includes(option.value) ? ages.filter(age => age !== option.value) : [...ages, option.value] })}>
              <Text className="flex-1 font-body text-white text-[16px] leading-[24px]">{option.label}</Text>
              <Feather name={ages.includes(option.value) ? 'check-square' : 'square'} size={24} color={ages.includes(option.value) ? colors.lime : colors.text} />
            </Pressable>
          ))}
        </View> : null}

        {selection && selection !== 'daily' && selection !== 'no_children' ? (
          <FadeInView>
            <Card className="border-lime/50 bg-lime/10">
              <Text className="font-heading-bold text-lime text-[16px] leading-[18px] tracking-[0.5px] uppercase">Your Bond score is protected</Text>
              <Text className="font-body text-muted-text text-[14px] leading-[21px] mt-sm">On days you're not with your kids your Bond score is based on remote connection — a call, a voice note, a shared photo. It's capped at 80 on those days. You're never penalised for time you don't have.</Text>
            </Card>
          </FadeInView>
        ) : null}
      </ScrollView>

      {/* Fixed footer — SafeAreaView > ScrollView > fixed footer (Phase 7).
          Uses the shared LimeButton (Phase 8) — no hand-rolled Pressable. */}
      <View className="px-lg pt-sm pb-lg gap-sm border-t border-border">
        <View className="flex-row gap-xs mb-sm">
          <View className="h-[6px] flex-1 rounded-full bg-lime" />
          <View className="h-[6px] flex-1 rounded-full bg-lime" />
          <View className="h-[6px] flex-1 rounded-full bg-lime" />
        </View>
        {error || progress.error ? (
          <Text className="font-body text-[#F87171] text-[14px] leading-[20px]">{error || progress.error}</Text>
        ) : null}
        <LimeButton
          label="Continue"
          onPress={handleContinue}
          disabled={!selection || !progress.ready}
          loading={saving}
        />
      </View>
    </SafeAreaView>
  );
}
