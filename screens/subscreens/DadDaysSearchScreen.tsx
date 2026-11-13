import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Keyboard, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type NavigationProp } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

import AppTopBar from '../../components/AppTopBar';
import InlineFormError from '../../components/InlineFormError';
import LimeButton from '../../components/LimeButton';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { useDashboard, type DadDateItem } from '../../hooks/useDashboard';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useUpgradeMomentManager } from '../../contexts/UpgradeMomentContext';
import { trackEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase';
import { withLocationDeadline } from '../../lib/locationDeadline';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

type Budget = 'free' | 'under_20' | 'over_20';
type ChildAge = 'toddler' | 'primary' | 'teen';
type SearchResult = { name: string; description: string; address: string; distanceMiles: number; estimatedCost: string; ageRange: string; websiteUrl: string; requiresBooking: boolean };
type ResultCardData = {
  name: string;
  description?: string | null;
  address?: string | null;
  distanceMiles?: number | null;
  estimatedCost?: string | null;
  ageRange?: string | null;
  websiteUrl?: string | null;
};
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
  const route = useRoute();
  const { requestMoment } = useUpgradeMomentManager();
  const { user, session } = useAuth();
  const { isOffline, showOfflineAction } = useNetworkStatus();
  const { data: dashboardData, loading: dashboardLoading, error: dashboardError, refresh: refreshDashboard } = useDashboard(user?.id);
  const entitlement = useEntitlement({
    isPro: dashboardData?.isPro ?? null,
    trialActive: dashboardData?.trialActive ?? null,
    loading: dashboardLoading,
  });
  const dadDaysAccess = entitlement.can('dad_days_unlimited');
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
  const [removingActivityId, setRemovingActivityId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<{ id: string; message: string } | null>(null);
  const [removedActivityIds, setRemovedActivityIds] = useState<Set<string>>(() => new Set());
  const [results, setResults] = useState<SearchResult[]>([]);
  const [savedActivitiesOpen, setSavedActivitiesOpen] = useState(false);
  const saveInFlightKeys = useRef(new Set<string>());
  const removeInFlightIds = useRef(new Set<string>());
  const savedActivitiesReady = Array.isArray(dashboardData?.savedDadActivities);
  const savedActivities = (dashboardData?.savedDadActivities ?? []).filter(
    (activity) => activity.user_id === user?.id
      && activity.source === 'ai_search'
      && !removedActivityIds.has(activity.id)
  );
  const savedActivitiesError = dashboardData?.savedDadActivitiesError
    ?? (!savedActivitiesReady && !dashboardLoading
      ? dashboardError ?? "We couldn't verify your saved activities. Please retry."
      : null);

const isActivitySaved = (result: SearchResult) =>
  savedActivities.some((activity) => {
    const savedUrl = activity.booking_url?.trim().toLowerCase();
    const resultUrl = result.websiteUrl?.trim().toLowerCase();

    if (savedUrl && resultUrl) {
      return savedUrl === resultUrl
        && activity.name.trim().toLowerCase() === result.name.trim().toLowerCase();
    }

    return activity.name.trim().toLowerCase() === result.name.trim().toLowerCase();
  });
  // Two inline slots: location problems sit under the location fields, search
  // problems sit next to the search action.
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ name: string; message: string } | null>(null);
  const [openFilter, setOpenFilter] = useState<'budget' | 'radius' | 'age' | null>(null);
  const accessRequestId = useRef(0);

  useEffect(() => {
    void SecureStore.getItemAsync(RADIUS_KEY).then((saved) => {
      if (saved && RADII.some((option) => option.value === saved)) setRadius(saved);
    }).catch(() => {});
  }, []);

  const loadAccess = useCallback(async () => {
    const requestId = ++accessRequestId.current;
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
      if (requestId !== accessRequestId.current) return;
      if (!response.ok || typeof body.isPro !== 'boolean') throw new Error('allowance_unavailable');

      setIsPro(body.isPro);
      setSearchesUsed(typeof body.searchesUsed === 'number' ? body.searchesUsed : 0);
      if (body.childAge && AGES.some((option) => option.value === body.childAge)) {
        setChildAge(body.childAge as ChildAge);
      }
      setAccessReady(true);
    } catch {
      if (requestId === accessRequestId.current) setSearchError('We could not load your Dad Days allowance. Please try again.');
    }
  }, [isOffline, session?.access_token, user?.id]);

  useFocusEffect(useCallback(() => {
    void loadAccess();
  }, [loadAccess]));

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && previousState !== 'active') {
        setAccessReady(false);
        if (!isOffline) void loadAccess();
        else accessRequestId.current += 1;
      }
      previousState = nextState;
    });
    return () => {
      accessRequestId.current += 1;
      subscription.remove();
    };
  }, [isOffline, loadAccess]);

  const useLocation = useCallback(async () => {
    if (locating) return;
    setLocating(true); setLocationError(null); setSearchError(null);
    try {
      const currentPermission = await withLocationDeadline(Location.getForegroundPermissionsAsync());
      const permission = currentPermission.status === 'granted'
        ? currentPermission
        : currentPermission.canAskAgain
          ? await withLocationDeadline(Location.requestForegroundPermissionsAsync(), 60000)
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
      const recent = await withLocationDeadline(
        Location.getLastKnownPositionAsync({ maxAge: 300000, requiredAccuracy: 5000 }), 2000,
      ).catch(() => null);
      const current = recent ?? await withLocationDeadline(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      );
      setCoords({ latitude: current.coords.latitude, longitude: current.coords.longitude });
      setPostcode(''); setPostcodeInput('');
    } catch {
      setLocationError('We could not get your location. Try again or enter a postcode.');
    } finally { setLocating(false); }
  }, [locating]);

  const usePostcode = useCallback(async () => {
    if (locating) return;
    if (isOffline) { showOfflineAction('dad_days_search'); return; }
    if (!postcodeInput.trim()) { setLocationError('Enter a UK postcode.'); return; }
    setLocating(true); setLocationError(null); setSearchError(null);
    try {
      const response = await withLocationDeadline(fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcodeInput.trim())}`));
      const body = await withLocationDeadline(response.json()) as { result?: { latitude?: number; longitude?: number } };
      if (!response.ok || typeof body.result?.latitude !== 'number' || typeof body.result.longitude !== 'number') throw new Error('invalid_postcode');
      setCoords({ latitude: body.result.latitude, longitude: body.result.longitude });
      setPostcode(postcodeInput.trim().toUpperCase());
    } catch {
      setLocationError("We couldn't find that postcode. Check it and try again.");
    } finally { setLocating(false); }
  }, [isOffline, locating, postcodeInput, showOfflineAction]);

  const remaining = Math.max(0, FREE_LIMIT - searchesUsed);
  const limitReached = accessReady && !isPro && remaining === 0;
  // The usage counter reports searches already used, not searches remaining.
  const searchesUsedLabel = `${Math.min(searchesUsed, FREE_LIMIT)} of ${FREE_LIMIT} free Dad Days searches used this month.`;
  const search = useCallback(async () => {
    if (!user || !session?.access_token) { navigation.navigate('Login'); return; }
    if (isOffline) { showOfflineAction('dad_days_search'); return; }
    if (!coords) { setLocationError('Use your location or enter a postcode first.'); return; }
    if (limitReached) {
      requestMoment({ id: 'dadDaysCounter', trigger: 'explicit', screen: route.key, feature: 'dad_days_unlimited', isPro: entitlement.isPro, trialActive: entitlement.trialActive, loading: entitlement.loading, featureAccess: dadDaysAccess, hasCompletedAction: searchesUsed > 0, lead: `${searchesUsedLabel} Your allowance resets on the first of next month.`, userId: user?.id });
      return;
    }
    setSearching(true); setSearchError(null); setResults([]);
    try {
      const response = await fetch(`${WEB_URL}/api/dad_days_searches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...coords, postcode, budget, radius: Number(radius), childAge, quickFilters, userId: user.id }),
      });
      const body = await response.json() as { results?: SearchResult[]; searchesUsed?: number; error?: string };
      if (response.status === 401) { setSearchError('Your session has expired. Please log in again.'); return; }
      if (response.status === 403 && body.error === 'search_limit_reached') { setSearchesUsed(FREE_LIMIT); requestMoment({ id: 'dadDaysCounter', trigger: 'explicit', screen: route.key, feature: 'dad_days_unlimited', isPro: entitlement.isPro, trialActive: entitlement.trialActive, loading: entitlement.loading, featureAccess: dadDaysAccess, hasCompletedAction: searchesUsed > 0, lead: `${FREE_LIMIT} of ${FREE_LIMIT} free Dad Days searches used this month. Your allowance resets on the first of next month.`, userId: user.id }); trackEvent('dad_days_search_limit_reached', { searchesUsed: FREE_LIMIT }, user.id); return; }
      if (!response.ok) { setSearchError(response.status === 429 ? "You're searching too quickly. Wait a moment and try again." : 'We could not search for Dad Days. Please try again.'); return; }
      const nextResults = body.results ?? [];
      setResults(nextResults);
      setSearchesUsed(body.searchesUsed ?? searchesUsed);
      if (nextResults.length === 0) setSearchError('No activities were found nearby. Increase the radius or change the budget.');
      trackEvent('dad_days_search_completed', { budget, radius: Number(radius), childAge, resultCount: nextResults.length, isPro }, user.id);
    } catch { setSearchError('We could not search for Dad Days. Check your connection and try again.'); }
    finally { setSearching(false); }
  }, [budget, childAge, coords, dadDaysAccess, entitlement.isPro, entitlement.loading, entitlement.trialActive, isOffline, isPro, limitReached, navigation, postcode, quickFilters, radius, requestMoment, route.key, searchesUsed, searchesUsedLabel, session?.access_token, showOfflineAction, user]);

  const save = useCallback(async (result: SearchResult) => {
    if (!user?.id) return;
    if (isOffline) { showOfflineAction('dad_days_save'); return; }
    const saveKey = `${result.name.trim().toLowerCase()}|${result.websiteUrl.trim().toLowerCase()}`;
    if (saveInFlightKeys.current.has(saveKey) || isActivitySaved(result)) return;
    saveInFlightKeys.current.add(saveKey);
    setSavingName(result.name);
    setSaveError(null);
    try {
      const saveResult = await supabase.from('dad_dates').insert({
        user_id: user.id,
        icon: 'map-pin',
        name: result.name,
        description: result.description,
        distance_miles: Number.isFinite(result.distanceMiles) ? result.distanceMiles : null,
        age_range: result.ageRange,
        budget: result.estimatedCost,
        duration_minutes: 120,
        time_of_day: 'Any time',
        source: 'ai_search',
        booking_url: result.websiteUrl,
        address: result.address,
        requires_booking: result.requiresBooking,
      });
      if (saveResult.error) {
        setSaveError({ name: result.name, message: 'We could not save this activity. Please try again.' });
        return;
      }
      trackEvent('dad_days_result_saved', { activityName: result.name, budget }, user.id);
      await refreshDashboard();
      Alert.alert('Saved', 'This activity was added to your saved Dad Days.');
    } catch {
      setSaveError({ name: result.name, message: 'We could not save this activity. Please try again.' });
    } finally {
      saveInFlightKeys.current.delete(saveKey);
      setSavingName(null);
    }
  }, [budget, isActivitySaved, isOffline, refreshDashboard, showOfflineAction, user?.id]);

  const removeSavedActivity = useCallback(async (activity: DadDateItem) => {
    if (!user?.id) return;
    if (isOffline) { showOfflineAction('dad_days_remove'); return; }
    if (removeInFlightIds.current.has(activity.id)) return;

    removeInFlightIds.current.add(activity.id);
    setRemovingActivityId(activity.id);
    setRemoveError(null);
    try {
      const { data: deleted, error: deleteError } = await supabase
        .from('dad_dates')
        .delete()
        .eq('id', activity.id)
        .eq('user_id', user.id)
        .eq('source', 'ai_search')
        .select('id')
        .maybeSingle();

      if (deleteError || !deleted) {
        setRemoveError({ id: activity.id, message: 'We could not remove this saved activity. Please try again.' });
        return;
      }

      setRemovedActivityIds((current) => new Set(current).add(activity.id));
      await refreshDashboard();
    } catch {
      setRemoveError({ id: activity.id, message: 'We could not remove this saved activity. Please try again.' });
    } finally {
      removeInFlightIds.current.delete(activity.id);
      setRemovingActivityId(null);
    }
  }, [isOffline, refreshDashboard, showOfflineAction, user?.id]);

  const locationLabel = coords ? (postcode ? postcode : 'Current location') : 'No location set';
  const openResultWebsite = (url: string) => {
    if (isOffline) { showOfflineAction('dad_days_open'); return; }
    openSecureWebsite(url);
  };

  return (
    <>
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="px-lg pt-lg pb-xl gap-xl">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="chevron-left" size={20} color={colors.text} /></Pressable>} />
        <ScreenHero eyebrow="Dad Days" headline={'Find your\nnext day out'} sub="Search nearby activities by age, budget and distance." />

        {!user ? <LimeButton label="Log in to search" onPress={() => navigation.navigate('Login')} /> : (
          <View className="gap-xl">
            <View className="gap-md">
              <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Location</Text>
              <Pressable onPress={() => void useLocation()} disabled={locating} accessibilityRole="button" accessibilityState={{ busy: locating }} className="min-h-[48px] flex-row items-center justify-center gap-sm rounded-button bg-lime px-lg active:opacity-80 disabled:opacity-60"><Feather name="crosshair" size={17} color={colors.dark} /><Text className="font-heading-bold text-dark text-[14px] uppercase">{locating ? 'Getting location...' : 'Use my location'}</Text></Pressable>
              <View className="flex-row gap-sm"><TextInput value={postcodeInput} onChangeText={(value) => { setPostcodeInput(value); setLocationError(null); }} autoCapitalize="characters" placeholder="e.g. SW1A 1AA" placeholderTextColor={colors.tertiaryText} returnKeyType="search" onSubmitEditing={() => { Keyboard.dismiss(); void usePostcode(); }} className="flex-1 min-h-[48px] rounded-button border border-border bg-card px-md text-white font-body" /><Pressable onPress={() => void usePostcode()} className="min-h-[48px] px-lg rounded-button border border-white/25 items-center justify-center"><Text className="font-heading-bold text-white text-[12px] uppercase">Use</Text></Pressable></View>
              <InlineFormError message={isOffline ? null : locationError} />
              <View className="flex-row items-center gap-sm"><Feather name={coords ? 'check-circle' : 'map-pin'} size={15} color={coords ? colors.lime : colors.tertiaryText} /><Text className="font-body text-muted-text text-[14px]">{locationLabel}</Text></View>
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
              /* The existing Free counter remains visible after the limit. */
              <>
                <LimeButton label="Search for Dad Days" onPress={() => void search()} loading={searching} />
                <Text className="font-body text-tertiary-text text-[14px] leading-[20px] text-center">
                  {searchesUsedLabel}
                </Text>
              </>
            ) : (
              <>
                <LimeButton label="Search for Dad Days" onPress={() => void search()} loading={searching} />
                {/* Keep the existing Free usage counter while searches remain. */}
                {accessReady && !isPro ? (
                  <Text className="font-body text-tertiary-text text-[14px] leading-[20px] text-center">
                    {searchesUsedLabel}
                  </Text>
                ) : null}
              </>
            )}
            <View className="mt-md">
              <Pressable
                onPress={() => setSavedActivitiesOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Open Saved Activities"
                className="flex-row items-center gap-md border-b border-border py-md"
              >
                <Feather name="bookmark" size={23} color={colors.lime} />

                <View className="flex-1">
                  <Text className="font-heading-bold text-white text-[16px] uppercase">
                    Saved Activities
                  </Text>
                  <Text className="font-body text-muted-text text-[14px] leading-[18px] mt-xs">
                    View your saved Dad Days
                  </Text>
                </View>

                <Feather name="chevron-right" size={20} color={colors.lime} />
              </Pressable>
            </View>
          </View>
        )}

        {results.length > 0 ? <View className="gap-md border-t border-border pt-xl"><Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Activities found ({results.length})</Text><FeaturedResult result={results[0]} saving={savingName === results[0].name} saved={isActivitySaved(results[0])} error={!isOffline && saveError?.name === results[0].name ? saveError.message : null} onOpen={() => openResultWebsite(results[0].websiteUrl)} onSave={() => void save(results[0])} /><View className="gap-md">{results.slice(1).map((result) => <ResultRow key={result.name} result={result} saving={savingName === result.name} saved={isActivitySaved(result)} error={!isOffline && saveError?.name === result.name ? saveError.message : null} onOpen={() => openResultWebsite(result.websiteUrl)} onSave={() => void save(result)} />)}</View></View> : null}
      </ScrollView>
    </SafeAreaView>
    <Modal
      visible={savedActivitiesOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setSavedActivitiesOpen(false)}
    >
      <SafeAreaProvider>
        <SafeAreaView
          edges={['top', 'bottom', 'left', 'right']}
          className="flex-1 bg-dark"
        >
          <View className="flex-row items-center justify-between border-b border-border px-lg py-md">
            <View className="flex-1">
              <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">
                Dad Days
              </Text>
              <Text className="font-heading-bold text-white text-[22px] uppercase mt-xs">
                Saved Activities
              </Text>
            </View>

            <Pressable
              onPress={() => setSavedActivitiesOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close Saved Activities"
              hitSlop={12}
              className="h-11 w-11 items-center justify-center rounded-full border border-border"
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 40,
            }}
          >
            <View className="gap-md">
              {dashboardLoading && !savedActivitiesReady ? (
                <ActivityIndicator color={colors.lime} />
              ) : savedActivitiesError && savedActivities.length === 0 ? (
                <View className="gap-md">
                  <InlineFormError message={savedActivitiesError} />
                  <Pressable
                    onPress={() => void refreshDashboard()}
                    disabled={dashboardLoading}
                    accessibilityRole="button"
                    className="min-h-[44px] items-center justify-center border-b border-lime disabled:opacity-50"
                  >
                    <Text className="font-heading-bold text-lime text-[11px] uppercase">
                      {dashboardLoading ? 'Loading' : 'Try again'}
                    </Text>
                  </Pressable>
                </View>
              ) : savedActivities.length === 0 ? (
                <Text className="font-body text-muted-text text-[14px]">
                  No saved activities yet. Search for Dad Days and bookmark
                  activities you'd like to try.
                </Text>
              ) : (
                <>
                  {savedActivitiesError ? (
                    <View className="gap-md">
                      <InlineFormError message={savedActivitiesError} />
                      <Pressable
                        onPress={() => void refreshDashboard()}
                        disabled={dashboardLoading}
                        accessibilityRole="button"
                        className="min-h-[44px] items-center justify-center border-b border-lime disabled:opacity-50"
                      >
                        <Text className="font-heading-bold text-lime text-[11px] uppercase">
                          {dashboardLoading ? 'Loading' : 'Try again'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <FeaturedResult
                    result={toResultCardData(savedActivities[0])}
                    saving={false}
                    saved
                    savedView
                    removing={removingActivityId === savedActivities[0].id}
                    error={removeError?.id === savedActivities[0].id ? removeError.message : null}
                    onOpen={() => savedActivities[0].booking_url && openResultWebsite(savedActivities[0].booking_url)}
                    onRemove={() => void removeSavedActivity(savedActivities[0])}
                  />
                  <View className="gap-md">
                    {savedActivities.slice(1).map((activity) => (
                      <ResultRow
                        key={activity.id}
                        result={toResultCardData(activity)}
                        saving={false}
                        saved
                        savedView
                        removing={removingActivityId === activity.id}
                        error={removeError?.id === activity.id ? removeError.message : null}
                        onOpen={() => activity.booking_url && openResultWebsite(activity.booking_url)}
                        onRemove={() => void removeSavedActivity(activity)}
                      />
                    ))}
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
    </>
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

type ResultCardProps = {
  result: ResultCardData;
  saving: boolean;
  saved: boolean;
  savedView?: boolean;
  removing?: boolean;
  error: string | null;
  onOpen: () => void;
  onSave?: () => void;
  onRemove?: () => void;
};

function ResultRow({ result, saving, saved, savedView = false, removing = false, error, onOpen, onSave, onRemove }: ResultCardProps) {
  return (
    <View className="rounded-button border border-border bg-card p-md gap-md">
      <View className="flex-row items-start justify-between gap-sm">
        <Text className="flex-1 font-heading-bold text-white text-[17px] uppercase">
          {result.name}
        </Text>
        <MaterialCommunityIcons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={26}
          color={saved ? colors.lime : colors.tertiaryText}
        />
      </View>

      {(!savedView || result.description) ? (
        <Text className="font-body text-muted-text text-[14px] leading-[20px]">
          {result.description ?? ''}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-sm">
        {!savedView || (typeof result.distanceMiles === 'number' && Number.isFinite(result.distanceMiles)) ? (
          <Meta icon="navigation" text={`${typeof result.distanceMiles === 'number' ? result.distanceMiles.toFixed(1) : ''} miles`} />
        ) : null}
        {!savedView || result.estimatedCost ? <Meta icon="credit-card" text={result.estimatedCost ?? ''} /> : null}
        {!savedView || result.ageRange ? <Meta icon="users" text={result.ageRange ?? ''} /> : null}
      </View>

      {(!savedView || result.address) ? (
        <Text className="font-body text-tertiary-text text-[14px] leading-[20px]">
          {result.address ?? ''}
        </Text>
      ) : null}

      <InlineFormError message={error} />

      <View className="flex-row gap-sm">
        {!savedView || result.websiteUrl ? (
          <Pressable onPress={onOpen} className="flex-1 min-h-[44px] rounded-button bg-lime items-center justify-center">
            <Text className="font-heading-bold text-dark text-[11px] uppercase">
              Find out more
            </Text>
          </Pressable>
        ) : null}

        {savedView ? (
          <Pressable
            onPress={onRemove}
            disabled={removing}
            accessibilityRole="button"
            accessibilityLabel="Remove from Saved"
            className={`min-h-[44px] rounded-button border border-lime items-center justify-center disabled:opacity-50 ${savedView && !result.websiteUrl ? 'w-full' : 'flex-1'}`}
          >
            <Text className="font-heading-bold text-lime text-[11px] uppercase">
              {removing ? 'Removing...' : 'Remove from Saved'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onSave}
            disabled={saving || saved}
            className="flex-1 min-h-[44px] rounded-button border border-lime items-center justify-center disabled:opacity-50"
          >
            <Text className="font-heading-bold text-lime text-[11px] uppercase">
              {saved ? 'Saved' : saving ? 'Saving' : 'Save to list'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function FeaturedResult({ result, saving, saved, savedView = false, removing = false, error, onOpen, onSave, onRemove }: ResultCardProps) {
  return (
    <View className="rounded-button border border-lime/50 bg-lime/[0.06] p-md gap-md">
      <View className="flex-row items-center justify-between gap-sm">
        <Text className="font-heading-bold text-lime text-[10px] tracking-label uppercase">
          Featured family day
        </Text>
        <MaterialCommunityIcons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={26}
          color={saved ? colors.lime : colors.tertiaryText}
        />
      </View>

      <Text className="font-heading text-white text-[22px] uppercase">
        {result.name}
      </Text>

      {(!savedView || result.description) ? (
        <Text className="font-body text-muted-text text-[14px] leading-[20px]">
          {result.description ?? ''}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-sm">
      {!savedView || (typeof result.distanceMiles === 'number' && Number.isFinite(result.distanceMiles)) ? (
        <Meta icon="navigation" text={`${typeof result.distanceMiles === 'number' ? result.distanceMiles.toFixed(1) : ''} miles`} />
        ) : null}
      {!savedView || result.estimatedCost ? <Meta icon="credit-card" text={result.estimatedCost ?? ''} /> : null}
      {!savedView || result.ageRange ? <Meta icon="users" text={result.ageRange ?? ''} /> : null}
      </View>

      {savedView && result.address ? (
        <Text className="font-body text-tertiary-text text-[14px] leading-[20px]">
          {result.address}
        </Text>
      ) : null}

      <InlineFormError message={error} />

      {!savedView || result.websiteUrl ? (
        <Pressable
          onPress={onOpen}
          className="min-h-[44px] rounded-button bg-lime items-center justify-center"
        >
          <Text className="font-heading-bold text-dark text-[11px] uppercase">
            Find out more
          </Text>
        </Pressable>
      ) : null}

      {savedView ? (
        <Pressable
          onPress={onRemove}
          disabled={removing}
          accessibilityRole="button"
          accessibilityLabel="Remove from Saved"
          className="min-h-[40px] items-center justify-center border-b border-lime disabled:opacity-50"
        >
          <Text className="font-heading-bold text-lime text-[11px] uppercase">
            {removing ? 'Removing...' : 'Remove from Saved'}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onSave}
          disabled={saving || saved}
          className="min-h-[40px] items-center justify-center border-b border-lime"
        >
          <Text className="font-heading-bold text-lime text-[11px] uppercase">
            {saved ? 'Saved' : saving ? 'Saving' : 'Save to list'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function toResultCardData(activity: DadDateItem): ResultCardData {
  return {
    name: activity.name,
    description: activity.description,
    address: activity.address,
    distanceMiles: activity.distance_miles,
    estimatedCost: activity.budget,
    ageRange: activity.age_range,
    websiteUrl: activity.booking_url,
  };
}
function Meta({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) { return <View className="flex-row items-center gap-xs"><Feather name={icon} size={13} color={colors.lime} /><Text className="font-body text-muted-text text-[14px] leading-[20px]">{text}</Text></View>; }
