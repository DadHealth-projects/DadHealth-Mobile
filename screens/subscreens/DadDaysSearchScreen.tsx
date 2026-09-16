import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

import AppTopBar from '../../components/AppTopBar';
import InlineFormError from '../../components/InlineFormError';
import LimeButton from '../../components/LimeButton';
import ProPromptModal from '../../components/ProPromptModal';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { useDashboard } from '../../hooks/useDashboard';
import { trackEvent } from '../../lib/analytics';
import { PRO_MOMENTS } from '../../lib/proMoments';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type Budget = 'free' | 'under_20' | 'over_20';
type ChildAge = 'toddler' | 'primary' | 'teen';
type SearchResult = { name: string; description: string; address: string; distanceMiles: number; estimatedCost: string; ageRange: string; websiteUrl: string; requiresBooking: boolean };
type QuickFilter = '60_minutes' | 'under_20' | 'raining' | 'active' | 'creative' | 'at_home';

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/, '');
const RADIUS_KEY = 'dadHealth.dadDaysRadius';
const FREE_LIMIT = 3;
const BUDGETS = [{ value: 'free', label: 'Free' }, { value: 'under_20', label: 'Under £20' }, { value: 'over_20', label: 'Over £20' }] as const;
const AGES = [{ value: 'toddler', label: 'Toddler 0-4' }, { value: 'primary', label: 'Primary 5-11' }, { value: 'teen', label: 'Teen 12+' }] as const;
const RADII = [{ value: '5', label: '5 mi' }, { value: '10', label: '10 mi' }, { value: '20', label: '20 mi' }, { value: '50', label: '50 mi' }] as const;
const QUICK_FILTERS: Array<{ value: QuickFilter; label: string }> = [
  { value: '60_minutes', label: 'I have 60 minutes' },
  { value: 'under_20', label: 'I have £20' },
  { value: 'raining', label: "It's raining" },
  { value: 'active', label: 'Active' },
  { value: 'creative', label: 'Creative' },
  { value: 'at_home', label: 'At-home' },
];

