import { resolveNotificationDestination } from './notificationDestinations';
import type { NavigationContainerRef } from '@react-navigation/native';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import type { NotificationClickEvent, OneSignal as OneSignalSdk } from 'react-native-onesignal';

import type { AppStackParamList } from '../navigation/AppNavigator';
import { isReportWeek } from './weeklyReport';
import { isValidCommunityPostId } from './deepLinks';

type NotificationData = {
  inbox_event_id?: unknown;
  type?: unknown;
  reporting_week?: unknown;
  link?: unknown;
  post_id?: unknown;
  event_id?: unknown;
  schedule_id?: unknown;
  destination_version?: unknown;
  pillar?: unknown;
  workout_id?: unknown;
  trial_episode?: unknown;
};

let initialized = false;
let oneSignal: typeof OneSignalSdk | null | undefined;
let navigationRef: NavigationContainerRef<AppStackParamList> | null = null;
let pendingData: NotificationData | null = null;
let navigationLifecycleReady = false;
let authenticatedDestinationReady = false;
let pendingShownWhileSignedOut = false;
let currentOwner: string | null = null;
let pendingOwner: string | null = null;
const consumedWeeklyNotifications = new Set<string>();
let modalBlocked = false;
let unavailableOwner:string|null=null;
function presentUnavailable(){
 if(unavailableOwner && unavailableOwner===currentOwner && !modalBlocked && navigationRef?.isReady()){unavailableOwner=null;navigationRef.navigate('Notifications');}
}
export function setPushModalBlocked(blocked: boolean) {
  modalBlocked = blocked;
  if (!blocked) { presentUnavailable(); flushPendingNavigation(); presentInboxOperation(); }
}

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
  const target=resolveNotificationDestination(data as Record<string,unknown>);
  if(!target) return false;
  const navigate=navigationRef.navigate as (...args:any[])=>void;
  if(target.params) navigate(target.route,target.params); else navigate(target.route);
  return true;
}

function flushPendingNavigation(): boolean {
  if (
    !pendingData || modalBlocked ||
    !navigationLifecycleReady ||
    !navigationRef?.isReady()
  ) {
    return false;
  }

  if (!authenticatedDestinationReady && pendingShownWhileSignedOut) {
    return false;
  }

  if (pendingData) {
    if (pendingOwner && pendingOwner !== currentOwner) { pendingData = null; return false; }
    if (!authenticatedDestinationReady || !currentOwner) return false;
  }
  if (typeof pendingData.inbox_event_id === 'string') {
    const id=pendingData.inbox_event_id;
    pendingData=null;
    void openInboxNotification(id);
    return true;
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

  if (!additionalData.inbox_event_id && additionalData.type === 'weekly_score' && !isReportWeek(additionalData.reporting_week)) return;
  {
    const identity = event.notification.notificationId;
    if (identity && consumedWeeklyNotifications.has(identity)) return;
    if (identity) consumedWeeklyNotifications.add(identity);
  }
  pendingOwner = currentOwner;
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
    presentInboxOperation();
  }
}

export function loginPushUser(userId: string) {
  if (currentOwner && currentOwner !== userId) {
    pendingData = null;
    unavailableOwner=null;
    cancelInboxNavigation();
    consumedWeeklyNotifications.clear();
  }
  currentOwner = userId;
  flushPendingNavigation();
  const sdk = getOneSignal();

  if (sdk && initializePushNotifications()) {
    sdk.login(userId);
  }
}

export function logoutPushUser() {
  cancelInboxNavigation();
  pendingData = null;
  modalBlocked = false;
  unavailableOwner=null;
  currentOwner = null; pendingOwner = null; consumedWeeklyNotifications.clear();
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

// Account-owned, bounded operation. No timers and no acknowledgement on navigate().
type InboxBridge={owner:string;read:(id:string,signal:AbortSignal)=>Promise<{destination:Record<string,unknown>}>;
 acknowledge:(id:string,signal:AbortSignal)=>Promise<void>;unavailable:()=>void};
let inboxBridge:InboxBridge|null=null;
let operation:{token:string;owner:string;id:string;controller:AbortController;family:string;origin?:string;destination?:Record<string,unknown>;presented:boolean;acknowledging:boolean}|null=null;
let operationSequence=0;
export function configureInboxNavigation(bridge:InboxBridge|null){
 if(inboxBridge?.owner!==bridge?.owner) cancelInboxNavigation();
 inboxBridge=bridge;
 if(bridge) flushPendingNavigation();
}
export function cancelInboxNavigation(){operation?.controller.abort();operation=null;}
export function notificationOperationFamily(token:unknown){return typeof token==='string'&&operation?.token===token?operation.family:null;}
function presentInboxOperation(){
 const op=operation;
 if(!op?.destination||op.presented||modalBlocked||!navigationLifecycleReady||!authenticatedDestinationReady||currentOwner!==op.owner||!navigationRef?.isReady()) return;
 const target=resolveNotificationDestination(op.destination);
 if(!target){inboxBridge?.unavailable();cancelInboxNavigation();return;}
 const params=target.route==='Tabs'?{...target.params,params:{...(target.params?.params as object ?? {}),notificationOperation:op.token}}
   :{...target.params,notificationOperation:op.token};
 op.family=target.family;op.presented=true;
 (navigationRef.navigate as (...args:any[])=>void)(target.route,params);
}
export async function openInboxNotification(id:string){
 if(!/^[0-9a-f-]{36}$/i.test(id))return;
 if(!currentOwner||!authenticatedDestinationReady||!inboxBridge||inboxBridge.owner!==currentOwner){pendingData={inbox_event_id:id};pendingOwner=currentOwner;return;}
 if(operation?.id===id&&operation.owner===currentOwner)return;
 cancelInboxNavigation();
 const bridge=inboxBridge,op={token:String(++operationSequence),owner:currentOwner,id,controller:new AbortController(),family:'',origin:navigationRef?.getCurrentRoute?.()?.key,presented:false,acknowledging:false};
 operation=op;
 try{
  const event=await bridge.read(id,op.controller.signal);
  if(operation!==op||currentOwner!==op.owner)return;
  operation.destination=event.destination;
  presentInboxOperation();
 }catch{
  if(operation===op&&currentOwner===op.owner){bridge.unavailable();cancelInboxNavigation();navigationRef?.navigate('Notifications');}
 }
}
export function notificationRouteChanged(token:unknown,routeKey?:string){
 if(operation && (operation.presented ? token!==operation.token : operation.origin && routeKey!==operation.origin)) cancelInboxNavigation();
}
export async function confirmNotificationPresentation(token:unknown,owner:string|undefined,available=true){
 const op=operation,bridge=inboxBridge;
 if(!op||op.token!==token||op.owner!==owner||currentOwner!==owner||bridge?.owner!==owner||op.acknowledging)return;
 if(!available){bridge.unavailable();unavailableOwner=owner;cancelInboxNavigation();presentUnavailable();return;}
 op.acknowledging=true;
 try{await bridge.acknowledge(op.id,op.controller.signal);}
 finally{if(operation===op)operation=null;}
}
