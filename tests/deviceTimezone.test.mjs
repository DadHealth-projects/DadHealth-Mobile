import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(read('lib/deviceTimezone.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports, Intl, require: (name) => { assert.equal(name, './supabase'); return { supabase: {} }; },
});
const { syncProfileTimezone, currentDeviceTimezone } = exports;

function client(profile, { readError = null, updateError = null } = {}) {
  const updates = [];
  return {
    updates,
    from(table) {
      assert.equal(table, 'user_profile');
      return {
        select: () => ({ eq: (_c, id) => ({ maybeSingle: async () => ({ data: profile && { ...profile, id }, error: readError }) }) }),
        update: (values) => ({ eq: async (column, id) => { updates.push({ values, column, id }); return { error: updateError }; } }),
      };
    },
  };
}

test('writes the phone timezone only when the account differs', async () => {
  const stale = client({ timezone: 'Europe/London' });
  assert.equal(await syncProfileTimezone('user-a', 'America/New_York', stale), 'updated');
  assert.deepEqual(JSON.parse(JSON.stringify(stale.updates)), [{ values: { timezone: 'America/New_York' }, column: 'user_id', id: 'user-a' }]);

  const same = client({ timezone: 'Europe/London' });
  assert.equal(await syncProfileTimezone('user-a', 'Europe/London', same), 'unchanged');
  assert.equal(same.updates.length, 0);
});

test('never writes without a user, a device zone or a profile, and reports failures', async () => {
  const c = client({ timezone: 'UTC' });
  assert.equal(await syncProfileTimezone('', 'Europe/London', c), 'skipped');
  assert.equal(await syncProfileTimezone('user-a', null, c), 'skipped');
  assert.equal(await syncProfileTimezone('user-a', 'Europe/London', client(null)), 'skipped');
  assert.equal(await syncProfileTimezone('user-a', 'Europe/London', client(null, { readError: { message: 'x' } })), 'failed');
  assert.equal(await syncProfileTimezone('user-a', 'Asia/Karachi', client({ timezone: 'UTC' }, { updateError: { code: '22023' } })), 'failed');
  assert.equal(c.updates.length, 0);
});

test('device timezone comes from the platform IANA zone', () => {
  assert.equal(currentDeviceTimezone(), Intl.DateTimeFormat().resolvedOptions().timeZone);
});

test('the manager runs for the signed-in account online, on launch and on each return to the app', () => {
  const app = read('App.js'), manager = read('components/TimezoneSyncManager.tsx');
  assert.match(app, /<OfflineSyncManager \/>\s*<TimezoneSyncManager \/>/);
  assert.match(manager, /if \(!userId \|\| !isKnown \|\| isOffline\) return;/);
  assert.match(manager, /AppState\.addEventListener\('change', \(state\) => \{ if \(state === 'active'\) sync\(\); \}\)/);
  assert.match(manager, /syncProfileTimezone\(userId, currentDeviceTimezone\(\)\)/);
});
