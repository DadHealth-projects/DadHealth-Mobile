import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import ScreenHero from '../../components/mockup/ScreenHero';
import TagPill from '../../components/dashboard/TagPill';
import { useAuth } from '../../contexts/AuthContext';
import { useFitnessLibrary } from '../../hooks/useFitnessLibrary';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

const CONFIGURED_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk';
const WEB_URL = CONFIGURED_WEB_URL.replace(/^https:\/\/dadhealth\.co\.uk(?=\/|$)/, 'https://www.dadhealth.co.uk').replace(/\/$/, '');
const CALORIES = [1800, 2000, 2200, 2500, 2800] as const;
const MEALS = [2, 3, 4, 5, 6] as const;
const ADULTS = [1, 2, 3, 4, 5, 6] as const;
const DIETS = [
  { value: 'none', label: 'No strict diet' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'glutenFree', label: 'Gluten-free' },
  { value: 'dairyFree', label: 'Dairy-free' },
] as const;

type Meal = { name?: string; ingredients?: string[]; macros?: Record<string, string | number>; prep_time?: string };
type GrocerySection = { category: string; items: string[] };
type MealPlan = {
  id?: string;
  plan: Array<{ day?: string; meals?: Record<string, Meal> }>;
  grocery_list?: GrocerySection[] | string[];
};

