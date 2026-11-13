import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
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
  freezeUsedThisWeek?: boolean;
  freezesRemaining?: number;
}

export interface NativePlanProduct {
  plan: SubscriptionPlan;
  productId: string;
  displayPrice: string;
  hasSevenDayTrial: boolean;
  trialEligibility: 'eligible' | 'ineligible' | 'unknown';
  subscriptionGroupId: string | null;
  offerToken: string | null;
  basePlanId: string | null;
}

type IapModule = typeof import('react-native-iap');

let cachedIap: IapModule | null | undefined;

export function shouldLoadNativeIap(appOwnership: string | null): boolean {
  return appOwnership !== 'expo';
}

export function getNativeIapModule(): IapModule | null {
  if (cachedIap !== undefined) return cachedIap;
  // Expo Go does not contain the native Nitro/IAP modules. Keep server-resolved
  // subscription status available, but do not load the unsupported native SDK.
  if (!shouldLoadNativeIap(Constants.appOwnership)) {
    cachedIap = null;
    return cachedIap;
  }
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

async function authenticatedRequest<T>(path: string, init?: RequestInit, expectedOwner?: string): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new NativeSubscriptionError('Please log in to continue.', 'unauthorized');
  }
  if (expectedOwner && data.session.user.id !== expectedOwner) {
    throw new NativeSubscriptionError('Your account changed. Please try again.', 'account_changed');
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
  if (expectedOwner) {
    const current = await supabase.auth.getSession();
    if (current.error || current.data.session?.user.id !== expectedOwner) {
      throw new NativeSubscriptionError('Your account changed. Please try again.', 'account_changed');
    }
  }
  if (!response.ok) {
    throw new NativeSubscriptionError(
      payload?.error ?? 'We couldn\'t complete that request. Please try again.',
      payload?.code ?? `http_${response.status}`,
    );
  }
  return payload as T;
}

function validatedSummary(value: unknown): NativeSubscriptionStatus {
  const item = value as Partial<NativeSubscriptionStatus> | null;
  if (!item || typeof item.isPro !== 'boolean' || typeof item.canPurchase !== 'boolean'
    || !Array.isArray(item.activeProviders)
    || item.activeProviders.some((provider) => !['apple', 'google', 'stripe'].includes(provider))
    || ![null, 'apple', 'google', 'stripe', 'manual'].includes(item.primaryProvider === undefined ? '' : item.primaryProvider)
    || ![null, 'monthly', 'annual'].includes(item.plan === undefined ? '' : item.plan)
    || !['status', 'productId', 'currentPeriodEnd'].every((key) => {
      const field = item[key as 'status' | 'productId' | 'currentPeriodEnd'];
      return field === null || typeof field === 'string';
    })) {
    throw new NativeSubscriptionError('We could not confirm your subscription. Please try again.', 'invalid_response');
  }
  return item as NativeSubscriptionStatus;
}

export async function loadNativeSubscriptionStatus(expectedOwner?: string): Promise<NativeSubscriptionStatus> {
  const response = await authenticatedRequest<unknown>('/api/native-subscriptions/status', undefined, expectedOwner);
  if (!response || typeof response !== 'object' || Array.isArray(response)) return validatedSummary(response);
  const details = response as Partial<NativeSubscriptionStatus>;
  return validatedSummary({
    ...details,
    primaryProvider: ['apple', 'stripe', 'google', 'manual'].includes(details.primaryProvider ?? '') ? details.primaryProvider : null,
    plan: details.plan === 'monthly' || details.plan === 'annual' ? details.plan : null,
    status: typeof details.status === 'string' ? details.status : null,
    productId: typeof details.productId === 'string' ? details.productId : null,
    currentPeriodEnd: typeof details.currentPeriodEnd === 'string' ? details.currentPeriodEnd : null,
  });
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

export async function prepareNativePurchase(plan: SubscriptionPlan, expectedOwner: string): Promise<PurchasePreparation> {
  const preparation = await authenticatedRequest<PurchasePreparation>('/api/native-subscriptions/prepare', {
    method: 'POST',
    body: JSON.stringify({ provider: Platform.OS === 'ios' ? 'apple' : 'google', plan }),
  }, expectedOwner);
  if (!preparation || typeof preparation.productId !== 'string'
    || (Platform.OS === 'ios' && (preparation.provider !== 'apple' || preparation.appAccountToken !== expectedOwner))
    || (Platform.OS === 'android' && preparation.provider !== 'google')) {
    throw new NativeSubscriptionError('We could not prepare your subscription. Please try again.', 'invalid_response');
  }
  return preparation;
}

export async function verifyNativePurchase(purchase: Purchase, expectedOwner: string): Promise<NativeSubscriptionStatus> {
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
    expectedOwner,
  );
  if (response?.ok !== true) {
    throw new NativeSubscriptionError('We could not verify your purchase. Please try again.', 'invalid_response');
  }
  return validatedSummary(response.summary);
}

