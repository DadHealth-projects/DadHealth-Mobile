import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CancellationFlow, { CancellationScheduled, isScheduledAppleMembership } from '../../components/subscriptions/CancellationFlow';
import InlineFormError from '../../components/InlineFormError';
import { useAuth } from '../../contexts/AuthContext';
import { useNetworkStatus } from '../../contexts/NetworkContext';
import { refreshDashboardForUser } from '../../hooks/useDashboard';
import { useNativeSubscriptions } from '../../hooks/useNativeSubscriptions';
import type { SubscriptionPlan } from '../../lib/nativeSubscriptions';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

const THIS_WEEK_FEATURES = [
  'Understand what is shaping your Mind, Body and Bond scores',
  'See your weekly trends and personalised insights',
  'Get workouts, Dad Days and plans built around your life',
] as const;

export default function ProSubscriptionScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const { isOffline, showOfflineAction, dismissToast } = useNetworkStatus();
  const [cancellationOwner, setCancellationOwner] = useState<string | null>(null);
  useEffect(() => { setCancellationOwner(null); }, [user?.id]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('annual');
  const refreshEntitlement = useCallback(() => {
    if (user?.id) void refreshDashboardForUser(user.id);
  }, [user?.id]);
  const subscriptions = useNativeSubscriptions(user?.id, refreshEntitlement);
  const selectedProduct = subscriptions.products.find((product) => product.plan === selectedPlan);
  const trialAvailable = !subscriptions.catalogLoading && selectedProduct?.trialEligibility === 'eligible';
  const optionReady = !subscriptions.catalogLoading && subscriptions.storeAvailable
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
  const loadError = subscriptions.statusError ?? (
    subscriptions.storeSupported && subscriptions.status?.isPro === false ? subscriptions.catalogError : null
  );
  const needsRecovery = checking || !subscriptions.status || Boolean(loadError)
    || (subscriptions.status.isPro === false && subscriptions.storeSupported && !optionReady);
  const displayError = subscriptions.actionError ?? (checking ? null : needsRecovery
    ? isOffline ? 'You are offline. Reconnect and try again.'
      : loadError ?? 'We could not confirm this subscription option. Please try again.'
    : null);
  const retry = () => {
    if (isOffline || checking) return;
    dismissToast();
    void subscriptions.retry();
  };

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

  const managedMembership = subscriptions.memberships?.find(item => item.id === subscriptions.managedId);
  if (user && subscriptions.status?.isPro === true && subscriptions.returnState === 'refreshed'
    && !subscriptions.membershipLoading && !subscriptions.membershipError
    && isScheduledAppleMembership(managedMembership)) return (
    <CancellationScheduled subscription={managedMembership!} busy={subscriptions.managing}
      error={subscriptions.actionError} offline={isOffline} onBack={() => navigation.goBack()}
      onManage={() => void subscriptions.manage(managedMembership!.id)} />
  );

  if (user && cancellationOwner === user.id) return (
    <CancellationFlow key={user.id} owner={user.id} subscriptions={subscriptions.memberships}
      loading={subscriptions.membershipLoading} loadError={subscriptions.membershipError}
      refresh={subscriptions.retryMembership} manage={subscriptions.manage}
      returnState={subscriptions.returnState} offline={isOffline} onClose={() => setCancellationOwner(null)} />
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-sm pb-lg gap-lg">
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close Dad Health Pro"
          className="h-[44px] w-[44px] items-center justify-center self-start active:opacity-70"
        >
          <View className="h-[32px] w-[32px] rounded-full bg-card items-center justify-center">
            <Feather name="chevron-left" size={22} color={colors.text} />
          </View>
        </Pressable>

        {(subscriptions.loading || checking) && !subscriptions.status ? (
          <View className="gap-sm items-center">
            <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Dad Health Pro</Text>
            <Text accessibilityLiveRegion="polite" className="font-body text-white text-[14px]">Checking your subscription…</Text>
          </View>
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
              <PlanRow title="Annual" price={planCopy.annual.price} suffix={planCopy.annual.suffix}
                selected={selectedPlan === 'annual'} onPress={() => setSelectedPlan('annual')} />
              <PlanRow title="Monthly" price={planCopy.monthly.price} suffix={planCopy.monthly.suffix}
                selected={selectedPlan === 'monthly'} onPress={() => setSelectedPlan('monthly')} />
            </View>
            {!user ? (
              <ProAction label="Log in to continue" onPress={() => navigation.navigate('Login')} />
            ) : optionReady ? (
              <ProAction label={trialAvailable ? 'Start 7-day free trial' : 'Subscribe'}
                onPress={() => isOffline ? showOfflineAction('subscriptions') : void subscriptions.purchase(selectedPlan)}
                loading={subscriptions.purchasing}
                disabled={subscriptions.restoring || subscriptions.status?.canPurchase !== true} />
            ) : null}
            {user && !subscriptions.storeSupported && !subscriptions.loading ? (
              <Text className="font-body text-white text-[13px] leading-[18px] text-center">Subscriptions aren’t available on this device right now.</Text>
            ) : null}
          </>
        ) : (
          <View className="items-center gap-sm">
            <Text className="font-heading-bold text-lime text-[11px] tracking-label uppercase">Dad Health Pro</Text>
          </View>
        )}

        <InlineFormError message={displayError} />
        {needsRecovery && !subscriptions.loading && !checking ? (
          <Pressable onPress={retry} disabled={isOffline || checking || subscriptions.purchasing || subscriptions.restoring} accessibilityRole="button" accessibilityState={{ busy: checking }} className="min-h-[44px] self-center justify-center border-b border-lime">
            <Text className="font-heading-bold text-lime text-[11px] uppercase">Retry</Text>
          </Pressable>
        ) : null}
        {subscriptions.notice && !displayError ? (
          <Text accessibilityLiveRegion="polite" className="font-body text-lime text-[14px] leading-[18px] text-center">
            {subscriptions.notice}
          </Text>
        ) : null}

        <View className="flex-row flex-wrap items-center justify-center gap-sm">
        {user && (subscriptions.status?.isPro === false
          || subscriptions.status?.primaryProvider === 'apple'
          || subscriptions.status?.primaryProvider === 'google') ? (
          <Pressable
            onPress={() => isOffline ? showOfflineAction('subscriptions') : void subscriptions.restore()}
            disabled={subscriptions.restoring || subscriptions.purchasing || subscriptions.managing}
            accessibilityRole="button"
            className="min-h-[44px] justify-center active:opacity-70"
          >
            <Text className="font-body text-white text-[12px]">
              {subscriptions.restoring ? 'Restoring purchases…' : 'Restore purchases'}
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

function ProAction({ label, onPress, loading = false, disabled = false, outlined = false }: {
  label: string; onPress(): void; loading?: boolean; disabled?: boolean; outlined?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      accessibilityLabel={label} accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className={`min-h-[48px] rounded-[14px] px-md flex-row items-center justify-center gap-sm active:opacity-70 ${outlined ? 'border border-white/70 bg-white/5' : 'bg-lime'} ${disabled || loading ? 'opacity-60' : ''}`}>
      <Text className={`font-body-semibold text-[16px] ${outlined ? 'text-white' : 'text-dark'}`}>{label}</Text>
      {loading ? <ActivityIndicator size="small" color={outlined ? colors.text : colors.dark} />
        : outlined ? <Feather name="external-link" size={18} color={colors.text} /> : null}
    </Pressable>
  );
}

function PlanRow({ title, price, suffix, selected, onPress }: {
  title: string; price: string | null; suffix: string; selected: boolean; onPress(): void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }}
      className={`min-h-[80px] rounded-[16px] flex-row items-center gap-md border px-lg py-md active:opacity-80 ${selected ? 'border-lime bg-lime/5' : 'border-transparent bg-card'}`}>
      <View className="flex-1 gap-xs">
        <Text className="font-body-semibold text-white text-[17px]">{title}</Text>
        <Text className="font-body text-white text-[14px]">{price ? `${price} / ${suffix === 'per year' ? 'year' : 'month'}` : '\u2014'}</Text>
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
