import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import Card from '../../components/Card';
import FadeInView from '../../components/FadeInView';
import LimeButton from '../../components/LimeButton';
import { useAuth } from '../../contexts/AuthContext';
import { CUSTODY_OPTIONS, LEGACY_CUSTODY_MAP, onboardingSaveErrorMessage, type CustodyPattern } from '../../lib/onboarding';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'OnboardingCustody'>;

export default function OnboardingCustodyScreen({ navigation, route }: Props) {
  const { user, refreshOnboarding } = useAuth();
  const [selection, setSelection] = useState<CustodyPattern | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Goals chosen on the previous step — passed via route params (Phase 6) so the
  // custody step can write goals + custody + completion in ONE upsert.
  const goals = route.params?.goals;

  const handleContinue = async () => {
    if (saving) return;
    if (!selection) {
      setError('Select how often you see your kids to continue.');
      return;
    }
    if (!user?.id) {
      setError("You're not signed in. Please sign in again to save your choices.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data: savedProfile, error: saveError } = await supabase
        .from('user_profile')
        .upsert({
          user_id: user.id,
          // Phase 6 — write everything here: goals (from the previous step) +
          // custody pattern + legacy mapped value + completion flag.
          ...(goals && goals.length > 0 ? { goals } : {}),
          custody_pattern: selection,
          custody_arrangement: LEGACY_CUSTODY_MAP[selection],
          onboarding_complete: true,
        }, { onConflict: 'user_id' })
        .select('goals,custody_pattern,onboarding_complete')
        .single();
      if (saveError) throw saveError;

      if (
        !savedProfile ||
        savedProfile.custody_pattern !== selection ||
        savedProfile.onboarding_complete !== true
      ) {
        setError('We could not confirm that your choices were saved. Please try again.');
        return;
      }

      const complete = await refreshOnboarding();

      // Phase 2 — give immediate feedback. Once the context confirms completion,
      // reset the stack to Tabs so there's no back path into onboarding. The
      // RootNavigator `key` swap to 'tabs' is a belt-and-braces backstop.
      if (complete) {
        navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
      } else {
        setError('Your choices were saved, but we could not verify completion. Please close and reopen the app, then try again.');
      }
    } catch (saveError) {
      setError(onboardingSaveErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView
        contentContainerClassName="px-lg pt-lg pb-lg gap-lg"
        showsVerticalScrollIndicator={false}
      >
<View className="flex-row gap-xs mb-lg">
          <View className="h-[6px] flex-1 rounded-full bg-lime" />
          <View className="h-[6px] flex-1 rounded-full bg-lime" />
          <View className="h-[6px] flex-1 rounded-full bg-lime" />
        </View>
        <FadeInView>
          <Text className="font-heading-semibold text-lime text-[13px] tracking-label uppercase mb-sm">Your routine</Text>
          <Text className="font-heading text-white text-[42px] leading-[44px] uppercase">How often do you see your kids?</Text>
        </FadeInView>

        <View className="gap-sm">
          {CUSTODY_OPTIONS.map((option, index) => {
            const selected = selection === option.value;
            return (
              <FadeInView key={option.value} delay={80 + index * 55}>
                <Pressable
                  onPress={() => { setSelection(option.value); setError(null); }}
                  disabled={saving}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <Card className={`${selected ? 'border-lime bg-lime/10' : ''} flex-row gap-md items-start`}>
                    <Text className="text-[28px] leading-[32px]">{option.icon}</Text>
                    <View className="flex-1">
                      <Text className={`font-heading-bold text-[20px] leading-[22px] uppercase ${selected ? 'text-lime' : 'text-white'}`}>{option.label}</Text>
                      <Text className="font-body text-muted-text text-[13px] leading-[19px] mt-xs">{option.sub}</Text>
                    </View>
                  </Card>
                </Pressable>
              </FadeInView>
            );
          })}
        </View>

        {selection && selection !== 'daily' ? (
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
        {error ? (
          <Text className="font-body text-[#F87171] text-[14px] leading-[20px]">{error}</Text>
        ) : null}
        <LimeButton
          label="Continue"
          onPress={handleContinue}
          disabled={!selection}
          loading={saving}
        />
      </View>
    </SafeAreaView>
  );
}
