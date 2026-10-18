export type DashboardReadFailures = {
  mood?: boolean;
  streak?: boolean;
  entitlement?: boolean;
  score?: boolean;
};

export function mergeDashboardRefreshState<T>(
  userId: string,
  previousUserId: string | null,
  previous: T | null,
  next: T,
  failedReads: DashboardReadFailures,
): T;
