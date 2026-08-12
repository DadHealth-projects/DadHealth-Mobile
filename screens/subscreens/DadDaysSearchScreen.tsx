import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../hooks/useDashboard';
import { trackEvent } from '../../lib/analytics';
import { isProfilePro } from '../../lib/proStatus';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type Budget = 'free' | 'under_20' | 'over_20';
type ChildAge = 'toddler' | 'primary' | 'teen';
type SearchResult = { name: string; description: string; address: string; distanceMiles: number; estimatedCost: string; ageRange: string; websiteUrl: string; requiresBooking: boolean };

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/, '');
const RADIUS_KEY = 'dadHealth.dadDaysRadius';
const FREE_LIMIT = 3;
const BUDGETS = [{ value: 'free', label: 'Free' }, { value: 'under_20', label: 'Under £20' }, { value: 'over_20', label: 'Over £20' }] as const;
const AGES = [{ value: 'toddler', label: 'Toddler 0-4' }, { value: 'primary', label: 'Primary 5-11' }, { value: 'teen', label: 'Teen 12+' }] as const;
const RADII = [{ value: '5', label: '5 mi' }, { value: '10', label: '10 mi' }, { value: '20', label: '20 mi' }, { value: '50', label: '50 mi' }] as const;

export default function DadDaysSearchScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user, session } = useAuth();
  const { refresh: refreshDashboard } = useDashboard(user?.id);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [postcodeInput, setPostcodeInput] = useState('');
  const [postcode, setPostcode] = useState('');
  const [budget, setBudget] = useState<Budget>('free');
  const [childAge, setChildAge] = useState<ChildAge>('primary');
  const [radius, setRadius] = useState('20');
  const [isPro, setIsPro] = useState(false);
  const [searchesUsed, setSearchesUsed] = useState(0);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openFilter, setOpenFilter] = useState<'budget' | 'radius' | 'age' | null>(null);

  useEffect(() => {
    void SecureStore.getItemAsync(RADIUS_KEY).then((saved) => {
      if (saved && RADII.some((option) => option.value === saved)) setRadius(saved);
    }).catch(() => {});
  }, []);

  const loadAccess = useCallback(async () => {
    if (!user?.id) return;
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [profileResult, countResult] = await Promise.all([
      supabase.from('user_profile').select('is_pro,subscription_status').eq('user_id', user.id).maybeSingle(),
      supabase.from('dad_day_searches').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('searched_at', monthStart.toISOString()),
    ]);
    if (profileResult.error || countResult.error) {
      setError('We could not load your Dad Days allowance. Please try again.');
      return;
    }
    const profile = profileResult.data;
    setIsPro(isProfilePro(profile));
    setSearchesUsed(countResult.count ?? 0);
  }, [user?.id]);

  useEffect(() => { void loadAccess(); }, [loadAccess]);

  const useLocation = useCallback(async () => {
    setLocating(true); setError(null);
    try {
      const currentPermission = await Location.getForegroundPermissionsAsync();
      const permission = currentPermission.status === 'granted'
        ? currentPermission
        : currentPermission.canAskAgain
          ? await Location.requestForegroundPermissionsAsync()
          : currentPermission;
      if (permission.status !== 'granted') {
        setError('Location access was not allowed. Enter a postcode instead.');
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
      setError('We could not get your location. Enter a postcode instead.');
    } finally { setLocating(false); }
  }, []);

  const usePostcode = useCallback(async () => {
    if (!postcodeInput.trim()) { setError('Enter a UK postcode.'); return; }
    setLocating(true); setError(null);
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcodeInput.trim())}`);
      const body = await response.json() as { result?: { latitude?: number; longitude?: number } };
      if (!response.ok || typeof body.result?.latitude !== 'number' || typeof body.result.longitude !== 'number') throw new Error('invalid_postcode');
      setCoords({ latitude: body.result.latitude, longitude: body.result.longitude });
      setPostcode(postcodeInput.trim().toUpperCase());
    } catch {
      setError("We couldn't find that postcode. Check it and try again.");
    } finally { setLocating(false); }
  }, [postcodeInput]);

  const remaining = Math.max(0, FREE_LIMIT - searchesUsed);
  const limitReached = !isPro && remaining === 0;
  const search = useCallback(async () => {
    if (!user || !session?.access_token) { navigation.navigate('Login'); return; }
    if (!coords) { setError('Use your location or enter a postcode first.'); return; }
    if (limitReached) { navigation.navigate('Tabs', { screen: 'Home' }); return; }
    setSearching(true); setError(null); setResults([]);
    try {
      const response = await fetch(`${WEB_URL}/api/dad_days_searches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...coords, postcode, budget, radius: Number(radius), childAge, userId: user.id }),
      });
      const body = await response.json() as { results?: SearchResult[]; searchesUsed?: number; error?: string };
      if (response.status === 401) { setError('Your session has expired. Please log in again.'); return; }
      if (body.error === 'search_limit_reached' || response.status === 403) { setSearchesUsed(FREE_LIMIT); trackEvent('dad_days_search_limit_reached', { searchesUsed: FREE_LIMIT }, user.id); return; }
      if (!response.ok) { setError(response.status === 429 ? "You're searching too quickly. Wait a moment and try again." : 'We could not search for Dad Days. Please try again.'); return; }
      const nextResults = body.results ?? [];
      setResults(nextResults);
      setSearchesUsed(body.searchesUsed ?? searchesUsed);
      if (nextResults.length === 0) setError('No activities were found nearby. Increase the radius or change the budget.');
      trackEvent('dad_days_search_completed', { budget, radius: Number(radius), childAge, resultCount: nextResults.length, isPro }, user.id);
    } catch { setError('We could not search for Dad Days. Check your connection and try again.'); }
    finally { setSearching(false); }
  }, [budget, childAge, coords, isPro, limitReached, navigation, postcode, radius, searchesUsed, session?.access_token, user]);

  const save = useCallback(async (result: SearchResult) => {
    if (!user?.id) return;
    setSavingName(result.name); setError(null);
    const saveResult = await supabase.from('dad_dates').insert({ user_id: user.id, icon: 'map-pin', name: result.name, age_range: result.ageRange, budget: result.estimatedCost, duration_minutes: 120, time_of_day: 'Any time', source: 'ai_search', booking_url: result.websiteUrl, address: result.address, requires_booking: result.requiresBooking });
    if (saveResult.error) setError('We could not save this activity. Please try again.');
    else {
      trackEvent('dad_days_result_saved', { activityName: result.name, budget }, user.id);
      await refreshDashboard();
      Alert.alert('Saved', 'This activity was added to your Dad Date Ideas.');
    }
    setSavingName(null);
  }, [budget, refreshDashboard, user?.id]);

  const locationLabel = coords ? (postcode ? postcode : 'Current location') : 'No location set';

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
              <View className="flex-row gap-sm"><TextInput value={postcodeInput} onChangeText={setPostcodeInput} autoCapitalize="characters" placeholder="e.g. SW1A 1AA" placeholderTextColor={colors.tertiaryText} className="flex-1 min-h-[48px] rounded-button border border-border bg-card px-md text-white font-body" /><Pressable onPress={() => void usePostcode()} className="min-h-[48px] px-lg rounded-button border border-white/25 items-center justify-center"><Text className="font-heading-bold text-white text-[12px] uppercase">Use</Text></Pressable></View>
              <View className="flex-row items-center gap-sm"><Feather name={coords ? 'check-circle' : 'map-pin'} size={15} color={coords ? colors.lime : colors.tertiaryText} /><Text className="font-body text-muted-text text-[12px]">{locationLabel}</Text></View>
            </View>
            <View className="gap-md">
              <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Search filters</Text>
              <View className="flex-row border-y border-border">
                <DropdownTrigger icon="credit-card" label="Budget" value={BUDGETS.find((item) => item.value === budget)?.label ?? 'Free'} open={openFilter === 'budget'} onPress={() => setOpenFilter((current) => current === 'budget' ? null : 'budget')} />
                <DropdownTrigger icon="navigation" label="Radius" value={RADII.find((item) => item.value === radius)?.label ?? '20 mi'} open={openFilter === 'radius'} onPress={() => setOpenFilter((current) => current === 'radius' ? null : 'radius')} divided />
                <DropdownTrigger icon="users" label="Child age" value={AGES.find((item) => item.value === childAge)?.label ?? 'Primary'} open={openFilter === 'age'} onPress={() => setOpenFilter((current) => current === 'age' ? null : 'age')} divided />
              </View>
              {openFilter === 'budget' ? <DropdownOptions options={BUDGETS} value={budget} onChange={(value) => { setBudget(value); setOpenFilter(null); }} /> : null}
              {openFilter === 'radius' ? <DropdownOptions options={RADII} value={radius} onChange={(value) => { setRadius(value); setOpenFilter(null); void SecureStore.setItemAsync(RADIUS_KEY, value); }} /> : null}
              {openFilter === 'age' ? <DropdownOptions options={AGES} value={childAge} onChange={(value) => { setChildAge(value); setOpenFilter(null); }} /> : null}
            </View>
            {error ? <View accessibilityRole="alert" className="rounded-button border border-red-400/40 bg-red-400/10 p-md"><Text className="font-body text-red-300 text-[13px] leading-[19px]">{error}</Text></View> : null}
            {limitReached ? <View className="gap-md border-y border-border py-lg"><Text className="font-heading-bold text-white text-[17px] uppercase">3 free searches used</Text><Text className="font-body text-muted-text text-[13px]">Your allowance resets on the first of next month.</Text><LimeButton label="View Dad Health Pro" onPress={() => navigation.navigate('Tabs', { screen: 'Home' })} /></View> : <><LimeButton label="Search for Dad Days" onPress={() => void search()} loading={searching} />{!isPro ? <Text className="font-body text-tertiary-text text-[12px] text-center">{remaining} of {FREE_LIMIT} free searches remaining</Text> : null}</>}
          </View>
        )}

        {results.length > 0 ? <View className="gap-md border-t border-border pt-xl"><Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Activities found ({results.length})</Text>{results.map((result) => <ResultRow key={result.name} result={result} saving={savingName === result.name} onSave={() => void save(result)} />)}</View> : null}
      </ScrollView>
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

