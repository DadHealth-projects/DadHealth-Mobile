import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

import AppTopBar from '../AppTopBar';
import InlineFormError from '../InlineFormError';
import LimeButton from '../LimeButton';
import MultilineTextInput from '../MultilineTextInput';
import { useAuth } from '../../contexts/AuthContext';
import { useJournalEntries } from '../../hooks/useJournalEntries';
import { TEXT_A_MATE_DRAFT } from '../../lib/mindExperienceContent';
import { RESET_STEPS } from '../../lib/mindReset';
import { colors } from '../../theme';

type TimedQuickFix = 'voice' | 'brain-dump' | 'body-reset';
type QuickFix = TimedQuickFix | 'text-mate';
type SessionState = 'ready' | 'running' | 'complete';

const QUICK_FIXES: Array<{ key: QuickFix; icon: keyof typeof Feather.glyphMap; title: string; detail: string }> = [
  { key: 'voice', icon: 'mic', title: 'Voice note', detail: 'Say what is on your mind · up to 1 minute' },
  { key: 'brain-dump', icon: 'edit-3', title: 'Brain dump', detail: 'Write freely for 1 minute' },
  { key: 'text-mate', icon: 'message-circle', title: 'Text a mate', detail: 'Open a message draft to someone you trust' },
  { key: 'body-reset', icon: 'wind', title: 'Shoulders / jaw reset', detail: 'Release tension for 30 seconds' },
];

const RECORDING_OPTIONS = { ...RecordingPresets.LOW_QUALITY, directory: 'cache' as const };

