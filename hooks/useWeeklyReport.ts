import { supabase } from '../lib/supabase';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useNetworkStatus } from '../contexts/NetworkContext';
import { subscribeOfflineSync } from '../lib/offlineStorage';
import { Item02ReadError, parseSavedReport, type SavedWeeklyReport } from '../lib/weeklyReport';

/** Why a read settled empty: the week is not released yet, or a released week has no saved report. */
export type EmptyReason = 'not_released' | 'snapshot_missing';
type Resource<T> = { key: string; data: T | null; loading: boolean; error: string | null; empty: boolean;
  emptyReason: EmptyReason | null };
/** Private component-owned cache; never survives unmount or an account change. */
export function useItem02Resource<T>(owner: string | undefined, path: string, accessKey: string,
  parse: (value: unknown) => T, enabled = true) {
  const { isOffline } = useNetworkStatus();
  const key = `${owner ?? ''}:${path}:${accessKey}`;
  const current = useRef(key); current.current = key;
  const sequence = useRef(0), controller = useRef<AbortController | null>(null);
  const mounted = useRef(false), blocked = useRef(false);
  const [state, setState] = useState<Resource<T>>({ key, data: null, loading: false, error: null, empty: false, emptyReason: null });
  const refresh = useCallback(async () => {
    const generation = ++sequence.current;
    controller.current?.abort();
    if (!owner || !enabled || blocked.current) return;
    const valid = () => mounted.current && !blocked.current && current.current === key && sequence.current === generation;
    const retained = (previous: Resource<T>) => previous.key === key ? previous.data : null;
    if (isOffline) {
      setState(previous => ({ key, data: retained(previous), loading: false, error: 'offline', empty: false, emptyReason: null }));
      return;
    }
    const request = new AbortController(); controller.current = request;
    setState(previous => ({ key, data: retained(previous), loading: true, error: null, empty: false, emptyReason: null }));
    try {
      const payload = await fetchItem02(owner, path, request.signal);
      if (!valid()) return;
      const data = parse(payload);
      setState({ key, data, loading: false, error: null, empty: false, emptyReason: null });
    } catch (error) {
      if (!valid()) return;
      const reason = error instanceof Item02ReadError ? error.reason : 'read_failed';
      const empty = reason === 'snapshot_missing' || reason === 'not_released';
const clearData = empty
  || reason === 'entitlement_unavailable'
  || reason === 'authorization_unavailable'
  || reason === 'account_changed';

setState(previous => ({
  key,
  data: clearData ? null : retained(previous),
  loading: false,
  error: empty ? null : reason,
  empty,
  emptyReason: empty ? reason as EmptyReason : null,
}));
    }
  }, [owner, key, path, enabled, isOffline, parse]);
  useEffect(() => {
    mounted.current = true; blocked.current = false;
    if (!enabled) setState({ key, data: null, loading: false, error: null, empty: false, emptyReason: null });
    void refresh();
    const unsubscribe = subscribeOfflineSync(event => {
      if (event.userId !== owner) return;
      if (event.status === 'cleared') {
        blocked.current = true; ++sequence.current; controller.current?.abort();
        setState({ key, data: null, loading: false, error: null, empty: false, emptyReason: null });
      } else if (event.status === 'synced') void refresh();
    });
    let previous = AppState.currentState;
    const resume = AppState.addEventListener('change', next => {
      if (next === 'active' && previous !== 'active') void refresh();
      previous = next;
    });
    return () => { mounted.current = false; ++sequence.current; controller.current?.abort(); unsubscribe(); resume.remove(); };
  }, [key, enabled, owner, refresh]);
  return { ...(state.key === key && enabled ? state : { key, data: null, loading: enabled, error: null, empty: false, emptyReason: null }), refresh };
}
export function useWeeklyReport(owner: string | undefined, access: boolean | null, week?: string, enabled = true) {
  // Dashboard status is an invalidation signal, not permission to fetch. This
  // authenticated endpoint independently verifies access and projects Free/Pro.
  // Changing the signal clears the old projection and cancels its request.
  const result = useItem02Resource<SavedWeeklyReport>(owner,
    `/api/reports/weekly${week ? `?week=${encodeURIComponent(week)}` : ''}`, String(access), parseSavedReport, enabled && Boolean(owner));
  return { report: result.data, loading: result.loading, error: result.error,
    empty: result.empty, emptyReason: result.emptyReason, refresh: result.refresh };
}

/** Retains the previous report request's 15s bound. No automatic retries. */
export async function fetchItem02(owner: string, path: string, parentSignal: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  parentSignal.addEventListener('abort', cancel);
  if (parentSignal.aborted) cancel();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error || data.session?.user.id !== owner || controller.signal.aborted) throw new Item02ReadError('account_changed');
        const base = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/, '');
        const response = await fetch(`${base}${path}`, { signal: controller.signal,
          headers: { Authorization: `Bearer ${data.session.access_token}` } });
        if (response.status === 401 || response.status === 403) {
  throw new Item02ReadError('authorization_unavailable');
}
const payload = await response.json();
        if (controller.signal.aborted) throw new Item02ReadError('cancelled');
        if (!response.ok || payload?.state !== 'available') throw new Item02ReadError(
          typeof payload?.reason === 'string' ? payload.reason : 'read_failed');
        return payload;
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Item02ReadError('read_failed')); }, 15000); }),
    ]);
  } finally { clearTimeout(timer); parentSignal.removeEventListener('abort', cancel); }
}
