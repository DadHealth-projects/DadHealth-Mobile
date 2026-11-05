import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const { mergeDashboardRefreshState } = require('../lib/dashboardRefreshState.js');

test('saved Dad Days use owner-scoped AI-search rows while preserving dashboard Dad Dates', async () => {
  const dashboard = await read('hooks/useDashboard.ts');

  assert.match(dashboard, /\.select\('id,user_id,icon,name,booking_url,description,distance_miles,address,requires_booking,source,age_range,budget,time_of_day,duration_minutes', \{ count: 'exact' \}\)\s*\.eq\('user_id', userId\)\s*\.eq\('source', 'ai_search'\)/);
  assert.match(dashboard, /\.from\('dad_dates'\)[\s\S]*?\.eq\('source', 'admin'\)\s*\.is\('user_id', null\)/);
  assert.match(dashboard, /const dadDates = mapDadDateRows\(dadDatesResult\.error \? \[\] : dadDatesResult\.data\)[\s\S]*?\.filter\(\(activity\) => activity\.source === 'admin' && activity\.user_id === null\)/);
  assert.match(dashboard, /const savedDadActivities = mapDadDateRows\([\s\S]*?\.filter\(\(activity\) => activity\.user_id === userId && activity\.source === 'ai_search'\)/);
  for (const field of ['description', 'distance_miles', 'address', 'requires_booking', 'user_id']) {
    assert.match(dashboard, new RegExp(`${field}:`));
  }
});

test('saved cards reuse the search card components and omit unavailable old bookmark details', async () => {
  const screen = await read('screens/subscreens/DadDaysSearchScreen.tsx');

  assert.match(screen, /<FeaturedResult[\s\S]*?savedView[\s\S]*?onRemove=/);
  assert.match(screen, /<ResultRow[\s\S]*?savedView[\s\S]*?onRemove=/);
  assert.match(screen, /!savedView \|\| result\.description/);
  assert.match(screen, /savedView && result\.address/);
  assert.match(screen, /Number\.isFinite\(result\.distanceMiles\)/);
  assert.match(screen, /Remove from Saved/);
  assert.match(screen, /openResultWebsite\(activity\.booking_url\)/);
});

test('removal is locked per bookmark, scoped to its owner and source, and followed by shared refresh', async () => {
  const screen = await read('screens/subscreens/DadDaysSearchScreen.tsx');
  const start = screen.indexOf('const removeSavedActivity = useCallback');
  const end = screen.indexOf('\n  const locationLabel', start);
  const handler = screen.slice(start, end);

  assert.notEqual(start, -1);
  assert.match(handler, /removeInFlightIds\.current\.has\(activity\.id\)/);
  assert.match(handler, /\.eq\('id', activity\.id\)[\s\S]*?\.eq\('user_id', user\.id\)[\s\S]*?\.eq\('source', 'ai_search'\)/);
  assert.match(handler, /if \(deleteError \|\| !deleted\)[\s\S]*?setRemoveError/);
  assert.match(handler, /setRemovedActivityIds[\s\S]*?await refreshDashboard\(\)/);
  assert.match(screen, /showOfflineAction\('dad_days_remove'\)/);
});

test('dashboard refresh preserves confirmed saved rows when their next read fails', () => {
  const previous = {
    dadDates: [{ id: 'admin-1', source: 'admin' }],
    savedDadActivities: [{ id: 'saved-1', source: 'ai_search', user_id: 'user-1' }],
  };
  const next = { dadDates: [], savedDadActivities: [] };
  const merged = mergeDashboardRefreshState('user-1', 'user-1', previous, next, {
    dadDates: true,
    savedDadActivities: true,
  });

  assert.deepEqual(merged.dadDates, previous.dadDates);
  assert.deepEqual(merged.savedDadActivities, previous.savedDadActivities);
});

test('Today Bond suggestion only uses admin-owned rows and omits missing or placeholder times', async () => {
  const [dashboard, today] = await Promise.all([
    read('hooks/useDashboard.ts'),
    read('screens/DashboardScreen.tsx'),
  ]);

  assert.match(dashboard, /\.eq\('source', 'admin'\)\s*\.is\('user_id', null\)/);
  assert.match(dashboard, /time_of_day: textOrNull\(row\.time_of_day\)/);
  assert.match(today, /const officialDadDateSuggestion = data\?\.dadDates\?\.find\([\s\S]*?activity\.source === 'admin' && activity\.user_id === null/);
  assert.match(today, /const officialDadDateTimeLabel = officialDadDateTime && !\/\^any\\s\+time\$\/i\.test\(officialDadDateTime\)/);
  assert.match(today, /title: officialDadDateSuggestion\?\.name \?\? 'Bond suggestion'/);
  assert.match(today, /detail: officialDadDateTimeLabel \?\? 'Find one simple way to connect today\.'/);
  assert.doesNotMatch(today, /data\?\.dadDates\?\.\[0\]/);

  const chooseOfficial = (rows) => rows.find((row) => row.source === 'admin' && row.user_id === null);
  const visibleTime = (value) => value && !/^any\s+time$/i.test(value.trim()) ? value.trim() : null;
  const mixedRows = [
    { source: 'ai_search', user_id: 'user-1', name: 'Saved bookmark', time_of_day: 'Any time' },
    { source: 'admin', user_id: null, name: 'Official activity', time_of_day: 'Weekend morning' },
  ];

  assert.equal(chooseOfficial(mixedRows).name, 'Official activity');
  assert.equal(chooseOfficial([mixedRows[0]]), undefined);
  assert.equal(chooseOfficial([]), undefined);
  assert.equal(visibleTime(null), null);
  assert.equal(visibleTime('Any time'), null);
  assert.equal(visibleTime('Weekend morning'), 'Weekend morning');
});
