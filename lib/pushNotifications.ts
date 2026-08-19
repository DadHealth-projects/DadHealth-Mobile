import type { NavigationContainerRef } from '@react-navigation/native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type {
  NotificationClickEvent,
  OneSignal as OneSignalSdk,
  PushSubscriptionChangedState,
  UserChangedState,
} from 'react-native-onesignal';

import type { AppStackParamList } from '../navigation/AppNavigator';
import {
  recordOneSignalDebugError,
  recordOneSignalDebugMessage,
  updateOneSignalDebug,
} from './oneSignalDebug';

type NotificationData = {
  type?: unknown;
  link?: unknown;
  post_id?: unknown;
  event_id?: unknown;
  schedule_id?: unknown;
};

let initialized = false;
let oneSignal: typeof OneSignalSdk | null | undefined;
let unavailableWarningShown = false;
let navigationRef: NavigationContainerRef<AppStackParamList> | null = null;
let pendingData: NotificationData | null = null;
let expectedExternalUserId: string | null = null;

function logOneSignalError(stage: string, error: unknown) {
  console.error(`[OneSignalDebug] ${stage}`, recordOneSignalDebugError(stage, error));
}

function nativePermissionLabel(permission: number) {
  return ['not_determined', 'denied', 'authorized', 'provisional', 'ephemeral'][permission] ?? 'unknown';
}

async function logPermissionState(sdk: typeof OneSignalSdk, reason: string) {
  try {
    const [granted, nativePermission] = await Promise.all([
      sdk.Notifications.getPermissionAsync(),
      sdk.Notifications.permissionNative(),
    ]);
    console.info('[OneSignalDebug] Permission state', {
      reason,
      granted,
      nativePermission,
      nativePermissionLabel: nativePermissionLabel(nativePermission),
    });
    updateOneSignalDebug({ permissionGranted: granted });
  } catch (error) {
    logOneSignalError(`Permission state read failed (${reason})`, error);
  }
}

async function logSubscriptionState(sdk: typeof OneSignalSdk, reason: string) {
  try {
    const [optedIn, subscriptionId] = await Promise.all([
      sdk.User.pushSubscription.getOptedInAsync(),
      sdk.User.pushSubscription.getIdAsync(),
    ]);
    console.info('[OneSignalDebug] Subscription state', {
      reason,
      optedIn,
      hasSubscriptionId: Boolean(subscriptionId),
    });
    updateOneSignalDebug({ subscriptionOptedIn: optedIn, hasSubscriptionId: Boolean(subscriptionId) });
  } catch (error) {
    logOneSignalError(`Subscription state read failed (${reason})`, error);
  }
}

async function logUserLinkState(sdk: typeof OneSignalSdk, reason: string) {
  try {
    const externalId = await sdk.User.getExternalId();
    console.info('[OneSignalDebug] Supabase user link state', {
      reason,
      hasExternalId: Boolean(externalId),
      linkedSuccessfully: Boolean(expectedExternalUserId && externalId === expectedExternalUserId),
    });
    updateOneSignalDebug({
      externalUserLinked: Boolean(expectedExternalUserId && externalId === expectedExternalUserId),
    });
  } catch (error) {
    logOneSignalError(`Supabase user link read failed (${reason})`, error);
  }
}

function onPermissionChange(granted: boolean) {
  console.info('[OneSignalDebug] Permission changed', { granted });
  updateOneSignalDebug({ permissionGranted: granted });
  const sdk = getOneSignal();
  if (sdk) {
    void logPermissionState(sdk, 'permission change');
    void logSubscriptionState(sdk, 'permission change');
  }
}

function onPushSubscriptionChange(event: PushSubscriptionChangedState) {
  console.info('[OneSignalDebug] Subscription changed', {
    previousOptedIn: event.previous.optedIn,
    optedIn: event.current.optedIn,
    hadSubscriptionId: Boolean(event.previous.id),
    hasSubscriptionId: Boolean(event.current.id),
  });
  updateOneSignalDebug({
    subscriptionOptedIn: event.current.optedIn,
    hasSubscriptionId: Boolean(event.current.id),
  });
}

function onUserStateChange(event: UserChangedState) {
  console.info('[OneSignalDebug] OneSignal user changed', {
    hasExternalId: Boolean(event.current.externalId),
    hasOneSignalId: Boolean(event.current.onesignalId),
    linkedSuccessfully: Boolean(expectedExternalUserId && event.current.externalId === expectedExternalUserId),
  });
  updateOneSignalDebug({
    externalUserLinked: Boolean(expectedExternalUserId && event.current.externalId === expectedExternalUserId),
  });
}