export default function DadDaysSearchScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user, session } = useAuth();
  const { isOffline, showOfflineAction } = useNetworkStatus();
  const { refresh: refreshDashboard } = useDashboard(user?.id);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [postcodeInput, setPostcodeInput] = useState('');
  const [postcode, setPostcode] = useState('');
  const [budget, setBudget] = useState<Budget>('free');
  const [childAge, setChildAge] = useState<ChildAge>('primary');
  const [radius, setRadius] = useState('20');
  const [quickFilters, setQuickFilters] = useState<QuickFilter[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [searchesUsed, setSearchesUsed] = useState(0);
  const [accessReady, setAccessReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  // Two inline slots: location problems sit under the location fields, search
  // problems sit next to the search action.
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ name: string; message: string } | null>(null);
  const [openFilter, setOpenFilter] = useState<'budget' | 'radius' | 'age' | null>(null);
  const [limitPromptOpen, setLimitPromptOpen] = useState(false);

  useEffect(() => {
    void SecureStore.getItemAsync(RADIUS_KEY).then((saved) => {
      if (saved && RADII.some((option) => option.value === saved)) setRadius(saved);
    }).catch(() => {});
  }, []);

  const loadAccess = useCallback(async () => {
    if (!user?.id || !session?.access_token || isOffline) {
      setAccessReady(false);
      return;
    }

    setSearchError(null);
    setAccessReady(false);
    try {
      const response = await fetch(`${WEB_URL}/api/dad_days_searches`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json() as { isPro?: boolean; searchesUsed?: number | null; childAge?: string | null };
      if (!response.ok || typeof body.isPro !== 'boolean') throw new Error('allowance_unavailable');

      setIsPro(body.isPro);
      setSearchesUsed(typeof body.searchesUsed === 'number' ? body.searchesUsed : 0);
      if (body.childAge && AGES.some((option) => option.value === body.childAge)) {
        setChildAge(body.childAge as ChildAge);
      }
      setAccessReady(true);
    } catch {
      setSearchError('We could not load your Dad Days allowance. Please try again.');
    }
  }, [isOffline, session?.access_token, user?.id]);

  useEffect(() => { void loadAccess(); }, [loadAccess]);

  const useLocation = useCallback(async () => {
    setLocating(true); setLocationError(null); setSearchError(null);
    try {
      const currentPermission = await Location.getForegroundPermissionsAsync();
      const permission = currentPermission.status === 'granted'
        ? currentPermission
        : currentPermission.canAskAgain
          ? await Location.requestForegroundPermissionsAsync()
          : currentPermission;
      if (permission.status !== 'granted') {
        setLocationError('Location access was not allowed. Enter a postcode instead.');
        if (!permission.canAskAgain) {
          Alert.alert(
            'Location access is off',
            'Enable location access for Dad Health in Settings, or enter a postcode.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => void Linking.openSettings() },
            ],
          );
        }
        return;
      }
      const recent = await Location.getLastKnownPositionAsync({ maxAge: 300000, requiredAccuracy: 5000 });
      const current = recent ?? await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('location_timeout')), 15000)),
      ]);
      setCoords({ latitude: current.coords.latitude, longitude: current.coords.longitude });
      setPostcode(''); setPostcodeInput('');
    } catch {
      setLocationError('We could not get your location. Enter a postcode instead.');
    } finally { setLocating(false); }
  }, []);

  const usePostcode = useCallback(async () => {
    if (isOffline) { showOfflineAction('dad_days_search'); return; }
    if (!postcodeInput.trim()) { setLocationError('Enter a UK postcode.'); return; }
    setLocating(true); setLocationError(null); setSearchError(null);
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcodeInput.trim())}`);
      const body = await response.json() as { result?: { latitude?: number; longitude?: number } };
      if (!response.ok || typeof body.result?.latitude !== 'number' || typeof body.result.longitude !== 'number') throw new Error('invalid_postcode');
      setCoords({ latitude: body.result.latitude, longitude: body.result.longitude });
      setPostcode(postcodeInput.trim().toUpperCase());
    } catch {
      setLocationError("We couldn't find that postcode. Check it and try again.");
    } finally { setLocating(false); }
  }, [isOffline, postcodeInput, showOfflineAction]);

  const remaining = Math.max(0, FREE_LIMIT - searchesUsed);
  const limitReached = accessReady && !isPro && remaining === 0;
  const search = useCallback(async () => {
    if (!user || !session?.access_token) { navigation.navigate('Login'); return; }
    if (isOffline) { showOfflineAction('dad_days_search'); return; }
    if (!coords) { setLocationError('Use your location or enter a postcode first.'); return; }
    if (limitReached) { setLimitPromptOpen(true); return; }
    setSearching(true); setSearchError(null); setResults([]);
    try {
      const response = await fetch(`${WEB_URL}/api/dad_days_searches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...coords, postcode, budget, radius: Number(radius), childAge, quickFilters, userId: user.id }),
      });
      const body = await response.json() as { results?: SearchResult[]; searchesUsed?: number; error?: string };
      if (response.status === 401) { setSearchError('Your session has expired. Please log in again.'); return; }
      if (body.error === 'search_limit_reached' || response.status === 403) { setSearchesUsed(FREE_LIMIT); setLimitPromptOpen(true); trackEvent('dad_days_search_limit_reached', { searchesUsed: FREE_LIMIT }, user.id); return; }
      if (!response.ok) { setSearchError(response.status === 429 ? "You're searching too quickly. Wait a moment and try again." : 'We could not search for Dad Days. Please try again.'); return; }
      const nextResults = body.results ?? [];
      setResults(nextResults);
      setSearchesUsed(body.searchesUsed ?? searchesUsed);
      if (nextResults.length === 0) setSearchError('No activities were found nearby. Increase the radius or change the budget.');
      trackEvent('dad_days_search_completed', { budget, radius: Number(radius), childAge, resultCount: nextResults.length, isPro }, user.id);
    } catch { setSearchError('We could not search for Dad Days. Check your connection and try again.'); }
    finally { setSearching(false); }
  }, [budget, childAge, coords, isOffline, isPro, limitReached, navigation, postcode, quickFilters, radius, searchesUsed, session?.access_token, showOfflineAction, user]);

  const save = useCallback(async (result: SearchResult) => {
    if (!user?.id) return;
    if (isOffline) { showOfflineAction('dad_days_save'); return; }
    setSavingName(result.name);
    setSaveError(null);
    const saveResult = await supabase.from('dad_dates').insert({ user_id: user.id, icon: 'map-pin', name: result.name, age_range: result.ageRange, budget: result.estimatedCost, duration_minutes: 120, time_of_day: 'Any time', source: 'ai_search', booking_url: result.websiteUrl, address: result.address, requires_booking: result.requiresBooking });
    if (saveResult.error) setSaveError({ name: result.name, message: 'We could not save this activity. Please try again.' });
    else {
      trackEvent('dad_days_result_saved', { activityName: result.name, budget }, user.id);
      await refreshDashboard();
      Alert.alert('Saved', 'This activity was added to your Dad Date Ideas.');
    }
    setSavingName(null);
  }, [budget, isOffline, refreshDashboard, showOfflineAction, user?.id]);

  const locationLabel = coords ? (postcode ? postcode : 'Current location') : 'No location set';
  // Moment 7 wording is the used count, not the remaining count.
  const searchesUsedLabel = `${Math.min(searchesUsed, FREE_LIMIT)} of ${FREE_LIMIT} free Dad Days searches used this month.`;
  const openPro = () => {
    setLimitPromptOpen(false);
    navigation.navigate('ProSubscription');
  };
  const openResultWebsite = (url: string) => {
    if (isOffline) { showOfflineAction('dad_days_open'); return; }
    openSecureWebsite(url);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="px-lg pt-lg pb-xl gap-xl">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close Dad Days search" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="x" size={20} color={colors.text} /></Pressable>} />
        <ScreenHero eyebrow="Dad Days" headline={'Find your\nnext day out'} sub="Search nearby activities by age, budget and distance." />

        {!user ? <LimeButton label="Log in to search" onPress={() => navigation.navigate('Login')} /> : (
          <View className="gap-xl">
            <View className="gap-md">
              <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Location</Text>
              <Pressable onPress={() => void useLocation()} disabled={locating} accessibilityRole="button" accessibilityState={{ busy: locating }} className="min-h-[48px] flex-row items-center justify-center gap-sm rounded-button bg-lime px-lg active:opacity-80 disabled:opacity-60"><Feather name="crosshair" size={17} color={colors.dark} /><Text className="font-heading-bold text-dark text-[14px] uppercase">{locating ? 'Getting location...' : 'Use my location'}</Text></Pressable>
              <View className="flex-row gap-sm"><TextInput value={postcodeInput} onChangeText={(value) => { setPostcodeInput(value); setLocationError(null); }} autoCapitalize="characters" placeholder="e.g. SW1A 1AA" placeholderTextColor={colors.tertiaryText} className="flex-1 min-h-[48px] rounded-button border border-border bg-card px-md text-white font-body" /><Pressable onPress={() => void usePostcode()} className="min-h-[48px] px-lg rounded-button border border-white/25 items-center justify-center"><Text className="font-heading-bold text-white text-[12px] uppercase">Use</Text></Pressable></View>
              <InlineFormError message={isOffline ? null : locationError} />
              <View className="flex-row items-center gap-sm"><Feather name={coords ? 'check-circle' : 'map-pin'} size={15} color={coords ? colors.lime : colors.tertiaryText} /><Text className="font-body text-muted-text text-[12px]">{locationLabel}</Text></View>
            </View>
            <View className="gap-md">
              <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Search filters</Text>
              <View className="flex-row flex-wrap gap-sm">
                {QUICK_FILTERS.map((filter) => {
                  const selected = quickFilters.includes(filter.value);
                  return <Pressable key={filter.value} onPress={() => { setQuickFilters((current) => selected ? current.filter((value) => value !== filter.value) : [...current, filter.value]); if (filter.value === 'under_20' && !selected) setBudget('under_20'); }} accessibilityRole="button" accessibilityState={{ selected }} className={`rounded-full border px-md py-sm ${selected ? 'border-lime bg-lime/10' : 'border-border'}`}><Text className={`font-heading-bold text-[10px] uppercase ${selected ? 'text-lime' : 'text-muted-text'}`}>{filter.label}</Text></Pressable>;
                })}
              </View>
              <View className="flex-row border-y border-border">
                <DropdownTrigger icon="credit-card" label="Budget" value={BUDGETS.find((item) => item.value === budget)?.label ?? 'Free'} open={openFilter === 'budget'} onPress={() => setOpenFilter((current) => current === 'budget' ? null : 'budget')} />
                <DropdownTrigger icon="navigation" label="Radius" value={RADII.find((item) => item.value === radius)?.label ?? '20 mi'} open={openFilter === 'radius'} onPress={() => setOpenFilter((current) => current === 'radius' ? null : 'radius')} divided />
                <DropdownTrigger icon="users" label="Child age" value={AGES.find((item) => item.value === childAge)?.label ?? 'Primary'} open={openFilter === 'age'} onPress={() => setOpenFilter((current) => current === 'age' ? null : 'age')} divided />
              </View>
              {openFilter === 'budget' ? <DropdownOptions options={BUDGETS} value={budget} onChange={(value) => { setBudget(value); setOpenFilter(null); setSearchError(null); }} /> : null}
              {openFilter === 'radius' ? <DropdownOptions options={RADII} value={radius} onChange={(value) => { setRadius(value); setOpenFilter(null); setSearchError(null); void SecureStore.setItemAsync(RADIUS_KEY, value); }} /> : null}
              {openFilter === 'age' ? <DropdownOptions options={AGES} value={childAge} onChange={(value) => { setChildAge(value); setOpenFilter(null); setSearchError(null); }} /> : null}
            </View>

            {/* Moment 4 — Pro makes Dad Days personal. */}
            <InlineFormError message={isOffline ? null : searchError} />

            {limitReached ? (
              /* Moment 7 — the free counter, at the limit. */
              <>
                <LimeButton label="Search for Dad Days" onPress={() => void search()} loading={searching} />
                <Text className="font-body text-tertiary-text text-[11px] leading-[16px] text-center">
                  {searchesUsedLabel}
                </Text>
              </>
            ) : (
              <>
                <LimeButton label="Search for Dad Days" onPress={() => void search()} loading={searching} />
                {/* Moment 7 — the free counter, while searches remain. */}
                {accessReady && !isPro ? (
                  <Text className="font-body text-tertiary-text text-[11px] leading-[16px] text-center">
                    {searchesUsedLabel}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        )}

        {results.length > 0 ? <View className="gap-md border-t border-border pt-xl"><Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Activities found ({results.length})</Text><FeaturedResult result={results[0]} saving={savingName === results[0].name} error={!isOffline && saveError?.name === results[0].name ? saveError.message : null} onOpen={() => openResultWebsite(results[0].websiteUrl)} onSave={() => void save(results[0])} /><View className="gap-md">{results.slice(1).map((result) => <ResultRow key={result.name} result={result} saving={savingName === result.name} error={!isOffline && saveError?.name === result.name ? saveError.message : null} onOpen={() => openResultWebsite(result.websiteUrl)} onSave={() => void save(result)} />)}</View></View> : null}
      </ScrollView>
      <ProPromptModal
        visible={limitPromptOpen}
        moment={PRO_MOMENTS.dadDaysCounter}
        lead={`${searchesUsedLabel} Your allowance resets on the first of next month.`}
        onUpgrade={openPro}
        onDismiss={() => setLimitPromptOpen(false)}
      />
    </SafeAreaView>
  );
}

function DropdownTrigger({ icon, label, value, divided = false, open, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; divided?: boolean; open: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} className={`flex-1 min-w-0 px-sm py-md active:opacity-75 ${divided ? 'border-l border-border' : ''}`}><View className="flex-row items-center gap-xs"><Feather name={icon} size={14} color={colors.lime} /><Text className="font-heading-bold text-tertiary-text text-[9px] uppercase">{label}</Text></View><View className="flex-row items-center gap-xs mt-xs"><Text numberOfLines={1} adjustsFontSizeToFit className="font-heading-bold text-white text-[12px] uppercase flex-1">{value}</Text><Feather name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.lime} /></View></Pressable>;
}

function DropdownOptions<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View className="border-b border-border">{options.map((option, index) => { const selected = option.value === value; return <Pressable key={option.value} onPress={() => onChange(option.value)} accessibilityRole="button" accessibilityState={{ selected }} className={`min-h-[44px] flex-row items-center justify-between px-sm active:opacity-75 ${index > 0 ? 'border-t border-border' : ''} ${selected ? 'bg-lime/10' : ''}`}><Text className={`font-heading-bold text-[13px] uppercase ${selected ? 'text-lime' : 'text-white'}`}>{option.label}</Text>{selected ? <Feather name="check" size={17} color={colors.lime} /> : null}</Pressable>; })}</View>;
}

function openSecureWebsite(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('unsafe_url');
    void Linking.openURL(url.toString()).catch(() => Alert.alert('Unable to open website', 'Please try again.'));
  } catch {
    Alert.alert('Unable to open website', 'This result does not have a secure website link.');
  }
}

