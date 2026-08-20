import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { refreshDashboardForUser } from '../../hooks/useDashboard';
import { useNativeSubscriptions } from '../../hooks/useNativeSubscriptions';
import type { SubscriptionPlan } from '../../lib/nativeSubscriptions';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

const PRO_FEATURES = [
  'Full workout library and live workout timer',
  'Meal planner and shopping list',
  'Mood, sleep and Dad Health Score trends',
  'Therapist and counsellor directory',
  'Badges, report cards and milestone photos',
  'Unlimited Dad Days searches',
] as const;

export default function ProSubscriptionScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('annual');
  const subscriptions = useNativeSubscriptions(
    user?.id,
    user?.id ? () => void refreshDashboardForUser(user.id) : undefined,
  );
  const selectedProduct = subscriptions.products.find((product) => product.plan === selectedPlan);
  const trialAvailable = Boolean(selectedProduct?.hasSevenDayTrial);
  const providerLabel = providerName(subscriptions.status?.primaryProvider ?? null);

  const planCopy = useMemo(() => ({
    monthly: {
      price: subscriptions.products.find((item) => item.plan === 'monthly')?.displayPrice ?? '£6.99',
      suffix: 'per month',
      badge: null,
    },
    annual: {
      price: subscriptions.products.find((item) => item.plan === 'annual')?.displayPrice ?? '£49.99',
      suffix: 'per year',
      badge: 'Best value',
    },
  }), [subscriptions.products]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-[80px] gap-xl">
        <AppTopBar
          showBrand
          leftAccessory={(
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Close Dad Health Pro"
              className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70"
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          )}
        />

        {subscriptions.status?.isPro ? (
          <>
            <ScreenHero
              eyebrow="Dad Health Pro"
              headline={'Pro is\nactive'}
              sub={providerLabel ? `Your Pro access is managed through ${providerLabel}.` : 'Your Dad Health Pro access is active.'}
            />
            <View className="border-y border-border py-xl gap-md">
              <View className="h-[54px] w-[54px] rounded-full bg-lime/10 items-center justify-center">
                <Feather name="check" size={25} color={colors.lime} />
              </View>
              <Text className="font-heading-bold text-white text-[19px] uppercase">Everything is unlocked</Text>
              <Text className="font-body text-muted-text text-[13px] leading-[20px]">
                Your Pro access works across Dad Health wherever you use this account.
              </Text>
              {subscriptions.status.primaryProvider !== 'manual' ? (
                <LimeButton label="Manage subscription" onPress={() => void subscriptions.manage()} />
              ) : null}
            </View>
          </>
        ) : (
          <>
            <ScreenHero
              eyebrow="Dad Health Pro"
              headline={'Kill the old\nversion of you.'}
              sub="Unlock every tool we've built to help you be a stronger dad."
            />

            <View className="gap-sm">
              <PlanRow
                title="Monthly"
                price={planCopy.monthly.price}
                suffix={planCopy.monthly.suffix}
                selected={selectedPlan === 'monthly'}
                onPress={() => setSelectedPlan('monthly')}
              />
              <PlanRow
                title="Annual"
                price={planCopy.annual.price}
                suffix={planCopy.annual.suffix}
                badge={planCopy.annual.badge}
                selected={selectedPlan === 'annual'}
                onPress={() => setSelectedPlan('annual')}
              />
            </View>

            <View className="border-y border-border py-lg gap-md">
              {PRO_FEATURES.map((feature) => (
                <View key={feature} className="flex-row items-start gap-sm">
                  <Feather name="check" size={17} color={colors.lime} />
                  <Text className="font-body text-muted-text text-[13px] leading-[19px] flex-1">{feature}</Text>
                </View>
              ))}
            </View>

            {!user ? (
              <LimeButton label="Log in to continue" onPress={() => navigation.navigate('Login')} />
            ) : (
              <LimeButton
                label={trialAvailable ? 'Start 7-day free trial' : 'Continue'}
                onPress={() => void subscriptions.purchase(selectedPlan)}
                loading={subscriptions.purchasing}
                disabled={subscriptions.loading || !subscriptions.storeAvailable || !selectedProduct}
              />
            )}

            {user && !subscriptions.storeAvailable && !subscriptions.loading ? (
              <Text className="font-body text-muted-text text-[12px] leading-[18px] text-center">
                Subscriptions aren’t available on this device right now.
              </Text>
            ) : null}
          </>
        )}

        {subscriptions.error ? (
          <Text accessibilityRole="alert" className="font-body text-red-300 text-[12px] leading-[18px] text-center">
            {subscriptions.error}
          </Text>
        ) : null}
        {subscriptions.notice ? (
          <Text accessibilityLiveRegion="polite" className="font-body text-lime text-[12px] leading-[18px] text-center">
            {subscriptions.notice}
          </Text>
        ) : null}

        {user && (!subscriptions.status?.isPro
          || subscriptions.status.primaryProvider === 'apple'
          || subscriptions.status.primaryProvider === 'google') ? (
          <Pressable
            onPress={() => void subscriptions.restore()}
            disabled={subscriptions.restoring}
            accessibilityRole="button"
            className="min-h-[44px] self-center justify-center border-b border-lime active:opacity-70"
          >
            <Text className="font-heading-bold text-lime text-[11px] uppercase">
              {subscriptions.restoring ? 'Restoring purchases…' : 'Restore purchases'}
            </Text>
          </Pressable>
        ) : null}

        {!subscriptions.status?.isPro ? (
          <Text className="font-body text-tertiary-text text-[10px] leading-[16px] text-center">
            {trialAvailable ? 'Seven-day free trial for eligible new subscribers. ' : ''}
            Subscription renews automatically unless cancelled. You can manage or cancel it in your {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} account.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanRow({
  title,
  price,
  suffix,
  badge,
  selected,
  onPress,
}: {
  title: string;
  price: string;
  suffix: string;
  badge?: string | null;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      className={`min-h-[88px] flex-row items-center gap-md border p-md active:opacity-80 ${selected ? 'border-lime bg-lime/5' : 'border-border bg-card'}`}
    >
      <View className={`h-[22px] w-[22px] rounded-full border items-center justify-center ${selected ? 'border-lime' : 'border-tertiary-text'}`}>
        {selected ? <View className="h-[12px] w-[12px] rounded-full bg-lime" /> : null}
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-sm">
          <Text className="font-heading-bold text-white text-[17px] uppercase">{title}</Text>
          {badge ? (
            <View className="bg-lime/10 px-sm py-xs">
              <Text className="font-heading-bold text-lime text-[9px] uppercase">{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text className="font-body text-muted-text text-[11px] mt-xs">{suffix}</Text>
      </View>
      <Text className="font-heading text-lime text-[27px]">{price}</Text>
    </Pressable>
  );
}

function providerName(provider: string | null): string | null {
  if (provider === 'apple') return 'the App Store';
  if (provider === 'google') return 'Google Play';
  if (provider === 'stripe') return 'the Dad Health website';
  if (provider === 'manual') return 'Dad Health';
  return null;
}
