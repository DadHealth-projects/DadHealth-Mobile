import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { blockCommunity, reportCommunity, reportReasons, type ModerationTarget } from '../../lib/communityModeration';
import LimeButton from '../LimeButton';
import { colors } from '../../theme';
const body = 'font-body text-white text-[16px] leading-[24px]';
export default function CommunityActionsMenu({ target, own = false }: { target: ModerationTarget; own?: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'report' | 'block' | 'done'>('menu');
  const [reason, setReason] = useState('bullying'), [explanation, setExplanation] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const lock = useRef(false), epoch = useRef(0);
  const identity = `${user?.id ?? ''}:${target.kind}:${target.id}`;
  const current = useRef(identity); current.current = identity;
  useEffect(() => { epoch.current++; setOpen(false); setFeedback(null); setExplanation(''); setBusy(false); lock.current = false; }, [identity]);
  useEffect(() => () => { epoch.current++; }, []);
  function close() { if (!lock.current) { setOpen(false); epoch.current++; } }
  async function submit() {
    if (!user || lock.current) return;
    lock.current = true; setBusy(true); setFeedback(null);
    const key = identity, generation = epoch.current;
    try {
      if (mode === 'report') await reportCommunity(user.id, target, reason, explanation);
      else await blockCommunity(user.id, target);
      if (current.current === key && epoch.current === generation) {
        Keyboard.dismiss();
        setFeedback(mode === 'report' ? 'Report received' : 'Account blocked');
        setMode('done');
      }
    } catch (error) {
      if (current.current === key && epoch.current === generation) setFeedback(error instanceof Error ? error.message : 'We couldn’t confirm this action.');
    } finally { if (current.current === key && epoch.current === generation) { lock.current = false; setBusy(false); } }
  }
  if (!user || own) return null;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${target.kind} options`} className="h-[48px] w-[48px] items-center justify-center" onPress={(event) => { event.stopPropagation(); setMode('menu'); setFeedback(null); setOpen(true); }}><Feather name="more-horizontal" size={20} color={colors.text} /></Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView className="flex-1 justify-end bg-black/75" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView edges={['bottom']} className="max-h-[85%] rounded-t-[28px] bg-dark px-lg pt-lg">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerClassName="gap-md pb-lg"
          >
            <View className="flex-row items-center justify-between gap-md">
              <Text
                accessibilityRole="header"
                className="flex-1 font-heading-bold text-white text-[24px] leading-[30px] uppercase"
              >
                {mode === 'done'
                  ? feedback
                  : mode === 'report'
                    ? `Report ${target.kind}`
                    : mode === 'block'
                      ? 'Block this dad?'
                      : 'Community options'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close community options"
                disabled={busy}
                onPress={close}
                className="h-[48px] w-[48px] items-center justify-center rounded-full bg-muted"
              >
                <Feather name="x" size={22} color={colors.text} />
              </Pressable>
            </View>
            {mode === 'done' ? (
              <>
                <Text className={body}>
                  {feedback === 'Report received'
                    ? 'Thanks for letting us know. Your report has been saved for review.'
                    : 'Their posts and comments are now hidden from you. You can unblock them in Settings.'}
                </Text>
                <LimeButton label="Done" onPress={close} />
              </>
            ) : (
              <>
                {mode === 'menu' ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => { setFeedback(null); setMode('report'); }}
                      className="min-h-[56px] flex-row items-center gap-md border-b border-border"
                    >
                      <Feather name="flag" size={20} color={colors.text} />
                      <Text className={`${body} flex-1`}>Report {target.kind}</Text>
                      <Feather name="chevron-right" size={20} color={colors.lime} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => { setFeedback(null); setMode('block'); }}
                      className="min-h-[56px] flex-row items-center gap-md"
                    >
                      <Feather name="user-x" size={20} color={colors.text} />
                      <Text className={`${body} flex-1`}>Block this dad</Text>
                      <Feather name="chevron-right" size={20} color={colors.lime} />
                    </Pressable>
                  </>
                ) : mode === 'report' ? (
                  <>
                    <Text className="font-body text-muted-text text-[14px] leading-[20px]">
                      Choose a reason. You can add more detail below.
                    </Text>
                    <View>
                      {reportReasons.map(([key, label]) => (
                        <Pressable
                          key={key}
                          disabled={busy}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: reason === key, disabled: busy }}
                          onPress={() => setReason(key)}
                          className="min-h-[48px] flex-row items-center gap-sm border-b border-border py-sm"
                        >
                          <Feather name={reason === key ? 'check-circle' : 'circle'} size={20} color={colors.lime} />
                          <Text className={`${body} flex-1`}>{label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      accessibilityLabel="Optional explanation"
                      placeholder="Anything else we should know? (optional)"
                      placeholderTextColor={colors.tertiaryText}
                      multiline
                      maxLength={1000}
                      editable={!busy}
                      value={explanation}
                      onChangeText={setExplanation}
                      textAlignVertical="top"
                      className="min-h-[100px] rounded-xl border border-border p-md font-body text-white text-[16px]"
                    />
                  </>
                ) : (
                  <Text className={body}>
                    Their posts and comments will be hidden from you, including
                    anonymous content. They won’t be notified. You can unblock
                    them in Settings.
                  </Text>
                )}
                {feedback ? (
                  <Text
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    className="font-body text-[#F87171] text-[14px] leading-[20px]"
                  >
                    {feedback}
                  </Text>
                ) : null}
                {mode !== 'menu' ? (
                  <LimeButton
                    label={mode === 'report'
                      ? busy ? 'Submitting…' : 'Submit report'
                      : busy ? 'Blocking…' : 'Block this dad'}
                    disabled={busy}
                    onPress={() => void submit()}
                  />
                ) : null}
                <Pressable
                  disabled={busy}
                  onPress={close}
                  accessibilityRole="button"
                  className="min-h-[48px] items-center justify-center"
                >
                  <Text className={body}>Cancel</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}
