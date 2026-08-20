import { Linking, Platform } from 'react-native';
import type {
  ProductSubscription,
  ProductSubscriptionAndroid,
  ProductSubscriptionIOS,
  Purchase,
  PurchaseError,
} from 'react-native-iap';

import { supabase } from './supabase';

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/, '');

export type SubscriptionPlan = 'monthly' | 'annual';
export type SubscriptionProvider = 'stripe' | 'apple' | 'google' | 'manual';

export interface NativeSubscriptionStatus {
  isPro: boolean;
  status: string | null;
  primaryProvider: SubscriptionProvider | null;
  activeProviders: Array<'stripe' | 'apple' | 'google'>;
  plan: SubscriptionPlan | null;
  productId: string | null;
  currentPeriodEnd: string | null;
  canPurchase: boolean;
}

export interface NativePlanProduct {
  plan: SubscriptionPlan;
  productId: string;
  displayPrice: string;
  hasSevenDayTrial: boolean;
  offerToken: string | null;
  basePlanId: string | null;
}

type IapModule = typeof import('react-native-iap');

let cachedIap: IapModule | null | undefined;

export function getNativeIapModule(): IapModule | null {
  if (cachedIap !== undefined) return cachedIap;
  try {
    cachedIap = require('react-native-iap') as IapModule;
  } catch {
    cachedIap = null;
  }
  return cachedIap;
}

export class NativeSubscriptionError extends Error {
  constructor(message: string, readonly code: string = 'unknown') {
    super(message);
    this.name = 'NativeSubscriptionError';
  }
}

export function nativeSubscriptionUserMessage(error: unknown, fallback: string): string {
  return error instanceof NativeSubscriptionError ? error.message : fallback;
}