export default function MindQuickFixes() {
  const [selected, setSelected] = useState<TimedQuickFix | null>(null);
  const openFix = useCallback(async (key: QuickFix) => {
    if (key === 'text-mate') {
      const body = encodeURIComponent(TEXT_A_MATE_DRAFT);
      const url = `sms:${Platform.OS === 'ios' ? '&' : '?'}body=${body}`;
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert('Messaging unavailable', 'This device cannot open a text message.');
      }
      return;
    }
    setSelected(key);
  }, []);

  return (
    <View className="gap-sm">
      <View className="gap-xs">
        <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Four free quick fixes</Text>
        <Text className="font-body text-muted-text text-[12px] leading-[18px]">Small ways to make room for what you need.</Text>
      </View>
      <View className="gap-sm">
        {QUICK_FIXES.map((item) => (
          <Pressable key={item.key} onPress={() => void openFix(item.key)} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.detail}`} className="min-h-[68px] flex-row items-center gap-md rounded-button border border-border bg-card px-md py-sm active:opacity-75">
            <View className="h-[38px] w-[38px] items-center justify-center rounded-full bg-lime/10">
              <Feather name={item.icon} size={18} color={colors.lime} />
            </View>
            <View className="flex-1">
              <Text className="font-heading-bold text-white text-[14px] uppercase">{item.title}</Text>
              <Text className="font-body text-muted-text text-[11px] leading-[16px] mt-[2px]">{item.detail}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.lime} />
          </Pressable>
        ))}
      </View>
      {selected ? <QuickFixSession key={selected} kind={selected} onClose={() => setSelected(null)} /> : null}
    </View>
  );
}

function QuickFixSession({ kind, onClose }: { kind: TimedQuickFix; onClose: () => void }) {
  const { user } = useAuth();
  const journal = useJournalEntries(user?.id);
  const [state, setState] = useState<SessionState>('ready');
  const [secondsLeft, setSecondsLeft] = useState(kind === 'body-reset' ? 30 : 60);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const recorder = useAudioRecorder(RECORDING_OPTIONS, (status) => {
    if (status.hasError || status.mediaServicesDidReset) {
      setError('Recording was interrupted. The temporary audio will be deleted.');
      setState('complete');
    }
  });
  const recorderUri = useRef<string | null>(null);
  const voiceCleanupStarted = useRef(false);
  const journalSaveInFlight = useRef(false);

  const deleteRecording = useCallback(async (stopFirst: boolean) => {
    if (voiceCleanupStarted.current) return;
    voiceCleanupStarted.current = true;
    try {
      if (stopFirst) await recorder.stop();
    } catch {
      // Recorder may already have stopped after a system interruption.
    }
    const uri = recorder.uri ?? recorderUri.current;
    recorderUri.current = null;
    if (uri) {
      try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch { /* App cache remains private; OS clears cache. */ }
    }
    try { await setAudioModeAsync({ allowsRecording: false }); } catch { /* Keep user flow safe if audio session reset. */ }
  }, [recorder]);

  const finishVoice = useCallback(async (message: string) => {
    await deleteRecording(true);
    setNotice(message);
    setState('complete');
  }, [deleteRecording]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const active = nextState === 'active';
      setAppActive(active);
      if (!active && kind === 'voice' && state === 'running') {
        void finishVoice('Recording stopped and deleted when you left the app.');
      }
    });
    return () => subscription.remove();
  }, [finishVoice, kind, state]);

  useEffect(() => {
    if (state !== 'running' || !appActive) return;
    const timer = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [appActive, state]);

  useEffect(() => {
    if (state !== 'running' || secondsLeft > 0) return;
    if (kind === 'voice') void finishVoice('One-minute recording ended and temporary audio was deleted.');
    else setState('complete');
  }, [finishVoice, kind, secondsLeft, state]);

  useEffect(() => {
    if (kind === 'voice' && state === 'complete' && !voiceCleanupStarted.current) {
      void deleteRecording(true);
    }
  }, [deleteRecording, kind, state]);

  useEffect(() => () => {
    if (kind === 'voice') void deleteRecording(true);
  }, [deleteRecording, kind]);

  const start = useCallback(async () => {
    setError(null);
    setNotice(null);
    setSecondsLeft(kind === 'body-reset' ? 30 : 60);
    if (kind === 'voice') {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          setError('Microphone access is needed to record a voice note. You can change this in device settings.');
          return;
        }
        voiceCleanupStarted.current = false;
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: false });
        await recorder.prepareToRecordAsync();
        recorder.record({ forDuration: 60 });
        recorderUri.current = recorder.uri;
      } catch {
        await deleteRecording(true);
        setError('Recording could not start. Please try again.');
        return;
      }
    }
    setState('running');
  }, [deleteRecording, kind, recorder]);

  const keepDraft = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || !user || saving || journalSaveInFlight.current) return;
    journalSaveInFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      await journal.createEntry(trimmed, 'Brain dump');
      onClose();
      Alert.alert('Saved to Journal', 'Your brain dump is saved using your normal Journal history and sync.');
    } catch {
      setError('We could not save this to your Journal. Your draft remains here so you can try again.');
    } finally {
      journalSaveInFlight.current = false;
      setSaving(false);
    }
  }, [draft, journal, onClose, saving, user]);

  const title = kind === 'voice' ? 'Voice note' : kind === 'brain-dump' ? 'Brain dump' : 'Shoulders / jaw reset';

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaProvider style={{ flex: 1 }}>
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-dark">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="px-lg pt-lg">
            <AppTopBar leftAccessory={(
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={state === 'complete' ? 'Back to Mind' : 'Close quick fix'}
                hitSlop={8}
                className="h-[44px] w-[44px] items-center justify-center rounded-full border border-border"
              >
                <Feather name={state === 'complete' ? 'arrow-left' : 'x'} size={20} color={colors.text} />
              </Pressable>
            )} />
          </View>
          <ScrollView
            className="flex-1"
            contentContainerClassName="flex-grow gap-lg px-lg py-lg"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-grow justify-center gap-lg">
                <View className="gap-sm">
                  <Text className="font-heading text-white text-[32px] uppercase">{title}</Text>
                  {kind === 'voice' ? <Text className="font-body text-muted-text text-[14px]">Private, temporary recording. Maximum 60 seconds. Deleted when session ends.</Text> : null}
                  {kind === 'brain-dump' ? <Text className="font-body text-muted-text text-[14px]">Write without editing. Keep it in Journal or discard it.</Text> : null}
                </View>

                {state === 'ready' ? <LimeButton label={kind === 'voice' ? 'Start voice note' : 'Start 1-minute timer'} onPress={() => void start()} /> : null}
                {state === 'running' ? (
                  <View className="gap-lg">
                    <Text accessibilityLiveRegion="polite" className="font-heading text-lime text-[42px] text-center">{formatTime(secondsLeft)}</Text>
                    {kind === 'brain-dump' ? <MultilineTextInput value={draft} onChangeText={setDraft} autoFocus placeholder="Let it out..." placeholderTextColor="rgba(255,255,255,0.3)" textAlignVertical="top" accessibilityLabel="Brain dump draft" className="min-h-[300px] rounded-button border border-border bg-card p-md font-body text-white text-[15px] leading-[22px]" /> : null}
                    {kind === 'voice' ? <Text className="font-body text-muted-text text-center">Recording stays on this device and will be deleted when you finish.</Text> : null}
                    {kind === 'body-reset' ? <Text className="font-body text-white text-[17px] leading-[26px]">{RESET_STEPS[1].instruction}</Text> : null}
                    <Pressable onPress={() => kind === 'voice' ? void finishVoice('Recording stopped and temporary audio was deleted.') : setState('complete')} accessibilityRole="button" accessibilityLabel="Finish quick fix now" className="min-h-[44px] items-center justify-center"><Text className="font-heading-bold text-lime uppercase">Finish now</Text></Pressable>
                  </View>
                ) : null}

                {state === 'complete' ? (
                  <View className="gap-md">
                    {kind === 'brain-dump' ? (
                      <>
                        <Text className="font-body text-white text-[14px] leading-[21px]">Keep this draft in your Journal, or discard it.</Text>
                        <MultilineTextInput value={draft} onChangeText={setDraft} placeholder="Your draft" placeholderTextColor="rgba(255,255,255,0.3)" textAlignVertical="top" accessibilityLabel="Brain dump draft to keep or discard" className="min-h-[240px] rounded-button border border-border bg-card p-md font-body text-white text-[15px] leading-[22px]" />
                        {user ? <LimeButton label="Keep in Journal" loading={saving} disabled={!draft.trim()} onPress={() => void keepDraft()} /> : <LimeButton label="Log in to keep in Journal" onPress={onClose} />}
                        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Discard brain dump" className="min-h-[44px] items-center justify-center"><Text className="font-heading-bold text-muted-text uppercase">Discard</Text></Pressable>
                      </>
                    ) : <LimeButton label="Done" onPress={onClose} />}
                  </View>
                ) : null}
                <InlineFormError message={error} />
                {notice ? <Text accessibilityLiveRegion="polite" className="font-body text-muted-text text-[12px] text-center">{notice}</Text> : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function formatTime(seconds: number) {
  return `0:${String(seconds).padStart(2, '0')}`;
}
