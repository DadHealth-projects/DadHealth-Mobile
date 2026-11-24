// Focus/resume refreshes skip a full dashboard reload when the last complete
// online read is recent. Explicit refreshes (pull-to-refresh, after saves,
// check-ins, purchases and offline sync) never use this window, and any write
// elsewhere that can change dashboard data marks the account stale.
const DASHBOARD_FRESHNESS_MS = 60_000;
const lastCompleteReadByUser = new Map();
// Bumped by every stale mark so a read that started before a write cannot
// record itself as fresh when it finishes after that write.
const staleGenerationByUser = new Map();

exports.DASHBOARD_FRESHNESS_MS = DASHBOARD_FRESHNESS_MS;

exports.dashboardReadGeneration = function dashboardReadGeneration(userId) {
  return staleGenerationByUser.get(userId) ?? 0;
};

exports.recordCompleteDashboardRead = function recordCompleteDashboardRead(userId, day, at, generation) {
  if ((staleGenerationByUser.get(userId) ?? 0) !== generation) return;
  lastCompleteReadByUser.set(userId, { day, at });
};

exports.markDashboardStale = function markDashboardStale(userId) {
  if (!userId) return;
  lastCompleteReadByUser.delete(userId);
  staleGenerationByUser.set(userId, (staleGenerationByUser.get(userId) ?? 0) + 1);
};

exports.clearDashboardFreshness = function clearDashboardFreshness() {
  lastCompleteReadByUser.clear();
  staleGenerationByUser.clear();
};

exports.isDashboardFresh = function isDashboardFresh({ userId, day, now, entitlementKnown, hasError }) {
  const lastRead = lastCompleteReadByUser.get(userId);
  if (!lastRead || lastRead.day !== day) return false;
  // Unknown access must be retried on focus/resume; errors must never be masked.
  if (!entitlementKnown || hasError) return false;
  const age = now - lastRead.at;
  return age >= 0 && age < DASHBOARD_FRESHNESS_MS;
};
