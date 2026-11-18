import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';

import { useNetworkStatus } from '../contexts/NetworkContext';
import { trackEvent } from '../lib/analytics';
import {
  enqueueOfflineWrite,
  readJournalCache,
  subscribeOfflineSync,
  writeJournalCache,
  type OfflineJournalEntry,
} from '../lib/offlineStorage';
import {
  createJournalQueueItem,
  isRetryableOfflineError,
  persistJournalEntry,
} from '../lib/offlineSync';
import { supabase } from '../lib/supabase';

export type JournalEntry = OfflineJournalEntry;

function mergeEntries(server: JournalEntry[], cached: JournalEntry[]) {
  const serverIds = new Set(server.map((entry) => entry.id));
  return [
    ...cached.filter((entry) => entry.sync_status && !serverIds.has(entry.id)),
    ...server.map((entry) => ({ ...entry, sync_status: undefined })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function useJournalEntries(userId?: string) {
  const { isOffline } = useNetworkStatus();
  const ownership = useRef({ userId });
  if (ownership.current.userId !== userId) ownership.current = { userId };
  const lifetime = ownership.current;
  const mounted = useRef(true);
  const sequence = useRef(0);
  const stateOwner = useRef(userId);
  const isCurrent = useCallback(() => mounted.current && ownership.current === lifetime, [lifetime]);
  const assertCurrent = useCallback(() => { if (!userId || !isCurrent()) throw new Error('account_changed'); }, [userId, isCurrent]);
  useEffect(() => {
    mounted.current = true;
    stateOwner.current = userId;
    setEntries([]); setError(null); setSyncError(null);
    return () => { mounted.current = false; ++sequence.current; };
  }, [userId]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadCached = useCallback(async (request = sequence.current) => {
    if (!userId) return [];
    const cached = await readJournalCache(userId);
    const safeEntries = Array.isArray(cached) ? cached : [];
    if (isCurrent() && request === sequence.current) setEntries(safeEntries);
    return safeEntries;
  }, [userId, isCurrent]);

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    const valid = () => isCurrent() && request === sequence.current;
    if (!isCurrent()) return;
    if (!userId) {
      setEntries([]);
      setLoading(false);
      setError(null);
      setSyncError(null);
      return;
    }
    setLoading(true);
    setError(null);

    let cached: JournalEntry[] = [];
    try {
      cached = await loadCached(request);
      if (!valid()) return;
      setLoading(false);
    } catch {
      cached = [];
    }

    if (!valid()) return;
    if (isOffline) {
      setLoading(false);
      return;
    }

    const result = await supabase
      .from('journal_entries')
      .select('id,user_id,content,prompt,mood_value,tag,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!valid()) return;
    if (result.error) {
      if (cached.length === 0 || !isRetryableOfflineError(result.error)) {
        setError('We could not load your journal entries. Please try again.');
      }
    } else {
      const merged = mergeEntries((result.data ?? []) as JournalEntry[], cached);
      setEntries(merged);
      try {
        await writeJournalCache(userId, merged);
      } catch {
        // Keep the successfully loaded server entries available in memory.
      }
    }
    if (valid()) setLoading(false);
  }, [isOffline, loadCached, userId, isCurrent]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeOfflineSync((event) => {
    if (!isCurrent() || event.userId !== userId || event.kind !== 'journal_create') return;
    if (event.status === 'failed') {
      setSyncError(event.message ?? 'A saved journal entry could not be synced.');
      void loadCached();
    }
    if (event.status === 'synced') {
      setSyncError(null);
      void refresh();
    }
  }), [loadCached, refresh, userId, isCurrent]);

  const cachePendingEntry = useCallback(async (entry: JournalEntry) => {
    assertCurrent();
    if (!userId) throw new Error('Not authenticated');
    const cached = await readJournalCache(userId) ?? entries;
    assertCurrent();
    const next = [entry, ...cached.filter((item) => item.id !== entry.id)]
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    await writeJournalCache(userId, next);
    if (isCurrent()) setEntries(next);
  }, [entries, userId, assertCurrent, isCurrent]);

  const createEntry = useCallback(async (content: string, prompt: string | null) => {
    assertCurrent();
    if (!userId) throw new Error('Not authenticated');
    const entry: JournalEntry = {
      id: Crypto.randomUUID(),
      user_id: userId,
      content,
      prompt,
      mood_value: 3,
      tag: 'EVENING_JOURNAL',
      created_at: new Date().toISOString(),
      sync_status: isOffline ? 'pending' : undefined,
    };
    const item = createJournalQueueItem(userId, entry, Crypto.randomUUID());

    if (isOffline) {
      await cachePendingEntry(entry);
      assertCurrent();
      try {
        await enqueueOfflineWrite(item);
      } catch (queueError) {
        const failed = { ...entry, sync_status: 'failed' as const };
        await cachePendingEntry(failed);
        throw queueError;
      }
      return entry;
    }

    try {
      await persistJournalEntry(item);
      assertCurrent();
      trackEvent('journal_entry_created', { content_length: content.length }, userId);
      await refresh();
      return entry;
    } catch (saveError) {
      assertCurrent();
      if (!isRetryableOfflineError(saveError)) throw saveError;
      const pending = { ...entry, sync_status: 'pending' as const };
      await cachePendingEntry(pending);
      assertCurrent();
      await enqueueOfflineWrite({ ...item, payload: { entry: pending } });
      return pending;
    }
  }, [cachePendingEntry, isOffline, refresh, userId, assertCurrent]);

  const updateEntry = useCallback(async (entryId: string, content: string, prompt: string | null) => {
    assertCurrent();
    if (!userId) throw new Error('Not authenticated');
    if (isOffline) throw new Error('offline_edit');
    const result = await supabase
      .from('journal_entries')
      .update({ content, prompt })
      .eq('id', entryId)
      .eq('user_id', userId)
      .select('id,user_id,content,prompt,mood_value,tag,created_at')
      .single();
    assertCurrent();
    if (result.error) throw result.error;
    await refresh();
    return result.data as JournalEntry;
  }, [isOffline, refresh, userId, assertCurrent]);

  const deleteEntry = useCallback(async (entryId: string) => {
    assertCurrent();
    if (!userId) throw new Error('Not authenticated');
    if (isOffline) throw new Error('offline_delete');
    const result = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);
    assertCurrent();
    if (result.error) throw result.error;
    await refresh();
  }, [isOffline, refresh, userId, assertCurrent]);

  return {
    entries: stateOwner.current === userId ? entries : [],
    loading: stateOwner.current === userId ? loading : Boolean(userId),
    error: stateOwner.current === userId ? error : null,
    syncError: stateOwner.current === userId ? syncError : null,
    isOffline,
    refresh,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}
