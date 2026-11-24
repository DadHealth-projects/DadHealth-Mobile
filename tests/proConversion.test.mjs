import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('the shared contract defines exactly seven upgrade moments', async () => {
  const moments = await source('lib/proMoments.ts');

  const block = /export const PRO_MOMENTS[^=]*= \{([\s\S]*?)\n\};/.exec(moments)?.[1] ?? '';
  assert.ok(block.length > 0, 'PRO_MOMENTS block not found');
  assert.equal((block.match(/\n {4}cta: /g) ?? []).length, 7);

  for (const id of ['score', 'checkIn', 'aiWorkout', 'dadDays', 'weeklyReport', 'progressTrends', 'dadDaysCounter']) {
    assert.ok(new RegExp(`\\n  ${id}: \\{`).test(block), `Missing upgrade moment: ${id}`);
  }
});

test('each upgrade moment preserves its approved wording', async () => {
  const moments = await source('lib/proMoments.ts');

  const copy = [
    'Pro members get personalised insights, weekly trends and recommendations.',
    'Get a personalised plan based on your mood, activity and Dad Health Score.',
    "We'll build your workout around you.",
    "Child's age · Budget · Time available · Distance · What they enjoy",
    'Your week in Dad Health',
    'Get unlimited personalised Dad Days searches.',
  ];
  for (const line of copy) {
    assert.ok(moments.includes(line), `Missing approved copy: ${line}`);
  }
  assert.ok(moments.includes("cta: 'Unlock my insights'"));
  assert.ok(moments.includes("cta: 'Unlock AI workouts'"));
  assert.ok(moments.includes("cta: 'Personalise my Dad Days'"));
  assert.ok(moments.includes("cta: 'View your trends'"));
  assert.ok(moments.includes("cta: 'Upgrade to Pro'"));
});

