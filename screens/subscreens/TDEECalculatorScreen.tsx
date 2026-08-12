import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import ScreenHero from '../../components/mockup/ScreenHero';
import {
  ACTIVITY_LABELS,
  calculateTDEE,
  ftInchesToCm,
  lbsToKg,
  type TDEEActivityLevel,
  type TDEEGender,
  type TDEEResult,
} from '../../lib/tdee';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type UnitSystem = 'metric' | 'imperial';
const ACTIVITIES = (Object.keys(ACTIVITY_LABELS) as TDEEActivityLevel[]).map((value) => ({ value, label: ACTIVITY_LABELS[value] }));

export default function TDEECalculatorScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const [units, setUnits] = useState<UnitSystem>('metric');
  const [gender, setGender] = useState<TDEEGender>('male');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [activityLevel, setActivityLevel] = useState<TDEEActivityLevel>('moderate');
  const [activityOpen, setActivityOpen] = useState(false);
  const [result, setResult] = useState<TDEEResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => navigation.goBack(), [navigation]);

  const calculate = useCallback(() => {
    setError(null);
    const parsedAge = Number(age);
    const resolvedWeight = units === 'metric' ? Number(weight) : lbsToKg(Number(weight));
    const resolvedHeight = units === 'metric' ? Number(heightCm) : ftInchesToCm(Number(heightFt), Number(heightIn || '0'));
    if (!parsedAge || parsedAge < 15 || parsedAge > 100 || !resolvedWeight || resolvedWeight < 30 || resolvedWeight > 300 || !resolvedHeight || resolvedHeight < 100 || resolvedHeight > 250) {
      setResult(null);
      setError('Enter valid values. Age: 15-100, weight: 30-300 kg, height: 100-250 cm.');
      return;
    }
    setResult(calculateTDEE({ age: parsedAge, weightKg: resolvedWeight, heightCm: resolvedHeight, gender, activityLevel }));
  }, [activityLevel, age, gender, heightCm, heightFt, heightIn, units, weight]);

  const reset = useCallback(() => {
    setAge(''); setWeight(''); setHeightCm(''); setHeightFt(''); setHeightIn(''); setResult(null); setError(null);
  }, []);
  const insights = useMemo(() => result ? buildInsights(result) : [], [result]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerClassName="px-lg pt-lg pb-xl gap-xl">
          <AppTopBar leftAccessory={<Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close TDEE calculator" hitSlop={8} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"><Feather name="x" size={20} color={colors.text} /></Pressable>} />
          <ScreenHero eyebrow="TDEE calculator" headline={'Know your\ndaily fuel'} sub="Calculate calories for your body, activity and goal." />

          <View className="gap-lg">
            <SegmentedControl options={[{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }]} value={units} onChange={(value) => { setUnits(value); setResult(null); setError(null); }} />
            <View>
              <Text className="font-heading-bold text-tertiary-text text-[9px] tracking-[0.8px] uppercase mb-sm">Gender</Text>
              <SegmentedControl options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} value={gender} onChange={setGender} />
            </View>
            <View className="flex-row gap-md">
              <NumberField label="Age" value={age} onChange={setAge} placeholder="35" />
              <NumberField label={units === 'metric' ? 'Weight kg' : 'Weight lbs'} value={weight} onChange={setWeight} placeholder={units === 'metric' ? '85' : '185'} />
            </View>
            {units === 'metric' ? <NumberField label="Height cm" value={heightCm} onChange={setHeightCm} placeholder="178" /> : <View className="flex-row gap-md"><NumberField label="Height ft" value={heightFt} onChange={setHeightFt} placeholder="5" /><NumberField label="Height in" value={heightIn} onChange={setHeightIn} placeholder="10" /></View>}
            <View className="border-y border-border">
              <DropdownTrigger label="Activity" value={ACTIVITY_LABELS[activityLevel]} open={activityOpen} onPress={() => setActivityOpen((open) => !open)} />
            </View>
            {activityOpen ? <DropdownOptions options={ACTIVITIES} value={activityLevel} onChange={(value) => { setActivityLevel(value); setActivityOpen(false); }} /> : null}
          </View>

          {error ? <View accessibilityRole="alert" className="rounded-button border border-red-400/40 bg-red-400/10 p-md"><Text className="font-body text-red-300 text-[13px] leading-[19px]">{error}</Text></View> : null}
          <View className="gap-sm"><LimeButton label="Calculate TDEE" onPress={calculate} />{result ? <Pressable onPress={reset} accessibilityRole="button" className="min-h-[44px] items-center justify-center"><Text className="font-heading-bold text-muted-text text-[12px] uppercase">Reset</Text></Pressable> : null}</View>

          {result ? (
            <View className="gap-xl border-t border-border pt-lg">
              <View className="flex-row flex-wrap gap-sm">
                <ResultStat label="BMR" value={result.bmr.toLocaleString()} detail="kcal/day" />
                <ResultStat label="TDEE" value={result.tdee.toLocaleString()} detail="kcal/day" />
                <ResultStat label="BMI" value={String(result.bmi)} detail={result.bmiCategory} />
                <ResultStat label="Activity" value={activityLevel.replace('_', ' ')} />
              </View>
              <View className="gap-md">
                <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Calorie targets</Text>
                <TargetRow label="Maintenance" value={result.maintenance} detail="Hold your current weight" highlighted />
                <TargetRow label="Fat loss" value={result.fatLoss} detail="500 kcal daily deficit" />
                <TargetRow label="Aggressive cut" value={result.aggressiveFatLoss} detail="750 kcal daily deficit" />
                <TargetRow label="Lean bulk" value={result.muscleGain} detail="300 kcal daily surplus" />
              </View>
              <View className="gap-md"><Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Insights</Text>{insights.map((text, index) => <View key={index} className="border-l-2 border-lime pl-md"><Text className="font-body text-muted-text text-[12px] leading-[18px]">{text}</Text></View>)}</View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function buildInsights(result: TDEEResult) {
  const first = result.bmi < 18.5
    ? `Your BMI of ${result.bmi} is below the healthy range. A quality calorie surplus can support healthy weight gain.`
    : result.bmi < 25
      ? `Your BMI of ${result.bmi} is in the healthy range. ${result.maintenance.toLocaleString()} kcal supports your current body composition.`
      : result.bmi < 30
        ? `Your BMI of ${result.bmi} is in the overweight range. A 500 kcal daily deficit targets about 0.5 kg loss per week.`
        : `Your BMI of ${result.bmi} is in the obese range. Consider professional guidance before using a larger deficit.`;
  const items = [first];
  if (result.tdee > 3000) items.push('Your high TDEE reflects significant activity. Fuel training with adequate carbohydrates.');
  items.push(`Your BMR is ${result.bmr.toLocaleString()} kcal. This is the energy your body uses at complete rest.`);
  items.push('This estimate uses the Mifflin-St Jeor formula. Adjust by 100-200 kcal after two weeks of real-world results.');
  return items;
}

function SegmentedControl<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View className="flex-row border border-border">{options.map((option, index) => { const selected = option.value === value; return <Pressable key={option.value} onPress={() => onChange(option.value)} accessibilityRole="button" accessibilityState={{ selected }} className={`flex-1 min-h-[44px] items-center justify-center ${index ? 'border-l border-border' : ''} ${selected ? 'bg-lime/10' : ''}`}><Text className={`font-heading-bold text-[12px] uppercase ${selected ? 'text-lime' : 'text-muted-text'}`}>{option.label}</Text></Pressable>; })}</View>;
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <View className="flex-1 gap-xs"><Text className="font-heading-bold text-tertiary-text text-[9px] tracking-[0.8px] uppercase">{label}</Text><TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="numeric" accessibilityLabel={label} className="min-h-[48px] border-b border-border font-heading-bold text-white text-[17px] py-sm" /></View>;
}

function DropdownTrigger({ label, value, open, onPress }: { label: string; value: string; open: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} className="px-sm py-md"><View className="flex-row items-center gap-xs"><Feather name="activity" size={14} color={colors.lime} /><Text className="font-heading-bold text-tertiary-text text-[9px] tracking-[0.8px] uppercase">{label}</Text></View><View className="flex-row items-center gap-xs mt-xs"><Text numberOfLines={1} className="font-heading-bold text-white text-[12px] uppercase flex-1">{value}</Text><Feather name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.lime} /></View></Pressable>;
}