function ResultRow({ result, saving, error, onOpen, onSave }: { result: SearchResult; saving: boolean; error: string | null; onOpen: () => void; onSave: () => void }) {
  return <View className="rounded-button border border-border bg-card p-md gap-md"><Text className="font-heading-bold text-white text-[17px] uppercase">{result.name}</Text><Text className="font-body text-muted-text text-[13px] leading-[19px]">{result.description}</Text><View className="flex-row flex-wrap gap-sm"><Meta icon="navigation" text={`${result.distanceMiles.toFixed(1)} miles`} /><Meta icon="credit-card" text={result.estimatedCost} /><Meta icon="users" text={result.ageRange} /></View><Text className="font-body text-tertiary-text text-[11px] leading-[16px]">{result.address}</Text><InlineFormError message={error} /><View className="flex-row gap-sm"><Pressable onPress={onOpen} className="flex-1 min-h-[44px] rounded-button bg-lime items-center justify-center"><Text className="font-heading-bold text-dark text-[11px] uppercase">Find out more</Text></Pressable><Pressable onPress={onSave} disabled={saving} className="flex-1 min-h-[44px] rounded-button border border-lime items-center justify-center disabled:opacity-50"><Text className="font-heading-bold text-lime text-[11px] uppercase">{saving ? 'Saving' : 'Save to list'}</Text></Pressable></View></View>;
}

