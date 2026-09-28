import { supabase } from './supabase';

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/, '');

export type ProInsightKind = 'score-history' | 'manual-activity-trends' | 'mood-correlation' | 'weekly-report' | 'monthly-report';

export async function fetchProInsight<T>(kind: ProInsightKind, params?: Record<string, string>): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error('Sign in required');
  const query = new URLSearchParams({ kind, ...params }).toString();
  const response = await fetch(`${WEB_URL}/api/pro/insights?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? 'Insight unavailable');
  return payload as unknown as T;
}
