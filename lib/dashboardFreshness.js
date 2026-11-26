// Focus/resume refreshes skip a full dashboard reload when the last complete
// online read is recent. Explicit refreshes (pull-to-refresh, after saves,
// check-ins, purchases and offline sync) never use this window, and any write
// elsewhere that can change dashboard data marks the account stale.
const DASHBOARD_FRESHNESS_MS = 60_000;
// After a failed, partial or unknown-access read, automatic (focus/resume) reloads
// wait this long after the previous attempt started. Explicit refreshes and writes
// are never delayed. Production evidence 2026-11-25: one device re-read the whole
// dashboard every 12 s for 18 minutes while each read timed out.
const AUTOMATIC_RETRY_MS = 15_000;
const lastCompleteReadByUser = new Map();
const lastAttemptByUser = new Map();
// Bumped by every stale mark so a read that started before a write cannot
// record itself as fresh when it finishes after that write.
const staleGenerationByUser = new Map();

exports.DASHBOARD_FRESHNESS_MS = DASHBOARD_FRESHNESS_MS;
exports.AUTOMATIC_RETRY_MS = AUTOMATIC_RETRY_MS;

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
  // A write is a real reason to re-read: never hold it back behind the retry backoff.
  lastAttemptByUser.delete(userId);
  staleGenerationByUser.set(userId, (staleGenerationByUser.get(userId) ?? 0) + 1);
};

exports.clearDashboardFreshness = function clearDashboardFreshness() {
  lastCompleteReadByUser.clear();
  staleGenerationByUser.clear();
  lastAttemptByUser.clear();
};

exports.isDashboardFresh = function isDashboardFresh({ userId, day, now, entitlementKnown, hasError }) {
  const lastRead = lastCompleteReadByUser.get(userId);
  if (!lastRead || lastRead.day !== day) return false;
  // Unknown access must be retried on focus/resume; errors must never be masked.
  if (!entitlementKnown || hasError) return false;
  const age = now - lastRead.at;
  return age >= 0 && age < DASHBOARD_FRESHNESS_MS;
};

exports.recordDashboardAttempt = function recordDashboardAttempt(userId, day, at) {
  if (userId) lastAttemptByUser.set(userId, { day, at });
};

/** True while an automatic reload must wait: same account day, previous attempt under AUTOMATIC_RETRY_MS ago. */
exports.isAutomaticReloadThrottled = function isAutomaticReloadThrottled({ userId, day, now }) {
  const attempt = lastAttemptByUser.get(userId);
  if (!attempt || attempt.day !== day) return false;
  const age = now - attempt.at;
  return age >= 0 && age < AUTOMATIC_RETRY_MS;
};
