import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('Score upgrade closes first and navigates once only after native dismissal', () => {
  const source = read('screens/DashboardScreen.tsx');
  const handlers = source.slice(source.indexOf('  const requestScoreUpgrade ='), source.indexOf('  const openCheckInPlan ='));
  const calls = [], pending = { current: null }, user = { id: 'owner-a' }, exports = {};
  vm.runInNewContext(compile(`${handlers}\nexport { requestScoreUpgrade, finishScoreDismissal };`), {
    exports, user, scoreUpgradePending: pending, useCallback: (fn) => fn,
    setScoreSheetOpen: (value) => calls.push(['visible', value]),
    openPro: (...args) => calls.push(['navigate', ...args]),
  });
  exports.requestScoreUpgrade(); exports.requestScoreUpgrade();
  assert.deepEqual(calls, [['visible', false]]);
  exports.finishScoreDismissal(); exports.finishScoreDismissal();
  assert.deepEqual(calls[1], ['navigate', 'score', 'Understand your score', 'lock', 'score_insights']);
  assert.equal(calls.length, 2);
  exports.requestScoreUpgrade(); user.id = 'owner-b'; exports.finishScoreDismissal();
  assert.equal(calls.filter((item) => item[0] === 'navigate').length, 1);
  assert.match(source, /onUpgrade=\{requestScoreUpgrade\}/);
  assert.match(source, /onDismiss=\{finishScoreDismissal\}/);
  assert.match(read('components/dashboard/ScoreDetailSheet.tsx'), /<Modal[^>]+onDismiss=\{onDismiss\}/);
  assert.match(read('screens/subscreens/ProSubscriptionScreen.tsx'), /onPress=\{\(\) => navigation.goBack\(\)\}/);
});

function syncHarness(mode, queue = [{ id: 'work' }]) {
  const h = { offline: true, owner: 'owner-a', queue, caughtUp: 0, syncing: 0, mode, listeners: new Set(), timers: new Map() };
  let cursor = 0, pending = [], timerId = 0, inFlight = null;
  const slots = [], effects = [];
  const same = (a,b) => a && b && a.length === b.length && a.every((x,i) => x === b[i]);
  const react = {
    useRef(value) { const i=cursor++; return slots[i] ??= { current: value }; },
    useCallback(fn,deps) { const i=cursor++; if(!same(slots[i]?.deps,deps)) slots[i]={fn,deps}; return slots[i].fn; },
    useEffect(fn,deps) { const i=cursor++; if(!same(effects[i]?.deps,deps)) pending.push(() => { effects[i]?.cleanup?.(); effects[i]={deps,cleanup:fn()}; }); },
  };
  const showCaughtUpNotice = () => h.caughtUp++, showSyncingNotice = () => h.syncing++;
  const mocks = {
    react, 'react-native': { AppState: { addEventListener: () => ({remove(){}}) } },
    '../contexts/AuthContext': { useAuth: () => ({user:{id:h.owner}}) },
    '../contexts/NetworkContext': { useNetworkStatus: () => ({isOffline:h.offline,isKnown:true,showCaughtUpNotice,showSyncingNotice}) },
    '../lib/offlineStorage': {
      readOfflineQueue: async () => [...h.queue],
      subscribeOfflineSync: (fn) => { h.listeners.add(fn); return () => h.listeners.delete(fn); },
    },
    '../lib/offlineSync': {
      setOfflineSyncUser(){}, syncOfflineQueue(owner) {
        if(inFlight) return inFlight;
        inFlight=Promise.resolve().then(async () => {
          if(h.wait) await h.wait;
          if(!h.queue.length) return;
          const event={userId:h.mode==='other-account'?'someone-else':owner,kind:'daily_checkin',status:h.mode==='cleared'?'cleared':h.mode==='failed'?'failed':'synced'};
          if(h.mode!=='partial' && h.mode!=='failed') h.queue=[];
          for(const listener of h.listeners) listener(event);
        }).finally(()=>{inFlight=null;});
        return inFlight;
      },
    },
  };
  const exports={};
  vm.runInNewContext(compile(read('components/OfflineSyncManager.tsx')), {exports,require:(name)=>{assert.ok(name in mocks,name);return mocks[name];},
    setTimeout(fn){h.timers.set(++timerId,fn);return timerId;},clearTimeout(id){h.timers.delete(id);}});
  h.render=()=>{cursor=0;pending=[];exports.default();pending.forEach((fn)=>fn());};
  h.online=async()=>{for(const fn of h.timers.values()) fn();h.timers.clear();h.offline=false;h.render();await tick();};
  h.unmount=()=>effects.forEach((effect)=>effect?.cleanup?.());
  h.render();return h;
}
for(const mode of ['success','partial','failed','cleared','other-account']) {
  test(`sync toast requires real successful work and a drained queue: ${mode}`,async()=>{
    const h=syncHarness(mode);await h.online();assert.equal(h.caughtUp,mode==='success'?1:0);h.unmount();
  });
}
test('empty queue does not show syncing or caught-up feedback',async()=>{
  const h=syncHarness('success',[]);await h.online();assert.equal(h.caughtUp,0);assert.equal(h.syncing,0);h.unmount();
});
test('late old-account sync completion cannot show caught-up feedback',async()=>{
  const h=syncHarness('success');let resolve;h.wait=new Promise((yes)=>{resolve=yes;});
  await h.online();h.owner='owner-b';h.render();resolve();await tick();
  assert.equal(h.caughtUp,0);h.unmount();
});
