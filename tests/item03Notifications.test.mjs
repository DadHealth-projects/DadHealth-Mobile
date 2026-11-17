import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function harness() {
 const h={routes:[]},exports={};
 const sdk={initialize(){},login(){},logout(){},Notifications:{addEventListener(_,fn){h.click=fn;}}};
 const mocks={'react-native':{Platform:{OS:'ios'},NativeModules:{OneSignal:{}},TurboModuleRegistry:{get:()=>({})}},
  'react-native-onesignal':{OneSignal:sdk},'./weeklyReport':{isReportWeek:v=>v==='2026-11-09'},
  './deepLinks':{isValidCommunityPostId:v=>typeof v==='string'&&/^[0-9a-f-]{36}$/.test(v)}};
 const resolver={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/notificationDestinations.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:resolver,require:n=>mocks[n]});
 mocks['./notificationDestinations']=resolver;
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/pushNotifications.ts',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports,AbortController,process:{env:{EXPO_PUBLIC_ONESIGNAL_APP_ID:'test'}},require:n=>{assert.ok(n in mocks,n);return mocks[n];}});
 h.api=exports;h.api.initializePushNotifications();h.api.attachPushNavigation({isReady:()=>true,navigate:(...args)=>h.routes.push(JSON.parse(JSON.stringify(args)))});
 h.tap=(data,id='event')=>h.click({notification:{notificationId:id,additionalData:data}});
 h.ready=()=>{h.api.loginPushUser('a');h.api.setPushNavigationLifecycleReady(true,true);};
 return h;
}
test('cold-start daily tap waits for authentication and opens check-in once',()=>{
 const h=harness();h.tap({type:'morning_checkin',destination_version:'1'});assert.equal(h.routes.length,0);h.ready();
 assert.deepEqual(h.routes,[['Tabs',{screen:'Home',params:{openDailyCheckIn:true}}]]);
 h.tap({type:'morning_checkin',destination_version:'1'});assert.equal(h.routes.length,1);
});
test('native dismissal block retains pending tap and account change discards it',()=>{
 const h=harness();h.ready();h.api.setPushModalBlocked(true);h.tap({type:'morning_checkin',destination_version:'1'});assert.equal(h.routes.length,0);
 h.api.setPushModalBlocked(false);assert.equal(h.routes.length,1);
 h.api.setPushModalBlocked(true);h.tap({type:'morning_checkin',destination_version:'1'},'second');h.api.loginPushUser('b');h.api.setPushModalBlocked(false);assert.equal(h.routes.length,1);
});
test('exact Mind, Body and Bond routes reveal without starting a session',()=>{
 const h=harness();h.ready();
 h.tap({type:'lowest_pillar',destination_version:'1',pillar:'mind'},'mind');
 h.tap({type:'lowest_pillar',destination_version:'1',pillar:'body',workout_id:'89e97b6c-0bfa-407d-a9f4-5020b086ba11'},'body');
 h.tap({type:'lowest_pillar',destination_version:'1',pillar:'bond'},'bond');
 assert.deepEqual(h.routes,[['BreathingSession'],['ActiveWorkout',{workoutId:'89e97b6c-0bfa-407d-a9f4-5020b086ba11'}],['Tabs',{screen:'Bond',params:{revealPresentDad:true}}]]);
});
test('untrusted versions/workout/episode fail closed; verified trial route opens plan',()=>{
 const h=harness();h.ready();
 for(const [i,data] of [{type:'lowest_pillar',pillar:'mind'},{type:'lowest_pillar',destination_version:'1',pillar:'body',workout_id:'other'},{type:'trial_ending',destination_version:'1',trial_episode:'bad'}].entries()) h.tap(data,String(i));
 assert.equal(h.routes.length,0);h.tap({type:'trial_ending',destination_version:'1',trial_episode:'03000000-0000-4000-8000-000000000001'},'valid');
 assert.equal(h.routes[0][0],'ProSubscription');
});
test('existing weekly payload still opens exact saved week; logout discards pending',()=>{
 const h=harness();h.ready();h.tap({type:'weekly_score',reporting_week:'2026-11-09'});
 assert.equal(h.routes[0][1].params.openWeeklyReport,'2026-11-09');
 h.api.setPushModalBlocked(true);h.tap({type:'morning_checkin',destination_version:'1'},'pending');h.api.logoutPushUser();h.ready();assert.equal(h.routes.length,1);
});
