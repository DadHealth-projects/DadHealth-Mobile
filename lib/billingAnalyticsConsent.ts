import { supabase } from './supabase';
import { uuid } from './analyticsContract';

export type BillingAnalyticsChoice = { owner: string; granted: boolean; revision: number; operationId: string | null; grantedAt: string | null };
export type BillingAnalyticsChange = { granted: boolean; revision: number; operationId: string };
export function parseBillingChoice(value: unknown, owner: string): BillingAnalyticsChoice {
  const v = value as BillingAnalyticsChoice | null;
  if (!v || v.owner !== owner || typeof v.granted !== 'boolean' || !Number.isSafeInteger(v.revision) || v.revision < 0
    || !(v.operationId === null || uuid(v.operationId))
    || !(v.grantedAt === null || typeof v.grantedAt === 'string' && Number.isFinite(Date.parse(v.grantedAt)))
    || (v.granted && v.grantedAt === null)) throw new Error('Choice unavailable');
  return v;
}
export async function requestBillingChoice(owner: string, signal: AbortSignal, change?: BillingAnalyticsChange) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel);
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, 10_000);
  let rejectStopped: (error: Error) => void = () => undefined;
  const stopped = new Promise<never>((_resolve, reject) => { rejectStopped = reject; });
  const stop = () => rejectStopped(new Error('Choice unavailable'));
  controller.signal.addEventListener('abort', stop);
  try {
    if (controller.signal.aborted) throw new Error('Session changed');
    const { data, error } = await Promise.race([supabase.auth.getSession(), stopped]);
    if (error || data.session?.user.id !== owner || controller.signal.aborted) throw new Error('Session changed');
    const base = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/, '');
    const response = await fetch(`${base}/api/analytics/billing-consent`, {
      method: change ? 'POST' : 'GET', signal: controller.signal,
      headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      ...(change ? { body: JSON.stringify(change) } : {}),
    });
    if (!response.ok || controller.signal.aborted) throw new Error('Choice unavailable');
    return parseBillingChoice(await response.json(), owner);
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', stop);
    signal.removeEventListener('abort', cancel);
  }
}
