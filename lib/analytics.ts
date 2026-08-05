import * as Crypto from 'expo-crypto';

const anonymousId = `mobile-${Crypto.randomUUID()}`;

export function trackEvent(event: string, properties: Record<string, unknown> = {}, userId?: string) {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;
  const host = (process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com').replace(/\/$/, '');
  void fetch(`${host}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, event, properties: { distinct_id: userId ?? anonymousId, ...properties } }),
  }).catch(() => {});
}