function getOneSignal(): typeof OneSignalSdk | null {
  if (oneSignal !== undefined) {
    console.info('[OneSignalDebug] Native module cache checked', { available: oneSignal !== null });
    updateOneSignalDebug({ nativeModuleAvailable: oneSignal !== null });
    return oneSignal;
  }

  const nativeModule = TurboModuleRegistry.get('OneSignal') ?? NativeModules.OneSignal;
  console.info('[OneSignalDebug] Native module available', { available: Boolean(nativeModule) });
  updateOneSignalDebug({ nativeModuleAvailable: Boolean(nativeModule) });
  if (!nativeModule) {
    oneSignal = null;
    if (!unavailableWarningShown) {
      unavailableWarningShown = true;
      console.warn('[OneSignalDebug] Native module unavailable');
      recordOneSignalDebugMessage('Native module', 'OneSignal is unavailable in this app build.');
    }
    return null;
  }

  try {
    oneSignal = require('react-native-onesignal').OneSignal as typeof OneSignalSdk;
    console.info('[OneSignalDebug] JavaScript SDK loaded', { loaded: true });
  } catch (error) {
    oneSignal = null;
    updateOneSignalDebug({ nativeModuleAvailable: false });
    logOneSignalError('JavaScript SDK load failed', error);
  }
  return oneSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function navigateFromData(data: NotificationData): boolean {
  if (!navigationRef?.isReady()) {
    pendingData = data;
    return false;
  }
  if (data.type === 'community_reply' && typeof data.post_id === 'string') {
    navigationRef.navigate('CommunityPostThread', { postId: data.post_id });
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
  if (data.type === 'morning_checkin' || data.type === 'streak_at_risk' || data.link === '/') {
    navigationRef.navigate('Tabs', { screen: 'Home' });
    return true;
  }
  if (data.type === 'bedtime_story' || data.type === 'milestone_anniversary' || data.link === '/bond') {
    navigationRef.navigate('Tabs', { screen: 'Bond' });
    return true;
  }
  if (data.type === 'workout_window' || data.link === '/fitness') {
    navigationRef.navigate('Tabs', { screen: 'Fit' });
    return true;
  }
  if (data.type === 'journal_prompt' || data.link === '/mind') {
    navigationRef.navigate('Tabs', { screen: 'Mind' });
    return true;
  }
  if (data.type === 'community_reply' || data.link === '/community') {
    navigationRef.navigate('Tabs', { screen: 'Squad' });
    return true;
  }
  return false;
}

function onNotificationClick(event: NotificationClickEvent) {
  const additionalData = event.notification.additionalData;
  if (isRecord(additionalData)) {
    console.info('[OneSignalDebug] Notification opened', {
      type: typeof additionalData.type === 'string' ? additionalData.type : 'unknown',
      hasPostId: typeof additionalData.post_id === 'string',
    });
    navigateFromData(additionalData);
  }
}

export function initializePushNotifications() {
  console.info('[OneSignalDebug] initializePushNotifications called', { alreadyInitialized: initialized });
  if (initialized) {
    const existingSdk = getOneSignal();
    if (existingSdk) {
      void logPermissionState(existingSdk, 'repeat initialization');
      void logSubscriptionState(existingSdk, 'repeat initialization');
    }
    return true;
  }
  const sdk = getOneSignal();
  if (!sdk) return false;
  const appId = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim();
  console.info('[OneSignalDebug] App ID configured', { configured: Boolean(appId) });
  if (!appId) {
    console.warn('[OneSignalDebug] EXPO_PUBLIC_ONESIGNAL_APP_ID is not configured');
    recordOneSignalDebugMessage('Configuration', 'The OneSignal App ID is not configured.');
    return false;
  }
  try {
    sdk.initialize(appId);
    console.info('[OneSignalDebug] sdk.initialize completed');
    sdk.Notifications.addEventListener('click', onNotificationClick);
    sdk.Notifications.addEventListener('permissionChange', onPermissionChange);
    sdk.User.pushSubscription.addEventListener('change', onPushSubscriptionChange);
    sdk.User.addEventListener('change', onUserStateChange);
    console.info('[OneSignalDebug] Permission and subscription listeners attached');
    initialized = true;
    updateOneSignalDebug({ sdkInitialized: true, latestError: null });
    void logPermissionState(sdk, 'after initialization');
    void logSubscriptionState(sdk, 'after initialization');
    return true;
  } catch (error) {
    updateOneSignalDebug({ sdkInitialized: false });
    logOneSignalError('SDK initialization failed', error);
    throw error;
  }
}

export function attachPushNavigation(ref: NavigationContainerRef<AppStackParamList>) {
  navigationRef = ref;
  if (pendingData) {
    const data = pendingData;
    pendingData = null;
    navigateFromData(data);
  }
}

export function loginPushUser(userId: string) {
  console.info('[OneSignalDebug] OneSignal.login requested', { hasSupabaseUserId: Boolean(userId) });
  expectedExternalUserId = userId;
  updateOneSignalDebug({ externalUserLinked: false });
  try {
    const sdk = getOneSignal();
    if (sdk && initializePushNotifications()) {
      sdk.login(userId);
      console.info('[OneSignalDebug] OneSignal.login call completed');
      void logUserLinkState(sdk, 'after login');
      void logSubscriptionState(sdk, 'after login');
    } else {
      console.warn('[OneSignalDebug] OneSignal.login skipped because initialization is unavailable');
    }
  } catch (error) {
    logOneSignalError('OneSignal.login failed', error);
    throw error;
  }
}

export function logoutPushUser() {
  const sdk = getOneSignal();
  if (sdk && initialized) {
    try {
      sdk.logout();
      expectedExternalUserId = null;
      updateOneSignalDebug({ externalUserLinked: false });
      console.info('[OneSignalDebug] OneSignal.logout call completed');
    } catch (error) {
      logOneSignalError('OneSignal.logout failed', error);
      throw error;
    }
  }
}

export async function requestPushPermission() {
  console.info('[OneSignalDebug] Notification permission request started');
  try {
    if (!initializePushNotifications()) {
      console.warn('[OneSignalDebug] Notification permission request skipped because initialization is unavailable');
      return { configured: false, granted: false };
    }
    const sdk = getOneSignal();
    if (!sdk) {
      console.warn('[OneSignalDebug] Notification permission request skipped because the SDK is unavailable');
      return { configured: false, granted: false };
    }
    console.info('[OneSignalDebug] Calling Notifications.requestPermission');
    const granted = await sdk.Notifications.requestPermission(true);
    console.info('[OneSignalDebug] Permission result', { granted });
    updateOneSignalDebug({ permissionGranted: granted });
    await logPermissionState(sdk, 'after permission request');
    await logSubscriptionState(sdk, 'after permission request');
    return { configured: true, granted };
  } catch (error) {
    logOneSignalError('Notification permission request failed', error);
    throw error;
  }
}
