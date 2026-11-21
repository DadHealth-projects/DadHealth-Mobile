import useOnboardingProgress from '../../hooks/useOnboardingProgress';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Card from '../../components/Card';
import FadeInView from '../../components/FadeInView';
import LimeButton from '../../components/LimeButton';
import { useAuth } from '../../contexts/AuthContext';
import {
  GOALS,
  onboardingSaveErrorMessage,
} from '../../lib/onboarding';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type Navigation = NativeStackNavigationProp<AppStackParamList, 'OnboardingGoals'>;

export default function OnboardingGoalsScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const progress = useOnboardingProgress(user?.id);
  const selectedGoals = progress.choices.goals;
  const current = useRef(user?.id); current.current = user?.id;
  const writing = useRef(false);
  useEffect(() => { current.current = user?.id; return () => { current.current = undefined; }; }, [user?.id]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleGoal = (title: string) => {
    setError(null);
    progress.change({ goals: selectedGoals.includes(title)
      ? selectedGoals.filter(goal => goal !== title) : [...selectedGoals, title] });
  };

  const handleContinue = async () => {

    if (selectedGoals.length === 0 || writing.current || !progress.ready) return;
    if (!user?.id) {
      setError("You're not signed in. Please sign in again to save your choices.");
      return;
    }

    const owner = user.id;
    writing.current = true;
    setSaving(true);
    setError(null);
    try {

      const { data: saved, error: saveError } = await supabase
        .from('user_profile')
        .upsert({ user_id: owner, goals: selectedGoals }, { onConflict: 'user_id' }).select('goals').single();

      if (saveError) throw saveError;
      if (current.current !== owner) return;
      if (JSON.stringify(saved?.goals) !== JSON.stringify(selectedGoals)) throw new Error('unconfirmed');
      // Phase 5 — replace (not push/navigate) so the user can't go back to the
      // goals screen and submit twice. Goals are also passed along for the
      // single combined save on the custody step (Phase 6).

      navigation.replace('OnboardingCustody', { goals: selectedGoals });
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
<View className="flex-row gap-xs mb-lg">
          <View className="h-[6px] flex-1 rounded-full bg-lime" />
          <View className="h-[6px] flex-1 rounded-full bg-lime" />
          <View className="h-[6px] flex-1 rounded-full bg-border" />
        </View>
        <FadeInView>
          <Text className="font-heading-semibold text-lime text-[13px] tracking-label uppercase mb-sm">Your focus</Text>
          <Text className="font-heading text-white text-[42px] leading-[44px] uppercase">What brings you here?</Text>
          <Text className="font-body text-muted-text text-[15px] leading-[23px] mt-md">Choose everything that feels true right now.</Text>
        </FadeInView>

        <View className="gap-sm">
          {GOALS.map((goal, index) => {
            const selected = selectedGoals.includes(goal.title);
            return (
              <FadeInView key={goal.title} delay={80 + index * 45}>
                <Pressable
                  onPress={() => toggleGoal(goal.title)}
                  disabled={saving || !progress.ready}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <Card className={`${selected ? 'border-lime bg-lime/10' : ''} flex-row gap-md items-start`}>
                    <Text className="text-[28px] leading-[32px]">{goal.icon}</Text>
                    <View className="flex-1">
                      <Text className={`font-heading-bold text-[20px] leading-[22px] uppercase ${selected ? 'text-lime' : 'text-white'}`}>{goal.title}</Text>
                      <Text className="font-body text-muted-text text-[14px] leading-[19px] mt-xs">{goal.sub}</Text>
                    </View>
                  </Card>
                </Pressable>
              </FadeInView>
            );
          })}
        </View>
      </ScrollView>

      {/* Fixed footer — same pattern as the custody screen (Phase 7): SafeAreaView
          > ScrollView > fixed footer, so the button is always visible/tappable. */}
      <View className="px-lg pt-sm pb-lg gap-sm border-t border-border">
        {error || progress.error ? (
          <Text className="font-body text-[#F87171] text-[14px] leading-[20px]">{error || progress.error}</Text>
        ) : null}
        <LimeButton
          label="Continue"
          onPress={handleContinue}
          disabled={!progress.ready || selectedGoals.length === 0}
          loading={saving}
        />
      </View>
    </SafeAreaView>
  );
}
