import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,mocks={},extras={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Headers,URL,process:{env:{EXPO_PUBLIC_ANALYTICS_ENABLED:'true',EXPO_PUBLIC_SUPABASE_URL:'https://fixture.invalid'}},require:id=>{assert.ok(id in mocks,id);return mocks[id];},...extras});return exports;}
const sessions=load('lib/analyticsSessions.ts');
test('one cold launch; foreground needs 30 minutes; inactive interruptions and rerenders are not launches',()=>{
 const s=sessions.createAnalyticsSessions();assert.equal(s.ready(),true);assert.equal(s.ready(),false);
 assert.equal(s.change('inactive',0),false);assert.equal(s.change('active',1800000),false);
 s.change('background',2000000);s.change('background',2100000);assert.equal(s.change('active',3799999),false);
 s.change('background',4000000);assert.equal(s.change('active',5800000),true);assert.equal(s.change('active',5800001),false);
});
test('presentation needs layout and focus; duplicate renders and attempted navigation do not count; reentry and account change do',()=>{
 const p=sessions.createPresentation();assert.equal(p.update('A',true,true),false);p.layout();
 assert.equal(p.update('A',false,true),false);assert.equal(p.update('A',true,true),true);
 assert.equal(p.update('A',true,true),false);p.update('A',false,true);assert.equal(p.update('A',true,true),true);
 assert.equal(p.update('B',true,true),true);assert.equal(p.update('B',true,false),false);
 const old=sessions.createPresentation();old.layout();assert.equal(old.update('completed-account',true,false),false);
});
test('business request snapshots consent without awaiting analytics; offline explicit none never inherits new consent',async()=>{
 const calls=[];const a=load('lib/analyticsOccurrence.ts',{}, {fetch:async(i,init)=>{calls.push(init);return {};}});
 const scope={owner:'A',consent:'original',secret:'capability',expiresAt:new Date(Date.now()+86400000).toISOString()};
 a.analyticsRequestOwner('A');a.analyticsRequestScopes([scope]);
 await a.analyticsFetch('https://fixture.invalid/rest/v1/mood_logs',{method:'POST',headers:{}});
 assert.deepEqual(JSON.parse(calls[0].headers.get('x-dadhealth-analytics')),scope);
 a.analyticsRequestOwner('B');assert.equal(a.analyticsOccurrence('A'),null);
 await a.analyticsFetch('https://fixture.invalid/rest/v1/mood_logs',{method:'POST',headers:{'x-dadhealth-analytics':'none'}});
 assert.equal(calls[1].headers.get('x-dadhealth-analytics'),'none');
 a.analyticsRequestOwner('A');a.analyticsRequestScopes([]);assert.equal(a.analyticsOccurrence('A'),null);
});
test('offline check-in uses its saved original capability and legacy queued entries explicitly suppress attribution',async()=>{
 const headers=[];
 function builder(){return {select(){return this;},eq(){return this;},insert(){return this;},update(){return this;},setHeader(k,v){headers.push([k,v]);return this;},maybeSingle:async()=>({data:null,error:null}),then(resolve){resolve({error:null});}};}
 const api=load('lib/offlineSync.ts',{'./supabase':{supabase:{from:()=>builder()}},'./offlineStorage':{},'./mindResetPendingStore':{readHeldMindResets:async()=>[],writeHeldMindResets:async()=>true,clearHeldMindResets:async()=>{}},'./nativeSubscriptions': { saveCancellationFeedback: async () => { throw new Error('unexpected feedback send'); } }, './analyticsOccurrence':{occurrenceHeader:s=>s?JSON.stringify(s):'none'}});
 const item={userId:'A',payload:{date:'2026-11-20',moodValue:3},analytics:{owner:'A',consent:'saved',secret:'original'}};
 await api.persistDailyCheckIn(item);assert.equal(headers[0][1],JSON.stringify(item.analytics));
 await api.persistDailyCheckIn({...item,analytics:undefined});assert.equal(headers[1][1],'none');
});
test('upgrade sources reject arbitrary text and persisted facts cannot enter client queue',()=>{
 const c=load('lib/analyticsContract.ts');assert.equal(c.upgradeSource('private free text'),'unknown');assert.equal(c.upgradeSource('weekly_report'),'weekly_report');
 assert.equal(c.permittedProperties('paywall_viewed',{source:'unknown'}),true);
 for(const name of ['first_checkin','onboarding_completed','trial_started','return_day_reached'])assert.equal(c.permittedProperties(name,{}),false);
});

test('editing a queued pre-consent check-in never acquires later consent and does not change its business payload',async()=>{
 const saved=new Map();const storage={getItem:async k=>saved.get(k)??null,setItem:async(k,v)=>saved.set(k,v),removeItem:async k=>saved.delete(k)};
 const api=load('lib/offlineStorage.ts',{'@react-native-async-storage/async-storage':storage});
 const item={id:'first',userId:'A',kind:'daily_checkin',createdAt:new Date().toISOString(),payload:{date:'2026-11-20',moodValue:3}};
 await api.enqueueOfflineWrite(item);
 await api.enqueueOfflineWrite({...item,id:'updated',analytics:{owner:'A',consent:'later',secret:'later'},payload:{...item.payload,moodValue:4}});
 const rows=await api.readOfflineQueue('A');assert.equal(rows.length,1);assert.equal(rows[0].analytics,null);assert.equal(rows[0].payload.moodValue,4);
 assert.equal((await api.readOfflineQueue('B')).length,0);
});
