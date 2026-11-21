import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const owner='11111111-1111-4111-8111-111111111111';
function load(path,mocks,globals={}) {
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:false,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports,Date,AbortController,setTimeout,clearTimeout,require:n=>{assert.ok(n in mocks,n);return mocks[n];},...globals});return exports;
}
function fixture({enabled=true,status=200,code='configuration_required',sessionOwner=owner,invalid=false,malformed=false,restored=false,expired=false,localOwner=owner,waitForRenewal}={}) {
 const logs=[],requests=[];let stored=null;
 const capability={owner,consent:randomUUID(),secret:randomUUID()+randomUUID(),expiresAt:new Date(Date.now()+30*86400000).toISOString()};
 if(restored) stored=JSON.stringify({version:1,choices:[owner],scopes:[{...capability,owner:localOwner,expiresAt:new Date(Date.now()+(expired?-1:3600000)).toISOString()}],revoked:[],retired:[],queue:[]});
 const contract=load('lib/analyticsContract.ts',{});
 const queue=load('lib/analyticsQueue.ts',{'./analyticsContract':contract});
 const api=load('lib/analytics.ts',{
 './analyticsContract':contract,'./analyticsQueue':queue,'./analyticsOccurrence':{analyticsRequestOwner(){},analyticsRequestScopes(){}},
 './analyticsSessions':{createAnalyticsSessions:()=>({ready:()=>false,change:()=>false})},
 '@react-native-async-storage/async-storage':{default:{getItem:async()=>stored,setItem:async(_k,v)=>{stored=v;}}},
 'expo-crypto':{randomUUID},'react-native':{AppState:{addEventListener:()=>({remove(){}})}},
 '@react-native-community/netinfo':{default:{addEventListener:()=>()=>{}}},
 './supabase':{supabase:{auth:{getSession:async()=>({data:{session:sessionOwner?{user:{id:sessionOwner},access_token:'PRIVATE-TOKEN'}:null}})}}}
 },{__DEV__:true,process:{env:{EXPO_PUBLIC_ANALYTICS_ENABLED:String(enabled),EXPO_PUBLIC_WEB_URL:'https://backend.example.invalid/'}},console:{log:(_tag,data)=>logs.push(data)},
 fetch:async(url,init)=>{
  requests.push({url,init});const action=JSON.parse(init.body).action;
  if(action==='renew')await waitForRenewal?.();
  if(action==='withdraw')return Response.json({withdrawn:true});
  if(malformed)return new Response('not json',{status});
  return Response.json(invalid?{...capability,owner:'wrong'}:capability,{status,headers:{'X-Analytics-Failure-Code':code,'X-Analytics-Request-ID':'22222222-2222-4222-8222-222222222222'}});
 }});
 return {api,requests,logs,state:()=>JSON.parse(stored)};
}
test('failed registration preserves explicit choice but never reports server readiness or captures an event',async()=>{
 const h=fixture({status:503});const state=await h.api.setAnalyticsConsent(owner,'granted');
 assert.equal(state.granted,true);assert.equal(state.ready,false);assert.equal(await h.api.getAnalyticsConsent(owner),true);
 h.api.trackEvent('app_opened',{},owner);await new Promise(r=>setImmediate(r));
 assert.equal(h.state().scopes.length,0);assert.equal(h.state().queue.length,0);
 assert.equal(h.logs.length,0, 'registration failure must not write client development logs');
});
test('current enabled flag and configured backend are used with the matching authenticated account',async()=>{
 const h=fixture();const result=await h.api.setAnalyticsConsent(owner,'granted');assert.equal(result.ready,true);
 const req=h.requests[0];assert.equal(req.url,'https://backend.example.invalid/api/analytics/events');
 assert.equal(req.init.headers.Authorization,'Bearer PRIVATE-TOKEN');assert.equal(JSON.parse(req.init.body).owner,owner);assert.equal(JSON.parse(req.init.body).action,'grant');
 assert.equal(h.logs.length,0, 'successful registration must not write client development logs');
});
test('disabled flag, owner mismatch, rejected status and invalid responses remain inactive',async()=>{
 for(const opts of [{enabled:false},{sessionOwner:null},{sessionOwner:'other'},{status:401},{invalid:true},{malformed:true}]){
  const h=fixture(opts),state=await h.api.setAnalyticsConsent(owner,'granted');assert.equal(state.granted,true);assert.equal(state.ready,false);
  if(opts.enabled===false||opts.sessionOwner!==undefined)assert.equal(h.requests.length,0);
 }
});
test('off removes local readiness and choice without enabling delivery or creating a replacement capability',async()=>{
 const h=fixture();await h.api.setAnalyticsConsent(owner,'granted');await h.api.setAnalyticsConsent(owner,'denied');
 assert.equal((await h.api.getAnalyticsConsentStatus(owner)).granted,false);assert.equal((await h.api.getAnalyticsConsentStatus(owner)).ready,false);
 await new Promise(r=>setImmediate(r));assert.equal(h.requests.filter(r=>JSON.parse(r.init.body).action==='grant').length,1);
});

test('Settings readiness waits for an in-flight renewal of this device capability',async()=>{
 let finish;const waiting=new Promise(resolve=>{finish=resolve;});
 const h=fixture({restored:true,waitForRenewal:()=>waiting});
 const stop=h.api.analyticsLifecycle(owner);
 await new Promise(r=>setImmediate(r));
 assert.equal(h.requests.length,1);assert.equal(JSON.parse(h.requests[0].init.body).action,'renew');
 let settled=false;const reading=h.api.getAnalyticsConsentStatus(owner).then(value=>{settled=true;return value;});
 await new Promise(r=>setImmediate(r));
 const wasPending=!settled;finish();const result=await reading;stop();
 assert.equal(wasPending,true,'Do not freeze a transient renewal state into the Settings error');
 assert.equal(result.granted,true);assert.equal(result.ready,true);
 assert.equal(h.requests.filter(r=>JSON.parse(r.init.body).action==='grant').length,0);
 assert.equal(h.requests.filter(r=>JSON.parse(r.init.body).action==='renew').length,1);
});

test('failed renewal remains not ready without replacing consent or granting from preference',async()=>{
 const h=fixture({restored:true,status:503});const result=await h.api.getAnalyticsConsentStatus(owner);
 assert.equal(result.granted,true);assert.equal(result.ready,false);
 assert.equal(h.state().choices[0],owner);assert.equal(h.state().scopes.length,1);
 assert.equal(h.requests.length,1);assert.equal(JSON.parse(h.requests[0].init.body).action,'renew');
 assert.equal(result.credentialState,'unverified');
});

test('expired and different-owner local capabilities never renew or regrant from the saved ON choice',async()=>{
 for(const options of [{expired:true},{localOwner:'22222222-2222-4222-8222-222222222222'}]) {
  const h=fixture({restored:true,...options});const state=await h.api.getAnalyticsConsentStatus(owner);
  assert.equal(state.granted,true);assert.equal(state.ready,false);assert.equal(state.enabled,true);
  assert.equal(state.credentialState,options.expired?'expired':'missing');assert.equal(h.requests.length,0);
  assert.deepEqual(Object.keys(state).sort(),['credentialState','enabled','granted','ready']);
  assert.equal(JSON.stringify(state).includes(owner),false);assert.equal(h.logs.length,0);
 }
});
