import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, AppState, Keyboard, KeyboardAvoidingView, Platform, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import LimeButton from '../LimeButton';
import InlineFormError from '../InlineFormError';
import { colors } from '../../theme';
import { useAccountPrivacy } from '../../hooks/useAccountPrivacy';
import { acknowledgePrivacyCompletion, privacyAcknowledgmentKey, PrivacyRequestError, confirmPrivacyIdentity, parsePrivacyStatus, privacyRequest, PRIVACY_RECOVERY_KEY, subscribePrivacyRecovery, privacyStatusMessage, type PrivacyKind, type PrivacyOperation, type PrivacyStatus } from '../../lib/accountPrivacy';
import { useAuth } from '../../contexts/AuthContext';
import * as SecureStore from 'expo-secure-store';
import { clearPrivacyOwnerData } from '../../lib/accountPrivacyCleanup';
import { supabase } from '../../lib/supabase';
import { openSubscriptionManagement } from '../../lib/nativeSubscriptions';

export default function AccountPrivacySheet({ owner, kind, onClose }: { owner?: string; kind: PrivacyKind | null; onClose(): void }) {
  const request = useAccountPrivacy(owner, kind);
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const flow = `${owner}:${kind}`;
  const currentFlow = useRef({ key: flow });
  if (currentFlow.current.key !== flow) currentFlow.current = { key: flow };
  const [notice, setNotice] = useState<{ flow: string; action: 'identity' | 'submit'; message: string } | null>(null);
  const [verificationFlow, setVerificationFlow] = useState<string | null>(null);
  const verificationOpen = kind === 'export' && verificationFlow === flow && Boolean(owner);
  const verifyButton = useRef<React.ComponentRef<typeof View>>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const passwordInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const passwordFocused = useRef(false);
  const submissionLock = useRef(false);
  useEffect(() => {
    setNotice(null); setIdentityError(null); setPassword(''); setConfirming(false);
    setVerificationFlow(null); identityLock.current = false; submissionLock.current = false;
  }, [flow]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(current => current === notice ? null : current), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  function revealPassword() {
    const node = findNodeHandle(passwordInput.current);
    if (node && passwordFocused.current) scroll.current?.scrollResponderScrollNativeHandleToKeyboard(node, 24, true);
  }
  useEffect(() => {
    const listener = Keyboard.addListener('keyboardDidShow', revealPassword);
    return () => listener.remove();
  }, []);
  const restoreVerificationFocus = useRef(false);
  function closeVerification() {
    restoreVerificationFocus.current = true;
    setVerificationFlow(null);
  }
  useEffect(() => {
    if (verificationOpen || !restoreVerificationFocus.current) return;
    restoreVerificationFocus.current = false;
    const node = findNodeHandle(verifyButton.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [verificationOpen]);
  const visibleRequestError = kind === 'export' ? null : request.error;
  const visibleIdentityError = kind === 'export'
    ? notice?.flow === flow && notice.action === 'identity' ? notice.message : null
    : identityError;
  async function submitExport() {
    if (submissionLock.current) return;
    submissionLock.current = true; setNotice(null);
    const acceptedFlow = currentFlow.current;
    try {
      const message = await request.submit();
      if (mounted.current && currentFlow.current === acceptedFlow && message)
        setNotice({ flow, action: 'submit', message });
    } finally { if (currentFlow.current === acceptedFlow) submissionLock.current = false; }
  }
  const identityLock = useRef(false);
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function confirmIdentity() {
    if (!owner || identityLock.current) return;
    Keyboard.dismiss();
    const acceptedOwner = owner;
    const acceptedFlow = currentFlow.current;
    identityLock.current = true; setConfirming(true); setIdentityError(null); setNotice(null);
    try {
      const appleAuthorizationCode = await confirmPrivacyIdentity(owner, password, kind === 'delete');
      if (mounted.current && currentFlow.current === acceptedFlow) {
        const message = await request.prepare(appleAuthorizationCode);
        if (mounted.current && currentFlow.current === acceptedFlow && kind === 'export' && message)
          setNotice({ flow, action: 'identity', message });
      }
    } catch {
      if (mounted.current && currentFlow.current === acceptedFlow) {
        if (kind === 'export') setNotice({ flow, action: 'identity', message: 'We couldn’t confirm your identity. Please sign in again.' });
        else setIdentityError('We couldn’t confirm your identity. Your account has not been deleted.');
      }
    } finally {
      if (mounted.current && currentOwner.current === acceptedOwner && currentFlow.current === acceptedFlow) {
        setPassword(''); setConfirming(false); identityLock.current = false;
      }
    }
  }
  const deleting = kind === 'delete';
  const body = 'font-body text-white text-[14px] leading-[21px]';
  return <Modal visible={Boolean(kind)} transparent animationType="slide" onRequestClose={verificationOpen ? closeVerification : onClose}>
    <KeyboardAvoidingView
      className="flex-1 justify-end"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable accessibilityElementsHidden={verificationOpen} importantForAccessibility={verificationOpen ? "no-hide-descendants" : "auto"} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" className="absolute inset-0 bg-black/75" />
      <SafeAreaView
        pointerEvents={verificationOpen ? "none" : "auto"}
        accessibilityElementsHidden={verificationOpen}
        importantForAccessibility={verificationOpen ? "no-hide-descendants" : "auto"}
        edges={['bottom']}
        style={deleting ? { height: '85%', flexShrink: 1, minHeight: 0 } : { maxHeight: '85%', flexShrink: 1, minHeight: 0 }}
        className="rounded-t-[28px] bg-dark px-lg pt-lg"
      >
        <View className="flex-row justify-between items-center gap-md pb-md">
          <Text className="font-heading-bold text-white text-[24px] flex-1">{deleting ? 'Delete your account?' : 'Export your data'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center"><Feather name="x" size={20} color={colors.text} /></Pressable>
        </View>
        <ScrollView
          ref={scroll}
          style={deleting ? { flex: 1, minHeight: 0 } : { flexShrink: 1, minHeight: 0 }}
          contentContainerClassName="gap-lg pb-md"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          <Text className={body}>{deleting
            ? 'This permanently removes your profile, check-ins, Journal, activity history, scores, plans and uploaded photos. Your community content will be removed; empty placeholders may remain to preserve other dads’ replies.\n\nDeleting your account does not cancel a paid subscription. Cancel it separately to stop future charges.\n\nThis cannot be undone.'
            : 'We’ll email a copy of your saved check-ins, Journal, activity history and other account information to:'}</Text>
          {!deleting && (request.destination || user?.email_confirmed_at && user.email) ? <Text className={body}>{request.destination ?? user?.email}</Text> : null}
          <Text className={body}>{deleting
            ? 'Any shared calendar you own and its events will be removed. If you are an invited parent, your association will be removed.'
            : 'This file contains personal information. Keep it somewhere safe. Photos are listed in a manifest; image files and unsynced device-only drafts are not included.'}</Text>
          {deleting ? <Text className={body}>For Apple subscriptions, use iPhone Settings → your name → Subscriptions. For Google Play, use Payments & subscriptions. Web subscriptions can be managed from your membership screen. You can delete your account without cancelling first.</Text> : null}
          {deleting && request.subscriptionProviders?.map(provider => <Pressable key={provider} accessibilityRole="link"
            className="min-h-[48px] justify-center" onPress={() => {
              if (provider === 'stripe' && owner) {
                const expectedOwner = owner;
                void openSubscriptionManagement(expectedOwner, () => mounted.current && currentOwner.current === expectedOwner)
                  .catch(() => { if (mounted.current && currentOwner.current === expectedOwner) setIdentityError('We could not open membership management. Account deletion remains available.'); });
                return;
              }
              void Linking.openURL(provider === 'apple'
              ? 'https://apps.apple.com/account/subscriptions' : provider === 'google'
                ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions'); }}>
            <Text className={body}>{provider === 'apple' ? 'Manage Apple subscriptions' : provider === 'google' ? 'Manage Google Play subscriptions' : 'Manage web membership'}</Text>
          </Pressable>)}
        <View className="gap-md pt-md pb-md">
          {(!request.status || request.status.state === 'reconfirmation_required') && !request.confirmation && user?.app_metadata.provider === 'email' ? <TextInput
            ref={passwordInput}
            onFocus={() => { passwordFocused.current = true; revealPassword(); }}
            onBlur={() => { passwordFocused.current = false; }}
            accessibilityLabel="Current password" placeholder="Current password" placeholderTextColor={colors.text}
            secureTextEntry autoCapitalize="none" autoCorrect={false} value={password} onChangeText={setPassword}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => Keyboard.dismiss()}
            className="min-h-[48px] rounded-xl border border-border px-md font-body text-white text-[16px]" /> : null}

{request.status || visibleRequestError || visibleIdentityError ? (
  <View className="gap-sm">
    {request.status ? (
      <Text accessibilityLiveRegion="polite" className={body}>
        {privacyStatusMessage(request.status)}
      </Text>
    ) : null}

    <InlineFormError message={visibleRequestError} />

    {visibleIdentityError ? (
      <Text accessibilityLiveRegion="polite" className={body}>
        {visibleIdentityError}
      </Text>
    ) : null}
  </View>
) : null}
          {!deleting && request.status && ['sent_for_delivery','delivery_failed','failed','cancelled'].includes(request.status.state)
            ? <LimeButton label="Request another export" onPress={() => void request.newExport()} /> : null}
          {!request.status || request.status.state === 'reconfirmation_required' ? (
            request.confirmation ? <LimeButton label={deleting ? 'Delete my account' : 'Email my data'} disabled={request.busy} onPress={() => void (deleting ? request.submit() : submitExport())} />
              : <LimeButton
  label={confirming ? 'Confirming…' : 'Confirm my identity'}
  disabled={request.busy || confirming}
  onPress={() => void confirmIdentity()}
/>
          ) : null}
          {!deleting && notice?.flow === flow && notice.action === 'submit' ? <InlineFormError message={notice.message} /> : null}
          {!deleting && (
            <View className="overflow-hidden rounded-xl border border-border">
              {!request.confirmation && (
                <Pressable
                  accessibilityRole="button"
                  className="min-h-[48px] flex-row items-center gap-3 px-md py-3"
                  ref={verifyButton}
                  onPress={() => {
                    if (!owner) return;
                    Keyboard.dismiss(); setNotice(null); setIdentityError(null);
                    setVerificationFlow(flow);
                  }}
                >
                  <Feather name="mail" size={18} color={colors.text} />
                  <Text className="flex-1 font-body text-[14px] leading-[20px] text-white">
                    Verify account email
                  </Text>
                  <Feather name="chevron-right" size={18} color={colors.text} />
                </Pressable>
              )}

              <Pressable
                accessibilityRole="link"
                className="min-h-[48px] flex-row items-center gap-3 px-md py-3"
                onPress={() =>
                  void Linking.openURL(
                    'https://www.dadhealth.co.uk/privacy-request'
                  )
                }
              >
                <Feather name="help-circle" size={18} color={colors.text} />
                <Text className="flex-1 font-body text-[14px] leading-[20px] text-white">
                  Contact privacy support
                </Text>
                <Feather name="external-link" size={16} color={colors.text} />
              </Pressable>
            </View>
          )}
          <Pressable onPress={onClose} accessibilityRole="button" className="min-h-[48px] items-center justify-center"><Text className={body}>{request.status ? 'Close' : deleting ? 'Keep my account' : 'Cancel'}</Text></Pressable>
        </View>
        </ScrollView>
      </SafeAreaView>
      {verificationOpen && owner ? <ExportEmailVerification key={flow} owner={owner} onBack={closeVerification} /> : null}
    </KeyboardAvoidingView>
  </Modal>;
}

// Mounted only while the overlay is open; no request can update a later opening.
function ExportEmailVerification({ owner, onBack }: { owner: string; onBack(): void }) {
  const { user } = useAuth();

  const [account, setAccount] = useState<{
    email: string;
    verified: boolean;
  } | null>(() =>
    user?.id === owner && user.email
      ? {
          email: user.email,
          verified: Boolean(user.email_confirmed_at),
        }
      : null
  );
  const [checking, setChecking] = useState(true);
  const [checkFailed, setCheckFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [acceptedEmail, setAcceptedEmail] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string } | null>(null);
  const alive = useRef(false);
  const sendingLock = useRef(false);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const heading = useRef<React.ComponentRef<typeof Text>>(null);
  useEffect(() => {
    alive.current = true;
    async function check() {
      if (sendingLock.current) return;
      const generation = ++sequence.current;
      setChecking(true); setCheckFailed(false);
      try {
        // getUser is a server Auth check, not cached session/profile metadata.
        const result = await supabase.auth.getUser();
        if (!alive.current || generation !== sequence.current) return;
        if (result.error || result.data.user?.id !== owner || !result.data.user.email) throw Error('verification unavailable');
        const email = result.data.user.email;
        setAccount({ email, verified: Boolean(result.data.user.email_confirmed_at) });
        setAcceptedEmail(current => current === email ? current : null);
      } catch {
        if (alive.current && generation === sequence.current) { setAccount(null); setCheckFailed(true); }
      } finally { if (alive.current && generation === sequence.current) setChecking(false); }
    }
    void check();
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    return () => { alive.current = false; sequence.current++; controller.current?.abort(); foreground.remove(); };
  }, [owner]);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(current => current === error ? null : current), 5000);
    return () => clearTimeout(timer);
  }, [error]);
  async function send() {
    if (sendingLock.current || checking || !account || account.verified || acceptedEmail) return;
    sendingLock.current = true; setSending(true); setError(null);
    const request = new AbortController(); controller.current = request;
    try {
      const result = await privacyRequest(owner, 'privacy-verification', request.signal, { action: 'verify_email' });
      if (!alive.current || request.signal.aborted) return;
      if (!result || !['verified', 'verification_requested'].includes(result.state) || typeof result.email !== 'string' || !result.email)
        throw new PrivacyRequestError('invalid_response');
      setAccount({ email: result.email, verified: result.state === 'verified' });
      setAcceptedEmail(result.state === 'verification_requested' ? result.email : null);
    } catch (failure) {
      if (!alive.current || request.signal.aborted) return;
      setError({ message: failure instanceof PrivacyRequestError && failure.reason === 'reauthentication_required'
        ? 'Please return to export and confirm your identity before sending the verification email.'
        : 'We couldn’t request a verification email. Please contact privacy support if this continues.' });
    } finally {
      sendingLock.current = false;
      if (alive.current && !request.signal.aborted) setSending(false);
    }
  }
  const body = 'font-body text-white text-[14px] leading-[21px]';

  return <View className="absolute inset-0 bg-black/75 justify-center px-lg py-xl"
    accessibilityViewIsModal importantForAccessibility="yes" onAccessibilityEscape={onBack}>
    <View className="rounded-[28px] bg-dark p-lg" style={{ maxHeight: '100%' }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-md" bounces={false}>
        <Text ref={heading} accessibilityRole="header" className="font-heading-bold text-white text-[24px]"
          onLayout={() => {
            const node = findNodeHandle(heading.current);
            if (node) AccessibilityInfo.setAccessibilityFocus(node);
          }}>
          {account?.verified ? 'Email verified' : 'Verify your email'}
        </Text>
        {account?.verified ? <Text accessibilityLiveRegion="polite" className={body}>Your email is verified</Text> : <>
          <Text className={body}>We’ll send a verification link to:</Text>
          {account ? <Text className={body}>{account.email}</Text> : null}
          <Text className={body}>Open the link, then return to Dad Health.</Text>
          {checkFailed ? <Text className={body}>We couldn’t check your email verification. Return to export and confirm your identity.</Text> : null}
          {acceptedEmail ? <View accessibilityLiveRegion="polite"><Text className={body}>Check your inbox</Text><Text className={body}>{acceptedEmail}</Text></View>
            : <LimeButton label="Send verification email" disabled={checking || !account || sending} onPress={() => void send()} />}
          <InlineFormError message={error?.message ?? null} />
        </>}
        <Pressable accessibilityRole="button" onPress={onBack} className="min-h-[48px] items-center justify-center"><Text className={body}>Back to export</Text></Pressable>
      </ScrollView>
    </View>
  </View>;
}

/** Available above authenticated navigation, including after Auth removal. */
export function AccountPrivacyRecovery() {
  const { user } = useAuth();
  const current = useRef(user?.id); current.current = user?.id;
  const [receipt, setReceipt] = useState<PrivacyOperation | null>(null);
  const [status, setStatus] = useState<PrivacyStatus | null>(null);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dismissError, setDismissError] = useState<string | null>(null);
  const closeLock = useRef(false);

  async function closeRecovery() {
    if (closeLock.current) return;

    if (!receipt || !status?.cleanupCompleted) {
      setDismissed(true);
      return;
    }

    const accepted = receipt;
    closeLock.current = true;
    setClosing(true);
    setDismissError(null);

    try {
      await acknowledgePrivacyCompletion(accepted);
      if (!current.current || current.current === accepted.owner) {
        setReceipt(null);
        setStatus(null);
        setDismissed(true);
      }
    } catch {
      if (!current.current || current.current === accepted.owner) {
        setDismissError('We couldn’t save your dismissal. Please close this message again.');
      }
    } finally {
      closeLock.current = false;
      setClosing(false);
    }
  }
  useEffect(() => {
    setReceipt(null); setStatus(null); setError(false);
    let alive = true; let controller: AbortController | null = null;
    let running = false; let attempts = 0; let terminal = false; let hasPending = false;
    let locallyCleared = false;
    async function recover() {
      if (running || dismissed || terminal || AppState.currentState !== 'active' || attempts >= 12) return; running = true;
      controller?.abort(); controller = new AbortController();
      const signal = controller.signal;
      try {
        const saved = await SecureStore.getItemAsync(PRIVACY_RECOVERY_KEY);
        if (!saved || !alive) return;
        const op = JSON.parse(saved) as PrivacyOperation;
        if (op.kind !== 'delete' || typeof op.owner !== 'string' || !/^[\w-]{43}$/.test(op.recovery)) return;
        if (current.current && current.current !== op.owner) return;
        const acknowledgedOwner = await SecureStore.getItemAsync(privacyAcknowledgmentKey(op.id));
        if (!alive || signal.aborted || (current.current && current.current !== op.owner)) return;
        if (acknowledgedOwner === op.owner) {
          hasPending = false;
          terminal = true;
          setReceipt(null);
          setStatus(null);
          return;
        }
        hasPending = true;
        attempts += 1;
        setReceipt(op);
        const result = parsePrivacyStatus(await privacyRequest(op.owner, `operations/${op.id}`, signal, undefined, op.recovery), op);
        if (!alive || signal.aborted || current.current && current.current !== op.owner) return;
        setReceipt(op);
        // Acceptance is durable and writes are barred: remove local private
        // caches before ending only this owner's local session.
        if (!locallyCleared) { await clearPrivacyOwnerData(op.owner); locallyCleared = true; }
        if (!alive || signal.aborted || current.current && current.current !== op.owner) return;
        setStatus(result); setError(false); terminal = ['completed','failed','cancelled'].includes(result.state);
        if (alive && current.current === op.owner) {
          const session = await supabase.auth.getSession();
          if (alive && current.current === op.owner && session.data.session?.user.id === op.owner)
            { const signedOut = await supabase.auth.signOut({ scope: 'local' }); if (signedOut.error) throw signedOut.error; }
        }
      } catch (error) {
        if (alive && !signal.aborted) {
          if (error instanceof PrivacyRequestError && error.reason === 'operation_not_found') { hasPending = false; setReceipt(null); setStatus(null); setError(false); }
          else setError(true);
        }
      }
      finally { running = false; }
    }
    void recover();
    const unsubscribe = subscribePrivacyRecovery(() => { attempts = 0; terminal = false; setDismissed(false); void recover(); });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') { attempts = 0; void recover(); } });
    const timer = setInterval(() => { if (hasPending && attempts < 12 && !terminal) void recover(); }, 5000);
    return () => { alive = false; clearInterval(timer); controller?.abort(); unsubscribe(); foreground.remove(); };
  }, [user?.id, dismissed]);
  const visible = Boolean(
    receipt &&
    status?.id === receipt.id &&
    !dismissed &&
    (!user || user.id === receipt.owner) &&
    (status.cleanupCompleted || status.state === 'failed')
  );
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => void closeRecovery()}>
    <View className="flex-1 justify-end bg-black/75">
      <SafeAreaView edges={['bottom']} className="rounded-t-[28px] bg-dark p-lg gap-lg">
        <Text className="font-heading-bold text-white text-[24px]">Account deletion</Text>
        <Text className="font-body text-white text-[16px]">{error ? 'We couldn’t check your deletion status. It will be checked when you return to the app.' : privacyStatusMessage(status)}</Text>
        {!status?.cleanupCompleted ? (
          <Text className="font-body text-white text-[14px]">
            Contact privacy support if your request needs attention.
          </Text>
        ) : null}
        <InlineFormError message={dismissError} />
        <LimeButton label="Close" disabled={closing} onPress={() => void closeRecovery()} />
      </SafeAreaView>
    </View>
  </Modal>;
}