function FeaturedResult({ result, saving, error, onOpen, onSave }: { result: SearchResult; saving: boolean; error: string | null; onOpen: () => void; onSave: () => void }) {
  return <View className="rounded-button border border-lime/50 bg-lime/[0.06] p-md gap-md"><Text className="font-heading-bold text-lime text-[10px] tracking-label uppercase">Featured family day</Text><Text className="font-heading text-white text-[22px] uppercase">{result.name}</Text><Text className="font-body text-muted-text text-[13px] leading-[19px]">{result.description}</Text><View className="flex-row flex-wrap gap-sm"><Meta icon="navigation" text={`${result.distanceMiles.toFixed(1)} miles`} /><Meta icon="credit-card" text={result.estimatedCost} /><Meta icon="users" text={result.ageRange} /></View><InlineFormError message={error} /><Pressable onPress={onOpen} className="min-h-[44px] rounded-button bg-lime items-center justify-center"><Text className="font-heading-bold text-dark text-[11px] uppercase">Find out more</Text></Pressable><Pressable onPress={onSave} disabled={saving} className="min-h-[40px] items-center justify-center border-b border-lime"><Text className="font-heading-bold text-lime text-[11px] uppercase">{saving ? 'Saving' : 'Save to list'}</Text></Pressable></View>;
}

function Meta({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) { return <View className="flex-row items-center gap-xs"><Feather name={icon} size={13} color={colors.lime} /><Text className="font-body text-muted-text text-[11px]">{text}</Text></View>; }
