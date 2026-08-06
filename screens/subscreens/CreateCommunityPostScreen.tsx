import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { trackEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

const TAGS = ['FITNESS', 'MIND', 'BOND'] as const;

export default function CreateCommunityPostScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [tag, setTag] = useState<(typeof TAGS)[number]>('FITNESS');
  const [anonymous, setAnonymous] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    void supabase.from('user_profile').select('display_name').eq('user_id', user.id).maybeSingle().then(({ data }) => setDisplayName(typeof data?.display_name === 'string' ? data.display_name : null));
  }, [user?.id]);

  const resolvedName = useMemo(() => resolveDisplayName(displayName, user), [displayName, user]);
  const submit = async () => {
    const content = body.trim();
    if (!user) { navigation.navigate('Login'); return; }
    if (!content || saving) return;
    setSaving(true); setError(null);
    const authorName = anonymous ? 'Anonymous' : resolvedName;
    const { error: insertError } = await supabase.from('posts').insert({ user_id: anonymous ? null : user.id, content, tag, anonymous, author_initials: anonymous ? '?' : initialsFromDisplayName(authorName, user.email), author_name: authorName, author_meta: anonymous ? 'Anonymous · ' : 'Member · ' });
    if (insertError) { setError('We could not publish your post. Please try again.'); setSaving(false); return; }
    trackEvent('community_post_created', { tag, anonymous, content_length: content.length }, user.id);
    setBody(''); setSaving(false); navigation.goBack();
  };

  return <SafeAreaView edges={['top']} className="flex-1 bg-dark"><ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerClassName="px-lg pt-lg pb-xl gap-xl"><AppTopBar leftAccessory={<Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close create post" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="x" size={20} color={colors.text} /></Pressable>} /><ScreenHero eyebrow="Dad Health Community" headline={'Share it\nwith the squad'} /><TextInput value={body} onChangeText={setBody} autoFocus multiline textAlignVertical="top" placeholder="Share something with the community…" placeholderTextColor={colors.tertiaryText} className="min-h-[220px] rounded-button border border-border bg-card p-md font-body text-white text-[16px] leading-[24px]" /><View className="gap-sm"><Text className="font-heading-bold text-lime text-[10px] uppercase">Topic</Text><View className="flex-row border-y border-border">{TAGS.map((option) => <Pressable key={option} onPress={() => setTag(option)} accessibilityRole="button" accessibilityState={{ selected: tag === option }} className={`flex-1 min-h-[46px] items-center justify-center border-b-2 ${tag === option ? 'border-lime' : 'border-transparent'}`}><Text className={`font-heading-bold text-[11px] uppercase ${tag === option ? 'text-lime' : 'text-white/40'}`}>{option}</Text></Pressable>)}</View></View><View className="min-h-[58px] flex-row items-center justify-between border-y border-border"><View className="flex-1 pr-md"><Text className="font-heading-bold text-white text-[13px] uppercase">Post anonymously</Text><Text className="font-body text-white/40 text-[11px] mt-xs">Your name and account will not appear on the post.</Text></View><Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ false: '#252525', true: colors.lime }} thumbColor={anonymous ? colors.dark : '#8A8A8A'} /></View>{error ? <Text accessibilityRole="alert" className="font-body text-red-300 text-[13px]">{error}</Text> : null}<LimeButton label={user ? 'Post' : 'Log in to post'} onPress={() => void submit()} loading={saving} disabled={Boolean(user) && !body.trim()} /></ScrollView></SafeAreaView>;
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
