import { useNotificationPresentation } from '../../contexts/NotificationInboxContext';
import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation, type NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CancellationFlow, { CancellationScheduled, isScheduledAppleMembership } from '../../components/subscriptions/CancellationFlow';
import InlineFormError from '../../components/InlineFormError';
import SkeletonBlock from '../../components/skeleton/SkeletonBlock';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { refreshDashboardForUser } from '../../hooks/useDashboard';
import { useNativeSubscriptions } from '../../hooks/useNativeSubscriptions';
import { trialDisclosure, type SubscriptionPlan } from '../../lib/nativeSubscriptions';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { useAnalyticsPresentation } from '../../hooks/useAnalyticsPresentation';
import { upgradeSource } from '../../lib/analyticsContract';
import { colors } from '../../theme';

const THIS_WEEK_FEATURES = [
  'Understand what is shaping your Mind, Body and Bond scores',
  'See your weekly trends and personalised insights',
  'Get workouts, Dad Days and plans built around your life',
] as const;

export default function ProSubscriptionScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const route = useRoute();
  const presented = useAnalyticsPresentation(user?.id, 'paywall_viewed', { source: upgradeSource((route.params as {source?:string} | undefined)?.source) });
  const { isOffline, showOfflineAction } = useNetworkStatus();
  const [cancellationOwner, setCancellationOwner] = useState<string | null>(null);
  useEffect(() => { setCancellationOwner(null); }, [user?.id]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('annual');
  const refreshEntitlement = useCallback(() => {
    if (user?.id) void refreshDashboardForUser(user.id);
  }, [user?.id]);
  const subscriptions = useNativeSubscriptions(user?.id, refreshEntitlement);
  const selectedProduct = subscriptions.products.find((product) => product.plan === selectedPlan);
  const trialAvailable = selectedProduct?.trialEligibility === 'eligible';
  // Recalculated on every render from the current time; the effect below forces
  // a render when the shown dates expire or the app returns to the foreground.
  const [, refreshTrialTerms] = useReducer((tick: number) => tick + 1, 0);
  const trialTerms = trialDisclosure(selectedProduct);
  const trialTermsValidUntil = trialTerms?.validUntil ?? null;
  useEffect(() => {
    if (trialTermsValidUntil === null) return;
    const timer = setTimeout(refreshTrialTerms, Math.max(0, trialTermsValidUntil - Date.now()) + 1000);
    const resume = AppState.addEventListener('change', (next) => { if (next === 'active') refreshTrialTerms(); });
    return () => { clearTimeout(timer); resume.remove(); };
  }, [trialTermsValidUntil]);
  const optionReady = subscriptions.storeAvailable
    && Boolean(selectedProduct?.displayPrice.trim()) && selectedProduct?.trialEligibility !== 'unknown'
    && Boolean(selectedProduct);
  const providerLabel = providerName(subscriptions.status?.primaryProvider ?? null);
  const manualAccess = subscriptions.status?.primaryProvider === 'manual';
  const trialAccess = subscriptions.status?.status === 'trialing' && !manualAccess;
  const canManage = subscriptions.status?.primaryProvider === 'apple'
    || subscriptions.status?.primaryProvider === 'stripe' || subscriptions.status?.primaryProvider === 'google';
  const periodLabel = membershipPeriodLabel(subscriptions.status?.currentPeriodEnd);
  const planLabel = subscriptions.status?.plan === 'monthly' ? 'Monthly'
    : subscriptions.status?.plan === 'annual' ? 'Annual' : null;
  const multipleProviders = new Set(subscriptions.status?.activeProviders ?? []).size > 1;
  const checking = subscriptions.statusLoading || subscriptions.catalogLoading;
  useNotificationPresentation(!checking && Boolean(subscriptions.status) && !subscriptions.statusError, !checking && Boolean(subscriptions.statusError), 'plan');
  const displayError = subscriptions.actionError;

  const planCopy = useMemo(() => ({
    monthly: {
      price: subscriptions.products.find((item) => item.plan === 'monthly')?.displayPrice ?? null,
      suffix: 'per month',
    },
    annual: {
      price: subscriptions.products.find((item) => item.plan === 'annual')?.displayPrice ?? null,
      suffix: 'per year',
    },
  }), [subscriptions.products]);

  const scheduledMembership = subscriptions.status?.primaryProvider === 'apple'
    && !multipleProviders && subscriptions.memberships?.length === 1
    ? subscriptions.memberships[0] : undefined;

  // Keep verified cancellation content visible during background refresh.
  if (user && subscriptions.status?.isPro === true
    && isScheduledAppleMembership(scheduledMembership)) return (
    <CancellationScheduled subscription={scheduledMembership!} busy={subscriptions.managing}
      error={subscriptions.actionError} offline={isOffline} onBack={() => navigation.goBack()}
      onManage={() => void subscriptions.manage(scheduledMembership!.id)} />
  );

  if (user && cancellationOwner === user.id) return (
    <CancellationFlow key={user.id} owner={user.id} subscriptions={subscriptions.memberships}
      loading={subscriptions.membershipLoading} loadError={subscriptions.membershipError}
      refresh={subscriptions.retryMembership} manage={subscriptions.manage}
      returnState={subscriptions.returnState} offline={isOffline} onClose={() => setCancellationOwner(null)} />
  );

  return (
    <SafeAreaView onLayout={presented} edges={['top', 'bottom']} className="flex-1 bg-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-sm pb-lg gap-lg">
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close Dad Health Pro"
          className="h-[44px] w-[44px] items-center justify-center self-start active:opacity-70"
        >
          <View className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center">
            <Feather name="chevron-left" size={20} color={colors.text} />
          </View>
        </Pressable>

        {user && (
          ((subscriptions.loading || checking) && !subscriptions.status)
          || (subscriptions.status?.isPro === true
            && subscriptions.status.primaryProvider === 'apple'
            && !multipleProviders
            && subscriptions.memberships === null
            && !subscriptions.membershipError
            && !subscriptions.statusError)
        ) ? (
          <SubscriptionSkeleton />
        ) : user && subscriptions.status?.isPro === true
          && subscriptions.status.primaryProvider === 'apple'
          && !multipleProviders
          && subscriptions.memberships === null ? (
          <ProHeader
            title="Dad Health Pro"
            description="Your membership details are temporarily unavailable."
          />
        ) : subscriptions.status?.isPro === true ? (
          <>
            <ProHeader
              title={trialAccess ? 'Pro Trial' : 'Pro is Active'}
              description={manualAccess ? 'Pro access provided by Dad Health.' : trialAccess
                ? 'Your free trial is active. Enjoy full access to Pro features.'
                : 'Your Dad Health Pro membership is active.'}
            />
            <View className="rounded-[16px] bg-card px-md py-lg gap-lg">
              <MembershipRow icon="user" label="Membership" value={trialAccess ? 'Pro trial' : 'Pro active'} />
              {manualAccess ? (
                <MembershipRow icon="shield" label="Access type" value="Provided by Dad Health" />
              ) : (
                <>
                  {planLabel ? <MembershipRow icon="calendar" label="Plan" value={planLabel} /> : null}
                  {providerLabel ? <MembershipRow icon="credit-card" label="Billed through" value={providerLabel} /> : null}
                  {periodLabel ? <MembershipRow icon="calendar" label="Current period ends" value={periodLabel} /> : null}
                </>
              )}
            </View>
            {multipleProviders ? (
              <Text className="font-body text-white text-[14px] leading-[20px]">Another active subscription may exist with a different provider.</Text>
            ) : null}
            {canManage ? (
              <ProAction outlined label="Manage subscription" loading={subscriptions.managing}
                disabled={subscriptions.purchasing || subscriptions.restoring}
                onPress={() => isOffline ? showOfflineAction('subscriptions') : void subscriptions.manage()} />
            ) : null}
            {user && (subscriptions.status.primaryProvider === 'apple' || subscriptions.status.activeProviders.includes('apple'))
              && ['active', 'trialing', 'grace_period'].includes(subscriptions.status.status ?? '') ? (
              <Pressable onPress={() => setCancellationOwner(user.id)} accessibilityRole="button" accessibilityLabel="Cancel subscription" className="min-h-[44px] self-center justify-center">
                <Text className="font-body-semibold text-lime text-[14px] underline">Cancel subscription</Text>
              </Pressable>
            ) : null}
            {subscriptions.managedId && subscriptions.returnState !== 'idle' ? (
              <View className="gap-sm">
                <Text className="font-body text-white text-[14px]">{subscriptions.returnState === 'refreshed'
                  ? 'Membership refreshed. See your provider for subscription details.'
                  : 'Cancellation is not yet confirmed. Check your provider for the latest status.'}</Text>
                {subscriptions.returnState === 'unknown' ? <Pressable onPress={() => void subscriptions.retryMembership()} disabled={isOffline} accessibilityRole="button" accessibilityLabel="Refresh membership status">
                  <Text className="font-body-semibold text-lime text-[14px]">Try again</Text>
                </Pressable> : null}

              </View>
            ) : null}
            {trialAccess ? (
              <View className="rounded-[16px] bg-lime/10 p-md flex-row gap-sm">
                <Feather name="info" size={24} color={colors.lime} />
                <Text className="font-body text-white text-[14px] leading-[21px] flex-1">Your trial gives you full access to Pro.</Text>
              </View>
            ) : (
              <View className="border-t border-border pt-lg flex-row gap-md">
                <View className="h-[40px] w-[40px] rounded-full bg-lime/10 items-center justify-center">
                  <Feather name="check" size={24} color={colors.lime} />
                </View>
                <View className="flex-1 gap-sm">
                  <Text className="font-body-semibold text-white text-[17px]">Everything is unlocked</Text>
                  <Text className="font-body text-white text-[14px] leading-[21px]">You have full access to all Pro features across Dad Health.</Text>
                </View>
              </View>
            )}
          </>
        ) : subscriptions.status?.isPro === false || !user ? (
          <>
            <ProHeader free title={'Unlock the\nfull experience'} description="Go further with personalised plans, advanced tools and more." />
            <View className="gap-sm">
              {THIS_WEEK_FEATURES.map((feature) => (
                <View key={feature} className="flex-row items-start gap-sm">
                  <Feather name="check" size={17} color={colors.lime} />
                  <Text className="font-body text-white text-[14px] leading-[20px] flex-1">{feature}</Text>
                </View>
              ))}
            </View>
            <View className="gap-sm">
              <PlanRow
                title="Annual"
                price={planCopy.annual.price}
                loading={subscriptions.catalogLoading}
                suffix={planCopy.annual.suffix}
                selected={selectedPlan === 'annual'}
                disabled={subscriptions.purchasing || subscriptions.restoring || subscriptions.managing}
                onPress={() => setSelectedPlan('annual')}
              />
              <PlanRow
                title="Monthly"
                price={planCopy.monthly.price}
                loading={subscriptions.catalogLoading}
                suffix={planCopy.monthly.suffix}
                selected={selectedPlan === 'monthly'}
                disabled={subscriptions.purchasing || subscriptions.restoring || subscriptions.managing}
                onPress={() => setSelectedPlan('monthly')}
              />
            </View>
            {!user ? (
              <ProAction label="Log in to continue" onPress={() => navigation.navigate('Login')} />
            ) : optionReady ? (
              <ProAction label={trialAvailable ? 'START MY 7-DAY FREE TRIAL' : 'Subscribe'}
                accessibilityLabel={trialAvailable ? 'Start my 7-day free trial' : 'Subscribe'}
                onPress={() => {

                  if (isOffline) showOfflineAction('subscriptions');
                  else void subscriptions.purchase(selectedPlan, 'button');
                }}
                loading={subscriptions.purchasing}
                disabled={checking || Boolean(subscriptions.statusError) || subscriptions.managing || subscriptions.restoring || subscriptions.status?.canPurchase !== true} />
            ) : null}
            {user && optionReady && trialTerms ? (
              <Text className="font-body text-white text-[14px] leading-[20px] text-center">
                {`Your free trial ends on ${trialTerms.trialEndsOn}. Your first payment of ${trialTerms.price} is taken on ${trialTerms.firstPaymentOn}, then ${trialTerms.price} every ${trialTerms.period} unless you cancel.`}
              </Text>
            ) : null}
            {user && !subscriptions.storeSupported && !subscriptions.loading ? (
              <Text className="font-body text-white text-[13px] leading-[18px] text-center">Subscriptions aren’t available on this device right now.</Text>
            ) : null}
          </>
        ) : (
          <ProHeader
            title="Dad Health Pro"
            description={isOffline
              ? 'Your membership will update when you reconnect.'
              : 'Your membership is temporarily unavailable.'}
          />
        )}

        <InlineFormError message={displayError} />
        {subscriptions.notice && !displayError ? (
          <Text accessibilityLiveRegion="polite" className="font-body text-lime text-[14px] leading-[18px] text-center">
            {subscriptions.notice}
          </Text>
        ) : null}

        <View className="flex-row flex-wrap items-center justify-center gap-sm">
                  {user && subscriptions.storeSupported ? (
          <Pressable
            onPress={() => isOffline ? showOfflineAction('subscriptions') : void subscriptions.restore()}
            disabled={subscriptions.restoring || subscriptions.purchasing || subscriptions.managing}
            accessibilityRole="button"
            className="min-h-[44px] justify-center active:opacity-70"
          >
            <Text className="font-body text-white text-[12px]">
              Restore purchases
            </Text>
          </Pressable>
        ) : null}

          {['Terms', 'Privacy'].map((label) => (
            <Pressable key={label} onPress={() => navigation.navigate('TermsPrivacy')} accessibilityRole="link" className="min-h-[44px] justify-center px-xs">
              <Text className="font-body text-white text-[12px]">{label}</Text>
            </Pressable>
          ))}
        </View>
        {subscriptions.status?.isPro === false ? (
          <Text className="font-body text-white text-[14px] leading-[20px] text-center">
            {trialAvailable ? '7-day free trial for eligible new subscribers. Cancel anytime. ' : ''}
            Subscription renews automatically unless cancelled. You can manage or cancel it in your {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} account.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Shown only while access is still unknown: the screen's own layout with section
 * placeholders. No price, no purchase button and no Pro state until the server confirms.
 */
function SubscriptionSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading your subscription" accessibilityLiveRegion="polite" className="gap-lg">
      <View className="items-center gap-md pb-sm">
        <MaterialCommunityIcons name="crown" size={32} color={colors.lime} />
        <Text className="font-body-semibold text-lime text-[11px] tracking-label">DAD HEALTH PRO</Text>
        <SkeletonBlock width={220} height={28} radius={8} />
        <SkeletonBlock width={260} height={16} radius={6} />
      </View>
      <View className="gap-sm">
        <SkeletonBlock height={16} radius={6} />
        <SkeletonBlock height={16} radius={6} />
        <SkeletonBlock width="80%" height={16} radius={6} />
      </View>
      <SkeletonBlock height={80} radius={16} />
      <SkeletonBlock height={80} radius={16} />
      <SkeletonBlock height={48} radius={14} />
    </View>
  );
}

function ProHeader({ title, description, free = false }: { title: string; description: string; free?: boolean }) {
  return (
    <View className="items-center gap-md pb-sm">
      <View className={free ? 'items-center' : 'h-[56px] w-[56px] rounded-[16px] bg-lime/10 items-center justify-center'}>
        <MaterialCommunityIcons name="crown" size={32} color={colors.lime} />
      </View>
      {free ? <Text className="font-body-semibold text-lime text-[11px] tracking-label">DAD HEALTH PRO</Text> : null}
      <Text className={`font-body-semibold text-white text-center ${free ? 'text-[30px] leading-[34px]' : 'text-[26px] leading-[30px]'}`}>{title}</Text>
      <Text className="font-body text-white text-[14px] leading-[21px] text-center max-w-[280px]">{description}</Text>
    </View>
  );
}

function ProAction({ label, accessibilityLabel, onPress, loading = false, disabled = false, outlined = false }: {
  label: string; accessibilityLabel?: string; onPress(): void; loading?: boolean; disabled?: boolean; outlined?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className={`min-h-[48px] rounded-[14px] px-md flex-row items-center justify-center gap-sm active:opacity-70 ${outlined ? 'border border-white/70 bg-white/5' : 'bg-lime'} ${disabled || loading ? 'opacity-60' : ''}`}>
      <Text className={`font-body-semibold text-[16px] ${outlined ? 'text-white' : 'text-dark'}`}>{label}</Text>
      {outlined ? <Feather name="external-link" size={18} color={colors.text} /> : null}
    </Pressable>
  );
}

function PlanRow({ title, price, suffix, selected, onPress, disabled = false, loading = false }: {
  title: string;
  price: string | null;
  loading?: boolean;
  suffix: string;
  selected: boolean;
  onPress(): void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      className={`min-h-[80px] rounded-[16px] flex-row items-center gap-md border px-lg py-md active:opacity-80 ${selected ? 'border-lime bg-lime/5' : 'border-transparent bg-card'}`}>
      <View className="flex-1 gap-xs">
        <Text className="font-body-semibold text-white text-[17px]">{title}</Text>
        {!price && loading ? <SkeletonBlock width={110} height={14} radius={6} /> : (
          <Text className="font-body text-white text-[14px]">{price ? `${price} / ${suffix === 'per year' ? 'year' : 'month'}` : '\u2014'}</Text>
        )}
      </View>
      <View className={`h-[22px] w-[22px] rounded-full border items-center justify-center ${selected ? 'border-lime' : 'border-white/70'}`}>
        {selected ? <View className="h-[12px] w-[12px] rounded-full bg-lime" /> : null}
      </View>
    </Pressable>
  );
}

function providerName(provider: string | null): string | null {
  if (provider === 'apple') return 'Apple';
  if (provider === 'google') return 'Google Play';
  if (provider === 'stripe') return 'Dad Health website';
  if (provider === 'manual') return 'Dad Health';
  return null;
}

function MembershipRow({ label, value, icon }: { label: string; value: string; icon: React.ComponentProps<typeof Feather>['name'] }) {
  return (
    <View className="flex-row items-start gap-sm">
      <Feather name={icon} size={18} color={colors.text} />
      <Text className="font-body text-white text-[14px]">{label}</Text>
      <Text className="flex-1 text-right font-body text-white text-[14px]">{value}</Text>
    </View>
  );
}

function membershipPeriodLabel(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const date = new Date(value);
  const calendarDate = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(calendarDate.getTime())
    || calendarDate.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
