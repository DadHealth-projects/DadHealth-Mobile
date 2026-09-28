import { supabase } from './supabase';

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/, '');

export type ProInsightKind = 'score-history' | 'manual-activity-trends' | 'mood-correlation' | 'weekly-report' | 'monthly-report';

export async function fetchProInsight<T>(kind: ProInsightKind, params?: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error('Insight request timed out'));
      controller.abort();
    }, 15000);
  });

  try {
    // Bound session recovery and response-body reads as well as the network request.
    return await Promise.race([loadInsight<T>(kind, params, controller.signal), deadline]);
  } finally {
    clearTimeout(timeout);
  }
}

async function loadInsight<T>(kind: ProInsightKind, params: Record<string, string> | undefined, signal: AbortSignal): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (signal.aborted) throw new Error('Insight request timed out');
  const token = data.session?.access_token;
  if (error || !token) throw new Error('Sign in required');
  const query = new URLSearchParams({ kind, ...params }).toString();
  const response = await fetch(`${WEB_URL}/api/pro/insights?${query}`, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? 'Insight unavailable');
  if (!payload || typeof payload !== 'object') throw new Error('Insight unavailable');
  return payload as unknown as T;
}