test('approved conversion entry points use the existing Pro prompt', async () => {
  const [dashboard, checkIn, weekly, aiWorkout, dadDays, scoreDetails, manager] = await Promise.all([
    source('screens/DashboardScreen.tsx'),
    source('components/dashboard/CheckInFollowUp.tsx'),
    source('components/dashboard/WeeklyReportCard.tsx'),
    source('screens/subscreens/AIWorkoutScreen.tsx'),
    source('screens/subscreens/DadDaysSearchScreen.tsx'),
    source('components/dashboard/ScoreDetailSheet.tsx'),
    source('contexts/UpgradeMomentContext.tsx'),
  ]);

  assert.match(dashboard, /requestMoment\(\{[\s\S]*?id: 'checkIn'/);
  // Since f734767 the weekly report upgrade opens the Pro screen directly after the sheet closes.
  assert.ok(dashboard.includes("openPro('weeklyReport', 'Your weekly report', 'lock', 'weekly_report')"));
  assert.ok(checkIn.includes('onPress={onPlan}'));
  // Since f6205a2 only confirmed Free access (false) hears the Pro wording; unknown access stays neutral.
  assert.ok(checkIn.includes("accessibilityLabel={planAccess === false ? 'Build my plan with Dad Health Pro' : 'Build my plan'}"));
  // Since 263ebc7 the weekly report entry is the dashboard's openPro('weeklyReport', ...) asserted above,
  // reached from inside the opened report; the Today card itself carries no Pro moment.
  assert.equal(weekly.includes('PRO_MOMENTS'), false);
  // The AI Workout entry renders the shared Pro moment rather than a local id.
  assert.ok(aiWorkout.includes('moment={PRO_MOMENTS.aiWorkout}'));
  assert.ok(dadDays.includes("id: 'dadDaysCounter'"));
  assert.ok(manager.includes('PRO_MOMENTS[active.id]'));
  assert.ok(scoreDetails.includes('PRO_MOMENTS.score'));
});

test('Moment 2 keeps free recommendation and Build My Plan Pro row', async () => {
  const [advice, followUp, dashboard] = await Promise.all([
    source('lib/checkInRecommendation.js'),
    source('components/dashboard/CheckInFollowUp.tsx'),
    source('screens/DashboardScreen.tsx'),
  ]);

  assert.ok(advice.includes("\"You're feeling stressed today.\""));
  assert.ok(advice.includes('stressLevel >= 4'));
  assert.ok(followUp.indexOf('advice.primary.recommendation') < followUp.indexOf('Build my plan'));
  // Button styling was aligned with the check-in actions in 228c1c9.
  assert.ok(followUp.includes('rounded-button bg-lime py-md items-center'));
  assert.ok(followUp.includes('min-h-[60px] flex-row items-center justify-between'));
  assert.ok(followUp.indexOf('onAction(action.action)') < followUp.indexOf('onPlan'));
  assert.ok(followUp.includes("planAccess === false ? 'Build my plan with Dad Health Pro' : 'Build my plan'"));
  assert.ok(followUp.includes('planAccess === false ? <ProBadge /> : null'));
  // Subtitle copy changed in fa529f1.
  assert.ok(followUp.includes("' · A seven-day plan shaped around your goals.'"));
  assert.ok(dashboard.includes('<CheckInFollowUp'));
  assert.ok(dashboard.includes('planAccess={buildMyPlanAccess}'));
  assert.match(dashboard, /id: 'checkIn'/);
  // f734767 derives checkedInToday (null while unknown) before rendering the follow-up.
  assert.ok(dashboard.includes('{checkedInToday ? ('));
});

test('Moment 7 counts searches used', async () => {
  const dadDays = await source('screens/subscreens/DadDaysSearchScreen.tsx');

  assert.ok(dadDays.includes('free Dad Days searches used this month.'));
  assert.equal(dadDays.includes('free searches remaining'), false);
  assert.ok(dadDays.includes('FREE_LIMIT = 3'));
});

test('Dad Days has no second-search teaser and retains the exhausted-quota modal', async () => {
  const dadDays = await source('screens/subscreens/DadDaysSearchScreen.tsx');

  assert.equal(dadDays.includes("searchesUsed === FREE_LIMIT - 1"), false);
  assert.equal(dadDays.includes('moment={PRO_MOMENTS.dadDays}'), false);
  assert.equal(dadDays.includes('<ProUpgradeSection'), false);
  assert.equal(dadDays.includes("id: 'dadDays'"), false);
  assert.ok(dadDays.includes("if (limitReached) {"));
  assert.ok(dadDays.includes("id: 'dadDaysCounter'"));
  assert.ok(dadDays.includes('const FREE_LIMIT = 3;'));
  // The response is parsed into a typed DadDaysRequestError (dc4a932); the screen checks its code.
  assert.ok(dadDays.includes("error instanceof DadDaysRequestError && error.status === 403 && error.code === 'search_limit_reached'"));
});

test('Moment 5 follows Body progress context and keeps the canonical score row free', async () => {
  const [body, row] = await Promise.all([
    source('screens/FitnessScreen.tsx'),
    source('components/dashboard/PillarScoreRow.tsx'),
  ]);

  const bodyScoreStart = body.indexOf('<PillarScoreRow');
  const bodyScoreEnd = body.indexOf('/>', bodyScoreStart) + 2;
  const bodyScoreRow = body.slice(bodyScoreStart, bodyScoreEnd);
  assert.ok(bodyScoreRow.includes('pillar="Body"'));
  assert.ok(bodyScoreRow.includes('score={data?.bodyScore ?? null}'));
  assert.ok(bodyScoreRow.includes('trend={data?.bodyWeekChange ?? null}'));
  assert.ok(bodyScoreRow.includes('scoreUnavailable={Boolean(data?.scoreError)}'));
  assert.ok(bodyScoreRow.includes('baselineBuilding={Boolean(data && !data.scoreError && !data.baselineAvailable)}'));
  assert.ok(body.indexOf('<StatCard value={stats[3].value}') < body.indexOf('moment={PRO_MOMENTS.progressTrends}'));
  assert.ok(body.includes('fitnessSummary.monthWorkouts > 0'));
  assert.ok(body.includes('trendsAccess === false'));
  assert.equal(body.includes('<GlobalErrorToastReporter message={fitnessLibrary.proError} />'), false);
  assert.ok(body.includes('Want to see how your Body score has changed?'));
  assert.ok(body.includes("navigateToProSubscription(navigation, 'progressTrends'"));
  // The row shows the rounded server score; a missing score is never shown as 0%.
  assert.ok(row.includes('Math.round(score)'));
  assert.ok(row.includes('{`${value}%`}'));
  assert.equal(row.includes('score ?? 0'), false);
  assert.ok(row.includes('formattedTrend.arrow'));
});

test('Moment 6 uses canonical positive score-point movement and labels it in points', async () => {
  const details = await source('components/dashboard/ScoreDetailSheet.tsx');
  const moments = await source('lib/proMoments.ts');

  assert.ok(details.includes('.filter((item) => item.value !== null && item.trend != null && item.trend > 0)'));
  assert.ok(details.includes('proScoreTease([scoreContextItem.label, scoreContextItem.trend] as const)'));
  assert.ok(moments.includes('by ${rounded} pts this week.'));
  assert.ok(moments.includes('score-point improvement'));
  assert.ok(details.includes('scoreContextItem.label'));
  assert.ok(details.includes("See what's driving your score →"));
  assert.ok(details.includes(': PRO_MOMENTS.score.cta'));
  assert.ok(details.includes('onPress={onUpgrade}'));
  assert.ok(details.includes('history = useDadScoreHistory(isPro ? sheetUserId : undefined)'));
  assert.ok(details.includes('<LockedPreview title="Your monthly report" onUpgrade={onUpgrade} />'));
  assert.equal(moments.includes('score by ${rounded}% this week.'), false);
});

test('AI workout uses the single screen and requires confirmed Pro or Trial access', async () => {
  const [screen, navigator] = await Promise.all([
    source('screens/subscreens/AIWorkoutScreen.tsx'),
    source('navigation/AppNavigator.tsx'),
  ]);

  assert.ok(screen.includes("entitlement.can('ai_workout')"));
  assert.ok(screen.includes('if (aiWorkoutAccess !== true) return'));
  assert.ok(screen.includes('ProUpgradeSection'));
  assert.equal(screen.includes('free_limit_reached'), false);
  assert.equal(screen.includes('PersonalisedAIWorkout'), false);
  assert.equal(navigator.includes('name="PersonalisedAIWorkout"'), false);
});

test('the weekly Sunday report is a Pro feature and never invents a week', async () => {
  const [report, card, dashboard, sheet] = await Promise.all([
    source('lib/weeklyReport.ts'),
    source('components/dashboard/WeeklyReportCard.tsx'),
    source('screens/DashboardScreen.tsx'),
    source('components/dashboard/WeeklyReportSheet.tsx'),
  ]);

  // Since 440bb4e the app reads the server's saved report and validates its 7-day week; it never builds one.
  assert.ok(report.includes('!isReportWeek(period.weekStart) || !isReportWeek(period.weekEndExclusive)'));
  assert.ok(report.includes('Date.parse(period.weekEndExclusive) - Date.parse(period.weekStart) !== 7 * 86400000'));
  assert.ok(report.includes('Your scores are here. Week-on-week trends will appear when previous-week data is available.'));
  assert.ok(report.includes('score: Math.round(source.mindScore ?? 0)'));
  assert.ok(report.includes('const trend = formatScoreTrend(change);'));
  assert.ok(report.includes('ACTION_FOCUS[source.recommendedAction]'));
  // Since 263ebc7 the Today card is one entry for everyone (brief 02: Free teaser, Pro details).
  // It shows only the saved week's dates; Free/Pro detail is decided by the saved report's access.
  assert.ok(card.includes('reportDates(report.weekStart, report.weekEndExclusive)'));
  assert.equal(card.includes('buildWeeklyReport'), false);
  assert.equal(card.includes('<ProLockedPreview'), false);
  assert.ok(sheet.includes("const detail = report?.access === 'pro' ? report.details : undefined;"));
  assert.ok(sheet.includes("report.access === 'free' ? <>"));
  assert.ok(sheet.includes('onPress={onUpgrade}'));
  assert.ok(dashboard.includes('if (isReportWeek(openWeeklyReport))'), 'deep links open only a valid saved week');
  assert.ok(dashboard.includes("openPro('weeklyReport'"));
  assert.ok(dashboard.includes('<WeeklyReportCard'));
});

test('conversion moments stay compact until the user asks for Pro', async () => {
  const [prompt, dashboard, aiWorkout, dadDays, weekly, scoreDetails] = await Promise.all([
    source('components/ProPromptModal.tsx'),
    source('screens/DashboardScreen.tsx'),
    source('screens/subscreens/AIWorkoutScreen.tsx'),
    source('screens/subscreens/DadDaysSearchScreen.tsx'),
    source('components/dashboard/WeeklyReportCard.tsx'),
    source('components/dashboard/ScoreDetailSheet.tsx'),
  ]);

  assert.ok(prompt.includes('Not now'));
  assert.ok(prompt.includes('onRequestClose={onDismiss}'));
  assert.ok(prompt.includes('onPress={onDismiss}'));
  assert.ok(dashboard.includes('proTease="Your insights"'));
  assert.ok(dashboard.includes('proTeaseLocked={scoreInsightsAccess === false}'));
  // The 403 parsing moved to lib/aiWorkout.ts; the screen reacts to the typed error code.
  assert.ok(aiWorkout.includes("cause.code === 'pro_required'"));
  assert.equal(aiWorkout.includes('free_limit_reached'), false);
  assert.ok(dadDays.includes('free Dad Days searches used this month.'));
  assert.ok(dadDays.includes("id: 'dadDaysCounter'"));
  assert.equal(dadDays.includes('<ProUpgradeSection'), false);
  // Since 263ebc7 the Today report card never sells Pro itself; Free sees the upgrade only inside the opened report.
  assert.equal(weekly.includes('onUpgrade'), false);
  assert.ok(scoreDetails.includes('See your score history'));
  assert.ok(scoreDetails.includes('Your monthly report'));
  assert.ok(scoreDetails.includes('onUpgrade={onUpgrade}'));
});

test('streak protection keeps its approved presentation and uses server-owned state', async () => {
  const [sync, card] = await Promise.all([
    source('lib/offlineSync.ts'),
    source('components/dashboard/StreakCard.tsx'),
  ]);

  assert.doesNotMatch(sync, /countStreakDays/);
  assert.doesNotMatch(sync, /from\('user_streaks'\)[\s\S]{0,180}\.upsert/);
  assert.ok(card.includes('Streak protected'));
  assert.ok(card.includes('Freeze your streak once a week'));
  assert.ok(card.includes('freezeAccess === false && onUpgrade'));
  assert.ok(card.includes('<ProBadge />'));
});

test('Today Build My Plan and streak rows share one lock Pro badge', async () => {
  const [plan, streak, badge] = await Promise.all([
    source('components/dashboard/CheckInFollowUp.tsx'),
    source('components/dashboard/StreakCard.tsx'),
    source('components/dashboard/ProBadge.tsx'),
  ]);
  assert.ok(plan.includes("import ProBadge from './ProBadge'"));
  assert.ok(streak.includes("import ProBadge from './ProBadge'"));
  assert.ok(badge.includes('name="lock"'));
  assert.ok(badge.includes("accessibilityLabel={isTrial ? 'Pro trial access' : 'Pro feature'}"));
  assert.ok(badge.includes("isTrial ? 'Trial' : 'Pro'"));
  // Dotted borders were removed in the divider-led redesign (fa529f1, e7c454b); the shared badge
  // still appears only when access is confirmed false, never while it is unknown.
  assert.ok(plan.includes('{planAccess === false ? <ProBadge /> : null}'));
  assert.ok(streak.includes('freezeAccess === false && onUpgrade ? ('));
});

test('Share Report remains available to Free without including Pro monthly report details', async () => {
  const [sheet, sharing] = await Promise.all([
    source('components/dashboard/ScoreDetailSheet.tsx'),
    source('lib/reportSharing.ts'),
  ]);
  assert.match(sheet, /<Text[^>]*>Share report<\/Text>/);
  assert.doesNotMatch(sheet, /\{isPro \? <View>[\s\S]*?Share report/);
  assert.match(sheet, /isPro \? report\.report : null/);
  assert.match(sharing, /report\?: ProgressReport \| null/);
  assert.match(sharing, /\.\.\.\(report \?/);
});

test('the free and Pro split matches the access contract', async () => {
  const [therapist, milestones, tdee, planner, scoreDetails, mind, dashboard] = await Promise.all([
    source('screens/subscreens/TherapistDirectoryScreen.tsx'),
    source('screens/subscreens/MilestoneTrackerScreen.tsx'),
    source('screens/subscreens/TDEECalculatorScreen.tsx'),
    source('screens/subscreens/MealPlannerScreen.tsx'),
    source('components/dashboard/ScoreDetailSheet.tsx'),
    source('screens/MindScreen.tsx'),
    source('screens/DashboardScreen.tsx'),
  ]);

  // Mind free column: therapist directory is not behind Pro.
  assert.equal(therapist.includes('directory.isPro'), false);

  // Bond free column: milestone logging is free, photos are the Pro layer.
  assert.ok(milestones.includes("<LimeButton label={editingId ? 'Update milestone' : 'Save milestone'}"));
  assert.ok(milestones.includes('PRO_LOCKS.milestonePhotos'));
  assert.ok(milestones.includes('{effectiveIsPro ? <Pressable onPress={() => void pickPhoto(milestone.id)}'));

  // Pro columns, each behind a visible preview.
  assert.ok(tdee.includes('PRO_LOCKS.fullTdee'));
  assert.ok(tdee.includes("entitlement.can('full_tdee')"));
  assert.ok(planner.includes('PRO_LOCKS.mealPlanner'));
  assert.ok(scoreDetails.includes('{reportStats.map(([value, label])'));
  assert.ok(scoreDetails.includes('!isPro && entitlementKnown ?'));
  assert.ok(scoreDetails.includes('badgeData.earnedCount === 0'));
  assert.ok(mind.includes('<MindPlanLockedCard'));
  assert.ok(mind.includes('planAccess === false'));
  assert.match(mind, /planAccess = .*state === 'locked' \? false/);
  assert.ok(mind.includes("actionLabel={trendsAccess === false ? 'View mood trends' : undefined}"));
  assert.equal(dashboard.includes('PRO_LOCKS.moodTrends'), false);
});

test('locks show a preview and never lead with the lock icon', async () => {
  const [section, preview, moments] = await Promise.all([
    source('components/ProUpgradeSection.tsx'),
    source('components/ProLockedPreview.tsx'),
    source('lib/proMoments.ts'),
  ]);

  // "Do not make the lock icon the first thing on any screen."
  assert.ok(section.indexOf('{moment.eyebrow}') < section.indexOf('name="lock"'));
  assert.ok(preview.indexOf('{children}') < preview.indexOf('name="lock"'));
  // "Never block a feature without showing a preview of what is behind the lock."
  assert.ok(preview.includes('{children}'));
  assert.ok(preview.includes('pointerEvents="none"'));
  // "Do not show 🚨 UPGRADE TO PRO on every screen."
  assert.equal(moments.includes('🚨'), false);
  assert.equal(moments.includes('UPGRADE TO PRO'), false);
});

test('the paywall is the only place Pro is sold', async () => {
  const [navigator, paywall] = await Promise.all([
    source('navigation/AppNavigator.tsx'),
    source('screens/subscreens/ProSubscriptionScreen.tsx'),
  ]);

  // No paywall on first open: it is a pushed screen, never the initial route.
  assert.ok(navigator.includes("initialRouteName = 'Tabs'"));
  // Headline copy was updated with the Pro membership screen in 3dbaf93.
  assert.ok(paywall.includes("title={'Unlock the\\nfull experience'}"));
  assert.ok(paywall.indexOf('title="Annual"') < paywall.indexOf('title="Monthly"'));
  assert.ok(paywall.includes('Start my 7-day free trial'));
  assert.ok(paywall.includes('Go further with personalised plans, advanced tools and more.'));
});
