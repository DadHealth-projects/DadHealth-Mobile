import type { NavigationContainerRef } from '@react-navigation/native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type { NotificationClickEvent, OneSignal as OneSignalSdk } from 'react-native-onesignal';

import type { AppStackParamList } from '../navigation/AppNavigator';

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

function getOneSignal(): typeof OneSignalSdk | null {
  if (oneSignal !== undefined) return oneSignal;

  const nativeModule = TurboModuleRegistry.get('OneSignal') ?? NativeModules.OneSignal;
  if (!nativeModule) {
    oneSignal = null;
    if (!unavailableWarningShown) {
      unavailableWarningShown = true;
      console.warn('[OneSignal] Native module unavailable. Use a fresh EAS development build; push is not supported in Expo Go.');
    }
    return null;
  }

  try {
    oneSignal = require('react-native-onesignal').OneSignal as typeof OneSignalSdk;
  } catch (error) {
    oneSignal = null;
    console.warn('[OneSignal] Native module could not be loaded.', error);
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
    console.info('[OneSignal] Notification opened.', {
      type: typeof additionalData.type === 'string' ? additionalData.type : 'unknown',
      hasPostId: typeof additionalData.post_id === 'string',
    });
    navigateFromData(additionalData);
  }
}

export function initializePushNotifications() {
  if (initialized) return true;
  const sdk = getOneSignal();
  if (!sdk) return false;
  const appId = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim();
  if (!appId) {
    console.warn('[OneSignal] EXPO_PUBLIC_ONESIGNAL_APP_ID is not configured.');
    return false;
  }
  sdk.initialize(appId);
  sdk.Notifications.addEventListener('click', onNotificationClick);
  initialized = true;
  console.info('[OneSignal] Native push initialized.');
  return true;
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
  const sdk = getOneSignal();
  if (sdk && initializePushNotifications()) {
    sdk.login(userId);
    console.info('[OneSignal] Supabase user linked.', { user: userId.slice(0, 8) });
  }
}

export function logoutPushUser() {
  const sdk = getOneSignal();
  if (sdk && initialized) {
    sdk.logout();
    console.info('[OneSignal] User link cleared.');
  }
}

export async function requestPushPermission() {
  if (!initializePushNotifications()) return { configured: false, granted: false };
  const sdk = getOneSignal();
  if (!sdk) return { configured: false, granted: false };
  const granted = await sdk.Notifications.requestPermission(true);
  console.info('[OneSignal] Permission request completed.', { granted });
  return { configured: true, granted };
}
