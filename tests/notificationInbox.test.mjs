import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(path,mocks={},extra={}){
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,
 {exports,Date,Intl,AbortController,process:{env:{EXPO_PUBLIC_ONESIGNAL_APP_ID:'test'}},...extra,require:n=>{assert.ok(n in mocks,n);return mocks[n];}});return exports;
}
const id='03200000-0000-4000-8000-000000000001',other='03200000-0000-4000-8000-000000000002';
const isUuid=v=>typeof v==='string'&&/^[0-9a-f-]{36}$/.test(v);
const resolver=load('lib/notificationDestinations.ts',{'./weeklyReport':{isReportWeek:v=>v==='2026-11-09'},'./deepLinks':{isValidCommunityPostId:isUuid}});
test('journal prompt opens the Journal writer rather than the Mind tab',()=>{
 const target=resolver.resolveNotificationDestination({version:'1',type:'journal_prompt'});
 assert.equal(target.route,'Journal');
 assert.equal(target.params.openEditor,true);
 assert.equal(target.family,'journal');
});
const destinations=[
 ['morning_checkin',{destination_version:'1'},'check-in'],['lowest_pillar',{destination_version:'1',pillar:'bond'},'bond-control'],
 ['weekly_score',{reporting_week:'2026-11-09'},'report'],['trial_ending',{destination_version:'1',trial_episode:id},'plan'],
 ['community_reply',{post_id:id},'community'],['community_like',{post_id:id},'community'],['co_parent_event_added',{event_id:id},'calendar'],
 ['present_dad_mode_complete',{},'Bond'],['bedtime_story',{},'Bond'],['milestone_anniversary',{},'Bond'],
 ['workout_window',{},'Fit'],['journal_prompt',{},'journal'],['weekly_challenge',{},'Home'],
 ['lowest_pillar',{destination_version:'1',pillar:'mind'},'mind-reset'],
 ['lowest_pillar',{destination_version:'1',pillar:'body',workout_id:'89e97b6c-0bfa-407d-a9f4-5020b086ba11'},'workout'],
];
function harness(){
 const h={routes:[],acks:[],unavailable:0};const sdk={initialize(){},login(){},logout(){},Notifications:{addEventListener(_,f){h.click=f;}}};
 h.api=load('lib/pushNotifications.ts',{'./notificationDestinations':resolver,'./weeklyReport':{isReportWeek:v=>v==='2026-11-09'},
 './deepLinks':{isValidCommunityPostId:isUuid},'react-native':{Platform:{OS:'ios'},NativeModules:{OneSignal:{}},TurboModuleRegistry:{get:()=>({})}},'react-native-onesignal':{OneSignal:sdk}});
 h.api.initializePushNotifications();h.api.attachPushNavigation({isReady:()=>true,getCurrentRoute:()=>({key:'inbox'}),navigate:(...a)=>h.routes.push(a)});
 h.bind=(owner='owner')=>{h.api.loginPushUser(owner);h.api.setPushNavigationLifecycleReady(true,true);h.api.configureInboxNavigation({owner,read:async()=>h.read?h.read():({destination:h.destination}),
 acknowledge:async(id,signal)=>{h.acks.push({id,signal});},unavailable:()=>h.unavailable++});};
 h.token=()=>{const p=h.routes.at(-1)?.[1];return p?.params?.notificationOperation??p?.notificationOperation;};
 h.bind();return h;
}
for(const [type,fields,family] of destinations)test(`${type}/${family}: saved destination acknowledged only after successful presentation`,async()=>{
 const h=harness();h.destination={version:'1',type,...fields};await h.api.openInboxNotification(id);
 assert.equal(h.routes.length,1);assert.equal(h.acks.length,0);const token=h.token();assert.equal(h.api.notificationOperationFamily(token),family);
 await h.api.confirmNotificationPresentation(token,'different');assert.equal(h.acks.length,0);
 await h.api.confirmNotificationPresentation(token,'owner');await h.api.confirmNotificationPresentation(token,'owner');assert.equal(h.acks.length,1);assert.equal(h.acks[0].id,id);
});
test('push ID uses owned saved data despite conflicting push fields and waits for native dismissal',async()=>{
 const h=harness();h.destination={version:'1',type:'weekly_score',reporting_week:'2026-11-09'};h.api.setPushModalBlocked(true);
 h.click({notification:{notificationId:'p',additionalData:{inbox_event_id:id,type:'weekly_score',reporting_week:'invalid'}}});
 assert.equal(h.routes.length,0);h.api.setPushModalBlocked(false);await tick();
 assert.equal(h.routes[0][1].params.openWeeklyReport,'2026-11-09');assert.equal(h.acks.length,0);
});
test('duplicate taps, route departure, account changes and late reads never acknowledge a different event',async()=>{
 const h=harness();h.destination={version:'1',type:'bedtime_story'};await h.api.openInboxNotification(id);await h.api.openInboxNotification(id);assert.equal(h.routes.length,1);
 const token=h.token();h.api.notificationRouteChanged(undefined);await h.api.confirmNotificationPresentation(token,'owner');assert.equal(h.acks.length,0);
 let resolve;h.read=()=>new Promise(r=>resolve=r);const pending=h.api.openInboxNotification(other);h.bind('next');resolve({destination:h.destination});await pending;
 assert.equal(h.routes.length,1);assert.equal(h.acks.length,0);
});
test('unavailable targets stay unread and return the approved unavailable message path',async()=>{
 const h=harness();h.destination={version:'1',type:'community_reply',post_id:id};await h.api.openInboxNotification(id);
 await h.api.confirmNotificationPresentation(h.token(),'owner',false);assert.equal(h.unavailable,1);assert.equal(h.acks.length,0);assert.equal(h.routes.at(-1)[0],'Notifications');
 h.read=async()=>{throw Error('deleted');};await h.api.openInboxNotification(other);assert.equal(h.unavailable,2);assert.equal(h.acks.length,0);
});
test('parser rejects cross-account rows and missing canonical calendar metadata',()=>{
 const api=load('lib/notificationInbox.ts',{'./supabase':{},'../hooks/useWeeklyReport':{},'./notificationDestinations':resolver});
 const page={items:[event()],event:null,unreadCount:1,timezone:'Europe/London',today:'2026-11-16',cutoff:'2026-11-16T09:00:00Z'};
 assert.equal(api.parseInbox(page,'owner').items.length,1);
 assert.throws(()=>api.parseInbox(page,'other'));assert.throws(()=>api.parseInbox({...page,timezone:null},'owner'));
 assert.throws(()=>api.parseInbox({...page,timezone:'Not/AZone'},'owner'));
});
function event(){return {id,user_id:'owner',type:'bedtime_story',title:'Bedtime',description:'Story time',destination:{version:'1',type:'bedtime_story',link:'/bond'},created_at:'2026-11-16T08:00:00Z',read_at:null,day_group:'Today'};}
const tick=()=>new Promise(r=>setImmediate(r));
function stateHarness(){
 const h={owner:'owner',offline:false,requests:[],writes:[],slots:[],effects:[],index:0,dirty:false};
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={createContext:()=>({Provider:'Provider'}),useContext:()=>null,createElement:(_t,p)=>p,
 useRef:v=>{const i=h.index++;return h.slots[i]??(h.slots[i]={current:v});},
 useState:v=>{const i=h.index++;if(!(i in h.slots))h.slots[i]=typeof v==='function'?v():v;return [h.slots[i],next=>{h.slots[i]=typeof next==='function'?next(h.slots[i]):next;h.dirty=true;}];},
 useMemo:(f,deps)=>{const i=h.index++,old=h.slots[i];if(!old||!same(old.deps,deps))h.slots[i]={deps,value:f()};return h.slots[i].value;},
 useEffect:(f,deps)=>{const i=h.index++,old=h.slots[i];if(!old||!same(old.deps,deps)){h.slots[i]={deps,cleanup:old?.cleanup};h.effects.push(()=>{h.slots[i].cleanup?.();h.slots[i].cleanup=f();});}}};
 react.useCallback=(f,d)=>react.useMemo(()=>f,d);react.default=react;
 const page=()=>({items:[event()],event:null,unreadCount:1,timezone:'Europe/London',today:'2026-11-16',cutoff:'2026-11-16T09:00:00Z'});
 h.respond=async()=>page();h.write=async()=>({...page(),unreadCount:0});
 const mod=load('contexts/NotificationInboxContext.tsx',{react,'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})}},
 '@react-navigation/native':{},'./AuthContext':{useAuth:()=>({user:{id:h.owner}})},'./NetworkContext':{useNetworkStatus:()=>({isOffline:h.offline})},
 '../lib/notificationInbox':{readInbox:async(...a)=>{h.requests.push(a);return h.respond(...a);},acknowledgeInbox:async(...a)=>{h.writes.push(a);return h.write(...a);}},
 '../lib/pushNotifications':{configureInboxNavigation:b=>h.bridge=b,openInboxNotification(){}}});
 h.render=()=>{h.index=0;h.dirty=false;h.value=mod.NotificationInboxProvider({children:null}).value;const effects=h.effects.splice(0);effects.forEach(f=>f());};
 h.flush=async()=>{for(let i=0;i<5;i++){await tick();if(h.dirty)h.render();}};h.render();return h;
}
test('same-account refresh retains content; opening list never writes read state',async()=>{
 const h=stateHarness();await h.flush();await h.value.refresh();await h.flush();assert.equal(h.value.items.length,1);assert.equal(h.writes.length,0);
 let resolve;h.respond=()=>new Promise(r=>resolve=r);const work=h.value.refresh();h.render();assert.equal(h.value.items.length,1);assert.equal(h.value.loading,true);
 resolve({items:[],unreadCount:0,timezone:'Europe/London'});await work;await h.flush();assert.equal(h.value.items.length,0);
});
test('account switch clears data immediately and stale reads/counts cannot repopulate it',async()=>{
 const h=stateHarness();await h.flush();await h.value.refresh();await h.flush();
 const pending=[];h.respond=()=>new Promise(resolve=>pending.push(resolve));
 const old=h.value.refresh();const oldSignal=h.requests.at(-1)[1];h.owner='next';h.render();assert.equal(h.value.items.length,0);assert.equal(h.value.unreadCount,0);
 assert.equal(oldSignal.aborted,true);
 pending[0]({items:[event()],unreadCount:4});await old;await h.flush();assert.equal(h.value.items.length,0);assert.equal(h.value.unreadCount,0);
 pending[1]({items:[],unreadCount:0});await h.flush();
});
test('failed read acknowledgement does not change read state or count',async()=>{
 const h=stateHarness();await h.flush();await h.value.refresh();await h.flush();h.write=async()=>{throw Error('offline');};await h.value.markAll();await h.flush();
 assert.equal(h.value.items[0].read_at,null);assert.equal(h.value.unreadCount,1);assert.match(h.value.error,/couldn/);
});
test('unavailable destination message survives the inbox focus refresh',async()=>{
 const h=stateHarness();await h.flush();h.bridge.unavailable();h.render();await h.value.refresh();await h.flush();
 assert.equal(h.value.error,'This update is no longer available.');assert.equal(h.writes.length,0);
});
test('late counts cannot overwrite confirmed read state and late writes cannot cross accounts',async()=>{
 const h=stateHarness();await h.flush();await h.value.refresh();await h.flush();
 let count;h.respond=()=>new Promise(r=>count=r);const old=h.value.refreshCount();
 await h.value.markAll();await h.flush();assert.equal(h.value.unreadCount,0);count({unreadCount:6});await old;await h.flush();assert.equal(h.value.unreadCount,0);
 let write;h.write=()=>new Promise(r=>write=r);const pending=h.value.markAll();h.owner='other';h.render();
 write({unreadCount:8,cutoff:'2026-11-16T09:00:00Z'});await pending;await h.flush();assert.equal(h.value.unreadCount,0);assert.equal(h.value.items.length,0);
});
test('failed report presentation waits for native dismissal before returning to inbox',async()=>{
 const h=harness();h.destination={version:'1',type:'weekly_score',reporting_week:'2026-11-09'};await h.api.openInboxNotification(id);
 h.api.setPushModalBlocked(true);await h.api.confirmNotificationPresentation(h.token(),'owner',false);
 assert.equal(h.routes.length,1);h.api.setPushModalBlocked(false);assert.equal(h.routes.at(-1)[0],'Notifications');assert.equal(h.acks.length,0);
});
test('presentation hook requires focus, resolved content and the matching destination family',()=>{
 const calls=[],h={focused:false,ready:false,failed:false,family:'workout'};
 const react={createContext:()=>({}),useEffect:f=>f()};
 const api=load('contexts/NotificationInboxContext.tsx',{react,'react-native':{},'./AuthContext':{useAuth:()=>({user:{id:'owner'}})},'./NetworkContext':{},'../lib/notificationInbox':{},
 '@react-navigation/native':{useIsFocused:()=>h.focused,useRoute:()=>({params:{notificationOperation:'token'}})},
 '../lib/pushNotifications':{notificationOperationFamily:()=>h.family,confirmNotificationPresentation:(...a)=>calls.push(a)}});
 api.useNotificationPresentation(true,false,'workout');assert.equal(calls.length,0);
 h.focused=true;api.useNotificationPresentation(false,false,'workout');assert.equal(calls.length,0);
 api.useNotificationPresentation(true,false,'calendar');assert.equal(calls.length,0);
 api.useNotificationPresentation(true,false,'workout');assert.deepEqual(calls.pop(),['token','owner',true]);
 for(const family of ['report','check-in','bond-control']){h.family=family;api.useNotificationPresentation(true);assert.equal(calls.length,0);api.useNotificationPresentation(true,false,family);assert.equal(calls.pop()[2],true);}
});

test('leaving inbox while destination lookup is pending cancels late navigation',async()=>{
 const h=harness();let resolve;h.read=()=>new Promise(r=>resolve=r);const pending=h.api.openInboxNotification(id);
 h.api.notificationRouteChanged(undefined,'different-route');resolve({destination:{version:'1',type:'bedtime_story'}});await pending;
 assert.equal(h.routes.length,0);assert.equal(h.acks.length,0);
});
