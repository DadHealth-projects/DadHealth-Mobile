import assert from 'node:assert/strict';
import test from 'node:test';

import { PRO_FEATURE_ACCESS, canAccessFeature } from '../lib/proEntitlementAccess.js';

test('Free users can use free features and cannot use Pro features', () => {
  assert.equal(canAccessFeature('free_weekly_workout', false, false), true);
  assert.equal(canAccessFeature('mind_plan', false, false), false);
  assert.equal(canAccessFeature('ai_workout', false, false), false);
});

test('Pro users can use all configured features', () => {
  for (const [key, access] of Object.entries(PRO_FEATURE_ACCESS)) {
    assert.equal(canAccessFeature(key, true, false), true, `${key} (${access})`);
  }
});

test('active trial unlocks Pro features', () => {
  assert.equal(canAccessFeature('meal_planner', false, true), true);
  assert.equal(canAccessFeature('weekly_report', false, true), true);
});

test('unknown entitlement remains unknown for Pro features', () => {
  assert.equal(canAccessFeature('mind_plan', null, null), null);
  assert.equal(canAccessFeature('streak_freeze', null, null), null);
  assert.equal(canAccessFeature('free_weekly_workout', null, null), true);
});

test('feature configuration contains the approved shared feature keys', () => {
  assert.deepEqual(Object.keys(PRO_FEATURE_ACCESS), [
    'mind_plan',
    'ai_workout',
    'workout_library',
    'meal_planner',
    'score_insights',
    'trends',
    'weekly_report',
    'dad_days_unlimited',
    'streak_freeze',
    'full_tdee',
    'milestone_photos',
    'free_weekly_workout',
  ]);
});
