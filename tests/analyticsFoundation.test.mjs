import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,mocks={}) { const exports={}; vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:id=>{if(!(id in mocks))throw Error(id);return mocks[id];},Date,AbortController,setTimeout,clearTimeout});return exports; }
const contract=load('lib/analyticsContract.ts');
const {createAnalyticsQueue}=load('lib/analyticsQueue.ts',{'./analyticsContract':contract});
function fixture() {
 const h={saved:null,now:Date.now(),sent:[],revoked:[],mode:'accepted'};
 h.d={credential:async(owner,previous)=>({...previous,owner,consent:previous?.consent??randomUUID(),secret:previous?.secret??randomUUID()+randomUUID(),expiresAt:new Date(h.now+30*86400000).toISOString()}),read:async()=>h.saved,write:async v=>{h.saved=v;},random:randomUUID,now:()=>h.now,
 send:async(scope,event)=>{h.sent.push(JSON.parse(JSON.stringify({scope,event})));if(h.mode==='throw')throw Error('offline');return h.mode;},withdraw:async scope=>{h.revoked.push(scope);return true;}};
 h.q=createAnalyticsQueue(h.d);return h;
}
test('contract rejects identity overrides, arbitrary text and authoritative facts',()=>{
 for(const [event,props] of [['app_opened',{distinct_id:'other'}],['journal_entry_created',{text:'private'}],['trial_started',{}],['first_checkin',{}],['lock_viewed',{feature:'secret',source:'score'}]])assert.equal(contract.permittedProperties(event,props),false);
 assert.equal(contract.permittedProperties('lock_viewed',{feature:'score_insights',source:'score'}),true);
});
test('unknown and denied consent capture nothing; explicit grant enables anonymous identity',async()=>{
 const h=fixture();await h.q.capture('app_opened',{},null);await h.q.flush();assert.equal(h.sent.length,0);
 await h.q.consent(null,false);await h.q.capture('app_opened',{},null);assert.equal(JSON.parse(h.saved).queue.length,0);
 await h.q.consent(null,true);await h.q.capture('app_opened',{},null);await h.q.flush();assert.equal(h.sent.length,1);assert.equal(h.sent[0].scope.owner,null);
});
test('offline restart and lost response preserve event UUID, timestamp and anonymous capability',async()=>{
 const h=fixture();await h.q.consent(null,true);await h.q.capture('app_opened',{},null);h.mode='throw';await h.q.flush();const first=h.sent[0];
 h.q=createAnalyticsQueue(h.d);h.now+=120000;h.mode='accepted';await h.q.flush();assert.deepEqual(h.sent[1],first);assert.equal(JSON.parse(h.saved).queue.length,0);
});

test('temporary storage read failure preserves consent and queued events for restart recovery',async()=>{
 const h=fixture();await h.q.consent('a',true);await h.q.capture('app_opened',{},'a');
 const saved=h.saved;let fail=true,writes=0;
 const d={...h.d,read:async()=>{if(fail)throw Error('storage unavailable');return h.saved;},write:async value=>{writes++;h.saved=value;}};
 h.q=createAnalyticsQueue(d);
 await assert.rejects(h.q.flush('a'),/storage unavailable/);
 assert.equal(writes,0);assert.equal(h.saved,saved);assert.equal(h.sent.length,0);
 fail=false;await h.q.flush('a');
 assert.equal(h.sent.length,1);assert.equal(h.sent[0].event.id,JSON.parse(saved).queue[0].event.id);
 assert.equal(await h.q.consentGranted('a'),true);
});
test('account switching never sends A under B and preserves A until A returns',async()=>{
 const h=fixture();await h.q.consent('a',true);await h.q.consent('b',true);await h.q.capture('app_opened',{},'a');await h.q.capture('app_opened',{},'b');
 h.q.changedAccount();await h.q.flush('b');assert.deepEqual(h.sent.map(x=>x.scope.owner),['b']);assert.equal(JSON.parse(h.saved).queue[0].scope.owner,'a');
 await h.q.flush('a');assert.deepEqual(h.sent.map(x=>x.scope.owner),['b','a']);
});
test('withdrawal aborts in-flight work, clears unsent events and durably revokes capability',async()=>{
 const h=fixture();let finish,signal;h.d.send=async(_s,_e,s)=>{signal=s;await new Promise(r=>finish=r);return 'accepted';};h.q=createAnalyticsQueue(h.d);
 await h.q.consent('a',true);await h.q.capture('app_opened',{},'a');const flush=h.q.flush('a');while(!finish)await new Promise(r=>setImmediate(r));
 await h.q.consent('a',false);assert.equal(signal.aborted,true);finish();await flush;assert.equal(JSON.parse(h.saved).queue.length,0);
 h.q=createAnalyticsQueue(h.d);await h.q.flush();assert.equal(h.revoked.length,1);
});
test('delayed capture cannot restore events after consent withdrawal',async()=>{
 const h=fixture();await h.q.consent('a',true);const capture=h.q.capture('app_opened',{},'a');const revoke=h.q.consent('a',false);await Promise.all([capture,revoke]);assert.equal(JSON.parse(h.saved).queue.length,0);
});
test('retired owner remains retired after restart; another owner remains intact',async()=>{
 const h=fixture();await h.q.consent('a',true);await h.q.consent('b',true);await h.q.capture('app_opened',{},'b');await h.q.retire('a');
 h.q=createAnalyticsQueue(h.d);await h.q.consent('a',true);await h.q.capture('app_opened',{},'a');await h.q.flush('b');assert.deepEqual(h.sent.map(x=>x.scope.owner),['b']);
});
test('queue caps at 200, ages out after seven days and bounds retries',async()=>{
 const h=fixture();await h.q.consent('a',true);for(let n=0;n<210;n++)await h.q.capture('app_opened',{},'a');assert.equal(JSON.parse(h.saved).queue.length,200);
 h.now+=8*86400000;await h.q.flush('a');assert.equal(JSON.parse(h.saved).queue.length,0);
 await h.q.capture('app_opened',{},'a');h.mode='later';for(let n=0;n<10;n++){await h.q.flush('a');h.now+=3600001;}assert.equal(h.sent.length,8);
});
test('concurrent drains never overlap and HTTP rejection is not retried',async()=>{
 const h=fixture();await h.q.consent(null,true);await h.q.capture('app_opened',{},null);h.mode='rejected';await Promise.all([h.q.flush(),h.q.flush(),h.q.flush()]);assert.equal(h.sent.length,1);
});
test('frontend and backend event contracts are byte-identical',()=>{
 assert.equal(readFileSync('lib/analyticsContract.ts','utf8'),readFileSync(process.env.ANALYTICS_BACKEND_CONTRACT_PATH || '../dadHealth/src/lib/analytics/contract.ts','utf8'));
});

