import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import { signInWithApple, signInWithGoogle } from './oauth';
import * as SecureStore from 'expo-secure-store';
export const PRIVACY_RECOVERY_KEY = 'dadhealth.privacy.deletion.recovery';
const recoveryListeners = new Set<() => void>();
export function subscribePrivacyRecovery(listener: () => void) { recoveryListeners.add(listener); return () => { recoveryListeners.delete(listener); }; }
let recoveryWrite: Promise<void> = Promise.resolve();
export async function rememberPrivacyRecovery(op: PrivacyOperation, notify = true, isCurrent = () => true) {
  if (op.kind !== 'delete') return;
  const write = recoveryWrite.catch(() => undefined).then(async () => {
    if (!isCurrent()) return;
    await SecureStore.setItemAsync(PRIVACY_RECOVERY_KEY, JSON.stringify(op));
    if (notify && isCurrent()) recoveryListeners.forEach(listener => listener());
  });
  recoveryWrite = write;
  await write;
}
export const privacyAcknowledgmentKey = (id: string) =>
  `dadhealth.privacy.deletion.ack.${id}`;

export async function acknowledgePrivacyCompletion(op: PrivacyOperation) {
  const write = recoveryWrite.catch(() => undefined).then(async () => {
    await SecureStore.setItemAsync(privacyAcknowledgmentKey(op.id), op.owner);

    const saved = await SecureStore.getItemAsync(PRIVACY_RECOVERY_KEY);
    if (!saved) return;

    const current = JSON.parse(saved) as PrivacyOperation;
    if (
      current.id === op.id &&
      current.owner === op.owner &&
      current.recovery === op.recovery
    ) {
      await SecureStore.deleteItemAsync(PRIVACY_RECOVERY_KEY);
    }
  });

  recoveryWrite = write;
  await write;
}

export type PrivacyKind = 'export' | 'delete';
export type PrivacyOperation = { id: string; owner: string; kind: PrivacyKind; recovery: string };
export type PrivacyStatus = { id: string; kind: PrivacyKind; state: string; accountRemoved: boolean; cleanupCompleted: boolean; updatedAt: string };
const states = ['queued','processing','reconfirmation_required','sent_for_delivery','delivery_failed','cancelled','account_removed','cleanup_pending','completed','failed'];
export class PrivacyRequestError extends Error { constructor(public reason: string) { super('Privacy request unavailable'); } }
export async function confirmPrivacyIdentity(owner: string, password: string, deleting = false) {
  const before = await supabase.auth.getUser();
  if (before.error || before.data.user?.id !== owner) {
    throw new PrivacyRequestError('account_changed');
  }
  const provider = deleting && before.data.user.identities?.some(identity => identity.provider === 'apple')
    ? 'apple' : before.data.user.app_metadata.provider;
  let appleAuthorizationCode: string | undefined;
  const result = provider === 'apple' ? await signInWithApple(code => { appleAuthorizationCode = code; }) : provider === 'google' ? await signInWithGoogle()
    : await supabase.auth.signInWithPassword({ email: before.data.user.email ?? '', password });
  if (result.error) {
    throw new PrivacyRequestError('identity_not_confirmed');
  }
  const after = await supabase.auth.getUser();
  if (after.error || after.data.user?.id !== owner) {
    throw new PrivacyRequestError('account_changed');
  }
  return appleAuthorizationCode;
}
export function parsePrivacyStatus(value: unknown, op: PrivacyOperation): PrivacyStatus {
  const v = value as PrivacyStatus | null;
  if (!v || v.id !== op.id || v.kind !== op.kind || !states.includes(v.state) || typeof v.accountRemoved !== 'boolean'
    || typeof v.cleanupCompleted !== 'boolean' || !Number.isFinite(Date.parse(v.updatedAt))
    || (v.cleanupCompleted && (!v.accountRemoved || v.state !== 'completed' || v.kind !== 'delete'))) throw new PrivacyRequestError('invalid_response');
  return { id: v.id, kind: v.kind, state: v.state, accountRemoved: v.accountRemoved, cleanupCompleted: v.cleanupCompleted, updatedAt: v.updatedAt };
}
export async function newPrivacyOperation(owner: string, kind: PrivacyKind): Promise<PrivacyOperation> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const recovery = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { id: Crypto.randomUUID(), owner, kind, recovery };
}
export async function privacyRequest(owner: string, path: string, signal: AbortSignal, body?: unknown, recovery?: string) {
  const requestId = Crypto.randomUUID();
  try {
    const { data, error } = await supabase.auth.getSession();
    if (signal.aborted || (data.session && data.session.user.id !== owner) || (!recovery && (error || !data.session))) {
      throw new PrivacyRequestError('account_changed');
    }
    const base = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/, '');
    const response = await fetch(base + '/api/account/' + path, { method: body ? 'POST' : 'GET', signal,
      headers: { 'X-Privacy-Request-ID': requestId, ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
        ...(recovery ? { 'X-Privacy-Recovery': recovery } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new PrivacyRequestError(typeof result?.reason === 'string' ? result.reason : 'operation_unavailable');
    return result;
  } catch (error) {
    throw error;
  }
}
export function privacyStatusMessage(status: PrivacyStatus | null) {
  if (!status) return null;
  if (status.cleanupCompleted) return 'Your account and required cleanup are complete.';
  if (status.state === 'failed') return status.accountRemoved
    ? 'Your account has been removed. Some required cleanup needs support attention.'
    : 'We couldn’t complete your request. Please contact support.';
  if (status.accountRemoved) return 'Your account has been removed. Required cleanup is still in progress.';
  if (status.state === 'sent_for_delivery') return 'Your export has been sent for delivery.';
  if (status.state === 'delivery_failed') return 'Your export could not be delivered. Please contact support.';
  if (status.state === 'reconfirmation_required') return 'Your email has changed. Confirm your current verified email before sending.';
  if (status.state === 'cancelled') return 'This export was cancelled.';
  return status.kind === 'delete' ? 'Your deletion request is being processed. You can close the app.' : 'Your export is being prepared. You can close the app.';
}