export async function openSubscriptionManagement(expectedOwner: string, isCurrent: () => boolean, subscriptionId?: string): Promise<void> {
  const assertCurrent = async () => {
    if (!isCurrent()) throw new NativeSubscriptionError('Your account changed. Please try again.', 'account_changed');
    const { data, error } = await supabase.auth.getSession();
    if (error || data.session?.user.id !== expectedOwner || !isCurrent()) {
      throw new NativeSubscriptionError('Your account changed. Please try again.', 'account_changed');
    }
  };
  await assertCurrent();
  const response = await authenticatedRequest<{ url: string }>('/api/native-subscriptions/manage', {
    method: 'POST',
    body: JSON.stringify(subscriptionId ? { subscriptionId } : {}),
  }, expectedOwner);
  await assertCurrent();
  if (!response.url || !(await Linking.canOpenURL(response.url))) {
    throw new NativeSubscriptionError('We couldn\'t open subscription management. Please try again.', 'link_unavailable');
  }
  await assertCurrent();
  // No asynchronous work between the final lifecycle check and handing off to the OS.
  if (!isCurrent()) return;
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
      && introductoryOffer.paymentMode === 'free-trial'
      && introductoryOffer.periodCount === 1
      && ((introductoryOffer.period?.unit === 'day' && introductoryOffer.period.value === 7)
        || (introductoryOffer.period?.unit === 'week' && introductoryOffer.period.value === 1)),
  );
  return {
    plan,
    productId: product.id,
    displayPrice: product.displayPrice,
    hasSevenDayTrial: sevenDayTrial,
    trialEligibility: 'unknown',
    subscriptionGroupId: product.subscriptionGroupIdIOS?.trim() || null,
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
    trialEligibility: hasSevenDayTrial ? 'eligible' : 'ineligible',
    subscriptionGroupId: null,
    offerToken: offer.offerToken,
    basePlanId,
  };
}

export function mapNativePlanProducts(products: ProductSubscription[]): NativePlanProduct[] {
  const config = configuredProducts();
  if (Platform.OS === 'ios') {
    if (!config.apple.monthly || !config.apple.annual || config.apple.monthly === config.apple.annual) return [];
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

export async function resolveNativePlanEligibility(
  products: ProductSubscription[],
  checkGroup: (groupId: string) => Promise<boolean>,
): Promise<NativePlanProduct[]> {
  const mapped = mapNativePlanProducts(products);
  if (Platform.OS !== 'ios') return mapped;
  const groups = new Map<string, Promise<boolean | null>>();
  return Promise.all(mapped.map(async (product) => {
    const group = product.subscriptionGroupId;
    if (!group || !product.hasSevenDayTrial || !product.displayPrice.trim()) return product;
    if (!groups.has(group)) groups.set(group, checkGroup(group).catch(() => null));
    const eligible = await groups.get(group);
    return { ...product, trialEligibility: eligible === true ? 'eligible' as const
      : eligible === false ? 'ineligible' as const : 'unknown' as const };
  }));
}

export function purchaseErrorMessage(error: PurchaseError | unknown): string | null {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code === 'user-cancelled') return null;
  if (code === 'item-unavailable') return 'That subscription is not available right now.';
  if (code === 'network-error' || code === 'service-error') return 'The store couldn\'t be reached. Check your connection and try again.';
  if (code === 'already-owned') return 'This subscription is already owned. Tap Restore purchases.';
  return 'We couldn\'t complete your purchase. Please try again.';
}


export type CancellationReason = 'too_expensive' | 'not_using' | 'missing_feature' | 'technical_problem' | 'other';
export interface MembershipSubscription {
  id: string;
  provider: 'apple';
  plan: SubscriptionPlan | null;
  status: string;
  currentPeriodEnd: string | null;
  canCancel: boolean;
  cancellation: { state: 'scheduled' | 'unknown'; end: string | null };
}
export async function loadNativeMembership(expectedOwner: string): Promise<MembershipSubscription[]> {
  const result = await authenticatedRequest<{ subscriptions: MembershipSubscription[] }>('/api/native-subscriptions/membership', undefined, expectedOwner);
  if (!result || !Array.isArray(result.subscriptions) || result.subscriptions.some(item =>
    !item || typeof item.id !== 'string' || item.provider !== 'apple'
    || ![null,'monthly','annual'].includes(item.plan) || typeof item.status !== 'string'
    || typeof item.canCancel !== 'boolean' || !(item.currentPeriodEnd === null || typeof item.currentPeriodEnd === 'string')
    || !item.cancellation || !['scheduled','unknown'].includes(item.cancellation.state)
    || !(item.cancellation.end === null || typeof item.cancellation.end === 'string'))) {
    throw new NativeSubscriptionError('We could not confirm your membership details.', 'invalid_response');
  }
  return result.subscriptions;
}
export async function saveCancellationFeedback(expectedOwner: string, input: {
  id: string; subscriptionId: string; reason: CancellationReason; details: string;
}): Promise<void> {
  if (input.details.length > 1000) throw new NativeSubscriptionError('Please use at most 1,000 characters.', 'invalid_feedback');
  const result = await authenticatedRequest<{ receipt: string }>('/api/native-subscriptions/cancellation-feedback', {
    method: 'POST', body: JSON.stringify(input),
  }, expectedOwner);
  if (result?.receipt !== input.id) throw new NativeSubscriptionError('We could not confirm your feedback was saved.', 'invalid_response');
}
