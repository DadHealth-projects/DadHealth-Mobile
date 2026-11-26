import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Scoring evidence 2026-11-26 (live functions, isolated harness): every workout_sessions row adds
// 8 "other source" Body points and the table has no idempotency key, so a retried save
// (lost response, or a failed completion after the session saved) must reuse the same row id.
const source = () => readFile(new URL('../components/fitness/ActiveWorkout.tsx', import.meta.url), 'utf8');

test('a logged session keeps one client id until the whole save succeeds', async () => {
  const ui = await source();
  assert.match(ui, /const pendingSession = useRef<\{ owner: string; id: string \} \| null>\(null\);/);
  assert.match(ui, /if \(pendingSession\.current\?\.owner !== userId\) pendingSession\.current = \{ owner: userId, id: Crypto\.randomUUID\(\) \};/,
    'a new id only for a new account or after success, never per tap');
  assert.match(ui, /\.from\('workout_sessions'\)\s*\.insert\(\{\s*id: sessionId,\s*user_id: userId,/);
  const handler = ui.slice(ui.indexOf('const handleLogSession'), ui.indexOf('return (', ui.indexOf('const handleLogSession')));
  assert.ok(handler.indexOf('pendingSession.current = null;') > handler.indexOf("setMessage('Your session was logged, but the workout could not be marked complete"),
    'the id is released only after the completion step, so a completion retry cannot create a second session');
  assert.equal((handler.match(/pendingSession\.current = null;/g) ?? []).length, 1, 'released in exactly one place: full success');
});

test('a duplicate-key answer counts as saved only after confirming our own row exists', async () => {
  const ui = await source();
  assert.match(ui, /if \(sessionResult\.error && !\(await workoutSessionAlreadySaved\(sessionResult\.error, sessionId, userId\)\)\) \{/);
  const helper = ui.slice(ui.indexOf('async function workoutSessionAlreadySaved'));
  assert.match(helper, /if \(error\.code !== '23505'\) return false;/, 'any other error stays an honest failure');
  assert.match(helper, /\.from\('workout_sessions'\)\.select\('id'\)\.eq\('id', id\)\.eq\('user_id', userId\)\.maybeSingle\(\);/, 'owner-scoped check');
  assert.match(helper, /return !existing\.error && Boolean\(existing\.data\);/);
});

test('the save button stays disabled while saving and the account-switch guard is kept', async () => {
  const ui = await source();
  assert.match(ui, /onPress=\{\(\) => void handleLogSession\(\)\}\s*disabled=\{saving\}/);
  assert.match(ui, /if \(currentOwner\.current !== userId\) return;\s*if \(sessionResult\.error/);
});
