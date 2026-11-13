import { StackActions, type NavigationProp } from '@react-navigation/native';

import type { AppStackParamList } from '../navigation/AppNavigator';
import { trackEvent } from './analytics';
import { supabase } from './supabase';

export type UpgradeSource = string;

// Retain the claim until this push is observed, or its originating stack/account ends.
const pending = new WeakMap<object, { owner?: string; release: () => void }>();
function claimNavigation(navigation: NavigationProp<AppStackParamList>, owner: string | undefined, source: string, context: string, feature: string) {
  let root = navigation;
  while (root.getParent()) root = root.getParent()!;
  const previous = pending.get(root);
  if (previous && previous.owner !== owner) previous.release();
  const state = root.getState();
  if (pending.has(root) || state.routes[state.index]?.name === 'ProSubscription') return false;
  const originKey = state.routes[state.index]?.key;
  const routeKeys = new Set(state.routes.map(route => route.key));
  let removeState = () => {};
  let removeAuth = () => {};
  let released = false;
  const claim = { owner, release: () => {
    if (released) return;
    released = true;
    if (pending.get(root) === claim) pending.delete(root);
    removeState();
    removeAuth();
  } };
  pending.set(root, claim);
  removeState = root.addListener('state', () => {
    const next = root.getState();
    const opened = next.routes.some(route => route.name === 'ProSubscription' && !routeKeys.has(route.key)
      && route.params && 'source' in route.params && route.params.source === source
      && 'context' in route.params && route.params.context === context
      && 'feature' in route.params && route.params.feature === feature);
    const reset = next.key !== state.key || !next.routes.some(route => route.key === originKey);
    if (opened || reset) claim.release();
  });
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user.id !== owner) claim.release();
  });
  removeAuth = () => subscription.unsubscribe();
  if (released) removeAuth();
  return true;
}

export function pushProSubscription(
  navigation: NavigationProp<AppStackParamList>,
  source: UpgradeSource,
  context: string,
  feature: string = source,
) {
  navigation.dispatch(StackActions.push('ProSubscription', { source, context, feature }));
}

export function navigateToProSubscription(
  navigation: NavigationProp<AppStackParamList>,
  source: UpgradeSource,
  context: string,
  userId?: string,
  interaction: 'lock' | 'cta' | 'badge' = 'cta',
  feature: string = source,
) {
  if (!claimNavigation(navigation, userId, source, context, feature)) return false;
  if (interaction === 'lock' || interaction === 'badge') {
    trackEvent('lock_tapped', { feature, source }, userId);
  }
  trackEvent('paywall_opened', { feature, source }, userId);
  pushProSubscription(navigation, source, context, feature);
  return true;
}
