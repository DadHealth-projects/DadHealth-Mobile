import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

for (const path of ['/auth/v1/token?grant_type=password', '/auth/v1/logout']) {
 test(`auth transport does not cancel a pending ${path} request after six seconds`, async () => {
  const timers = new Map();
  let options, finish, requestSignal;
  const transport = (_url, init) => {
   requestSignal = init?.signal;
   return new Promise(resolve => { finish = resolve; });
  };
  load('lib/supabase.ts', {
   'react-native-url-polyfill/auto': {},
   'react-native': { AppState: { addEventListener() {} } },
   '@supabase/supabase-js': { createClient: (_url, _key, config) => { options = config; return {}; } },
   './secureStore': { SecureStoreAdapter: {} },
   './analyticsOccurrence': load('lib/analyticsOccurrence.ts', {}, {fetch:transport,URL,Headers}),
  }, {
   process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://example.invalid', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-only' } },
   fetch: transport, URL, AbortController,
   setTimeout: (callback, delay) => { const id = timers.size + 1; timers.set(id, { callback, delay }); return id; },
   clearTimeout: id => timers.delete(id),
  });
  const pending = (options.global?.fetch ?? transport)(`https://example.invalid${path}`, { method: 'POST' });
  for (const timer of timers.values()) if (timer.delay <= 6000) timer.callback();
  assert.notEqual(requestSignal?.aborted, true);
  const response = { ok: true };
  finish(response);
  assert.equal(await pending, response);
  assert.equal(options.auth.persistSession, true);
  assert.equal(options.auth.autoRefreshToken, true);
 });
}

function load(file,mocks,globals={}) {
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,
 {exports,process:{env:{}},...globals,require:n=>{assert.ok(n in mocks,n);return mocks[n];}});return exports;
}
function harness() {
 const h={slots:[],effects:[],index:0,dirty:false,requests:[],availability:{data:true,error:null},availabilityCalls:0};
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={createContext:()=>({Provider:'Provider'}),useContext:()=>null,createElement:(_t,p)=>p,
 useRef:v=>{const i=h.index++;return h.slots[i]??(h.slots[i]={current:v});},
 useState:v=>{const i=h.index++;if(!(i in h.slots))h.slots[i]=v;return [h.slots[i],next=>{h.slots[i]=typeof next==='function'?next(h.slots[i]):next;h.dirty=true;}];},
 useMemo:(f,deps)=>{const i=h.index++,old=h.slots[i];if(!old||!same(old.deps,deps))h.slots[i]={deps,value:f()};return h.slots[i].value;},
 useEffect:(f,deps)=>{const i=h.index++,old=h.slots[i];if(!old||!same(old.deps,deps)){h.slots[i]={deps,cleanup:old?.cleanup};h.effects.push(()=>{h.slots[i].cleanup?.();h.slots[i].cleanup=f();});}}};
 react.useCallback=(f,d)=>react.useMemo(()=>f,d);react.default=react;
 const supabase={rpc:async name=>{assert.equal(name,'privacy_current_account_available');h.availabilityCalls++;return h.availability;},auth:{onAuthStateChange:f=>{h.auth=f;return {data:{subscription:{unsubscribe(){}}}};}},from:()=>{
  const q={select:()=>q,eq:()=>q,maybeSingle:()=>new Promise(resolve=>h.requests.push(resolve))};return q;
 }};
 const mod=load('contexts/AuthContext.tsx',{react,'../lib/supabase':{supabase},'../lib/biometric':{},
 '../lib/analytics':{analyticsLifecycle:()=>()=>{}},
 '../lib/onboardingHandoff':load('lib/onboardingHandoff.ts',{}),
 '../components/settings/AccountPrivacySheet':{AccountPrivacyRecovery:()=>null},
 '../lib/onboarding':load('lib/onboarding.ts',{}),'../lib/offlineSync':{pauseAndClearOfflineUser:async()=>{}}});
 h.render=()=>{h.index=0;h.dirty=false;h.value=mod.AuthProvider({children:null}).value;h.effects.splice(0).forEach(f=>f());};
 h.flush=async()=>{for(let i=0;i<4;i++){await new Promise(r=>setImmediate(r));if(h.dirty)h.render();}};
 h.signIn=id=>{h.auth('SIGNED_IN',id?{user:{id}}:null);h.render();};h.render();return h;
}
const complete={data:{goals:['health'],custody_pattern:'daily'},error:null};

