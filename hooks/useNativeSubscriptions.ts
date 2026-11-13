import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { ProductSubscription, Purchase } from 'react-native-iap';
import { useNetworkStatus } from '../contexts/NetworkContext';

import {
  getNativeIapModule,
  loadNativeSubscriptionStatus,
  loadNativeMembership,
  type MembershipSubscription,
  resolveNativePlanEligibility,
  nativeSubscriptionUserMessage,
  nativeProductIds,
  openSubscriptionManagement,
  prepareNativePurchase,
  purchaseErrorMessage,
  verifyNativePurchase,
  type NativePlanProduct,
  type NativeSubscriptionStatus,
  type SubscriptionPlan,
} from '../lib/nativeSubscriptions';

type Operation = { kind: 'purchase' | 'restore' | 'callback'; processing: boolean };
type TransactionResult = { summary: NativeSubscriptionStatus; finishFailed: boolean };
type Transaction = { summary?: NativeSubscriptionStatus; finished: boolean; work?: Promise<TransactionResult> };

export function useNativeSubscriptions(userId: string | undefined, onEntitlementChanged?: () => void) {
  const [memberships, setMemberships] = useState<MembershipSubscription[] | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [returnState, setReturnState] = useState<'idle' | 'pending' | 'refreshed' | 'unknown'>('idle');
  const [managedId, setManagedId] = useState<string | null>(null);
  const [status, setStatus] = useState<NativeSubscriptionStatus | null>(null);
  const [products, setProducts] = useState<NativePlanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [managing, setManaging] = useState(false);
  const [storeAvailable, setStoreAvailable] = useState(false);
  const [actionFailure, setActionFailure] = useState<{ message: string } | null>(null);
  const error = actionFailure?.message ?? null;
  const setError = useCallback((message: string | null) => {
    setActionFailure(message ? { message } : null);
  }, []);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const { isOffline } = useNetworkStatus();
  const offline = useRef(isOffline);
  offline.current = isOffline;
  const [notice, setNotice] = useState<string | null>(null);
  const statusRequestId = useRef(0);
  const scope = useMemo(() => ({
    owner: userId, alive: false, lifecycle: 0, catalogId: 0, catalogReady: false,
    operation: null as Operation | null,
    purchaseAwaitingOutcome: false,
    management: null as object | null,
    loadFailed: false, membershipRequest: 0, returnGeneration: 0,
    handoff: null as { id: string; leftApp: boolean } | null,
    connection: null as Promise<unknown> | null,
    transactions: new Map<string, Transaction>(),
    queued: new Map<string, Purchase>(),
  }), [userId]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [stateScope, setStateScope] = useState(scope);
  const changed = useRef(onEntitlementChanged);
  changed.current = onEntitlementChanged;
  const isCurrent = useCallback(() => scope.alive && currentScope.current === scope, [scope]);

  const refreshStatus = useCallback(async () => {
    if (!scope.owner || !isCurrent()) return;
    const requestId = ++statusRequestId.current;
    setStatusLoading(true);
    setStatusError(null);
    try {
      if (offline.current) throw new Error('offline');
      const next = await loadNativeSubscriptionStatus(scope.owner);
      if (!isCurrent() || statusRequestId.current !== requestId) return;
      setStatus(next);
      scope.loadFailed = false;
      return next;
    } catch (statusError) {
      if (isCurrent() && statusRequestId.current === requestId) {
        scope.loadFailed = true;
        setStatusError(offline.current ? 'You are offline. Reconnect and try again.'
          : nativeSubscriptionUserMessage(statusError, 'We could not confirm your Dad Health Pro access.'));
      }
      throw statusError;
    } finally {
      if (isCurrent() && statusRequestId.current === requestId) setStatusLoading(false);
    }
  }, [scope, isCurrent]);

  const refreshMembership = useCallback(async () => {
    if (!scope.owner || !isCurrent()) return false;
    const request = ++scope.membershipRequest;
    const lifecycle = scope.lifecycle;
    const valid = () => isCurrent() && lifecycle === scope.lifecycle && request === scope.membershipRequest;
    setMembershipLoading(true); setMembershipError(null);
    try {
      if (offline.current) throw new Error('offline');
      const next = await loadNativeMembership(scope.owner);
      if (!valid()) return false;
      setMemberships(next); return true;
    } catch {
      if (valid()) setMembershipError('We could not confirm your membership details. Please try again.');
      return false;
    } finally { if (valid()) setMembershipLoading(false); }
  }, [scope, isCurrent]);

  const refreshAfterManagement = useCallback(async () => {
    const lifecycle = scope.lifecycle;
    if (!isCurrent()) return false;
    const generation = ++scope.returnGeneration;
    setReturnState('pending');
    const [statusOk, detailsOk] = await Promise.all([
      refreshStatus().then(result => Boolean(result), () => false), refreshMembership(),
    ]);
    if (!isCurrent() || scope.lifecycle !== lifecycle || generation !== scope.returnGeneration) return false;
    setReturnState(statusOk && detailsOk ? 'refreshed' : 'unknown');
    if (statusOk) changed.current?.();
    return statusOk && detailsOk;
  }, [scope, isCurrent, refreshStatus, refreshMembership]);

  const retryMembership = useCallback(() => scope.returnGeneration > 0 && !scope.handoff
    ? refreshAfterManagement() : refreshMembership(), [scope, refreshAfterManagement, refreshMembership]);

  const refreshCatalog = useCallback(async () => {
    if (!isCurrent()) return;
    const requestId = ++scope.catalogId;
    const valid = () => isCurrent() && requestId === scope.catalogId;
    const iap = getNativeIapModule();
    scope.catalogReady = false;
    setCatalogLoading(true);
    setCatalogError(null);
    let statusLoaded = false;
    try {
      await refreshStatus();
      if (!valid()) return;
      statusLoaded = true;
      if (!iap || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
        if (valid()) setStoreAvailable(false);
        return;
      }
      scope.connection ??= iap.initConnection().catch((failure) => {
        scope.connection = null;
        throw failure;
      });
      await scope.connection;
      if (!valid()) return;
      const ids = nativeProductIds();
      if (!ids.length) throw new Error('Catalog configuration unavailable');
      const fetched = await iap.fetchProducts({ skus: ids, type: 'subs' });
      if (!valid()) return;
      const mapped = await resolveNativePlanEligibility((fetched ?? []) as ProductSubscription[],
        (groupId) => iap.isEligibleForIntroOfferIOS(groupId));
      if (!valid()) return;
      setProducts(mapped);
      scope.catalogReady = true;
      setStoreAvailable(mapped.length > 0);
    } catch {
      if (valid()) {
        setStoreAvailable(false);
        if (statusLoaded) {
          scope.loadFailed = true;
          setCatalogError('We could not load subscription options. Please try again.');
        }
      }
    } finally {
      if (valid()) setCatalogLoading(false);
    }
  }, [scope, isCurrent, refreshStatus]);

  const publishSummary = useCallback((summary: NativeSubscriptionStatus) => {
    if (!isCurrent()) return;
    statusRequestId.current += 1;
    setStatus(summary);
    setStatusLoading(false);
    setStatusError(null);
    changed.current?.();
  }, [isCurrent]);

  // Share verification/finishing between listener callbacks and explicit restore.
  // Keep verified results when finishing fails so a retry cannot claim verification failed.
  const settleTransaction = useCallback(async (purchase: Purchase): Promise<TransactionResult> => {
    const iap = getNativeIapModule();
    if (!scope.owner || !isCurrent() || !iap) throw new Error('Account changed');
    const lifecycle = scope.lifecycle;
    if (!purchase.id || !purchase.purchaseToken || !nativeProductIds().includes(purchase.productId)) {
      throw new Error('Incomplete store purchase');
    }
    const key = `${purchase.productId}:${purchase.id}`;
    let entry = scope.transactions.get(key);
    if (!entry) {
      entry = { finished: false };
      scope.transactions.set(key, entry);
    }
    if (entry.work) return entry.work;
    const transaction = entry;
    transaction.work = (async () => {
      const summary = transaction.summary
        ? await loadNativeSubscriptionStatus(scope.owner!)
        : await verifyNativePurchase(purchase, scope.owner!);
      if (!isCurrent() || lifecycle !== scope.lifecycle) throw new Error('Account changed');
      transaction.summary = summary;
      publishSummary(summary);
      if (!transaction.finished) {
        try {
          await iap.finishTransaction({ purchase, isConsumable: false });
          transaction.finished = true;
        } catch {
          return { summary, finishFailed: true };
        }
      }
      return { summary, finishFailed: false };
    })();
    try { return await transaction.work; }
    finally { transaction.work = undefined; }
  }, [scope, isCurrent, publishSummary]);

  const processPurchase = useCallback(async (purchase: Purchase): Promise<void> => {
    if (!isCurrent() || !scope.owner || !nativeProductIds().includes(purchase.productId)) return;
    const key = `${purchase.productId}:${purchase.id}`;
    if (scope.transactions.get(key)?.work || scope.transactions.get(key)?.finished) return;
    if (scope.operation?.kind === 'restore' || scope.operation?.processing) {
      scope.queued.set(purchase.id, purchase);
      return;
    }
    if (purchase.purchaseState === 'pending') {
      scope.purchaseAwaitingOutcome = false;
      scope.operation = null;
      setPurchasing(false);
      setError(null);
      setNotice('Your purchase is pending approval from the store.');
      return;
    }
    if (purchase.purchaseState !== 'purchased') return;
    scope.purchaseAwaitingOutcome = false;
    const operation = scope.operation ?? { kind: 'callback' as const, processing: false };
    scope.operation = operation;
    operation.processing = true;
    setPurchasing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await settleTransaction(purchase);
      if (!isCurrent() || scope.operation !== operation) return;
      const provider = Platform.OS === 'ios' ? 'apple' : 'google';
      const confirmed = result.summary.isPro && result.summary.activeProviders.includes(provider);
      setNotice(confirmed ? 'Dad Health Pro is now active.'
        : 'Your purchase was checked, but no active store subscription was confirmed.');
      if (result.finishFailed) setError('Your purchase was verified, but store completion failed. Please retry using Restore purchases.');
    } catch (purchaseError) {
      if (isCurrent() && scope.operation === operation) setError(nativeSubscriptionUserMessage(purchaseError, "We couldn't verify your purchase. Please try again."));
    } finally {
      if (isCurrent() && scope.operation === operation) {
        scope.operation = null;
        setPurchasing(false);
        while (isCurrent() && !scope.operation && scope.queued.size) {
          const next = scope.queued.entries().next().value!;
          scope.queued.delete(next[0]);
          await processPurchase(next[1]);
        }
      }
    }
  }, [scope, isCurrent, settleTransaction]);

  const retry = useCallback(async () => {
    if (!isCurrent() || scope.operation) return;
    await refreshCatalog();
  }, [scope, isCurrent, refreshCatalog]);

  useEffect(() => {
    scope.alive = true;
    const lifecycle = ++scope.lifecycle;
    scope.operation = null;
    scope.purchaseAwaitingOutcome = false;
    scope.management = null;
    setManaging(false);
    scope.transactions.clear();
    scope.queued.clear();
    scope.connection = null;
    setStateScope(scope);
    setMemberships(null); setMembershipLoading(false); setMembershipError(null); setReturnState('idle'); setManagedId(null); scope.handoff = null;
    setStatus(null);
    setProducts([]);
    setError(null);
    setStatusError(null);
    setCatalogError(null);
    setStatusLoading(false);
    setNotice(null);
    setPurchasing(false);
    setRestoring(false);
    setStoreAvailable(false);
    setLoading(true);
    const iap = getNativeIapModule();
    const updateSubscription = iap?.purchaseUpdatedListener((purchase) => {
      if (scope.lifecycle === lifecycle) void processPurchase(purchase);
    });
    const errorSubscription = iap?.purchaseErrorListener((purchaseError) => {
      if (!isCurrent() || scope.lifecycle !== lifecycle || !scope.purchaseAwaitingOutcome
        || (scope.operation && (scope.operation.kind !== 'purchase' || scope.operation.processing))) return;
      scope.purchaseAwaitingOutcome = false;
      scope.operation = null;
      setPurchasing(false);
      const message = purchaseErrorMessage(purchaseError);
      setError(message);
      setNotice(message ? null : 'Purchase cancelled.');
    });
    void refreshCatalog()
      .finally(() => { if (isCurrent() && scope.lifecycle === lifecycle) setLoading(false); });
    return () => {
      scope.alive = false;
      scope.catalogId += 1;
      statusRequestId.current += 1;
      updateSubscription?.remove();
      errorSubscription?.remove();
      if (iap) void iap.endConnection().catch(() => undefined);
    };
  }, [processPurchase, refreshStatus]);

  useEffect(() => {
    if (!actionFailure || stateScope !== scope || !isCurrent()) return;
    let active = true;
    const timer = setTimeout(() => {
      if (active && isCurrent()) {
        setActionFailure((current) => current === actionFailure ? null : current);
      }
    }, 10_000);
    return () => { active = false; clearTimeout(timer); };
  }, [actionFailure, stateScope, scope, isCurrent]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && scope.handoff) scope.handoff.leftApp = true;
      if (nextState === 'active' && previousState !== 'active' && scope.handoff?.leftApp) {
        scope.handoff = null;
        void refreshAfterManagement();
      } else if (nextState === 'active' && previousState !== 'active' && scope.owner
        && !scope.operation && !scope.loadFailed && !offline.current) void retry();
      previousState = nextState;
    });
    return () => subscription.remove();
  }, [scope, retry, refreshAfterManagement]);

  const purchase = useCallback(async (plan: SubscriptionPlan) => {
    if (!isCurrent() || scope.operation || scope.management) return;
    const iap = getNativeIapModule();
    const product = products.find((item) => item.plan === plan);
    if (!scope.owner || !iap || !scope.catalogReady || !storeAvailable || !product
      || product.trialEligibility === 'unknown' || !product.displayPrice.trim() || status?.canPurchase !== true) {
      setError('We could not confirm this subscription option. Please try again.');
      return;
    }
    const operation: Operation = { kind: 'purchase', processing: false };
    scope.operation = operation;
    scope.purchaseAwaitingOutcome = true;
    setPurchasing(true);
    setError(null);
    setNotice(null);
    try {
      const preparation = await prepareNativePurchase(plan, scope.owner);
      if (!isCurrent() || scope.operation !== operation) return;
      if (preparation.productId !== product.productId) throw new Error('This subscription is not available right now.');
      if (preparation.provider === 'apple') {
        await iap.requestPurchase({
          type: 'subs',
          request: { apple: { sku: product.productId, appAccountToken: preparation.appAccountToken } },
        });
      } else {
        if (product.basePlanId !== preparation.basePlanId || !product.offerToken) {
          throw new Error('This subscription offer is not available right now.');
        }
        await iap.requestPurchase({
          type: 'subs',
          request: { google: {
            skus: [product.productId],
            subscriptionOffers: [{ sku: product.productId, offerToken: product.offerToken }],
            obfuscatedAccountId: preparation.obfuscatedAccountId,
          } },
        });
      }
    } catch (purchaseError) {
      if (!isCurrent() || scope.operation !== operation || operation.processing) return;
      scope.purchaseAwaitingOutcome = false;
      scope.operation = null;
      setPurchasing(false);
      const message = purchaseErrorMessage(purchaseError);
      setError(message ? nativeSubscriptionUserMessage(purchaseError, message) : null);
      setNotice(message ? null : 'Purchase cancelled.');
    } finally {
      if (isCurrent() && scope.operation === operation && !operation.processing) {
        scope.operation = null;
        setPurchasing(false);
        setNotice('Purchase confirmation has not arrived. Use Restore purchases to check.');
      }
    }
  }, [scope, isCurrent, products, storeAvailable, status]);

  const restore = useCallback(async () => {
    if (!isCurrent() || scope.operation || scope.management || !scope.owner) return;
    const iap = getNativeIapModule();
    if (!iap) {
      setError('Purchases can only be restored from the Dad Health app installed through the store.');
      return;
    }
    const operation: Operation = { kind: 'restore', processing: true };
    scope.operation = operation;
    scope.purchaseAwaitingOutcome = false;
    const valid = () => isCurrent() && scope.operation === operation;
    setRestoring(true);
    setError(null);
    setNotice(null);
    try {
      const available = await iap.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true, includeSuspendedAndroid: false });
      if (!valid()) return;
      const configured = new Set(nativeProductIds());
      const purchases = available.filter((item) => configured.has(item.productId));
      let verified = 0;
      let failed = 0;
      let finishFailed = false;
      for (const restored of purchases) {
        if (!valid()) return;
        try {
          const result = await settleTransaction(restored);
          verified += 1;
          finishFailed ||= result.finishFailed;
        } catch { failed += 1; }
        scope.queued.delete(restored.id);
      }
      if (!valid()) return;
      const latest = await refreshStatus();
      if (!valid() || !latest) return;
      const provider = Platform.OS === 'ios' ? 'apple' : 'google';
      const restoredAccess = verified > 0 && latest.isPro && latest.activeProviders.includes(provider);
      setNotice(null);
      if (failed) {
        setError(restoredAccess
          ? 'Your Pro access is confirmed, but restore is incomplete. Retry Restore purchases for the remaining items.'
          : 'Some purchases could not be restored. Please try again with the Dad Health account used to subscribe.');
      } else if (finishFailed) {
        setError(restoredAccess
          ? 'Your Pro access is confirmed, but store completion needs attention. Retry Restore purchases.'
          : 'Your purchases were checked, but no active store subscription was confirmed and store completion needs attention. Retry Restore purchases.');
      } else {
        setError(null);
        setNotice(restoredAccess ? 'Dad Health Pro has been restored.'
          : 'No active Dad Health Pro purchase was found for this store account.');
      }
      changed.current?.();
    } catch {
      if (valid()) {
        setNotice(null);
        setError('We could not complete restore. Any confirmed access is unchanged. Please try again.');
      }
    } finally {
      if (isCurrent() && scope.operation === operation) {
        scope.operation = null;
        setRestoring(false);
        const queued = [...scope.queued.values()];
        scope.queued.clear();
        for (const purchase of queued) await processPurchase(purchase);
      }
    }
  }, [scope, isCurrent, settleTransaction, refreshStatus, processPurchase]);

  const manage = useCallback(async (subscriptionId?: string): Promise<boolean> => {
    if (!isCurrent() || !scope.owner || scope.management || scope.operation || offline.current) return false;
    const operation = {};
    const lifecycle = scope.lifecycle;
    scope.management = operation;
    const valid = () => isCurrent() && scope.lifecycle === lifecycle && scope.management === operation;
    setManaging(true);
    setError(null);
    try {
      if (subscriptionId) { scope.returnGeneration++; scope.handoff = { id: subscriptionId, leftApp: false }; setManagedId(subscriptionId); setReturnState('pending'); }
      await openSubscriptionManagement(scope.owner, valid, subscriptionId);
      return valid();
    } catch (manageError) {
      if (valid()) { scope.handoff = null; setReturnState('unknown'); setError(nativeSubscriptionUserMessage(manageError, 'We could not open subscription management.')); }
      return false;
    } finally {
      if (scope.management === operation) {
        if (valid()) setManaging(false);
        scope.management = null;
      }
    }
  }, [scope, isCurrent]);

  const sameAccount = stateScope === scope;
  return {
    status: sameAccount ? status : null,
    products: sameAccount ? products : [],
    loading: !sameAccount || loading,
    catalogLoading: !sameAccount || catalogLoading,
    purchasing: sameAccount && purchasing,
    restoring: sameAccount && restoring,
    managing: sameAccount && managing,
    storeAvailable: sameAccount && storeAvailable,
    storeSupported: Boolean(getNativeIapModule()),
    error: sameAccount ? error ?? statusError ?? catalogError : null,
    actionError: sameAccount ? error : null,
    statusError: sameAccount ? statusError : null,
    catalogError: sameAccount ? catalogError : null,
    statusLoading: !sameAccount || statusLoading,
    notice: sameAccount ? notice : null,
    memberships: sameAccount ? memberships : null, membershipLoading: sameAccount && membershipLoading,
    membershipError: sameAccount ? membershipError : null, returnState: sameAccount ? returnState : 'idle',
    managedId: sameAccount ? managedId : null, refreshMembership, retryMembership,
    purchase, restore, manage, refreshStatus, retry,
  };
}
