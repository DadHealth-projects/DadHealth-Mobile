import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../components/AppTopBar';
import LimeButton from '../components/LimeButton';
import { useAuth } from '../contexts/AuthContext';
import { type JournalEntry, useJournalEntries } from '../hooks/useJournalEntries';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

const JOURNAL_PROMPTS = [
  'What felt heavy today, and why?',
  'What went better than expected today?',
  'What do I want to do differently tomorrow?',
  'What am I grateful for right now?',
] as const;

export default function JournalScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const journal = useJournalEntries(user?.id);
  const [editing, setEditing] = useState<JournalEntry | null | undefined>(undefined);
  const [content, setContent] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editorOpen = editing !== undefined;

  const openNew = useCallback(() => {
    setEditing(null);
    setContent('');
    setSelectedPrompt(null);
    setMessage(null);
    setError(null);
  }, []);
  const openEntry = useCallback((entry: JournalEntry) => {
    setEditing(entry);
    setContent(entry.content);
    setSelectedPrompt(entry.prompt);
    setMessage(null);
    setError(null);
  }, []);
  const closeEditor = useCallback(() => {
    setEditing(undefined);
    setContent('');
    setSelectedPrompt(null);
    setError(null);
  }, []);
  const save = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || !user) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) await journal.updateEntry(editing.id, trimmed, selectedPrompt);
      else await journal.createEntry(trimmed, selectedPrompt);
      setEditing(undefined);
      setContent('');
      setMessage(editing ? 'Entry updated.' : 'Journal entry saved.');
    } catch {
      setError('We could not save your journal entry. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [content, editing, journal, selectedPrompt, user]);

  const confirmDelete = useCallback(() => {
    if (!editing) return;
    Alert.alert('Delete entry?', 'This private journal entry will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          setError(null);
          void journal.deleteEntry(editing.id)
            .then(() => {
              closeEditor();
              setMessage('Entry deleted.');
            })
            .catch(() => setError('We could not delete this entry. Please try again.'))
            .finally(() => setSaving(false));
        },
      },
    ]);
  }, [closeEditor, editing, journal]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerClassName="px-lg pt-lg pb-xl gap-xl">
          <AppTopBar leftAccessory={<Pressable onPress={() => editorOpen ? closeEditor() : navigation.goBack()} accessibilityRole="button" accessibilityLabel={editorOpen ? 'Back to journal entries' : 'Close journal'} hitSlop={8} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"><Feather name={editorOpen ? 'chevron-left' : 'x'} size={20} color={colors.text} /></Pressable>} />
          {!editorOpen ? (
            <View>
              <Text className="font-heading text-white uppercase text-[42px] leading-[44px]">
                Journal entries
              </Text>
              <Text className="font-body text-white/50 text-[15px] leading-[22px] mt-sm">
                For your eyes only.
              </Text>
            </View>
          ) : null}

          {!user ? (
            <LimeButton label="Log in to journal" onPress={() => navigation.navigate('Login')} />
          ) : editorOpen ? (
            <View className="gap-lg">
              <View className="gap-sm">
                <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Daily prompts</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="gap-sm">
                  {JOURNAL_PROMPTS.map((prompt) => {
                    const selected = selectedPrompt === prompt;
                    return <Pressable key={prompt} onPress={() => setSelectedPrompt(selected ? null : prompt)} accessibilityRole="button" accessibilityState={{ selected }} className={`max-w-[220px] rounded-button border px-md py-sm active:opacity-75 ${selected ? 'border-lime bg-lime/10' : 'border-border bg-card'}`}><Text className={`font-body text-[12px] leading-[17px] ${selected ? 'text-lime' : 'text-white/60'}`}>{prompt}</Text></Pressable>;
                  })}
                </ScrollView>
              </View>
              {selectedPrompt ? <View className="border-l-2 border-lime pl-md"><Text className="font-heading-bold text-lime text-[10px] tracking-label uppercase">Selected prompt</Text><Text className="font-body text-white/65 text-[13px] leading-[19px] mt-xs">{selectedPrompt}</Text></View> : null}
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="Write freely..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                textAlignVertical="top"
                accessibilityLabel="Private journal entry"
                className="min-h-[420px] rounded-button border border-border bg-card p-md font-body text-white text-[15px] leading-[23px]"
              />
              {error ? <View accessibilityRole="alert" className="rounded-button border border-red-400/40 bg-red-400/10 p-md"><Text className="font-body text-red-300 text-[13px]">{error}</Text></View> : null}
              <LimeButton label={editing ? 'Save changes' : 'Save entry'} onPress={() => void save()} loading={saving} disabled={!content.trim()} />
              {editing ? <Pressable onPress={confirmDelete} disabled={saving} accessibilityRole="button" className="min-h-[44px] items-center justify-center"><Text className="font-heading-bold text-red-300 text-[12px] uppercase">Delete entry</Text></Pressable> : null}
            </View>
          ) : (
            <View className="gap-lg">
              <LimeButton label="New entry" onPress={openNew} />
              {message ? <View accessibilityLiveRegion="polite" className="rounded-button border border-lime/25 bg-lime/5 p-md"><Text className="font-body text-lime text-[13px]">{message}</Text></View> : null}
              {journal.loading ? (
                <View className="gap-sm">{[0, 1, 2].map((item) => <View key={item} className="h-[82px] rounded-button bg-white/5" />)}</View>
              ) : journal.error ? (
                <View accessibilityRole="alert" className="gap-md rounded-button border border-red-400/40 bg-red-400/10 p-md"><Text className="font-body text-red-300 text-[13px]">{journal.error}</Text><LimeButton label="Retry entries" onPress={() => void journal.refresh()} /></View>
              ) : journal.entries.length === 0 ? (
                <View className="border-y border-border py-xl"><Text className="font-heading-bold text-white text-[17px] uppercase">No entries yet</Text><Text className="font-body text-white/40 text-[13px] leading-[19px] mt-xs">Your private entries will appear here.</Text></View>
              ) : (
                <View className="gap-sm">
                  {journal.entries.map((entry) => <Pressable key={entry.id} onPress={() => openEntry(entry)} accessibilityRole="button" accessibilityLabel={`Open journal entry from ${formatDate(entry.created_at)}`} className="rounded-button border border-border bg-card p-md active:opacity-75"><View className="flex-row items-center justify-between gap-sm"><Text className="font-heading-bold text-lime text-[10px] tracking-label uppercase">{formatDate(entry.created_at)}</Text><Feather name="chevron-right" size={18} color={colors.lime} /></View>{entry.prompt ? <Text numberOfLines={2} className="font-heading-bold text-white text-[14px] uppercase mt-sm">{entry.prompt}</Text> : null}<Text numberOfLines={2} className="font-body text-white/50 text-[12px] leading-[18px] mt-xs">{entry.content}</Text></Pressable>)}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}
