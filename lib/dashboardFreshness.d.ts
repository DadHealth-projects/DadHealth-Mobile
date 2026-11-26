export const DASHBOARD_FRESHNESS_MS: number;
export const AUTOMATIC_RETRY_MS: number;
export function dashboardReadGeneration(userId: string): number;
export function recordCompleteDashboardRead(userId: string, day: string, at: number, generation: number): void;
export function markDashboardStale(userId: string | null | undefined): void;
export function clearDashboardFreshness(): void;
export function isDashboardFresh(input: {
  userId: string;
  day: string;
  now: number;
  entitlementKnown: boolean;
  hasError: boolean;
}): boolean;
export function recordDashboardAttempt(userId: string, day: string, at: number): void;
export function isAutomaticReloadThrottled(input: { userId: string; day: string; now: number }): boolean;
