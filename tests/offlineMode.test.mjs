import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('offline foundation detects connectivity and runs a user-scoped foreground sync worker', async () => {
  const [app, network, manager, topBar, toast, pkg] = await Promise.all([
    source('App.js'),
    source('contexts/NetworkContext.tsx'),
    source('components/OfflineSyncManager.tsx'),
    source('components/AppTopBar.tsx'),
    source('components/GlobalConnectivityToast.tsx'),
    source('package.json'),
  ]);

  assert.ok(pkg.includes('@react-native-async-storage/async-storage'));
  assert.ok(pkg.includes('@react-native-community/netinfo'));
  assert.ok(app.includes('<NetworkProvider>'));
  assert.ok(app.includes('<OfflineSyncManager />'));
  assert.ok(app.includes('<GlobalConnectivityToast />'));
  assert.ok(network.includes('NetInfo.addEventListener'));
  assert.ok(network.includes('isInternetReachable === false'));
  assert.ok(network.includes("You're offline. Some features may be unavailable."));
  assert.ok(network.includes('Back online — syncing changes…'));
  assert.ok(network.includes('All caught up'));
  assert.ok(network.includes('setTimeout'));
  assert.ok(manager.includes('OFFLINE_NOTICE_DELAY_MS = 1500'));
  assert.ok(manager.includes('confirmedOffline.current'));
  assert.ok(manager.includes('offlineNoticeTimer.current = setTimeout'));
  assert.ok(manager.includes('await syncOfflineQueue(userId)'));
  assert.ok(manager.includes('remaining.length === 0'));
  assert.ok(manager.includes("state === 'active'"));
  assert.equal(topBar.includes('OfflineStatusNotice'), false);
  assert.ok(toast.includes('toast.message'));
  assert.ok(toast.includes('pointerEvents="none"'));
});

test('private caches and queued writes are namespaced and cleared before Supabase sign-out', async () => {
  const [storage, sync, auth] = await Promise.all([
    source('lib/offlineStorage.ts'),
    source('lib/offlineSync.ts'),
    source('contexts/AuthContext.tsx'),
  ]);

  assert.ok(storage.includes('private.${userId}.${name}'));
  for (const key of ["privateKey(userId, 'dashboard')", "privateKey(userId, 'journal')", "privateKey(userId, 'community')", "privateKey(userId, 'queue')"]) {
    assert.ok(storage.includes(key), `Missing private logout key: ${key}`);
  }
  assert.ok(storage.includes('if (pendingQueueOperation) await pendingQueueOperation'));
  assert.ok(storage.includes('if (pendingPrivateWrite) await pendingPrivateWrite'));
  assert.ok(storage.includes('blockedPrivateUsers.has(userId)'));
  assert.ok(sync.includes('activeUserId = null'));
  assert.ok(sync.includes('if (running) await running'));
  assert.ok(sync.includes('await clearPrivateOfflineData(userId)'));
  assert.ok(auth.indexOf('await pauseAndClearOfflineUser(signedOutUserId)') < auth.indexOf('await supabase.auth.signOut()'));
  assert.ok(auth.includes('pauseAndClearOfflineUser(previousUserId)'));
});

test('Home queues a deduplicated daily check-in and protects newer wearable sleep data', async () => {
  const [dashboard, screen, storage, sync] = await Promise.all([
    source('hooks/useDashboard.ts'),
    source('screens/DashboardScreen.tsx'),
    source('lib/offlineStorage.ts'),
    source('lib/offlineSync.ts'),
  ]);

  assert.ok(dashboard.includes("kind: 'daily_checkin'"));
  assert.ok(dashboard.includes('await enqueueOfflineWrite(item)'));
  assert.ok(dashboard.includes('await writeDashboardCache(userId, nextData)'));
  assert.ok(storage.includes('existing.payload.date === item.payload.date'));
  assert.ok(sync.includes("new Set(['garmin', 'fitbit', 'apple_health', 'health_connect'])"));
  assert.ok(sync.includes(".eq('source', 'manual')"));
  assert.ok(sync.includes('await recomputeStreak(item.userId)'));
  assert.ok(screen.includes("Saved — will sync when you're back online"));
});

