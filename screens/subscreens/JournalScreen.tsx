import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import GlobalErrorToastReporter from '../../components/GlobalErrorToastReporter';
import InlineFormError from '../../components/InlineFormError';
import LimeButton from '../../components/LimeButton';
import MultilineTextInput from '../../components/MultilineTextInput';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../hooks/useDashboard';
import { type JournalEntry, useJournalEntries } from '../../hooks/useJournalEntries';
import { localDateKey, selectMindJournalPrompts } from '../../lib/mindExperienceContent';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

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
  const dashboard = useDashboard(user?.id);
  const todayCheckIn = dashboard.data?.moodLogs.find((log) => log.date === localDateKey());
  const guidedPrompts = useMemo(() => selectMindJournalPrompts(todayCheckIn), [todayCheckIn]);
  const [editing, setEditing] = useState<JournalEntry | null | undefined>(undefined);
  const [editorMode, setEditorMode] = useState<'write' | 'guide'>('write');
  const [content, setContent] = useState('');
  const [guideAnswers, setGuideAnswers] = useState(['', '', '']);
  const [guideIndex, setGuideIndex] = useState(0);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editorOpen = editing !== undefined;

  const openNew = useCallback(() => {
    setEditing(null);
    setEditorMode('write');
    setContent('');
    setGuideAnswers(['', '', '']);
    setGuideIndex(0);
    setSelectedPrompt(null);
    setMessage(null);
    setError(null);
  }, []);
  const openEntry = useCallback((entry: JournalEntry) => {
    setEditing(entry);
    setEditorMode('write');
    setContent(entry.content);
    setSelectedPrompt(entry.prompt);
    setMessage(null);
    setError(null);
  }, []);
  const closeEditor = useCallback(() => {
    setEditing(undefined);
    setEditorMode('write');
    setContent('');
    setGuideAnswers(['', '', '']);
    setGuideIndex(0);
    setSelectedPrompt(null);
    setError(null);
  }, []);
  const save = useCallback(async () => {
    const guidedContent = guideAnswers
      .map((answer, index) => answer.trim() ? `${guidedPrompts[index]}\n${answer.trim()}` : null)
      .filter(Boolean)
      .join('\n\n');
    const trimmed = (editorMode === 'guide' ? guidedContent : content).trim();
    if (!trimmed || !user || saveInFlight.current) return;
    if (editing && journal.isOffline) return;
    saveInFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      if (editing) await journal.updateEntry(editing.id, trimmed, selectedPrompt);
      else {
        const entry = await journal.createEntry(trimmed, editorMode === 'guide' ? 'Guided Journal' : selectedPrompt);
        setMessage(entry.sync_status === 'pending' ? null : 'Journal entry saved.');
      }
      setEditing(undefined);
      setEditorMode('write');
      setContent('');
      setGuideAnswers(['', '', '']);
      setGuideIndex(0);
      if (editing) setMessage('Entry updated.');
    } catch {
      setError('We could not save your journal entry. Please try again.');
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }, [content, editing, editorMode, guideAnswers, guidedPrompts, journal, selectedPrompt, user]);

  const openGuided = useCallback(() => {
    setEditing(null);
    setEditorMode('guide');
    setContent('');
    setGuideAnswers(['', '', '']);
    setGuideIndex(0);
    setSelectedPrompt(null);
    setMessage(null);
    setError(null);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!editing) return;
    if (journal.isOffline) return;
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
          <AppTopBar leftAccessory={<Pressable onPress={() => editorOpen ? closeEditor() : navigation.goBack()} accessibilityRole="button" accessibilityLabel={editorOpen ? 'Back to journal entries' : 'Go back'} hitSlop={8} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"><Feather name="chevron-left" size={20} color={colors.text} /></Pressable>} />
          <GlobalErrorToastReporter message={journal.syncError ?? journal.error} />
          {!editorOpen ? (
            <View>
              <Text className="font-heading text-white uppercase text-[42px] leading-[44px]">
                Journal
              </Text>
              <Text className="font-body text-muted-text text-[15px] leading-[22px] mt-sm">
                For your eyes only.
              </Text>
            </View>
          ) : null}

          {!user ? (
            <LimeButton label="Log in to journal" onPress={() => navigation.navigate('Login')} />
          ) : editorOpen ? (
            <View className="gap-lg">
              {editorMode === 'guide' ? (
                <View className="gap-lg">
                  <View className="gap-xs">
                    <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Guide me · {guideIndex + 1} of 3</Text>
                    <Text className="font-heading-bold text-white text-[19px] leading-[25px]">{guidedPrompts[guideIndex]}</Text>
                  </View>
                  <MultilineTextInput
                    value={guideAnswers[guideIndex]}
                    onChangeText={(value) => setGuideAnswers((answers) => answers.map((answer, index) => index === guideIndex ? value : answer))}
                    placeholder="Write what feels useful..."
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    textAlignVertical="top"
                    accessibilityLabel={`Answer prompt ${guideIndex + 1}: ${guidedPrompts[guideIndex]}`}
                    className="min-h-[240px] rounded-button border border-border bg-card p-md font-body text-white text-[15px] leading-[23px]"
                  />
                  <View className="flex-row gap-sm">
                    {guideIndex > 0 ? <Pressable onPress={() => setGuideIndex((index) => index - 1)} accessibilityRole="button" accessibilityLabel="Previous prompt" className="min-h-[48px] flex-1 items-center justify-center rounded-button border border-border"><Text className="font-heading-bold text-white text-[12px] uppercase">Back</Text></Pressable> : null}
                    {guideIndex < 2 ? <View className="flex-1"><LimeButton label="Next prompt" onPress={() => setGuideIndex((index) => index + 1)} /></View> : <View className="flex-1"><LimeButton label="Save guided entry" onPress={() => void save()} loading={saving} disabled={!guideAnswers.some((answer) => answer.trim())} /></View>}
                  </View>
                  <Pressable onPress={() => guideIndex < 2 ? setGuideIndex((index) => index + 1) : setGuideIndex(0)} accessibilityRole="button" accessibilityLabel={guideIndex < 2 ? 'Skip this prompt' : 'Review prompts'} className="min-h-[44px] items-center justify-center"><Text className="font-heading-bold text-muted-text text-[11px] uppercase">{guideIndex < 2 ? 'Skip this prompt' : 'Review prompts'}</Text></Pressable>
                  <InlineFormError message={error} />
                </View>
              ) : (
              <>
              <View className="gap-sm">
                <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Daily prompts</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="gap-sm">
                  {JOURNAL_PROMPTS.map((prompt) => {
                    const selected = selectedPrompt === prompt;
                    return <Pressable key={prompt} onPress={() => setSelectedPrompt(selected ? null : prompt)} accessibilityRole="button" accessibilityState={{ selected }} className={`max-w-[220px] rounded-button border px-md py-sm active:opacity-75 ${selected ? 'border-lime bg-lime/10' : 'border-border bg-card'}`}><Text className={`font-body text-[12px] leading-[17px] ${selected ? 'text-lime' : 'text-tertiary-text'}`}>{prompt}</Text></Pressable>;
                  })}
                </ScrollView>
              </View>
              {selectedPrompt ? <View className="border-l-2 border-lime pl-md"><Text className="font-heading-bold text-lime text-[10px] tracking-label uppercase">Selected prompt</Text><Text className="font-body text-white text-[13px] leading-[19px] mt-xs">{selectedPrompt}</Text></View> : null}
              <MultilineTextInput
                value={content}
                onChangeText={(value) => { setContent(value); setError(null); }}
                placeholder="Write freely..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                textAlignVertical="top"
                accessibilityLabel="Private journal entry"
                className="min-h-[420px] rounded-button border border-border bg-card p-md font-body text-white text-[15px] leading-[23px]"
              />
              <InlineFormError message={error} />
              <LimeButton label={editing ? 'Save changes' : 'Save entry'} onPress={() => void save()} loading={saving} disabled={!content.trim() || Boolean(editing && journal.isOffline)} />
              {editing ? <Pressable onPress={confirmDelete} disabled={saving || journal.isOffline} accessibilityRole="button" accessibilityState={{ disabled: saving || journal.isOffline }} className="min-h-[44px] items-center justify-center disabled:opacity-40"><Text className="font-heading-bold text-red-300 text-[12px] uppercase">Delete entry</Text></Pressable> : null}
              </>
              )}
            </View>
          ) : (
            <View className="gap-lg">
              <View className="gap-sm">
                <LimeButton label="Write freely" onPress={openNew} />
                <Pressable onPress={openGuided} accessibilityRole="button" accessibilityLabel="Start guided Journal prompts" className="min-h-[52px] items-center justify-center rounded-button border border-lime px-lg active:opacity-75"><Text className="font-heading-bold text-lime text-[14px] uppercase">Guide me</Text></Pressable>
              </View>
              {message ? <View accessibilityLiveRegion="polite" className="rounded-button border border-lime/25 bg-lime/5 p-md"><Text className="font-body text-lime text-[13px]">{message}</Text></View> : null}
              <Text className="font-heading-bold text-white text-[17px] uppercase">Journal history</Text>
              {journal.loading ? (
                <View className="gap-sm">{[0, 1, 2].map((item) => <View key={item} className="h-[82px] rounded-button bg-white/5" />)}</View>
              ) : journal.entries.length === 0 ? (
                <View className="border-y border-border py-xl"><Text className="font-heading-bold text-white text-[17px] uppercase">No entries yet</Text><Text className="font-body text-muted-text text-[13px] leading-[19px] mt-xs">Your private entries will appear here.</Text></View>
              ) : (
                <View className="gap-sm">
                  {journal.entries.map((entry) => <Pressable key={entry.id} onPress={() => openEntry(entry)} accessibilityRole="button" accessibilityLabel={`Open journal entry from ${formatDate(entry.created_at)}`} className="rounded-button border border-border bg-card p-md active:opacity-75"><View className="flex-row items-center justify-between gap-sm"><View><Text className="font-heading-bold text-lime text-[10px] tracking-label uppercase">{formatDate(entry.created_at)}</Text>{entry.sync_status ? <Text className={`font-heading-bold text-[9px] uppercase mt-xs ${entry.sync_status === 'failed' ? 'text-red-300' : 'text-tertiary-text'}`}>{entry.sync_status === 'failed' ? 'Sync needed' : 'Waiting to sync'}</Text> : null}</View><Feather name="chevron-right" size={18} color={colors.lime} /></View>{entry.prompt ? <Text numberOfLines={2} className="font-heading-bold text-white text-[14px] uppercase mt-sm">{entry.prompt}</Text> : null}<Text numberOfLines={2} className="font-body text-muted-text text-[12px] leading-[18px] mt-xs">{entry.content}</Text></Pressable>)}
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
