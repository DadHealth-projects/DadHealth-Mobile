import { StackActions, type NavigationProp } from '@react-navigation/native';

import type { AppStackParamList } from '../navigation/AppNavigator';
import { trackEvent } from './analytics';

export type UpgradeSource = string;

export function pushProSubscription(
  navigation: NavigationProp<AppStackParamList>,
  source: UpgradeSource,
  context: string,
) {
  navigation.dispatch(StackActions.push('ProSubscription', { source, context }));
}

export function navigateToProSubscription(
  navigation: NavigationProp<AppStackParamList>,
  source: UpgradeSource,
  context: string,
  userId?: string,
  interaction: 'lock' | 'cta' | 'badge' = 'cta',
  feature: string = source,
) {
  if (interaction === 'lock' || interaction === 'badge') {
    trackEvent('lock_tapped', { feature, source }, userId);
  }
  trackEvent('paywall_opened', { feature, source }, userId);
  pushProSubscription(navigation, source, context);
}
