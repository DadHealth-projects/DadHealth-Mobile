import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { saveCancellationFeedback, type CancellationReason, type MembershipSubscription, type RetentionOffer } from '../../lib/nativeSubscriptions';
import type { OfferOutcome } from '../../hooks/useNativeSubscriptions';
import { colors } from '../../theme';

export const REASONS: ReadonlyArray<{ value: CancellationReason; label: string }> = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'not_using', label: 'Not using it enough' },
  { value: 'missing_feature', label: 'Missing a feature' },
  { value: 'technical_problem', label: 'Technical problem' },
  { value: 'other', label: 'Other' },
];
type Props = {
  owner: string; subscriptions: MembershipSubscription[] | null; loading: boolean; loadError: string | null;
  refresh(): Promise<boolean>; manage(id: string): Promise<boolean>; onClose(): void;
  returnState: string; offline: boolean;
  /** Retention offer (brief 01). Optional: without it, or when the server signs nothing, the flow is unchanged. */
  loadOffer?(subscriptionId: string): Promise<RetentionOffer | null>;
  redeemOffer?(offer: RetentionOffer): Promise<boolean>;
  offerOutcome?: OfferOutcome;
};
// Copy for the offer step is provisional and awaits the client's approval (decision H2d).
export const OFFER_COPY = {
  title: 'Before you go',
  body: 'Stay with Dad Health Pro for 50% off for the next 3 months.',
  accept: 'Keep Pro at 50% off',
  decline: 'No thanks, continue cancelling',
  kept: 'Thanks for staying. Apple has confirmed your subscription. Your App Store subscription shows the discounted price.',
  pending: 'Apple is still confirming this. Check your App Store subscription for the latest status.',
  cancelled: 'The offer wasn’t applied. You can try again or continue cancelling.',
  failed: 'We couldn’t apply the offer. You can continue cancelling as normal.',
} as const;
// Brief 01: after "Cancel subscription", one screen asks why (five reasons plus optional free text).
type Step = 'reason' | 'offer' | 'handoff' | 'receipt' | 'kept';
export default function CancellationFlow({ owner, subscriptions, loading, loadError, refresh, manage, onClose, returnState, offline, loadOffer, redeemOffer, offerOutcome = 'idle' }: Props) {
  const [step, setStep] = useState<Step>('reason');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState<CancellationReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<RetentionOffer | null>(null);
  const scope = useRef({ owner, alive: true, busy: false });
  if (scope.current.owner !== owner) scope.current = { owner, alive: true, busy: false };
  const intent = useRef<{ id: string; subscriptionId: string; reason: CancellationReason; details: string; saved: boolean } | null>(null);
  useEffect(() => {
    const current = scope.current; current.alive = true;
    void refresh();
    return () => { current.alive = false; };
  }, [owner, refresh]);
  useEffect(() => { if (step === 'offer' && offerOutcome === 'accepted') setStep('kept'); }, [step, offerOutcome]);
  const eligible = (subscriptions ?? []).filter(item => item.provider === 'apple' && item.canCancel);
  const selected = (subscriptions ?? []).find(item => item.provider === 'apple' && item.id === selectedId)
    ?? (selectedId === null && eligible.length === 1 ? eligible[0] : null);
  const provider = selected ? 'Apple' : null;
  const locked = intent.current !== null;
  const back = () => {
    if (busy) return;
    setError(null);
    if (step === 'reason' || step === 'receipt' || step === 'kept') onClose();
    else setStep('reason');
  };
  // Continue from the reason step: ask the server for a signed offer; on no offer (not configured,
  // not eligible, offline, Android or any failure) go straight to the normal hand-off.
  const continueFromReason = async () => {
    const current = scope.current;
    if (!selected || !reason || current.busy) return;
    setSelectedId(selected.id);
    if (offline || !loadOffer || !redeemOffer) { setStep('handoff'); return; }
    current.busy = true; setBusy(true); setError(null);
    try {
      const signed = await loadOffer(selected.id);
      if (!current.alive || scope.current !== current) return;
      setOffer(signed);
      setStep(signed ? 'offer' : 'handoff');
    } finally { current.busy = false; if (current.alive && scope.current === current) setBusy(false); }
  };
  const acceptOffer = async () => {
    const current = scope.current;
    if (!offer || !redeemOffer || !selected || !reason || current.busy || offline) return;
    current.busy = true; setBusy(true); setError(null);
    try {
      // Save the reason first (best effort): the outcome is recorded from the verified store result.
      intent.current ??= { id: Crypto.randomUUID(), subscriptionId: selected.id, reason, details: details.trim(), saved: false };
      if (!intent.current.saved) {
        try { await saveCancellationFeedback(owner, intent.current); intent.current.saved = true; } catch { /* never blocks the offer */ }
      }
      if (!current.alive || scope.current !== current) return;
      await redeemOffer(offer);
    } finally { current.busy = false; if (current.alive && scope.current === current) setBusy(false); }
  };
  const handoff = async (save: boolean) => {
    const current = scope.current;
    if (!current.alive || current.owner !== owner || current.busy || offline || !selected || !reason) return;
    current.busy = true; setBusy(true); setError(null);
    const valid = () => current.alive && scope.current === current;
    try {
      if (save) {
        intent.current ??= { id: Crypto.randomUUID(), subscriptionId: selected.id, reason, details: details.trim(), saved: false };
        const attempt = intent.current;
        if (attempt.subscriptionId !== selected.id || attempt.reason !== reason || attempt.details !== details.trim()) {
          setError('Retry your original answer or continue without saving feedback.'); return;
        }
        if (!attempt.saved) {
          try {
            await saveCancellationFeedback(owner, attempt);
            if (!valid()) return;
            attempt.saved = true;
          } catch {
            if (valid()) setError('We could not confirm your feedback was saved. Retry or continue without saving.');
            return;
          }
        }
        if (valid()) setStep('receipt');
      }
      const opened = await manage(selected.id);
      if (!valid()) return;
      if (!opened) setError('We could not open subscription management. Please try again.');
      else if (!intent.current?.saved) onClose();
    } catch {
      if (valid()) setError('We could not open subscription management. Please try again.');
    } finally { current.busy = false; if (valid()) setBusy(false); }
  };
  const title = !selected && eligible.length > 1 ? 'Choose subscription'
    : step === 'reason' ? 'Tell us why'
    : step === 'offer' ? OFFER_COPY.title
    : step === 'kept' ? 'You’re staying'
    : step === 'handoff' ? `Manage with\n${provider ?? 'your provider'}` : 'Thanks for\nyour feedback';
  const description = step === 'reason' ? 'We’re sorry to see you go. What’s the main reason for cancelling?'
    : step === 'offer' ? OFFER_COPY.body
    : step === 'kept' ? OFFER_COPY.kept
    : step === 'handoff' ? `You’ll be taken to Apple’s subscription settings to cancel your Dad Health subscription.`
    : 'We’ve received your feedback. You can manage your subscription anytime with your provider.';
  return (
    <SafeAreaView edges={['top','bottom']} className="flex-1 bg-dark">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="flex-grow px-lg pt-sm pb-lg gap-lg">
        <Pressable onPress={back} disabled={busy} accessibilityRole="button" accessibilityLabel="Go back" className="h-[44px] w-[44px] items-center justify-center">
          <View className="h-[32px] w-[32px] rounded-full bg-card items-center justify-center"><Feather name="chevron-left" size={22} color={colors.text} /></View>
        </Pressable>
        <View className="items-center gap-md">
          <View className="h-[56px] w-[56px] rounded-[16px] bg-lime/10 items-center justify-center">
            {step === 'receipt' ? <Feather name="check-circle" size={32} color={colors.lime} /> : <MaterialCommunityIcons name={step === 'handoff' && provider === 'Apple' ? 'apple' : 'crown'} size={32} color={step === 'handoff' ? colors.text : colors.lime} />}
          </View>
          <Text className="font-body-semibold text-white text-[26px] leading-[30px] text-center">{title}</Text>
          <Text className="font-body text-white text-[14px] leading-[21px] text-center">{description}</Text>
        </View>
        {!selected && eligible.length > 1 ? (
          <View className="gap-sm">
            <Text className="font-body text-white text-[14px]">Choose which subscription to manage. Other subscriptions may still provide Pro access.</Text>
            {eligible.map(item => <Pressable key={item.id} onPress={() => setSelectedId(item.id)} accessibilityRole="button" className="rounded-[14px] bg-card p-md">
              <Text className="font-body-semibold text-white">Apple{item.plan ? ` · ${item.plan === 'annual' ? 'Annual' : 'Monthly'}` : ''}</Text>
              <Text className="font-body text-white text-[13px]">Current period ends: {dateLabel(item.currentPeriodEnd) ?? 'Not available'}</Text>
            </Pressable>)}
          </View>
        ) : null}
        {loading && !subscriptions ? <ActivityIndicator size="small" color={colors.lime} /> : null}
        {loadError ? <View className="gap-sm"><Text className="font-body text-white">{loadError}</Text><Action label="Try again" disabled={loading || offline} onPress={() => void refresh()} outlined /></View> : null}
        {!loading && !loadError && subscriptions && !eligible.length && !selected ? <Text className="font-body text-white">No eligible subscription is available to cancel.</Text> : null}
        {selected && step === 'reason' ? <View className="gap-sm">{REASONS.map(item => (
          <Pressable key={item.value} onPress={() => setReason(item.value)} disabled={locked} accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{ checked: reason === item.value, disabled: locked }} className="rounded-[14px] border border-border bg-card p-md flex-row items-center justify-between">
            <Text className="font-body text-white text-[15px]">{item.label}</Text>
            <View className={`h-[20px] w-[20px] rounded-full border items-center justify-center ${reason === item.value ? 'border-lime' : 'border-white/70'}`}>{reason === item.value ? <View className="h-[10px] w-[10px] rounded-full bg-lime" /> : null}</View>
          </Pressable>
        ))}</View> : null}
        {selected && step === 'reason' ? <View className="gap-sm">
          <Text className="font-body text-white text-[14px]">Anything else you’d like to share? (Optional)</Text>
          <View className="rounded-[16px] border border-white/50 bg-card p-md">
          <TextInput value={details} onChangeText={text => setDetails(text.slice(0,1000))} editable={!locked} maxLength={1000} multiline textAlignVertical="top" placeholder="Tell us more..." placeholderTextColor="#FFFFFF" accessibilityLabel="Optional feedback" className="min-h-[180px] font-body text-white text-[15px]" />
          <Text className="font-body text-white text-[12px] text-right">{details.length} / 1,000</Text>
          </View>
        </View> : null}
        {selected && (step === 'handoff' || step === 'receipt') ? <View className="rounded-[16px] bg-card p-md gap-md">
          <Row label="Provider" value={provider!} />
          {selected.plan ? <Row label="Plan" value={selected.plan === 'annual' ? 'Annual' : 'Monthly'} /> : null}
          {dateLabel(selected.currentPeriodEnd) ? <Row label="Current period ends" value={dateLabel(selected.currentPeriodEnd)!} /> : null}

        </View> : null}
        {step === 'receipt' ? <Text className="font-body text-white text-[14px]">{returnState === 'refreshed'
          ? 'Your membership has refreshed. See your verified membership status for the outcome.'
          : 'Feedback received. Cancellation is not yet confirmed. Check your provider for the latest status.'}</Text> : null}
        {step === 'receipt' && returnState === 'unknown' && !loadError ? <Action label="Try again" outlined disabled={loading || offline} onPress={() => void refresh()} /> : null}
        {error ? <Text accessibilityRole="alert" className="font-body text-white text-[14px]">{error}</Text> : null}
        {offline ? <Text className="font-body text-white text-[14px]">Reconnect to continue with your provider.</Text> : null}
        <View className="flex-1" />
        {selected ? <View className="gap-sm">
          {step === 'reason' ? <Action label="Continue" disabled={!reason || !selected.canCancel || busy} onPress={() => void continueFromReason()} /> : null}
          {step === 'offer' && offerOutcome === 'pending' ? <Text className="font-body text-white text-[14px]">{OFFER_COPY.pending}</Text> : null}
          {step === 'offer' && offerOutcome === 'cancelled' ? <Text className="font-body text-white text-[14px]">{OFFER_COPY.cancelled}</Text> : null}
          {step === 'offer' && offerOutcome === 'failed' ? <Text accessibilityRole="alert" className="font-body text-white text-[14px]">{OFFER_COPY.failed}</Text> : null}
          {step === 'offer' && offerOutcome !== 'failed' && offerOutcome !== 'pending' ? <Action label={OFFER_COPY.accept} disabled={busy || offline || offerOutcome === 'redeeming'} onPress={() => void acceptOffer()} /> : null}
          {step === 'offer' ? <Action outlined label={OFFER_COPY.decline} onPress={() => setStep('handoff')} /> : null}
          {step === 'kept' ? <Action label="Done" onPress={onClose} /> : null}
          {step === 'handoff' ? <Action label={error ? 'Retry' : `Continue to ${provider}`} disabled={busy || offline} onPress={() => void handoff(true)} /> : null}
          {error && step === 'handoff' ? <Action outlined label="Continue without saving feedback" disabled={busy || offline} onPress={() => void handoff(false)} /> : null}
          {step === 'receipt' && error ? <Action label={`Continue to ${provider}`} disabled={busy || offline} onPress={() => void handoff(false)} /> : null}
          {step === 'receipt' ? <Action outlined label="Done" disabled={busy} onPress={onClose} /> : null}
          {busy ? <ActivityIndicator size="small" color={colors.lime} /> : null}
        </View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
export function isScheduledAppleMembership(item: MembershipSubscription | undefined): boolean {
  return Boolean(item && item.provider === 'apple' && item.canCancel
    && ['active', 'trialing', 'grace_period'].includes(item.status)
    && Date.parse(item.currentPeriodEnd ?? '') > Date.now()
    && item.cancellation.state === 'scheduled');
}

export function CancellationScheduled({ subscription, busy, offline, error, onBack, onManage }: {
  subscription: MembershipSubscription; busy: boolean; offline: boolean; error: string | null;
  onBack(): void; onManage(): void;
}) {
  if (!isScheduledAppleMembership(subscription)) return null;
  const end = dateLabel(subscription.cancellation.end);
  const covered = end && Date.parse(subscription.currentPeriodEnd ?? '') >= Date.parse(subscription.cancellation.end ?? '');
  return <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-dark">
    <ScrollView contentContainerClassName="flex-grow px-lg pt-sm pb-lg gap-lg">
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back" className="h-[44px] w-[44px] items-center justify-center">
        <View className="h-[32px] w-[32px] rounded-full bg-card items-center justify-center"><Feather name="chevron-left" size={22} color={colors.text} /></View>
      </Pressable>
      <View className="items-center gap-md">
        <View className="h-[56px] w-[56px] rounded-[16px] bg-lime/10 items-center justify-center"><MaterialCommunityIcons name="crown" size={32} color={colors.lime} /></View>
        <Text className="font-body-semibold text-white text-[26px] leading-[30px] text-center">{'Cancellation\nScheduled'}</Text>
        <Text className="font-body text-white text-[14px] leading-[21px] text-center">{end ? `Your Apple subscription is set to end on ${end}.` : 'Apple has confirmed that cancellation is scheduled.'}</Text>
      </View>
      <View className="rounded-[14px] border border-lime bg-lime/10 p-md flex-row gap-sm items-center">
        <Feather name="info" size={22} color={colors.lime} />
        <Text className="flex-1 font-body text-white text-[14px] leading-[20px]">{covered ? 'You’ll keep full access to Pro until this date.' : 'Your Pro access follows your verified membership status.'}</Text>
      </View>
      <View className="rounded-[16px] bg-card p-md gap-lg">
        <View className="flex-row items-center gap-sm"><MaterialCommunityIcons name="apple" size={22} color={colors.text} /><View className="flex-1"><Row label="Provider" value="Apple" /></View></View>
        {end ? <View className="flex-row items-center gap-sm"><Feather name="calendar" size={20} color={colors.text} /><View className="flex-1"><Row label="Access ends" value={end} /></View></View> : null}
      </View>
      {error ? <Text accessibilityRole="alert" className="font-body text-white text-[14px]">{error}</Text> : null}
      <View className="flex-1" />
      <Pressable onPress={onManage} disabled={busy || offline} accessibilityRole="button" accessibilityLabel="Manage subscription"
        accessibilityState={{ disabled: busy || offline, busy }} className={`min-h-[48px] rounded-[14px] border border-white/70 px-md flex-row items-center justify-center gap-md ${busy || offline ? 'opacity-50' : 'active:opacity-70'}`}>
        <Text className="font-body-semibold text-white text-[16px]">Manage subscription</Text>
        <Feather name="external-link" size={18} color={colors.text} />
      </Pressable>
      {busy ? <ActivityIndicator size="small" color={colors.lime} /> : null}
    </ScrollView>
  </SafeAreaView>;
}

function Action({ label, onPress, disabled = false, outlined = false }: { label: string; onPress(): void; disabled?: boolean; outlined?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} className={`min-h-[48px] rounded-[14px] px-md items-center justify-center ${outlined ? 'border border-white/70' : 'bg-lime'} ${disabled ? 'opacity-50' : 'active:opacity-70'}`}><Text className={`font-body-semibold text-[16px] ${outlined ? 'text-white' : 'text-dark'}`}>{label}</Text></Pressable>;
}
function Row({ label, value }: { label: string; value: string }) { return <View className="flex-row justify-between gap-md"><Text className="font-body text-white text-[14px]">{label}</Text><Text className="font-body text-white text-[14px] flex-1 text-right">{value}</Text></View>; }
function dateLabel(value: string | null) { if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null; const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null; }
