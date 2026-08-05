import { useCallback, useEffect, useState } from 'react';

import { trackEvent } from '../lib/analytics';
import { supabase } from '../lib/supabase';

export type JournalEntry = {
  id: string;
  user_id: string;
  content: string;
  prompt: string | null;
  mood_value: number;
  tag: string | null;
  created_at: string;
};

export function useJournalEntries(userId?: string) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await supabase
      .from('journal_entries')
      .select('id,user_id,content,prompt,mood_value,tag,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (result.error) {
      setEntries([]);
      setError('We could not load your journal entries. Please try again.');
    } else {
      setEntries((result.data ?? []) as JournalEntry[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createEntry = useCallback(async (content: string, prompt: string | null) => {
    if (!userId) throw new Error('Not authenticated');
    const result = await supabase
      .from('journal_entries')
      .insert({ user_id: userId, content, prompt, mood_value: 3, tag: 'EVENING_JOURNAL' })
      .select('id,user_id,content,prompt,mood_value,tag,created_at')
      .single();
    if (result.error) throw result.error;
    trackEvent('journal_entry_created', { content_length: content.length }, userId);
    await refresh();
    return result.data as JournalEntry;
  }, [refresh, userId]);

  const updateEntry = useCallback(async (entryId: string, content: string, prompt: string | null) => {
    if (!userId) throw new Error('Not authenticated');
    const result = await supabase
      .from('journal_entries')
      .update({ content, prompt })
      .eq('id', entryId)
      .eq('user_id', userId)
      .select('id,user_id,content,prompt,mood_value,tag,created_at')
      .single();
    if (result.error) throw result.error;
    await refresh();
    return result.data as JournalEntry;
  }, [refresh, userId]);

  const deleteEntry = useCallback(async (entryId: string) => {
    if (!userId) throw new Error('Not authenticated');
    const result = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);
    if (result.error) throw result.error;
    await refresh();
  }, [refresh, userId]);

  return { entries, loading, error, refresh, createEntry, updateEntry, deleteEntry };
}
