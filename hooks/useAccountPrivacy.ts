import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { newPrivacyOperation, parsePrivacyStatus, privacyRequest, PrivacyRequestError, rememberPrivacyRecovery, type PrivacyKind, type PrivacyOperation, type PrivacyStatus } from '../lib/accountPrivacy';

export function useAccountPrivacy(owner: string | undefined, kind: PrivacyKind | null) {
  const current = useRef(''); current.current = `${owner}:${kind}`;
  const active = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const reading = useRef<AbortController | null>(null);
  const hydrated = useRef(false);
  const operation = useRef<PrivacyOperation | null>(null);
  const [view, setView] = useState<{ key: string; status: PrivacyStatus | null; busy: boolean; error: string | null; destination: string | null; confirmation: string | null; subscriptionProviders?: string[] | null }>
    ({ key: '', status: null, busy: false, error: null, destination: null, confirmation: null });
  const key = `${owner}:${kind}`;
  const storageKey = `dadhealth.privacy.${owner}.${kind}`;
  const recoverExport = useCallback(async (controller: AbortController) => {
    if (!owner || kind !== 'export' || current.current !== key || controller.signal.aborted) return;
    const result = await privacyRequest(owner, 'export', controller.signal);
    if (current.current !== key || controller.signal.aborted) return;
    if (result?.status === null) return;
    if (typeof result?.status?.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(result.status.id)) throw new PrivacyRequestError('invalid_response');
    let receipt = operation.current;
    if (!receipt || receipt.id !== result.status.id || receipt.owner !== owner || receipt.kind !== 'export') {
      const saved = await SecureStore.getItemAsync(`${storageKey}.previous`);
      if (current.current !== key || controller.signal.aborted) return;
      try { receipt = saved ? JSON.parse(saved) as PrivacyOperation : null; } catch { receipt = null; }
    }
    // A lost export capability is not reconstructed or replaced. Server status
    // recovery is authenticated; retain the real receipt when it still exists.
    const recovered: PrivacyOperation = { id: result.status.id, owner, kind: 'export', recovery:
      receipt && receipt.id === result.status.id && receipt.owner === owner && receipt.kind === 'export' && typeof receipt.recovery === 'string'
        ? receipt.recovery : '' };
    const status = parsePrivacyStatus(result.status, recovered);
    await SecureStore.setItemAsync(storageKey, JSON.stringify(recovered));
    if (current.current !== key || controller.signal.aborted) return;
    operation.current = recovered;
    setView(v => ({ ...v, key, status, confirmation: null, error: null }));
  }, [owner, kind, key, storageKey]);
  const refresh = useCallback(async () => {
    const op = operation.current;
    if ((!op && kind !== 'export') || current.current !== key || writing.current || reading.current && !reading.current.signal.aborted) return;
    active.current?.abort(); const controller = new AbortController(); active.current = controller; reading.current = controller;
    try {
      if (!op) { await recoverExport(controller); return; }
      const result = await privacyRequest(op.owner, `operations/${op.id}`, controller.signal, undefined, op.kind === 'delete' ? op.recovery : undefined);
      const status = parsePrivacyStatus(result, op);
      if (current.current === key && !controller.signal.aborted && op.kind === 'delete') await rememberPrivacyRecovery(op, true, () => current.current === key && !controller.signal.aborted);
      if (current.current === key && !controller.signal.aborted) setView(v => ({ ...v, key, status, error: null }));
    } catch (error) {
      if (current.current === key && !controller.signal.aborted && kind === 'export' && error instanceof PrivacyRequestError && error.reason === 'operation_not_found') {
        try { await recoverExport(controller); } catch {
          if (current.current === key && !controller.signal.aborted) setView(v => ({ ...v, error: 'We couldn’t confirm your request yet.' }));
        }
      }
      if (current.current === key && !controller.signal.aborted && !(error instanceof PrivacyRequestError && error.reason === 'operation_not_found'))
        setView(v => ({ ...v, key, error: 'We couldn’t confirm your request yet. It will be checked when you return.' }));
    }
    finally { if (reading.current === controller) reading.current = null; }
  }, [key, kind, recoverExport]);
  useEffect(() => {
    writing.current = false; hydrated.current = false; operation.current = null; active.current?.abort();
    setView({ key, status: null, busy: false, error: null, destination: null, confirmation: null });
    if (!owner || !kind) return;
    let alive = true;
    void SecureStore.getItemAsync(storageKey).then(async saved => {
      if (!alive || current.current !== key) return;
      if (saved) {
        const op = JSON.parse(saved) as PrivacyOperation;
        if (op.owner === owner && op.kind === kind) { operation.current = op; await refresh(); }
      }
      if (!saved && kind === 'export') await refresh();
      if (alive && current.current === key) hydrated.current = true;
    }).catch(() => { if (alive && current.current === key) setView(v => ({ ...v, error: 'Your request history could not be checked.' })); });
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { alive = false; hydrated.current = false; active.current?.abort(); subscription.remove(); };
  }, [key, owner, kind, storageKey, refresh]);

  useEffect(() => {
    if (!owner || !kind || view.key !== key || !view.status ||
      ['completed','failed','cancelled','sent_for_delivery','delivery_failed','reconfirmation_required'].includes(view.status.state)) return;
    let remaining = 12;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active' || remaining <= 0) return;
      remaining -= 1; void refresh();
      // Keep the timer dormant after the budget; foregrounding resets the budget.
    }, 5000);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') { remaining = 12; void refresh(); } });
    return () => { clearInterval(timer); foreground.remove(); };
  }, [owner, kind, key, view.key, view.status?.state, refresh]);

  const prepare = useCallback(async (appleAuthorizationCode?: string) => {
    if (!owner || !kind || !hydrated.current || writing.current || current.current !== key) return;
    writing.current = true; active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setView(v => ({ ...v, key, busy: true, error: null }));
    try {
      const existing = operation.current;
const op = existing ?? await newPrivacyOperation(owner, kind);

if (current.current !== key || controller.signal.aborted) return;

// An accepted export needs its saved status, not another confirmation.
if (kind === 'export' && existing) {
  try {
    const saved = await privacyRequest(
      owner,
      `operations/${existing.id}`,
      controller.signal
    );

    const status = parsePrivacyStatus(saved, existing);

    if (current.current !== key || controller.signal.aborted) return;

    if (status.state !== 'reconfirmation_required') {
      setView(v => ({
        ...v,
        key,
        status,
        confirmation: null,
        error: null,
      }));
      return;
    }
  } catch (error) {
    if (current.current !== key || controller.signal.aborted) return;

    // A locally generated candidate may not have been submitted yet.
    if (
      !(error instanceof PrivacyRequestError) ||
      error.reason !== 'operation_not_found'
    ) {
      throw error;
    }
  }
}

await SecureStore.setItemAsync(storageKey, JSON.stringify(op));
      if (current.current !== key || controller.signal.aborted) return;
      operation.current = op;
      const result = await privacyRequest(owner, 'privacy-verification', controller.signal, { operationId: op.id, kind,
        ...(kind === 'delete' && appleAuthorizationCode ? { appleAuthorizationCode } : {}) });
      if (typeof result?.confirmation !== 'string' || (kind === 'export' && typeof result.destination !== 'string')) throw Error('Invalid confirmation');
      if (current.current === key && !controller.signal.aborted) setView(v => ({ ...v, confirmation: result.confirmation, destination: result.destination,
        subscriptionProviders: Array.isArray(result.subscriptionProviders) ? result.subscriptionProviders.filter((p: unknown) => typeof p === 'string') : null, error: null }));
    } catch (error) {
      const message = error instanceof PrivacyRequestError && error.reason === 'reauthentication_required'
        ? 'Please sign in again to confirm your identity.' : error instanceof PrivacyRequestError && error.reason === 'verified_email_required'
          ? 'Please verify your account email before requesting an export.' : 'We couldn’t verify this request. Please check back later.';
      if (current.current === key && !controller.signal.aborted) {
        setView(v => ({ ...v, error: message }));
        return message;
      }
    } finally { if (current.current === key && active.current === controller) { writing.current = false; setView(v => ({ ...v, busy: false })); } }
  }, [owner, kind, key, storageKey]);
  const submit = useCallback(async () => {
    const op = operation.current;
    if (!op || !view.confirmation || writing.current || current.current !== key || view.status && view.status.state !== 'reconfirmation_required') return;
    writing.current = true; active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setView(v => ({ ...v, busy: true, error: null }));
    let reconcile = true;

    try {
      // Persist the capability before sending. It proves nothing until status is verified.
      if (op.kind === 'delete') await rememberPrivacyRecovery(op, false, () => current.current === key && !controller.signal.aborted);
      if (current.current !== key || controller.signal.aborted) return;
      const result = await privacyRequest(op.owner, op.kind, controller.signal, { operationId: op.id, confirmation: view.confirmation, recovery: op.recovery });
      const status = parsePrivacyStatus(result, op);
      if (current.current === key && !controller.signal.aborted && op.kind === 'delete') await rememberPrivacyRecovery(op, true, () => current.current === key && !controller.signal.aborted);
      if (current.current === key && !controller.signal.aborted) setView(v => ({ ...v, status, confirmation: null }));
    } catch (error) {
      const limited = op.kind === 'export' && error instanceof PrivacyRequestError && error.reason === 'export_limit';
      // A rejected new export was not accepted; never reconcile its ID.
      if (limited) {
        reconcile = false;
        try { await recoverExport(controller); } catch { /* Keep the truthful limit message; normal lifecycle retries recovery. */ }
      }
      if (current.current === key && !controller.signal.aborted) {
        const message = limited
          ? 'You already have an active export or requested one within the last 24 hours. Check your email for your existing export.'
          : 'We couldn’t confirm your request yet.';
        setView(v => ({ ...v, confirmation: null, error: message }));
        return message;
      }
    } finally {
      if (current.current === key && active.current === controller) {
        writing.current = false;
        setView(v => ({ ...v, busy: false }));
        if (reconcile) void refresh();
      }
    }
  }, [key, view.confirmation, view.status, refresh, recoverExport]);
  const newExport = useCallback(async () => {
    if (current.current !== key || kind !== 'export' || writing.current || !view.status || !['sent_for_delivery','delivery_failed','failed','cancelled'].includes(view.status.state)) return;
    writing.current = true;
    active.current?.abort();
    try {
      const previous = operation.current;
      if (previous && previous.owner === owner && previous.kind === 'export') {
        await SecureStore.setItemAsync(`${storageKey}.previous`, JSON.stringify(previous));
      }
      if (current.current !== key) return;
      await SecureStore.deleteItemAsync(storageKey);
      if (current.current !== key) return;
      operation.current = null;
      setView({ key, status: null, busy: false, error: null, destination: null, confirmation: null });
    } finally {
      if (current.current === key) writing.current = false;
    }
  }, [owner, kind, view.status, storageKey, key]);
  return { ...(view.key === key ? view : { status: null, busy: false, error: null, destination: null, confirmation: null, subscriptionProviders: null }), prepare, submit, refresh, newExport };
}