test('new Journal entries queue with a client UUID while offline edits and deletes stay blocked', async () => {
  const [hook, screen, sync] = await Promise.all([
    source('hooks/useJournalEntries.ts'),
    source('screens/subscreens/JournalScreen.tsx'),
    source('lib/offlineSync.ts'),
  ]);

  assert.ok(hook.includes('Crypto.randomUUID()'));
  assert.ok(hook.includes("sync_status: 'pending'"));
  assert.ok(hook.includes('await enqueueOfflineWrite(item)'));
  assert.ok(hook.includes("throw new Error('offline_edit')"));
  assert.ok(hook.includes("throw new Error('offline_delete')"));
  assert.ok(sync.includes("result.error.code !== '23505'"));
  assert.equal(screen.includes('Reconnect to edit or delete this entry.'), false);
  assert.ok(screen.includes('disabled={!content.trim() || Boolean(editing && journal.isOffline)}'));
  assert.ok(screen.includes('Waiting to sync'));
  assert.equal(screen.includes('Saved on this device.'), false);
});

test('Community reads cached posts offline and never queues Community mutations', async () => {
  const [feed, storage, community, list, post, composer, thread] = await Promise.all([
    source('hooks/useCommunityFeed.ts'),
    source('lib/offlineStorage.ts'),
    source('screens/CommunityScreen.tsx'),
    source('screens/subscreens/CommunityFeedScreen.tsx'),
    source('components/community/InteractiveFeedPost.tsx'),
    source('screens/subscreens/CreateCommunityPostScreen.tsx'),
    source('screens/subscreens/CommunityPostThreadScreen.tsx'),
  ]);

  assert.ok(feed.includes('readCommunityCache<CommunityFeedPost>(userId)'));
  assert.ok(feed.includes('writeCommunityCache(userId'));
  assert.ok(storage.includes('likedIds: []'));
  assert.ok(storage.includes('savedIds: []'));
  assert.ok(storage.includes('anonymousOwnedIds: []'));
  assert.ok(storage.includes('{ ...post, user_id: null }'));
  assert.ok(feed.includes('cacheOwner.current !== nextOwner'));
  assert.equal(community.includes('OfflineUnavailableState'), false);
  assert.equal(list.includes('OfflineUnavailableState'), false);
  assert.equal(composer.includes('OfflineUnavailableState'), false);
  assert.equal(thread.includes('OfflineUnavailableState'), false);
  assert.ok(list.includes('feed.posts.map'));
  assert.ok(list.includes("showOfflineAction('community_post')"));
  assert.ok(list.includes("showOfflineAction('community_thread')"));
  assert.ok(list.includes("showOfflineAction('community_update')"));
  assert.equal(list.includes('mutationsDisabled={feed.isOffline}'), false);
  assert.equal(post.includes('mutationsDisabled'), false);
  assert.ok(composer.includes("showOfflineAction('community_post')"));
  assert.ok(thread.includes("showOfflineAction('community_post')"));
  assert.equal(storage.includes("kind: 'community"), false);
});

test('Dad Days remains visible and guards search only when invoked while breathing and Bond stay unchanged', async () => {
  const [dadDays, network, breathing, bond, storage] = await Promise.all([
    source('screens/subscreens/DadDaysSearchScreen.tsx'),
    source('contexts/NetworkContext.tsx'),
    source('screens/subscreens/BreathingSessionScreen.tsx'),
    source('screens/BondScreen.tsx'),
    source('lib/offlineStorage.ts'),
  ]);

  assert.equal(dadDays.includes('OfflineUnavailableState'), false);
  assert.ok(dadDays.includes("showOfflineAction('dad_days_search')"));
  assert.ok(network.includes('Dad Days search needs an internet connection. Reconnect and try again.'));
  assert.equal(breathing.includes('useNetworkStatus'), false);
  assert.equal(bond.includes('offline_check'), false);
  assert.equal(storage.includes('bond_check'), false);
});

test('feature errors remain inline and stale feature failures are hidden while offline', async () => {
  const [reporter, screenNotice, topBar, fitness, therapist, aiWorkout] = await Promise.all([
    source('components/GlobalErrorToastReporter.tsx'),
    source('components/ScreenErrorNotice.tsx'),
    source('components/AppTopBar.tsx'),
    source('screens/FitnessScreen.tsx'),
    source('screens/subscreens/TherapistDirectoryScreen.tsx'),
    source('screens/subscreens/AIWorkoutScreen.tsx'),
  ]);

  assert.ok(reporter.includes('<InlineFormError message={isOffline ? null : message} />'));
  assert.ok(screenNotice.includes('<InlineFormError message={isOffline ? null : message} />'));
  assert.equal(topBar.includes('text-red'), false);
  assert.ok(fitness.includes('<GlobalErrorToastReporter message={fitnessLibrary.error} />'));
  assert.equal(fitness.includes('text-red'), false);
  assert.ok(therapist.includes('<ScreenErrorNotice message={bookingError ?? directory.error} />'));
  assert.equal(therapist.includes('text-red'), false);
  assert.equal(aiWorkout.includes('GlobalErrorToastReporter'), false);
  assert.ok(aiWorkout.includes('<InlineFormError message={isOffline ? null : error ?? library.error ?? library.proError} />'));
  assert.ok(aiWorkout.includes("showOfflineAction('ai_workout')"));
});

