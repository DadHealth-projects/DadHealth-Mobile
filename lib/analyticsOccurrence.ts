import type { AnalyticsScope } from './analyticsQueue';
// Synchronous request snapshot: no storage/network work on a business save path.
let owner: string | null = null;
let scopes: AnalyticsScope[] = [];
export function analyticsRequestOwner(value: string | null) { owner = value; }
export function analyticsRequestScopes(value: AnalyticsScope[]) { scopes = value.map(s => ({ ...s })); }
export function analyticsOccurrence(userId?: string): AnalyticsScope | null {
  if (process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'true' || !owner || (userId && owner !== userId)) return null;
  const scope = scopes.find(s => s.owner === owner && Date.parse(s.expiresAt ?? '') > Date.now());
  return scope ? { ...scope } : null;
}
export function occurrenceHeader(scope: AnalyticsScope | null | undefined): string {
  // Explicit none prevents offline replay from acquiring a newly granted scope.
  return scope ? JSON.stringify(scope) : 'none';
}
export const analyticsFetch: typeof fetch = (input, init) => {
  let options = init;

  try {
    const request = typeof input === 'object' && 'headers' in input
      ? input
      : undefined;

    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );

    const configured = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();

    if (
      configured &&
      url.origin === new URL(configured).origin &&
      url.pathname.startsWith('/rest/v1/') &&
      ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)
    ) {
      const headers = new Headers(request?.headers);

      new Headers(init?.headers).forEach((value, name) => {
        headers.set(name, value);
      });

      // Preserve the original offline snapshot, including explicit "none".
      if (!headers.has('x-dadhealth-analytics')) {
        headers.set(
          'x-dadhealth-analytics',
          occurrenceHeader(analyticsOccurrence()),
        );
      }

      options = { ...init, headers };
    }
  } catch {
    // Optional instrumentation must not prevent the original request.
  }

  return fetch(input, options);
};
