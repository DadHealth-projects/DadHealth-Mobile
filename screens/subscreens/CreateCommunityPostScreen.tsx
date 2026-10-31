import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';

import AppTopBar from '../../components/AppTopBar';
import InlineFormError from '../../components/InlineFormError';
import LimeButton from '../../components/LimeButton';
import MultilineTextInput from '../../components/MultilineTextInput';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { trackEvent } from '../../lib/analytics';
import { communityTagLabel } from '../../lib/communityLabels';
import { dashboardIcon } from '../../lib/dashboardIcons';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

const TAGS = ['FITNESS', 'MIND', 'BOND'] as const;

export default function CreateCommunityPostScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'CreateCommunityPost'>>();
  const { user } = useAuth();
  const { isOffline, showOfflineAction } = useNetworkStatus();
  const [body, setBody] = useState('');
  const [tag, setTag] = useState<(typeof TAGS)[number]>('FITNESS');
  const [memberCircles, setMemberCircles] = useState<Array<{ id: string; name: string; icon: string | null; description: string | null; members_count: number | null; visibility: 'public' | 'private' }>>([]);
  const [circleId, setCircleId] = useState<string | null>(route.params?.circleId ?? null);
  const [circlePickerOpen, setCirclePickerOpen] = useState(false);
  const [anonymous, setAnonymous] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [circlesLoading, setCirclesLoading] = useState(false);
  const [circleRetryKey, setCircleRetryKey] = useState(0);
  const [submissionUncertain, setSubmissionUncertain] = useState(false);
  const [safeToRetry, setSafeToRetry] = useState(false);
  const pendingPost = useRef<{ id: string; signature: string; payload: { id: string; user_id: string | null; circle_id: string | null; content: string; tag: string; anonymous: boolean; author_initials: string; author_name: string; author_meta: string } } | null>(null);

  useEffect(() => {
    if (!user?.id || isOffline) return;
    void (async () => {
      try {
        const { data } = await supabase.from('user_profile').select('display_name').eq('user_id', user.id).maybeSingle();
        setDisplayName(typeof data?.display_name === 'string' ? data.display_name : null);
      } catch {
        setDisplayName(null);
      }
    })();
  }, [isOffline, user?.id]);

  useEffect(() => {
    const requested = route.params?.circleId;
    if (!requested || !user?.id || isOffline) { setMemberCircles([]); setCircleId(null); return; }
    let active = true;
    void (async () => {
      setCirclesLoading(true);
      try {
      const { data: memberships, error: membershipError } = await supabase.from('user_circles').select('circle_id').eq('user_id', user.id);
      if (!active) return;
      const ids = (memberships ?? []).map((row) => String(row.circle_id));
      const { data: circles, error: circlesError } = ids.length
        ? await supabase.from('circles').select('id,name,icon,description,members_count,visibility').in('id', ids)
        : { data: [], error: null };
      if (!active) return;
      if (membershipError || circlesError) { setError('We could not load your Dad Circles. Please try again.'); return; }
      const available = (circles ?? []).map((circle) => ({ id: String(circle.id), name: String(circle.name), icon: typeof circle.icon === 'string' ? circle.icon : null, description: typeof circle.description === 'string' ? circle.description : null, members_count: typeof circle.members_count === 'number' ? circle.members_count : null, visibility: circle.visibility === 'private' ? 'private' as const : 'public' as const }));
      setMemberCircles(available);
      if (requested && !available.some((circle) => circle.id === requested)) {
        setCircleId(null);
        setError('Join this Dad Circle before posting in it.');
      } else {
        setCircleId((current) => requested ?? (current && available.some((circle) => circle.id === current) ? current : available[0]?.id ?? null));
      }
      } catch {
        if (active) setError('We could not load your Dad Circles. Please try again.');
      } finally {
        if (active) setCirclesLoading(false);
      }
    })();
    return () => { active = false; };
  }, [circleRetryKey, isOffline, route.params?.circleId, user?.id]);

  const resolvedName = useMemo(() => resolveDisplayName(displayName, user), [displayName, user]);
  const selectedCircle = memberCircles.find((circle) => circle.id === circleId) ?? null;
  const submit = async () => {
    const content = body.trim();
    if (!user) { navigation.navigate('Login'); return; }
    if (isOffline) { showOfflineAction('community_post'); return; }
    if (!content || saving || savingRef.current) return;
    if (route.params?.circleId && !circleId) { setError('Join a Dad Circle before creating a post.'); return; }
    if (submissionUncertain && !safeToRetry) return;
    const authorName = anonymous ? 'Anonymous' : resolvedName;
    const signature = JSON.stringify([content, tag, anonymous, route.params?.circleId ? circleId : null]);
    let pending = pendingPost.current;
    if (!pending || pending.signature !== signature) {
      const id = Crypto.randomUUID();
      pending = {
        id,
        signature,
        payload: { id, user_id: anonymous ? null : user.id, circle_id: route.params?.circleId ? circleId : null, content, tag, anonymous, author_initials: anonymous ? '?' : initialsFromDisplayName(authorName, user.email), author_name: authorName, author_meta: anonymous ? 'Anonymous · ' : 'Member · ' },
      };
      pendingPost.current = pending;
    }
    savingRef.current = true;
    setSaving(true); setError(null);
    try {
      const { error: insertError } = await supabase
        .from('posts')
        .insert(pending.payload);
      if (insertError) {
        const isHourlyLimit =
  insertError.code === 'P0001' &&
  insertError.message?.includes('community_hourly_post_limit');

if (isHourlyLimit) {
          pendingPost.current = null;
          setSubmissionUncertain(false);
          setSafeToRetry(false);
          setError("You've already shared a post this hour. Please try again later.");
          return;
        }
        if (isTransportFailure(insertError)) {
          setSubmissionUncertain(true);
          setSafeToRetry(false);
          setError('We could not confirm whether your post was published. Check its status before trying again.');
          return;
        }
        setError('We could not publish your post. Please try again.');
        pendingPost.current = null;
        return;
      }
      trackEvent('community_post_created', { tag, anonymous, content_length: content.length }, user.id);
      pendingPost.current = null;
      setSubmissionUncertain(false);
      navigation.goBack();
    } catch (requestError) {
      const caughtError = requestError && typeof requestError === 'object'
        ? requestError as { code?: unknown; constraint?: unknown; message?: unknown; details?: unknown; detail?: unknown; hint?: unknown }
        : null;
      const caughtIdentifiesHourlyConstraint = caughtError !== null
        && [caughtError.constraint, caughtError.message, caughtError.details, caughtError.detail, caughtError.hint]
          .some((value) => typeof value === 'string' && value.includes('limit_posts_per_hour'));
      if (caughtError?.code === '23505' && caughtIdentifiesHourlyConstraint) {
        pendingPost.current = null;
        setSubmissionUncertain(false);
        setSafeToRetry(false);
        setError("You've already shared a post this hour. Please try again later.");
        return;
      }
      setSubmissionUncertain(true);
      setSafeToRetry(false);
      setError('We could not confirm whether your post was published. Check its status before trying again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const checkPostStatus = async () => {
    const pending = pendingPost.current;
    if (!pending || !user?.id || savingRef.current || isOffline) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const { data, error: statusError } = await supabase.from('posts').select('id').eq('id', pending.id).maybeSingle();
      if (statusError) { setError('We could not check your post status. Please try again.'); return; }
      if (data) {
        pendingPost.current = null;
        setSubmissionUncertain(false);
        navigation.goBack();
      } else {
        setSafeToRetry(true);
        setError('No post was found. You can safely try again.');
      }
    } catch {
      setError('We could not check your post status. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerClassName="px-lg pt-lg pb-xl gap-xl">
        <AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="chevron-left" size={20} color={colors.text} /></Pressable>} />
        <ScreenHero eyebrow="Dad Health Community" headline={'Share it\nwith the community'} sub="Start a conversation, ask a question or share your experience." />
        <>
          {route.params?.circleId ? <View className="gap-sm">
            <Text className="font-heading-bold text-lime text-[10px] uppercase">Circle</Text>
            {circlesLoading ? <Text className="font-body text-muted-text text-[14px]">Loading your Dad Circles…</Text> : null}
            {error === 'We could not load your Dad Circles. Please try again.' ? <Pressable onPress={() => setCircleRetryKey((key) => key + 1)} accessibilityRole="button" className="min-h-[40px] justify-center"><Text className="font-heading-bold text-lime text-[11px] uppercase">Try again</Text></Pressable> : null}
            {memberCircles.length === 0 ? <Text className="font-body text-muted-text text-[14px]">Join a Dad Circle before posting.</Text> : <>
              <Pressable onPress={() => setCirclePickerOpen((open) => !open)} disabled={submissionUncertain} accessibilityRole="button" accessibilityState={{ expanded: circlePickerOpen, disabled: submissionUncertain }} accessibilityLabel={selectedCircle ? `Selected Circle: ${selectedCircle.name}. Choose another Circle` : 'Choose a Circle'} className="min-h-[80px] flex-row items-center gap-md rounded-button border border-border bg-card p-md">
                <View className="h-[38px] w-[38px] rounded-full bg-lime items-center justify-center"><Feather name={dashboardIcon(selectedCircle?.icon ?? 'community')} size={18} color={colors.dark} /></View>
                <View className="flex-1"><Text className="font-heading-bold text-white text-[12px]">{selectedCircle?.name ?? 'Choose a Circle'}</Text><Text className="font-body text-muted-text text-[14px] leading-[20px] mt-xs">{selectedCircle?.description ?? (selectedCircle?.visibility === 'private' ? 'Private Circle' : 'Select where to share')}</Text></View>
                <Feather name={circlePickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.tertiaryText} />
              </Pressable>
              {circlePickerOpen ? <View className="rounded-button border border-border bg-card overflow-hidden">{memberCircles.map((circle) => <Pressable key={circle.id} onPress={() => { setCircleId(circle.id); setCirclePickerOpen(false); setError(null); }} disabled={submissionUncertain} accessibilityRole="button" accessibilityState={{ selected: circleId === circle.id, disabled: submissionUncertain }} className={`min-h-[64px] flex-row items-center gap-sm px-md py-sm border-b border-border ${circle.id === circleId ? 'bg-lime/[0.06]' : ''}`}><View className="h-[34px] w-[34px] shrink-0 rounded-full bg-lime items-center justify-center"><Feather name={dashboardIcon(circle.icon ?? 'community')} size={16} color={colors.dark} /></View><View className="flex-1"><Text className="font-heading-bold text-white text-[12px] uppercase">{circle.name}{circle.visibility === 'private' ? ' · Private' : ''}</Text>{circle.description ? <Text className="font-body text-muted-text text-[14px] leading-[20px] mt-xs">{circle.description}</Text> : null}</View>{circle.id === circleId ? <Feather name="check" size={16} color={colors.lime} /> : null}</Pressable>)}</View> : null}
            </>}
          </View> : null}
          <View className="gap-sm">
            <Text className="font-heading-bold text-lime text-[10px] uppercase">Topic</Text>
            <View className="flex-row border-y border-border">
              {TAGS.map((option) => <Pressable key={option} onPress={() => { setTag(option); setError(null); }} disabled={submissionUncertain} accessibilityRole="button" accessibilityState={{ selected: tag === option, disabled: submissionUncertain }} className={`flex-1 min-h-[48px] items-center justify-center border-b-2 ${tag === option ? 'border-lime' : 'border-transparent'}`}><Text className={`font-heading-bold text-[12px] uppercase ${tag === option ? 'text-lime' : 'text-white/70'}`}>{communityTagLabel(option)}</Text></Pressable>)}
            </View>
          </View>
          <MultilineTextInput value={body} editable={!submissionUncertain} onChangeText={(value) => { setBody(value); setError(null); }} autoFocus textAlignVertical="top" placeholder="Share something with the community…" placeholderTextColor={colors.tertiaryText} className="min-h-[180px] rounded-button border border-border bg-card p-md font-body text-white text-[16px] leading-[24px]" />
          <View className="min-h-[72px] flex-row items-center justify-between gap-md border-y border-border py-md">
            <View className="flex-1 pr-md"><Text className="font-heading-bold text-white text-[13px] uppercase">Post anonymously</Text><Text className="font-body text-muted-text text-[14px] leading-[20px] mt-xs">Your name and account will not appear on the post.</Text></View>
            <Switch value={anonymous} disabled={submissionUncertain} onValueChange={(value) => { setAnonymous(value); setError(null); }} trackColor={{ false: '#252525', true: colors.lime }} thumbColor={anonymous ? colors.dark : '#8A8A8A'} />
          </View>
          <View className="gap-sm">
            <InlineFormError message={isOffline ? null : error} />
            {submissionUncertain && !safeToRetry ? <LimeButton label="Check post status" onPress={() => void checkPostStatus()} loading={saving} disabled={isOffline} /> : null}
            <LimeButton label={user ? safeToRetry ? 'Try again' : 'Start a Post' : 'Log in to post'} onPress={() => void submit()} loading={saving} disabled={Boolean(user) && (!body.trim() || (Boolean(route.params?.circleId) && !circleId) || (submissionUncertain && !safeToRetry))} />
          </View>
        </>
      </ScrollView>
    </SafeAreaView>
  );
}

function resolveDisplayName(profileName: string | null, user: ReturnType<typeof useAuth>['user']) {
  if (profileName?.trim()) return profileName.trim();
  const meta = user?.user_metadata as Record<string, unknown> | undefined;
  for (const value of [meta?.display_name, meta?.full_name]) if (typeof value === 'string' && value.trim()) return value.trim();
  return user?.email?.split('@')[0]?.trim() || 'Member';
}

function initialsFromDisplayName(name: string, email?: string | null) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${[...parts[0]][0] ?? ''}${[...parts[1]][0] ?? ''}`.toUpperCase();
  const compact = name.replace(/\s+/g, '');
  if (compact.length >= 2 && name !== 'Member') return [...compact].slice(0, 2).join('').toUpperCase();
  const local = email?.split('@')[0]?.replace(/[^a-zA-Z0-9]/g, '') ?? '';
  return local.length >= 2 ? local.slice(0, 2).toUpperCase() : '?';
}

function isTransportFailure(error: { code?: string; message?: string }) {
  const message = (error.message ?? '').toLowerCase();
  return ['FETCH_ERROR', 'NETWORK_ERROR', 'TIMEOUT'].includes(error.code ?? '')
    || ['network request failed', 'failed to fetch', 'fetch failed', 'timed out', 'timeout', 'connection reset', 'aborted'].some((part) => message.includes(part));
}