test('deletion-hidden profile never becomes fresh onboarding; unknown barrier fails closed',async()=>{
 for(const availability of [{data:false,error:null},{data:null,error:{code:'network'}}]) {
  const h=harness();h.availability=availability;h.signIn('deleting');
  h.requests.shift()({data:null,error:null});await h.flush();
  assert.equal(h.availabilityCalls,1);assert.equal(h.value.onboardingComplete,null);
  assert.equal(h.value.onboardingLoading,false);
 }
});
test('genuinely new available account can still onboard; existing profile needs no extra RPC',async()=>{
 const h=harness();h.signIn('new');h.requests.shift()({data:null,error:null});await h.flush();
 assert.equal(h.value.onboardingComplete,false);
 h.signIn('existing');h.requests.shift()(complete);await h.flush();
 assert.equal(h.value.onboardingComplete,true);assert.equal(h.availabilityCalls,1);
});
test('profile failure stays unknown instead of forcing Welcome; successful retry resolves',async()=>{
 const h=harness();h.signIn('a');assert.equal(h.value.onboardingLoading,true);
 h.requests.shift()({data:null,error:{code:'network'}});await h.flush();
 assert.equal(h.value.onboardingComplete,null);assert.equal(h.value.onboardingLoading,false);
 const retry=h.value.refreshOnboarding();h.requests.shift()(complete);assert.equal(await retry,true);await h.flush();
 assert.equal(h.value.onboardingComplete,true);
});
test('failed refresh preserves the current account verified completion',async()=>{
 const h=harness();h.signIn('a');h.requests.shift()(complete);await h.flush();
 const retry=h.value.refreshOnboarding();h.requests.shift()({data:null,error:{code:'network'}});await retry;await h.flush();
 assert.equal(h.value.onboardingComplete,true);assert.equal(h.value.onboardingLoading,false);
});
test('old account responses cannot override the current account, and incomplete remains incomplete',async()=>{
 const h=harness();h.signIn('a');const old=h.requests.shift();h.signIn('b');
 h.requests.shift()({data:{goals:[],custody_pattern:null},error:null});await h.flush();
 old(complete);await h.flush();assert.equal(h.value.onboardingComplete,false);
 h.signIn(null);assert.equal(h.value.onboardingComplete,null);
});
test('newest onboarding request wins and unmount invalidates pending reads',async()=>{
 const h=harness();h.signIn('a');const old=h.requests.shift();
 const newer=h.value.refreshOnboarding();h.requests.shift()(complete);await newer;await h.flush();
 old({data:null,error:null});await h.flush();assert.equal(h.value.onboardingComplete,true);
 const pending=h.value.refreshOnboarding();h.render();h.slots.forEach(s=>s?.cleanup?.());h.dirty=false;
 h.requests.shift()(complete);await pending;assert.equal(h.dirty,false);
});
test('Apple Health initial sync waits for idle and cleanup cancels it; foreground sync remains',()=>{
 let effect,idle,foreground,cancelled,removed=false,syncs=0;
 const mod=load('components/AppleHealthManager.tsx',{
 react:{useCallback:f=>f,useEffect:f=>effect=f},
 'react-native':{AppState:{addEventListener:(_e,f)=>{foreground=f;return {remove:()=>removed=true};}}},
 '../contexts/AuthContext':{useAuth:()=>({user:{id:'a'},onboardingComplete:true})},
 '../lib/appleHealth':{syncAppleHealthIfConnected:async()=>syncs++},
 },{requestIdleCallback:f=>{idle=f;return 7;},cancelIdleCallback:id=>cancelled=id});
 mod.default();const cleanup=effect();assert.equal(syncs,0);idle();assert.equal(syncs,1);
 foreground('active');assert.equal(syncs,2);cleanup();assert.equal(cancelled,7);assert.equal(removed,true);
});