function DropdownOptions<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View className="border-b border-border">{options.map((option, index) => { const selected = option.value === value; return <Pressable key={option.value} onPress={() => onChange(option.value)} accessibilityRole="button" accessibilityState={{ selected }} className={`min-h-[44px] flex-row items-center justify-between px-sm ${index ? 'border-t border-border' : ''} ${selected ? 'bg-lime/10' : ''}`}><Text className={`font-heading-bold text-[12px] uppercase flex-1 ${selected ? 'text-lime' : 'text-white'}`}>{option.label}</Text>{selected ? <Feather name="check" size={17} color={colors.lime} /> : null}</Pressable>; })}</View>;
}

function ResultStat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <View className="w-[48%] min-h-[96px] rounded-button border border-border bg-card p-md"><Text numberOfLines={1} adjustsFontSizeToFit className="font-heading text-lime text-[25px] uppercase">{value}</Text><Text className="font-heading-bold text-muted-text text-[10px] uppercase mt-xs">{label}</Text>{detail ? <Text numberOfLines={1} className="font-body text-tertiary-text text-[10px] mt-xs">{detail}</Text> : null}</View>;
}

function TargetRow({ label, value, detail, highlighted = false }: { label: string; value: number; detail: string; highlighted?: boolean }) {
  return <View className={`flex-row items-center justify-between gap-md border-b pb-md ${highlighted ? 'border-lime/50' : 'border-border'}`}><View className="flex-1"><Text className={`font-heading-bold text-[14px] uppercase ${highlighted ? 'text-lime' : 'text-white'}`}>{label}</Text><Text className="font-body text-tertiary-text text-[11px] mt-xs">{detail}</Text></View><Text className={`font-heading text-[25px] ${highlighted ? 'text-lime' : 'text-white'}`}>{value.toLocaleString()} <Text className="text-[11px]">kcal</Text></Text></View>;
}