test('corrupt persisted consent cannot authorize capture and orphaned queue records never send',async()=>{
 const h=fixture();h.saved=JSON.stringify({version:1,scopes:[{owner:'a',consent:'invalid',secret:'invalid'}],revoked:[],retired:[],queue:[]});
 h.q=createAnalyticsQueue(h.d);await h.q.capture('app_opened',{},'a');await h.q.flush('a');assert.equal(h.sent.length,0);
 await h.q.consent('a',true);await h.q.capture('app_opened',{},'a');const s=JSON.parse(h.saved);s.queue[0].scope.consent=randomUUID();h.saved=JSON.stringify(s);
 h.q=createAnalyticsQueue(h.d);await h.q.flush('a');assert.equal(h.sent.length,0);
});

test('renewal failure stops collection without clearing choice; expired credentials never request renewal',async()=>{
 const h=fixture();await h.q.consent('a',true);h.now+=29.5*86400000;
 let calls=0;h.d.credential=async(_owner,previous)=>{calls++;assert.ok(previous);throw Error('offline');};
 await h.q.flush('a');assert.equal(calls,1);assert.equal(await h.q.consentGranted('a'),true);
 await h.q.capture('app_opened',{},'a');assert.equal(JSON.parse(h.saved).queue.length,0);
 h.now+=86400000;await h.q.flush('a');assert.equal(calls,1,'expired credentials cannot renew from saved choice');
 h.q=createAnalyticsQueue(h.d);await h.q.flush('a');assert.equal(calls,1);assert.equal(await h.q.consentGranted('a'),true);
});

test('withdrawal or retirement racing renewal cannot publish the returned credential',async()=>{
 for(const retire of [false,true]) {
  const h=fixture();await h.q.consent('a',true);h.now+=29.5*86400000;
  let finish;h.d.credential=async(owner,previous)=>new Promise(resolve=>finish=()=>resolve({...previous,owner,expiresAt:new Date(h.now+30*86400000).toISOString()}));
  const flushing=h.q.flush('a');while(!finish)await new Promise(r=>setImmediate(r));
  await (retire?h.q.retire('a'):h.q.consent('a',false));finish();await flushing;
  assert.equal(await h.q.consentGranted('a'),false);await h.q.capture('app_opened',{},'a');assert.equal(JSON.parse(h.saved).queue.length,0);
  assert.equal(JSON.parse(h.saved).scopes.length,0);
 }
});

test('renewal preserves queued identity and timestamp even when its original local expiry passes',async()=>{
 const h=fixture();await h.q.consent('a',true);h.now+=29*86400000;await h.q.capture('app_opened',{},'a');
 const original=JSON.parse(h.saved).queue[0];h.mode='throw';await h.q.flush('a');
 h.now+=2*86400000;h.mode='accepted';await h.q.flush('a');
 const delivered=h.sent.at(-1);assert.equal(delivered.event.id,original.event.id);assert.equal(delivered.event.timestamp,original.event.timestamp);
 assert.equal(delivered.scope.consent,original.scope.consent);assert.equal(JSON.parse(h.saved).queue.length,0);
});

test('new explicit grant waits for an aborted old renewal instead of silently losing registration',async()=>{
 const h=fixture();await h.q.consent('a',true);h.now+=29.5*86400000;
 let finish;let grants=0;
 h.d.credential=async(owner,previous)=>previous?new Promise(resolve=>finish=()=>resolve({...previous,expiresAt:new Date(h.now+30*86400000).toISOString()})):
  (++grants,{owner,consent:randomUUID(),secret:randomUUID()+randomUUID(),expiresAt:new Date(h.now+30*86400000).toISOString()});
 const renewing=h.q.flush('a');while(!finish)await new Promise(r=>setImmediate(r));
 await h.q.consent('a',false);const granting=h.q.consent('a',true);finish();await Promise.all([renewing,granting]);
 assert.equal(grants,1);assert.equal((await h.q.consentStatus('a')).ready,true);assert.equal(JSON.parse(h.saved).scopes.length,1);
});