test('feature screens keep their normal layout without offline retry screens or banners', async () => {
  const paths = [
    'screens/CommunityScreen.tsx',
    'screens/BondScreen.tsx',
    'screens/subscreens/CommunityFeedScreen.tsx',
    'screens/subscreens/CommunityPostThreadScreen.tsx',
    'screens/subscreens/CookTogetherScreen.tsx',
    'screens/subscreens/JournalScreen.tsx',
    'screens/subscreens/MilestoneTrackerScreen.tsx',
    'screens/subscreens/NotificationSettingsScreen.tsx',
    'screens/subscreens/SharedCalendarScreen.tsx',
    'screens/subscreens/WeeklyChallengeScreen.tsx',
  ];
  const files = await Promise.all(paths.map(source));

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    assert.equal(/label=["'](?:Try again|Retry[^"']*)["']/i.test(file), false, `Retry control remains in ${paths[index]}`);
    assert.equal(file.includes('OfflineUnavailableState'), false, `Offline replacement state remains in ${paths[index]}`);
  }

  assert.equal(files[0].includes('circleError ? ('), false);
  assert.equal(files[0].includes('liveSessionsError ?'), false);
  assert.equal(files[0].includes('trendingError ?'), false);
  assert.equal(files[3].includes('error && !post ?'), false);
  assert.equal(files[4].includes('if (recipeData.error)'), false);
  assert.equal(files[5].includes('journal.error ? ('), false);
  assert.equal(files[9].includes('if (error)'), false);
});

test('Weekly Challenge restores cached display state offline and guards server mutations', async () => {
  const [screen, network, manager] = await Promise.all([
    source('screens/subscreens/WeeklyChallengeScreen.tsx'),
    source('contexts/NetworkContext.tsx'),
    source('components/OfflineSyncManager.tsx'),
  ]);

  assert.ok(screen.includes('readDashboardCache<DashboardData>(user.id)'));
  assert.ok(screen.includes('dadhealth.weekly-challenge.participation.'));
  assert.ok(screen.includes('if (isOffline)'));
  assert.ok(screen.includes("showOfflineAction('weekly_challenge')"));
  assert.equal(screen.includes("'unavailable'"), false);
  assert.equal(screen.includes('loadError && !challenge'), false);
  assert.ok(network.includes('weekly_challenge'));
  assert.ok(manager.includes('if (!userId || !isKnown || isOffline) return;'));
});

test('cached data renders before background refresh and dashboard requests stay deduplicated', async () => {
  const [dashboard, community, journal] = await Promise.all([
    source('hooks/useDashboard.ts'),
    source('hooks/useCommunityFeed.ts'),
    source('hooks/useJournalEntries.ts'),
  ]);

  assert.ok(dashboard.includes('const inFlightByUser = new Map<string, Promise<void>>()'));
  assert.ok(dashboard.includes('const existingRequest = inFlightByUser.get(userId)'));
  assert.ok(dashboard.includes('if (existingRequest) return existingRequest'));
  assert.ok(dashboard.indexOf('await hydrateDashboardCache(userId, false)') < dashboard.indexOf('await runFetch(userId)'));
  assert.ok(community.includes('if (!silent) setLoading(false)'));
  assert.ok(journal.includes('cached = await loadCached();\n      setLoading(false);'));
});

test('network-backed feature loaders stop waiting immediately in airplane mode', async () => {
  const paths = [
    'hooks/useFitnessSummary.ts',
    'hooks/useFitnessLibrary.ts',
    'hooks/useTherapists.ts',
    'hooks/useCookTogetherRecipes.ts',
    'hooks/useDadScoreHistory.ts',
    'hooks/useProgressReport.ts',
    'hooks/useProgressBadges.ts',
    'hooks/useProgressSleep.ts',
    'hooks/useNotificationSettings.ts',
    'hooks/usePublicHome.ts',
    'hooks/usePresentDadMode.ts',
    'screens/subscreens/MilestoneTrackerScreen.tsx',
    'screens/subscreens/SharedCalendarScreen.tsx',
  ];
  const files = await Promise.all(paths.map(source));

  for (let index = 0; index < files.length; index += 1) {
    assert.ok(files[index].includes('isOffline'), `Missing offline fast path in ${paths[index]}`);
  }
});