function ResultRow({ result, saving, onSave }: { result: SearchResult; saving: boolean; onSave: () => void }) {
  return <View className="rounded-button border border-border bg-card p-md gap-md"><Text className="font-heading-bold text-white text-[17px] uppercase">{result.name}</Text><Text className="font-body text-muted-text text-[13px] leading-[19px]">{result.description}</Text><View className="flex-row flex-wrap gap-sm"><Meta icon="navigation" text={`${result.distanceMiles.toFixed(1)} miles`} /><Meta icon="credit-card" text={result.estimatedCost} /><Meta icon="users" text={result.ageRange} /></View><Text className="font-body text-tertiary-text text-[11px] leading-[16px]">{result.address}</Text><View className="flex-row gap-sm"><Pressable onPress={() => openSecureWebsite(result.websiteUrl)} className="flex-1 min-h-[44px] rounded-button bg-lime items-center justify-center"><Text className="font-heading-bold text-dark text-[11px] uppercase">Find out more</Text></Pressable><Pressable onPress={onSave} disabled={saving} className="flex-1 min-h-[44px] rounded-button border border-lime items-center justify-center disabled:opacity-50"><Text className="font-heading-bold text-lime text-[11px] uppercase">{saving ? 'Saving' : 'Save to list'}</Text></Pressable></View></View>;
}

function Meta({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) { return <View className="flex-row items-center gap-xs"><Feather name={icon} size={13} color={colors.lime} /><Text className="font-body text-muted-text text-[11px]">{text}</Text></View>; }
