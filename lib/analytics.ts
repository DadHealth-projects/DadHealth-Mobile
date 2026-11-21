import { analyticsRequestOwner, analyticsRequestScopes } from './analyticsOccurrence';
import { createAnalyticsSessions } from './analyticsSessions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { createAnalyticsQueue, type AnalyticsScope } from './analyticsQueue';
import { uuid } from './analyticsContract';
import type { AnalyticsEvent, AnalyticsEventName, AnalyticsProperties } from './analyticsContract';

const key = 'dadhealth.analytics.v1';
const enabled = () => process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === 'true';
async function request(scope: AnalyticsScope, event: AnalyticsEvent | null, signal: AbortSignal) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (event && scope.owner) {
    const { data, error } = await supabase.auth.getSession();
    if (error || data.session?.user.id !== scope.owner || signal.aborted) return null;
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  if (signal.aborted) return null;
  const base = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/, '');
  return fetch(`${base}/api/analytics/events`, { method: 'POST', headers, signal,
    body: JSON.stringify({ action: event ? 'capture' : 'withdraw', consent: scope.consent, secret: scope.secret,
      owner: scope.owner, ...(event ? { event } : {}) }) });
}
const queue = createAnalyticsQueue({
  scopesChanged: analyticsRequestScopes,
  async credential(owner, previous, signal) {
    if (!enabled()) return null;
    try {
      const requestId = Crypto.randomUUID();
      const headers: Record<string,string> = {'Content-Type':'application/json', 'X-Analytics-Request-ID': requestId};
      if(owner) {
        const {data,error}=await supabase.auth.getSession();
        if(error || !data.session || data.session.user.id!==owner) return null;
        headers.Authorization=`Bearer ${data.session.access_token}`;
      }
      if(signal.aborted) return null;
      const base=(process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/,'');
      const response=await fetch(`${base}/api/analytics/events`,{method:'POST',headers,signal,body:JSON.stringify(previous
        ? {action:'renew',owner,consent:previous.consent,secret:previous.secret}
        : {action:'grant',owner})});
      if (!response.ok) return null;
      const next = await response.json();
      if (!next || next.owner !== owner || !uuid(next.consent) || typeof next.secret !== 'string' ||
          !uuid(next.secret.slice(0,36)) || !uuid(next.secret.slice(36)) || !Number.isFinite(Date.parse(next.expiresAt)) || Date.parse(next.expiresAt) <= Date.now() ||
          (previous && (next.consent !== previous.consent || next.secret !== previous.secret))) return null;
      // Queue ownership/epoch guards still decide whether this response may be used.
      return next;
    } catch {
      return null;
    }
  },
  read: () => AsyncStorage.getItem(key), write: value => AsyncStorage.setItem(key, value),
  random: () => Crypto.randomUUID(), now: () => Date.now(),
  async send(scope, event, signal) {
    if (!enabled()) return 'later';
    const response = await request(scope, event, signal);
    if (!response) return 'later';
    if (response.ok) {
      const payload = await response.json();
      return payload.accepted === event.id ? 'accepted' : 'later';
    }
    return [400,403,409,410].includes(response.status) ? 'rejected' : 'later';
  },
  async withdraw(scope, signal) {
    const response = await request(scope, null, signal);
    if (!response?.ok) return false;
    return (await response.json())?.withdrawn === true;
  },
});
let currentOwner: string | null = null;
const sessions = createAnalyticsSessions();
const flush = () => { void queue.flush(currentOwner).catch(() => undefined); };
export function analyticsLifecycle(owner: string | null) {
  currentOwner = owner;
  analyticsRequestOwner(owner);
  queue.changedAccount();
  if (sessions.ready()) trackEvent('app_opened');
  const app = AppState.addEventListener('change', state => {
    if (sessions.change(state, Date.now())) trackEvent('app_opened');
    if (state === 'active') flush();
  });
  const network = NetInfo.addEventListener(state => { if (state.isConnected === true && state.isInternetReachable !== false) flush(); });
  flush();
  return () => { queue.changedAccount(); app.remove(); network(); };
}
/** Call only from a separately approved consent choice; absence is NOT consent. */
export async function setAnalyticsConsent(owner: string | null, value: 'granted' | 'denied') {
  await queue.consent(owner, value === 'granted');
  const state = await queue.consentStatus(owner);
  flush();
  return { ...state, ready: state.ready && enabled(), enabled: enabled() };
}
export async function clearAnalyticsOwner(owner: string) { await queue.retire(owner); }
export async function getAnalyticsConsentStatus(owner: string | null) {
  // Reconcile only an existing, unexpired capability. A saved ON preference
  // alone can never obtain a replacement credential or enable collection.
  if (enabled()) await queue.reconcileCredential(owner);
  const state = await queue.consentStatus(owner);
  return { ...state, ready: state.ready && enabled(), enabled: enabled() };
}
export const getAnalyticsConsent = (owner: string | null) => queue.consentGranted(owner);
export function captureAnalytics<N extends AnalyticsEventName>(event: N, properties: AnalyticsProperties<N>, userId?: string) {
  trackEvent(event, properties, userId);
}
/** Compatibility entry point: old callers remain safe through runtime validation. */
export function trackEvent(event: string, properties: Record<string, unknown> = {}, userId?: string) {
  if (!enabled()) return;
  void queue.capture(event, properties, userId ?? currentOwner).then(flush).catch(() => undefined);
}