async function authenticatedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new NativeSubscriptionError('Please log in to continue.', 'unauthorized');
  }
  const response = await fetch(`${WEB_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
  if (!response.ok) {
    throw new NativeSubscriptionError(
      payload?.error ?? 'We couldn\'t complete that request. Please try again.',
      payload?.code ?? `http_${response.status}`,
    );
  }
  return payload as T;
}

export function loadNativeSubscriptionStatus(): Promise<NativeSubscriptionStatus> {
  return authenticatedRequest('/api/native-subscriptions/status');
}

type ApplePreparation = { provider: 'apple'; productId: string; appAccountToken: string };
type GooglePreparation = {
  provider: 'google';
  productId: string;
  basePlanId: string;
  trialOfferId: string | null;
  obfuscatedAccountId: string;
};
export type PurchasePreparation = ApplePreparation | GooglePreparation;

export function prepareNativePurchase(plan: SubscriptionPlan): Promise<PurchasePreparation> {
  return authenticatedRequest('/api/native-subscriptions/prepare', {
    method: 'POST',
    body: JSON.stringify({ provider: Platform.OS === 'ios' ? 'apple' : 'google', plan }),
  });
}

export async function verifyNativePurchase(purchase: Purchase): Promise<NativeSubscriptionStatus> {
  if (!purchase.purchaseToken) {
    throw new NativeSubscriptionError('Your purchase is still being processed by the store.', 'purchase_pending');
  }
  const provider = Platform.OS === 'ios' ? 'apple' : 'google';
  const response = await authenticatedRequest<{ ok: true; summary: NativeSubscriptionStatus }>(
    `/api/native-subscriptions/verify/${provider}`,
    {
      method: 'POST',
      body: JSON.stringify(
        provider === 'apple'
          ? { signedTransaction: purchase.purchaseToken }
          : { purchaseToken: purchase.purchaseToken },
      ),
    },
  );
  return response.summary;
}

export async function openSubscriptionManagement(): Promise<void> {
  const response = await authenticatedRequest<{ url: string }>('/api/native-subscriptions/manage', {
    method: 'POST',
    body: '{}',
  });
  if (!response.url || !(await Linking.canOpenURL(response.url))) {
    throw new NativeSubscriptionError('We couldn\'t open subscription management. Please try again.', 'link_unavailable');
  }
  await Linking.openURL(response.url);
}

function configuredProducts() {
  return {
    apple: {
      monthly: process.env.EXPO_PUBLIC_APPLE_IAP_PRO_MONTHLY_PRODUCT_ID?.trim() ?? '',
      annual: process.env.EXPO_PUBLIC_APPLE_IAP_PRO_ANNUAL_PRODUCT_ID?.trim() ?? '',
    },
    google: {
      product: process.env.EXPO_PUBLIC_GOOGLE_PLAY_PRO_PRODUCT_ID?.trim() ?? '',
      monthlyBasePlan: process.env.EXPO_PUBLIC_GOOGLE_PLAY_PRO_MONTHLY_BASE_PLAN_ID?.trim() ?? '',
      annualBasePlan: process.env.EXPO_PUBLIC_GOOGLE_PLAY_PRO_ANNUAL_BASE_PLAN_ID?.trim() ?? '',
      monthlyTrialOffer: process.env.EXPO_PUBLIC_GOOGLE_PLAY_PRO_MONTHLY_TRIAL_OFFER_ID?.trim() ?? '',
      annualTrialOffer: process.env.EXPO_PUBLIC_GOOGLE_PLAY_PRO_ANNUAL_TRIAL_OFFER_ID?.trim() ?? '',
    },
  };
}

export function nativeProductIds(): string[] {
  const config = configuredProducts();
  if (Platform.OS === 'ios') return [config.apple.monthly, config.apple.annual].filter(Boolean);
  if (Platform.OS === 'android') return config.google.product ? [config.google.product] : [];
  return [];
}

function iOSPlanProduct(
  product: ProductSubscriptionIOS,
  plan: SubscriptionPlan,
): NativePlanProduct {
  const introductoryOffer = product.subscriptionOffers?.find((offer) => offer.type === 'introductory');
  const sevenDayTrial = Boolean(
    introductoryOffer
      && introductoryOffer.price === 0
      && introductoryOffer.period?.unit === 'day'
      && introductoryOffer.period.value === 7,
  );
  return {
    plan,
    productId: product.id,
    displayPrice: product.displayPrice,
    hasSevenDayTrial: sevenDayTrial,
    offerToken: null,
    basePlanId: null,
  };
}

function androidPlanProduct(
  product: ProductSubscriptionAndroid,
  plan: SubscriptionPlan,
  basePlanId: string,
  trialOfferId: string,
): NativePlanProduct | null {
  const matching = product.subscriptionOfferDetailsAndroid.filter((offer) => offer.basePlanId === basePlanId);
  const offer = matching.find((item) => Boolean(trialOfferId) && item.offerId === trialOfferId)
    ?? matching.find((item) => !item.offerId)
    ?? matching[0];
  if (!offer) return null;
  const phases = offer.pricingPhases.pricingPhaseList;
  const recurring = [...phases].reverse().find((phase) => phase.priceAmountMicros !== '0') ?? phases.at(-1);
  const hasSevenDayTrial = phases.some(
    (phase) => phase.priceAmountMicros === '0' && phase.billingPeriod === 'P7D',
  );
  return {
    plan,
    productId: product.id,
    displayPrice: recurring?.formattedPrice ?? product.displayPrice,
    hasSevenDayTrial,
    offerToken: offer.offerToken,
    basePlanId,
  };
}

export function mapNativePlanProducts(products: ProductSubscription[]): NativePlanProduct[] {
  const config = configuredProducts();
  if (Platform.OS === 'ios') {
    return products.flatMap((product) => {
      if (product.platform !== 'ios') return [];
      if (product.id === config.apple.monthly) return [iOSPlanProduct(product, 'monthly')];
      if (product.id === config.apple.annual) return [iOSPlanProduct(product, 'annual')];
      return [];
    });
  }
  const product = products.find(
    (item): item is ProductSubscriptionAndroid => item.platform === 'android' && item.id === config.google.product,
  );
  if (!product) return [];
  return [
    androidPlanProduct(product, 'monthly', config.google.monthlyBasePlan, config.google.monthlyTrialOffer),
    androidPlanProduct(product, 'annual', config.google.annualBasePlan, config.google.annualTrialOffer),
  ].filter((item): item is NativePlanProduct => Boolean(item));
}

export function purchaseErrorMessage(error: PurchaseError | unknown): string | null {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code === 'user-cancelled') return null;
  if (code === 'item-unavailable') return 'That subscription is not available right now.';
  if (code === 'network-error' || code === 'service-error') return 'The store couldn\'t be reached. Check your connection and try again.';
  if (code === 'already-owned') return 'This subscription is already owned. Tap Restore purchases.';
  return 'We couldn\'t complete your purchase. Please try again.';
}
