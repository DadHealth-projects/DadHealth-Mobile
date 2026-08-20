import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { ProductSubscription, Purchase } from 'react-native-iap';

import {
  getNativeIapModule,
  loadNativeSubscriptionStatus,
  mapNativePlanProducts,
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

export function useNativeSubscriptions(userId: string | undefined, onEntitlementChanged?: () => void) {
  const [status, setStatus] = useState<NativeSubscriptionStatus | null>(null);
  const [products, setProducts] = useState<NativePlanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [storeAvailable, setStoreAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!userId) {
      setStatus(null);
      return;
    }
    const next = await loadNativeSubscriptionStatus();
    setStatus(next);
  }, [userId]);

  const processPurchase = useCallback(async (purchase: Purchase) => {
    if (purchase.purchaseState === 'pending') {
      setPurchasing(false);
      setNotice('Your purchase is pending approval from the store.');
      return;
    }
    if (purchase.purchaseState !== 'purchased') return;
    const iap = getNativeIapModule();
    if (!iap) return;
    try {
      const summary = await verifyNativePurchase(purchase);
      await iap.finishTransaction({ purchase, isConsumable: false });
      setStatus(summary);
      setError(null);
      setNotice('Dad Health Pro is now active.');
      onEntitlementChanged?.();
    } catch (purchaseError) {
      setError(nativeSubscriptionUserMessage(purchaseError, 'We couldn\'t verify your purchase. Please try again.'));
    } finally {
      setPurchasing(false);
    }
  }, [onEntitlementChanged]);

  useEffect(() => {
    let active = true;
    let updateSubscription: { remove(): void } | null = null;
    let errorSubscription: { remove(): void } | null = null;
    const iap = getNativeIapModule();

    async function connect() {
      setLoading(true);
      setError(null);
      try {
        await refreshStatus();
        if (!iap || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
          if (active) setStoreAvailable(false);
          return;
        }
        const ids = nativeProductIds();
        if (ids.length === 0) {
          if (active) setStoreAvailable(false);
          return;
        }
        await iap.initConnection();
        updateSubscription = iap.purchaseUpdatedListener((purchase) => void processPurchase(purchase));
        errorSubscription = iap.purchaseErrorListener((purchaseError) => {
          if (!active) return;
          setPurchasing(false);
          const message = purchaseErrorMessage(purchaseError);
          if (message) setError(message);
          else setNotice('Purchase cancelled.');
        });
        const fetched = await iap.fetchProducts({ skus: ids, type: 'subs' });
        if (!active) return;
        const subscriptions = (fetched ?? []) as ProductSubscription[];
        let mapped = mapNativePlanProducts(subscriptions);
        if (Platform.OS === 'ios') {
          const groupId = subscriptions.find((item) => item.platform === 'ios')?.subscriptionGroupIdIOS;
          if (groupId) {
            const eligible = await iap.isEligibleForIntroOfferIOS(groupId);
            if (!eligible) mapped = mapped.map((item) => ({ ...item, hasSevenDayTrial: false }));
          }
        }
        setProducts(mapped);
        setStoreAvailable(mapped.length > 0);
      } catch (connectionError) {
        if (active) {
          setStoreAvailable(false);
          setError(nativeSubscriptionUserMessage(connectionError, 'Subscriptions aren\'t available right now.'));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void connect();
    return () => {
      active = false;
      updateSubscription?.remove();
      errorSubscription?.remove();
      if (iap) void iap.endConnection().catch(() => undefined);
    };
  }, [processPurchase, refreshStatus]);

  const purchase = useCallback(async (plan: SubscriptionPlan) => {
    const iap = getNativeIapModule();
    const product = products.find((item) => item.plan === plan);
    if (!iap || !product) {
      setError('Subscriptions aren\'t available on this device.');
      return;
    }
    setPurchasing(true);
    setError(null);
    setNotice(null);
    try {
      const preparation = await prepareNativePurchase(plan);
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
          request: {
            google: {
              skus: [product.productId],
              subscriptionOffers: [{ sku: product.productId, offerToken: product.offerToken }],
              obfuscatedAccountId: preparation.obfuscatedAccountId,
            },
          },
        });
      }
    } catch (purchaseError) {
      setPurchasing(false);
      const message = purchaseErrorMessage(purchaseError);
      if (message) setError(nativeSubscriptionUserMessage(purchaseError, message));
      else setNotice('Purchase cancelled.');
    }
  }, [products]);

  const restore = useCallback(async () => {
    const iap = getNativeIapModule();
    if (!iap) {
      setError('Purchases can only be restored from the Dad Health app installed through the store.');
      return;
    }
    setRestoring(true);
    setError(null);
    setNotice(null);
    try {
      const available = await iap.getAvailablePurchases({
        onlyIncludeActiveItemsIOS: true,
        includeSuspendedAndroid: false,
      });
      const configured = new Set(nativeProductIds());
      const purchases = available.filter((item) => configured.has(item.productId) && item.purchaseToken);
      if (purchases.length === 0) {
        setNotice('No active Dad Health Pro purchase was found for this store account.');
        return;
      }
      let latest: NativeSubscriptionStatus | null = null;
      for (const restored of purchases) {
        latest = await verifyNativePurchase(restored);
        await iap.finishTransaction({ purchase: restored, isConsumable: false });
      }
      setStatus(latest);
      setNotice('Dad Health Pro has been restored.');
      onEntitlementChanged?.();
    } catch (restoreError) {
      setError(nativeSubscriptionUserMessage(restoreError, 'We couldn\'t restore purchases. Please try again.'));
    } finally {
      setRestoring(false);
    }
  }, [onEntitlementChanged]);

  const manage = useCallback(async () => {
    setError(null);
    try {
      await openSubscriptionManagement();
    } catch (manageError) {
      setError(nativeSubscriptionUserMessage(manageError, 'We couldn\'t open subscription management.'));
    }
  }, []);

  return useMemo(() => ({
    status,
    products,
    loading,
    purchasing,
    restoring,
    storeAvailable,
    error,
    notice,
    purchase,
    restore,
    manage,
    refreshStatus,
  }), [status, products, loading, purchasing, restoring, storeAvailable, error, notice, purchase, restore, manage, refreshStatus]);
}
