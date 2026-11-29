import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import AppTopBar from '../../components/AppTopBar';
import {
  readCommunityBlocks,
  subscribeCommunityModeration,
  unblockCommunity,
  type BlockedAccount,
} from '../../lib/communityModeration';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme';
export default function BlockedAccountsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth(); const owner = user?.id;
  const current = useRef(owner); current.current = owner;
  const [view, setView] = useState<{owner?: string; rows: BlockedAccount[]; error: string | null; loaded: boolean}>({ rows: [], error: null, loaded: false });
  const [busy, setBusy] = useState<string | null>(null); const lock = useRef(false); const sequence = useRef(0); const mutation = useRef(0);
  useEffect(() => { sequence.current++; mutation.current++; lock.current = false; setBusy(null); }, [owner]);
  useFocusEffect(useCallback(() => {
    let alive = true;

    async function refresh() {
      const request = ++sequence.current;
      if (!owner) {
        setView({ rows: [], error: null, loaded: true });
        return;
      }
      try {
        const rows = await readCommunityBlocks(owner);
        if (alive && request === sequence.current && current.current === owner) {
          setView({ owner, rows, error: null, loaded: true });
        }
      } catch {
        if (alive && request === sequence.current && current.current === owner) {
          setView(v => ({
            owner,
            rows: v.owner === owner ? v.rows : [],
            loaded: true,
            error: 'We couldn’t load your blocked accounts.',
          }));
        }
      }
    }

    const unsubscribe = subscribeCommunityModeration((changedOwner, ready) => {
      if (ready && changedOwner === owner && current.current === owner) {
        void refresh();
      }
    });
    void refresh();
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [owner]));
  async function unblock(id: string) {
    if (!owner || lock.current) return; lock.current = true; sequence.current++; const operation = ++mutation.current; setBusy(id);
    try { await unblockCommunity(owner, id); sequence.current++; if (current.current === owner && operation === mutation.current) setView(v => ({ ...v, rows: v.rows.filter(row => row.id !== id), error: null })); }
    catch { if (current.current === owner && operation === mutation.current) setView(v => ({ ...v, error: 'We couldn’t confirm this change.' })); }
    finally { if (current.current === owner && operation === mutation.current) { lock.current = false; setBusy(null); } }
  }
  const rows = view.owner === owner ? view.rows : [];
  return <SafeAreaView edges={['top','bottom']} className="flex-1 bg-dark"><ScrollView contentContainerClassName="p-lg gap-lg pb-xl">
    <AppTopBar title="Blocked accounts" showNotifications={false} leftAccessory={<Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.goBack()} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="chevron-left" size={20} color={colors.text} /></Pressable>} />
    <Text className="font-body text-white text-[16px] leading-[24px]">Blocked accounts are labelled privately to protect anonymous authors. Unblocking makes their content visible again.</Text>
    {view.owner === owner && view.error ? <Text accessibilityRole="alert" className="font-body text-white text-[16px]">{view.error}</Text> : null}
    {view.owner === owner && view.loaded && !view.error && !rows.length ? <Text className="font-body text-white text-[16px]">No blocked accounts.</Text> : null}
    {rows.map(row => <View key={row.id} className="flex-row flex-wrap items-center justify-between gap-md border-b border-border py-md"><View><Text className="font-heading-bold text-white text-[22px]">{row.label}</Text><Text className="font-body text-white text-[14px]">{new Date(row.createdAt).toLocaleDateString()}</Text></View><Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void unblock(row.id)} className="min-h-[48px] justify-center"><Text className="font-heading-bold text-lime text-[18px]">{busy === row.id ? 'Unblocking…' : 'Unblock'}</Text></Pressable></View>)}
  </ScrollView></SafeAreaView>;
}
