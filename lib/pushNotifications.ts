import type { NavigationContainerRef } from '@react-navigation/native';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import type { NotificationClickEvent, OneSignal as OneSignalSdk } from 'react-native-onesignal';

import type { AppStackParamList } from '../navigation/AppNavigator';
import { isValidCommunityPostId } from './deepLinks';

type NotificationData = {
  type?: unknown;
  link?: unknown;
  post_id?: unknown;
  event_id?: unknown;
  schedule_id?: unknown;
};

let initialized = false;
let oneSignal: typeof OneSignalSdk | null | undefined;
let navigationRef: NavigationContainerRef<AppStackParamList> | null = null;
let pendingData: NotificationData | null = null;
let navigationLifecycleReady = false;
let authenticatedDestinationReady = false;
let pendingShownWhileSignedOut = false;

function getOneSignal(): typeof OneSignalSdk | null {
  if (oneSignal !== undefined) return oneSignal;

  if (Platform.OS === 'web') {
    oneSignal = null;
    return null;
  }

  const nativeModule = TurboModuleRegistry.get('OneSignal') ?? NativeModules.OneSignal;

  if (!nativeModule) {
    oneSignal = null;
    return null;
  }

  try {
    oneSignal = require('react-native-onesignal').OneSignal as typeof OneSignalSdk;
  } catch {
    oneSignal = null;
  }

  return oneSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function navigateFromData(data: NotificationData): boolean {
  if (!navigationRef?.isReady() || !navigationLifecycleReady) return false;

  if (
    data.type === 'community_reply' &&
    isValidCommunityPostId(data.post_id)
  ) {
    navigationRef.navigate('CommunityPostThread', {
      postId: data.post_id,
    });
    return true;
  }

  if (
    data.type === 'community_like' &&
    isValidCommunityPostId(data.post_id)
  ) {
    navigationRef.navigate('CommunityPostThread', {
      postId: data.post_id,
    });
    return true;
  }

  if (data.type === 'co_parent_event_added') {
    navigationRef.navigate('SharedCalendar');
    return true;
  }

  if (data.type === 'present_dad_mode_complete') {
    navigationRef.navigate('Tabs', { screen: 'Bond' });
    return true;
  }

  if (data.type === 'weekly_score' || data.link === '/progress') {
    navigationRef.navigate('Progress');
    return true;
  }

  if (
    data.type === 'morning_checkin' ||
    data.type === 'streak_at_risk' ||
    data.link === '/'
  ) {
    navigationRef.navigate('Tabs', { screen: 'Home' });
    return true;
  }

  if (
    data.type === 'bedtime_story' ||
    data.type === 'milestone_anniversary' ||
    data.link === '/bond'
  ) {
    navigationRef.navigate('Tabs', { screen: 'Bond' });
    return true;
  }

  if (
    data.type === 'workout_window' ||
    data.link === '/fitness'
  ) {
    navigationRef.navigate('Tabs', { screen: 'Fit' });
    return true;
  }

  if (
    data.type === 'journal_prompt' ||
    data.link === '/mind'
  ) {
    navigationRef.navigate('Tabs', { screen: 'Mind' });
    return true;
  }

  if (
    data.type === 'community_reply' ||
    data.type === 'community_like' ||
    data.link === '/community'
  ) {
    navigationRef.navigate('Tabs', { screen: 'Squad' });
    return true;
  }

  return false;
}

function flushPendingNavigation(): boolean {
  if (
    !pendingData ||
    !navigationLifecycleReady ||
    !navigationRef?.isReady()
  ) {
    return false;
  }

  if (!authenticatedDestinationReady && pendingShownWhileSignedOut) {
    return false;
  }

  const navigated = navigateFromData(pendingData);

  if (!navigated) {
    // Unsupported or malformed notification destinations are safely discarded.
    pendingData = null;
    pendingShownWhileSignedOut = false;
    return false;
  }

  if (authenticatedDestinationReady) {
    pendingData = null;
    pendingShownWhileSignedOut = false;
  } else {
    // Preserve the destination through the signed-out navigator and replay it
    // after authentication/onboarding replaces that navigation tree.
    pendingShownWhileSignedOut = true;
  }

  return true;
}

function onNotificationClick(event: NotificationClickEvent) {
  const additionalData = event.notification.additionalData;

  if (!isRecord(additionalData)) return;

  pendingData = additionalData;
  pendingShownWhileSignedOut = false;

  flushPendingNavigation();
}

export function initializePushNotifications() {
  if (initialized) return true;

  const sdk = getOneSignal();

  if (!sdk) return false;

  const appId = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim();

  if (!appId) return false;

  sdk.initialize(appId);

  sdk.Notifications.addEventListener(
    'click',
    onNotificationClick,
  );

  initialized = true;

  return true;
}

export function attachPushNavigation(
  ref: NavigationContainerRef<AppStackParamList>,
) {
  navigationRef = ref;
  flushPendingNavigation();
}

export function setPushNavigationLifecycleReady(
  ready: boolean,
  authenticated: boolean,
) {
  navigationLifecycleReady = ready;
  authenticatedDestinationReady = authenticated;

  if (ready) {
    flushPendingNavigation();
  }
}

export function loginPushUser(userId: string) {
  const sdk = getOneSignal();

  if (sdk && initializePushNotifications()) {
    sdk.login(userId);
  }
}

export function logoutPushUser() {
  const sdk = getOneSignal();

  if (sdk && initialized) {
    sdk.logout();
  }
}

export async function requestPushPermission() {
  if (!initializePushNotifications()) {
    return {
      configured: false,
      granted: false,
    };
  }

  const sdk = getOneSignal();

  if (!sdk) {
    return {
      configured: false,
      granted: false,
    };
  }

  const granted =
    await sdk.Notifications.requestPermission(true);

  return {
    configured: true,
    granted,
  };
}