export default function MealPlannerScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user, session } = useAuth();
  const library = useFitnessLibrary(user?.id, true);
  const [calorieTarget, setCalorieTarget] = useState<(typeof CALORIES)[number]>(2200);
  const [mealsPerDay, setMealsPerDay] = useState<(typeof MEALS)[number]>(4);
  const [adults, setAdults] = useState<(typeof ADULTS)[number]>(1);
  const [dietaryPreference, setDietaryPreference] = useState<(typeof DIETS)[number]['value']>('none');
  const [preferences, setPreferences] = useState('');
  const [generatedPlan, setGeneratedPlan] = useState<MealPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFilter, setOpenFilter] = useState<'calories' | 'meals' | 'adults' | 'diet' | null>(null);

  const displayedDay = generatedPlan?.plan[selectedDay];
  const grocerySections = useMemo(() => normalizeGroceryList(generatedPlan?.grocery_list), [generatedPlan]);
  const close = useCallback(() => navigation.goBack(), [navigation]);
  const openLogin = useCallback(() => navigation.navigate('Login'), [navigation]);
  const openPro = useCallback(() => navigation.navigate('Tabs', { screen: 'Home' }), [navigation]);

  const generate = useCallback(async () => {
    setError(null);
    if (!session?.access_token) return openLogin();
    if (!library.isPro) return openPro();

    setGenerating(true);
    let accessToken = session.access_token;
    const tokenCheck = await supabase.auth.getUser(accessToken);
    if (tokenCheck.error || !tokenCheck.data.user) {
      const refreshed = await supabase.auth.refreshSession();
      accessToken = refreshed.data.session?.access_token ?? '';
      if (!accessToken) {
        setGenerating(false);
        setError('Your session has expired. Please log in again.');
        return;
      }
    }

    try {
      const response = await fetch(`${WEB_URL}/api/generate-meal-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Request-Id': `mobile-${Date.now()}`,
        },
        body: JSON.stringify({ calorieTarget, dietaryPreference, preferences: preferences.trim(), mealsPerDay, adults }),
      });
      const payload = await response.json() as MealPlan & { error?: string };
      if (!response.ok) throw new Error('generation_failed');
      setGeneratedPlan(payload);
      setSelectedDay(0);
    } catch {
      setError('We could not generate your meal plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [adults, calorieTarget, dietaryPreference, library.isPro, mealsPerDay, openLogin, openPro, preferences, session?.access_token]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerClassName="px-lg pt-lg pb-xl gap-xl"
      >
        <AppTopBar leftAccessory={<Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close meal planner" hitSlop={8} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"><Feather name="x" size={20} color={colors.text} /></Pressable>} />
        <ScreenHero eyebrow="Meal planner" headline={'Fuel your\nwhole week'} sub="Set your needs. Get five days of meals and one shopping list." />

        <View className="gap-md">
          <View>
            <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Plan filters</Text>
            <Text className="font-body text-white/45 text-[12px] leading-[18px] mt-xs">Choose your targets.</Text>
          </View>
          <View className="flex-row border-y border-border">
            <DropdownTrigger icon="activity" label="Calories" value={`${calorieTarget}`} open={openFilter === 'calories'} onPress={() => setOpenFilter(openFilter === 'calories' ? null : 'calories')} />
            <DropdownTrigger icon="coffee" label="Meals" value={`${mealsPerDay} daily`} open={openFilter === 'meals'} onPress={() => setOpenFilter(openFilter === 'meals' ? null : 'meals')} divided />
            <DropdownTrigger icon="users" label="Adults" value={`${adults}`} open={openFilter === 'adults'} onPress={() => setOpenFilter(openFilter === 'adults' ? null : 'adults')} divided />
          </View>
          {openFilter === 'calories' ? <DropdownOptions options={CALORIES.map((value) => ({ value, label: `${value} kcal` }))} value={calorieTarget} onChange={(value) => { setCalorieTarget(value); setOpenFilter(null); }} /> : null}
          {openFilter === 'meals' ? <DropdownOptions options={MEALS.map((value) => ({ value, label: `${value} meals per day` }))} value={mealsPerDay} onChange={(value) => { setMealsPerDay(value); setOpenFilter(null); }} /> : null}
          {openFilter === 'adults' ? <DropdownOptions options={ADULTS.map((value) => ({ value, label: `${value} ${value === 1 ? 'adult' : 'adults'}` }))} value={adults} onChange={(value) => { setAdults(value); setOpenFilter(null); }} /> : null}
          <View className="border-y border-border"><DropdownTrigger icon="shield" label="Diet" value={DIETS.find((item) => item.value === dietaryPreference)?.label ?? 'No strict diet'} open={openFilter === 'diet'} onPress={() => setOpenFilter(openFilter === 'diet' ? null : 'diet')} /></View>
          {openFilter === 'diet' ? <DropdownOptions options={DIETS} value={dietaryPreference} onChange={(value) => { setDietaryPreference(value); setOpenFilter(null); }} /> : null}
          <View className="gap-xs">
            <Text className="font-heading-bold text-white/40 text-[9px] tracking-[0.8px] uppercase">Preferences</Text>
            <TextInput value={preferences} onChangeText={setPreferences} placeholder="e.g. high-protein, no fish" placeholderTextColor="rgba(255,255,255,0.25)" accessibilityLabel="Other meal preferences" className="min-h-[48px] border-b border-border font-body text-white text-[14px] py-sm" />
          </View>
        </View>

        {!user ? <LimeButton label="Log in to generate" onPress={openLogin} /> : library.loading ? <LimeButton label="Loading meal planner" loading /> : library.proError ? <LimeButton label="Retry access" onPress={() => void library.refresh()} /> : !library.isPro ? <LimeButton label="View Dad Health Pro" onPress={openPro} /> : <LimeButton label={generatedPlan ? 'Regenerate meal plan' : 'Generate meal plan'} onPress={() => void generate()} loading={generating} />}
        {error || library.error || library.proError ? <View accessibilityRole="alert" className="rounded-button border border-red-400/40 bg-red-400/10 p-md"><Text className="font-body text-red-300 text-[13px] leading-[19px]">{error ?? library.error ?? library.proError}</Text></View> : null}

        {generatedPlan && displayedDay ? (
          <View className="gap-lg border-t border-border pt-lg">
            <View className="flex-row items-center justify-between gap-sm"><Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Your new plan</Text><TagPill label={`${generatedPlan.plan.length} days`} tone="outline" /></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm">
              {generatedPlan.plan.map((day, index) => <Pressable key={`${day.day}-${index}`} onPress={() => setSelectedDay(index)} accessibilityRole="tab" accessibilityState={{ selected: selectedDay === index }} className={`min-h-[42px] px-md items-center justify-center border-b-2 ${selectedDay === index ? 'border-lime' : 'border-transparent'}`}><Text className={`font-heading-bold text-[12px] uppercase ${selectedDay === index ? 'text-lime' : 'text-white/40'}`}>{day.day ?? `Day ${index + 1}`}</Text></Pressable>)}
            </ScrollView>
            <View className="gap-md">
              <Text className="font-heading text-white text-[27px] uppercase">{displayedDay.day ?? `Day ${selectedDay + 1}`}</Text>
              {Object.entries(displayedDay.meals ?? {}).map(([mealType, meal]) => (
                <View key={mealType} className="border-b border-border pb-md gap-xs">
                  <View className="flex-row items-center justify-between gap-sm"><Text className="font-heading-bold text-lime text-[10px] tracking-label uppercase">{mealType}</Text><Text className="font-body text-white/35 text-[11px]">{meal.prep_time ?? ''}</Text></View>
                  <Text className="font-heading-bold text-white text-[16px] uppercase">{meal.name ?? 'Unavailable'}</Text>
                  <Text className="font-body text-white/50 text-[12px] leading-[18px]">{meal.ingredients?.join(', ') ?? 'Ingredients not available'}</Text>
                  {meal.macros ? <Text className="font-body text-white/35 text-[11px] uppercase">{Object.entries(meal.macros).map(([key, value]) => `${key}: ${value}`).join('  ·  ')}</Text> : null}
                </View>
              ))}
            </View>
            {grocerySections.length ? <View className="gap-md"><Text className="font-heading text-white text-[28px] uppercase">Shopping list</Text>{grocerySections.map((section) => <View key={section.category} className="border-b border-border pb-md"><Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">{section.category}</Text><Text className="font-body text-white/55 text-[13px] leading-[20px] mt-xs">{section.items.join(', ')}</Text></View>)}</View> : null}
          </View>
        ) : user && library.isPro ? <Text className="font-body text-white/40 text-[13px] leading-[19px]">Your plan will appear here after you generate it.</Text> : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function normalizeGroceryList(list: MealPlan['grocery_list']): GrocerySection[] {
  if (!Array.isArray(list) || !list.length) return [];
  return typeof list[0] === 'string' ? [{ category: 'Shopping', items: list as string[] }] : list as GrocerySection[];
}

function DropdownTrigger({ icon, label, value, divided = false, open, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; divided?: boolean; open: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} className={`flex-1 min-w-0 px-sm py-md active:opacity-75 ${divided ? 'border-l border-border' : ''}`}><View className="flex-row items-center gap-xs"><Feather name={icon} size={14} color={colors.lime} /><Text className="font-heading-bold text-white/40 text-[9px] tracking-[0.8px] uppercase">{label}</Text></View><View className="flex-row items-center gap-xs mt-xs"><Text numberOfLines={1} adjustsFontSizeToFit className="font-heading-bold text-white text-[12px] uppercase flex-1">{value}</Text><Feather name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.lime} /></View></Pressable>;
}

function DropdownOptions<T extends string | number>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View className="border-b border-border">{options.map((option, index) => { const selected = option.value === value; return <Pressable key={String(option.value)} onPress={() => onChange(option.value)} accessibilityRole="button" accessibilityState={{ selected }} className={`min-h-[44px] flex-row items-center justify-between px-sm active:opacity-75 ${index > 0 ? 'border-t border-border' : ''} ${selected ? 'bg-lime/10' : ''}`}><Text className={`font-heading-bold text-[13px] uppercase ${selected ? 'text-lime' : 'text-white'}`}>{option.label}</Text>{selected ? <Feather name="check" size={17} color={colors.lime} /> : null}</Pressable>; })}</View>;
}
