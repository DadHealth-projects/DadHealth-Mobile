import type { NavigationContainerRef } from '@react-navigation/native';
import { OneSignal, type NotificationClickEvent } from 'react-native-onesignal';

import type { AppStackParamList } from '../navigation/AppNavigator';

type NotificationData = {
  type?: unknown;
  link?: unknown;
  post_id?: unknown;
  event_id?: unknown;
  schedule_id?: unknown;
};

let initialized = false;
let navigationRef: NavigationContainerRef<AppStackParamList> | null = null;
let pendingData: NotificationData | null = null;

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
  return false;
}

function onNotificationClick(event: NotificationClickEvent) {
  const additionalData = event.notification.additionalData;
  if (isRecord(additionalData)) navigateFromData(additionalData);
}

export function initializePushNotifications() {
  if (initialized) return true;
  const appId = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim();
  if (!appId) {
    console.warn('[OneSignal] EXPO_PUBLIC_ONESIGNAL_APP_ID is not configured.');
    return false;
  }
  OneSignal.initialize(appId);
  OneSignal.Notifications.addEventListener('click', onNotificationClick);
  initialized = true;
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
  if (initializePushNotifications()) OneSignal.login(userId);
}

export function logoutPushUser() {
  if (initialized) OneSignal.logout();
}

export async function requestPushPermission() {
  if (!initializePushNotifications()) return { configured: false, granted: false };
  const granted = await OneSignal.Notifications.requestPermission(true);
  return { configured: true, granted };
}
