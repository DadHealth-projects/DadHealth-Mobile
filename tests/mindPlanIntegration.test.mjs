import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = f => readFileSync(new URL('../'+f, import.meta.url),'utf8');
function load(f,mocks={},globals={}) {
 const exports={};vm.runInNewContext(ts.transpileModule(read(f),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,
 {exports,require:n=>{assert.ok(n in mocks,n);return mocks[n];},AbortController,Date,Set,setTimeout,clearTimeout,process,...globals});return exports;
}
const api=load('lib/mindPlan.ts',{'./supabase':{supabase:{}}});
const plain=v=>JSON.parse(JSON.stringify(v));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
const id='04000000-0000-4000-8000-000000000001';
function fixture(done=0,date='2026-11-17') {
 const completions=Array.from({length:done},(_,i)=>({actionNumber:i+1,completedOn:`2026-11-${String(11+i).padStart(2,'0')}`,completedAt:`2026-11-${String(11+i).padStart(2,'0')}T12:00:00Z`,timezone:'Europe/London'}));
 return {state:'available',currentDate:date,timezone:'Europe/London',receipt:null,plan:{id,version:'mind-plan-v1',copyStatus:'draft',variant:'balanced',createdAt:'2026-11-11T10:00:00Z',startedOn:'2026-11-11',
 actions:Array.from({length:7},(_,i)=>({id:'action-'+i,title:'Action '+(i+1),instruction:'Saved instruction '+i,route:i%2?'Journal':'BreathingSession'})),completions,completed:done===7,nextAction:done===7?null:done+1,canComplete:done<7&&(!done||date>completions.at(-1).completedOn)}};
}
function controller(result={state:'not_started'}) {
 const x={calls:[],views:[],answer:async()=>result};
 x.c=api.createMindPlanController('owner-a',async(owner,op,signal)=>{x.calls.push({owner,op,signal});return x.answer(op);},v=>x.views.push(v));return x;
}
test('parser allowlists every Batch 2 state without retaining restricted extras',()=>{
 for(const state of ['locked','not_started','unavailable','unauthorized'])assert.deepEqual(plain(api.parseMindPlan({state,plan:fixture().plan})),{state});
 for(const reason of ['daily_limit','plan_mismatch','action_out_of_order'])assert.equal(api.parseMindPlan({state:'conflict',reason}).reason,reason);
 const f=fixture();f.plan.privateText='hidden';assert.equal(api.parseMindPlan(f).plan.privateText,undefined);
 assert.equal(api.parseMindPlan(fixture(7)).plan.completed,true);
});
test('malformed plans, routes, progression and receipts fail closed',()=>{
 for(const change of [f=>f.plan.actions[0].route='ProSubscription',f=>f.plan.actions.pop(),f=>f.currentDate='2026-02-30',f=>f.plan.canComplete=false,
 f=>f.plan.nextAction=2,f=>f.plan.copyStatus='approved',f=>f.plan.actions[1].id=f.plan.actions[0].id,f=>f.receipt={actionNumber:1}]){
 const f=fixture();change(f);assert.throws(()=>api.parseMindPlan(f));}
 const f=fixture(2);f.plan.completions[1].completedOn=f.plan.completions[0].completedOn;assert.throws(()=>api.parseMindPlan(f));
});
test('read never starts; explicit start is synchronous-locked and confirmed only from saved response',async()=>{
 const x=controller();await x.c.refresh();assert.equal(x.calls.length,1);assert.equal(x.calls[0].op,null);
 const d=deferred();x.answer=()=>d.promise;const p=x.c.mutate({kind:'start'});await x.c.mutate({kind:'start'});
 assert.equal(x.calls.length,2);assert.equal(x.c.get().busy,true);assert.equal(x.c.get().result.state,'not_started');
 d.resolve(fixture());await p;assert.equal(x.c.get().result.plan.nextAction,1);assert.equal(x.c.get().uncertain,null);
});
test('failed start reconciles to a committed plan without repeating the POST',async()=>{
 const x=controller();await x.c.refresh();x.answer=async op=>{if(op)throw Error('lost response');return fixture();};
 await x.c.mutate({kind:'start'});assert.equal(x.calls.filter(c=>c.op).length,1);assert.equal(x.c.get().uncertain,null);assert.equal(x.c.get().result.state,'available');
});
test('uncertain completion retains exact identity and blocks next action until normal read confirms',async()=>{
 const x=controller(fixture());await x.c.refresh();x.answer=async()=>{throw Error('offline');};
 const operation={kind:'complete',planId:id,actionNumber:1};await x.c.mutate(operation);
 assert.deepEqual(plain(x.c.get().uncertain),operation);assert.equal(x.c.get().error,api.PLAN_UNCERTAIN);
 const calls=x.calls.length;await x.c.mutate({...operation,actionNumber:2});assert.equal(x.calls.length,calls);
 x.answer=async()=>fixture(1);await x.c.refresh();assert.equal(x.c.get().uncertain,null);assert.equal(x.c.get().result.plan.nextAction,2);
});
test('negative reconciliation permits only explicit retry of the same operation, no automatic writes',async()=>{
 const x=controller(fixture());await x.c.refresh();x.answer=async op=>{if(op)throw Error('lost');return fixture();};
 const op={kind:'complete',planId:id,actionNumber:1};await x.c.mutate(op);assert.equal(x.c.get().canRetryOperation,true);
 const n=x.calls.length;await x.c.mutate({...op,actionNumber:2});assert.equal(x.calls.length,n);
 await x.c.mutate(op);assert.equal(x.calls.filter(c=>c.op).length,2);assert.deepEqual(plain(x.c.get().uncertain),op);
});
test('read/write races cannot replace saved completion with stale read; refresh cannot cancel mutation',async()=>{
 const x=controller(fixture());await x.c.refresh();const read=deferred(),write=deferred();x.answer=op=>op?write.promise:read.promise;
 const r=x.c.refresh(),w=x.c.mutate({kind:'complete',planId:id,actionNumber:1});const n=x.calls.length;
 await x.c.refresh();assert.equal(x.calls.length,n);write.resolve(fixture(1));await w;read.resolve(fixture());await r;
 assert.equal(x.c.get().result.plan.completions.length,1);
});
test('completion uses server day eligibility, not device clock, including DST, missed days and completed plan',async()=>{
 for(const f of [fixture(1,'2026-11-11'),fixture(7)]){const x=controller(f);await x.c.refresh();await x.c.mutate({kind:'complete',planId:id,actionNumber:f.plan.nextAction??7});assert.equal(x.calls.length,1);}
 const f=fixture(1,'2027-03-28');assert.equal(api.parseMindPlan(f).plan.canComplete,true);const x=controller(f);await x.c.refresh();x.answer=async()=>fixture(2,'2027-03-28');await x.c.mutate({kind:'complete',planId:id,actionNumber:2});assert.equal(x.c.get().result.plan.completions.length,2);
});
test('locked/unknown/unavailable never expose content or permit writes; re-access reads retained server progress',async()=>{
 for(const state of ['locked','unavailable','unauthorized']){const x=controller({state});await x.c.refresh();await x.c.mutate({kind:'start'});assert.equal(x.calls.length,1);assert.equal(x.c.get().verified,false);assert.equal(x.c.get().result?.plan,undefined);}
 const x=controller(fixture(3));await x.c.refresh();x.answer=async()=>({state:'locked'});await x.c.refresh();assert.equal(x.c.get().result.state,'locked');
 x.answer=async()=>fixture(3);await x.c.refresh();assert.equal(x.c.get().result.plan.nextAction,4);
});
test('offline and invalidation hide private state and reject late responses without losing uncertain identity',async()=>{
 const x=controller(fixture());await x.c.refresh();const d=deferred();x.answer=()=>d.promise;const write=x.c.mutate({kind:'complete',planId:id,actionNumber:1});
 x.c.setOffline(true);assert.equal(x.c.get().result,null);assert.equal(x.c.get().uncertain.actionNumber,1);d.resolve(fixture(1));await write;assert.equal(x.c.get().result,null);
 x.c.setOffline(false);x.answer=async()=>fixture(1);await x.c.refresh();assert.equal(x.c.get().uncertain,null);
});
test('disposed owner cannot publish late callbacks or mutate',async()=>{
 const x=controller();const d=deferred();x.answer=()=>d.promise;const r=x.c.refresh();x.c.dispose();const n=x.views.length;d.resolve(fixture());await r;await x.c.mutate({kind:'start'});assert.equal(x.views.length,n);
});
test('background read retains valid content while loading, but verification failure clears it',async()=>{
 const x=controller(fixture());await x.c.refresh();const d=deferred();x.answer=()=>d.promise;const r=x.c.refresh();assert.equal(x.c.get().result.state,'available');assert.equal(x.c.get().loading,true);
 d.reject(Error());await r;assert.equal(x.c.get().result,null);assert.equal(x.c.get().error,api.PLAN_UNAVAILABLE);
});
test('navigation binds owner, plan, action and allows only current/completed actions',()=>{
 const f=fixture(1);const target=api.planDestination('a',f,2);assert.equal(target.action.route,'Journal');
 assert.ok(api.validPlanDestination(target,'a',f));assert.equal(api.validPlanDestination(target,'b',f),false);
 const changed=fixture(1);changed.plan.id='04000000-0000-4000-8000-000000000002';assert.equal(api.validPlanDestination(target,'a',changed),false);
 assert.equal(api.planDestination('a',f,3),null);assert.equal(api.planDestination('a',fixture(1,'2026-11-11'),2),null);assert.ok(api.planDestination('a',fixture(7),1));
});
test('actual transport authenticates owner and sends exact GET/start/complete bodies',async()=>{
 const requests=[];const session={user:{id:'a'},access_token:'test-token'};
 const client=load('lib/mindPlan.ts',{'./supabase':{supabase:{auth:{getSession:async()=>({data:{session},error:null})}}}},
 {fetch:async(url,init)=>{requests.push({url,init});return {status:200,json:async()=>fixture()};}});
 for(const op of [null,{kind:'start'},{kind:'complete',planId:id,actionNumber:1}])await client.requestMindPlan('a',op,new AbortController().signal);
 assert.equal(requests[0].init.method,'GET');assert.equal(requests[0].init.body,undefined);assert.equal(requests[1].init.body,'{}');assert.deepEqual(JSON.parse(requests[2].init.body),{planId:id,actionNumber:1});
 await assert.rejects(()=>client.requestMindPlan('b',null,new AbortController().signal));assert.equal(requests.length,3);
});
function harness() {
 const slots=[],effects=[];let cursor=0,pending=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),
 useState(value){const i=cursor++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
 useRef(value){const i=cursor++;return slots[i]??={current:value};},
 useCallback(fn,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))slots[i]={fn,deps};return slots[i].fn;},
 useMemo(fn,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))slots[i]={value:fn(),deps};return slots[i].value;},
 useEffect(fn,deps){const i=cursor++;if(!same(effects[i]?.deps,deps))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});}};
 react.default=react;
 return {react,render(fn){cursor=0;pending=[];const result=fn();pending.forEach(f=>f());return result;},unmount(){effects.forEach(e=>e?.cleanup?.());}};
}
const walk=n=>!n?[]:Array.isArray(n)?n.flatMap(walk):typeof n==='object'?[n,...walk(n.props?.children)]:[];
test('Mind entry stays static and usable for verified, checking, failed and offline access',()=>{
 const source=read('screens/MindScreen.tsx');
 const start=source.indexOf('<FadeInView delay={170}>');
 const entry=source.slice(start,source.indexOf('</FadeInView>',start)+'</FadeInView>'.length);
 const js=ts.transpileModule('globalThis.tree=('+entry+');',{compilerOptions:{jsx:ts.JsxEmit.React}}).outputText;
 for(const planAccess of [true,false,null])for(const failed of [false,true]){
  const h=harness(),calls=[];const ctx={React:h.react,FadeInView:'Fade',Pressable:'Pressable',Text:'Text',MindPlanLockedCard:'Locked',
   planAccess,user:{id:'a'},closingPlan:{current:false},planNativePresented:false,
   mindPlan:{view:{error:failed?'Private request error':null},isOffline:failed,refresh:()=>calls.push('refresh')},
   setMindPlanOpen:value=>calls.push(value),navigation:{},navigateToProSubscription:()=>calls.push('upgrade')};
  vm.runInNewContext(js,ctx);const nodes=walk(ctx.tree),copy=JSON.stringify(ctx.tree);
  assert.doesNotMatch(copy,/Checking|Loading|unavailable|Retry|Private request error|Saved instruction/);
  if(planAccess===false){nodes.find(n=>n.type==='Locked').props.onUnlock();assert.deepEqual(calls,['upgrade']);}
  else{assert.match(copy,/Personalised Mind Plan/);assert.match(copy,/A seven-day plan shaped around your goals\./);
   assert.ok(copy.includes(planAccess?'Open plan':'View plan'));
   nodes.find(n=>n.type==='Pressable').props.onPress();assert.deepEqual(calls,[true,'refresh']);}
 }
});
test('dashboard unknown plan entry opens verification sheet instead of an upgrade',()=>{
 const source=read('screens/DashboardScreen.tsx');
 const handler=source.slice(source.indexOf('  const openCheckInPlan ='),source.indexOf('  const openFocus ='));
 const js=ts.transpileModule(handler+'\nglobalThis.open=openCheckInPlan;',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 for(const buildMyPlanAccess of [null,true,false]){
  const calls=[];const ctx={useCallback:fn=>fn,buildMyPlanAccess,requestMoment:()=>calls.push('upgrade'),route:{key:'today'},user:{id:'a'},
   data:{checkedInToday:true},entitlement:{},navigation:{navigate:(...args)=>calls.push(args)}};
  vm.runInNewContext(js,ctx);ctx.open();
  assert.deepEqual(plain(calls),buildMyPlanAccess===false?['upgrade']:[['Tabs',{screen:'Mind',params:{openPersonalisedPlan:true}}]]);
 }
 const card=read('components/dashboard/CheckInFollowUp.tsx');
 assert.match(card,/Build my plan/);assert.match(card,/A seven-day plan shaped around your goals\./);
 assert.doesNotMatch(card,/Checking|Loading|temporarily unavailable|Retry/);
});
function sheetHarness(){const h=harness();const Sheet=load('components/mind/PersonalisedMindPlanSheet.tsx',{react:h.react,
 'react-native':{ActivityIndicator:'Spinner',Modal:'Modal',Platform:{OS:'ios'},Pressable:'Pressable',ScrollView:'Scroll',Text:'Text',View:'View'},
 'react-native-safe-area-context':{SafeAreaView:'Safe'},'@expo/vector-icons':{Feather:'Icon'},'../LimeButton':{__esModule:true,default:'LimeButton'},'./MindPlanLockedCard':{__esModule:true,default:'Locked'},'../../theme':{colors:{}}}).default;
 return {...h,show:props=>h.render(()=>Sheet({visible:true,userId:'a',onClose(){},onDismiss(){},onShow(){},...props}))};}
test('actual sheet renders locked/unknown/start states without personal content or Retry',()=>{
 const h=sheetHarness();for(const result of [null,{state:'locked'},{state:'not_started'}]){
 const view={result,verified:result?.state==='not_started',error:null};const tree=h.show({view});const str=JSON.stringify(tree);
 assert.doesNotMatch(str,/Saved instruction|Retry/);if(result?.state==='locked')assert.ok(walk(tree).some(n=>n.type==='Locked'));
 if(result?.state==='not_started')assert.ok(walk(tree).some(n=>n.props.label==='Start my plan'));
 }
});
test('actual sheet separates open from complete, shows seven rows and keeps future controls disabled',()=>{
 const h=sheetHarness();const calls=[];const f=fixture();const tree=h.show({view:{result:f,verified:true,busy:false},onActivity:n=>calls.push(['open',n]),onComplete:(id,n)=>calls.push(['complete',id,n])});
 const nodes=walk(tree);nodes.find(n=>n.props.label==='Open Mind Reset').props.onPress();assert.deepEqual(calls,[['open',1]]);
 nodes.find(n=>n.type==='Pressable'&&n.props.accessibilityState?.busy===false).props.onPress();assert.equal(calls[1][0],'complete');
 const rows=nodes.filter(n=>n.props.accessibilityLabel?.startsWith('Action '));assert.equal(rows.length,7);assert.equal(rows.filter(n=>n.props.disabled).length,6);
});
test('actual sheet done-today and completed states expose no next-action completion; history remains reviewable',()=>{
 for(const f of [fixture(1,'2026-11-11'),fixture(7)]){const h=sheetHarness();const view={result:f,verified:true,busy:false};const tree=h.show({view});
 assert.doesNotMatch(JSON.stringify(tree),/Mark as done|Start my plan/);const first=walk(tree).find(n=>n.props.accessibilityLabel?.startsWith('Action 1:'));first.props.onPress();
 const review=h.show({view});assert.match(JSON.stringify(review),/Saved instruction 0/);assert.doesNotMatch(JSON.stringify(review),/Mark as done/);}
});
test('hook clears synchronously on account/access change, fetches despite unknown dashboard access and refreshes on return',async()=>{
 const h=harness();let owner='a',access=null,focused=true,offline=false,resume;const calls=[];
 const hook=load('hooks/useMindPlan.ts',{react:h.react,'react-native':{AppState:{addEventListener(_,fn){resume=fn;return {remove(){}};}}},
 '../contexts/NetworkContext':{useNetworkStatus:()=>({isOffline:offline})},'../lib/mindPlan':{...api,requestMindPlanWithRetry:async(o,op)=>{calls.push({o,op});return fixture();}}}).useMindPlan;
 const render=()=>h.render(()=>hook(owner,access,focused));render();await tick();let result=render();assert.equal(result.view.result.state,'available');assert.ok(calls.length);
 owner='b';result=render();assert.equal(result.view,null);await tick();result=render();assert.equal(result.view.result.state,'available');
 access=false;result=render();assert.equal(result.view,null);await tick();render();const n=calls.length;focused=false;render();focused=true;render();await tick();assert.ok(calls.length>n);
 offline=true;assert.equal(render().view,null);h.unmount();resume?.('active');
});
function journalHarness() {
 const h=harness();const user={id:'a'},route={params:{}},alerts=[],saved=[];
 const native={Alert:{alert:(...args)=>alerts.push(args)},KeyboardAvoidingView:'Keyboard',Platform:{OS:'ios'},Pressable:'Pressable',ScrollView:'Scroll',Text:'Text',View:'View'};
 const mocks={react:h.react,'react-native':native,'react-native-safe-area-context':{SafeAreaView:'Safe'},'@expo/vector-icons':{Feather:'Icon'},
 '@react-navigation/native':{useRoute:()=>route,useNavigation:()=>({navigate(){},goBack(){},setParams(p){Object.assign(route.params,p);}})},
 '../../contexts/AuthContext':{useAuth:()=>({user})},'../../contexts/NotificationInboxContext':{useNotificationPresentation(){}},
 '../../hooks/useDashboard':{useDashboard:()=>({data:{moodLogs:[]}})},'../../hooks/useJournalEntries':{useJournalEntries:()=>({entries:[],createEntry:(...args)=>saved.push(args)})},
 '../../lib/mindExperienceContent':{localDateKey:()=>'',selectMindJournalPrompts:()=>['One','Two','Three']},'../../theme':{colors:{}}};
 for(const name of ['AppTopBar','GlobalErrorToastReporter','InlineFormError','LimeButton','MultilineTextInput'])mocks['../../components/'+name]={__esModule:true,default:name};
 const Wrapper=load('screens/subscreens/JournalScreen.tsx',mocks).default;
 const Inner=Wrapper().type;
 return {...h,route,alerts,saved,user,show:()=>h.render(()=>Inner())};
}
test('Journal plan handoff selects the saved prompt without writing or completing anything',()=>{
 const h=journalHarness();h.route.params.planPrompt={owner:'a',planId:id,actionId:'journal',prompt:'Saved plan question'};
 h.show();const tree=h.show();assert.equal(h.route.params.planPrompt,undefined);assert.match(JSON.stringify(tree),/Saved plan question/);assert.equal(h.saved.length,0);assert.equal(h.alerts.length,0);
});
test('Journal existing draft offers keep/switch and neither option overwrites text or saves',()=>{
 for(const choice of ['Keep mine','Switch prompt']){
 const h=journalHarness();h.route.params.openEditor=true;h.show();let tree=h.show();
 walk(tree).find(n=>n.type==='MultilineTextInput').props.onChangeText('My private draft');h.show();
 h.route.params.planPrompt={owner:'a',planId:id,actionId:'journal',prompt:'New saved prompt'};h.show();
 const button=h.alerts.at(-1)[2].find(b=>b.text===choice);button.onPress?.();tree=h.show();
 assert.equal(walk(tree).find(n=>n.type==='MultilineTextInput').props.value,'My private draft');assert.equal(h.saved.length,0);
 assert.equal(JSON.stringify(tree).includes('New saved prompt'),choice==='Switch prompt');
 }
});
test('Journal rejects another owner prompt and stale alert callbacks after unmount',()=>{
 const h=journalHarness();h.route.params.planPrompt={owner:'b',planId:id,actionId:'journal',prompt:'Wrong owner'};h.show();assert.doesNotMatch(JSON.stringify(h.show()),/Wrong owner/);assert.equal(h.alerts.length,0);
 h.route.params.openEditor=true;h.show();let tree=h.show();walk(tree).find(n=>n.type==='MultilineTextInput').props.onChangeText('Keep me');h.show();
 h.route.params.planPrompt={owner:'a',planId:id,actionId:'journal',prompt:'Late prompt'};h.show();h.unmount();h.alerts.at(-1)[2][1].onPress();assert.doesNotMatch(JSON.stringify(h.show()),/Late prompt/);
});
test('actual Mind handlers wait for dismissal, consume once and reject stale owner/access',()=>{
 const source=read('screens/MindScreen.tsx');const start=source.indexOf('  const openPlanActivity =');const end=source.indexOf('\n  const trendLockViewed',start);
 const code=ts.transpileModule(source.slice(start,end)+'\nexports.open=openPlanActivity;exports.dismiss=finishPlanDismissal;',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 for(const invalid of [null,'owner','access','plan']){
 const calls=[],exports={};const context={exports,user:{id:'a'},mindPlanOpen:true,closingPlan:{current:false},mindPlan:{view:{verified:true,busy:false}},
 planResult:fixture(1),pendingPlanDestination:{current:null},pendingPlanUpgrade:{current:null},focused:true,
 closeMindPlan(){context.closingPlan.current=true;context.mindPlanOpen=false;calls.push('close');},setPlanNativePresented(){},
 planDestination:api.planDestination,validPlanDestination:api.validPlanDestination,navigation:{navigate:(...args)=>calls.push(args)},navigateToProSubscription(){throw Error('Unexpected upgrade');}};
 vm.runInNewContext(code,context);exports.open(2);assert.deepEqual(calls,['close']);exports.open(2);assert.equal(calls.length,1);
 if(invalid==='owner')context.user={id:'b'};if(invalid==='access')context.mindPlan.view.verified=false;if(invalid==='plan')context.planResult=fixture();
 // A changed plan identity invalidates the queued destination.
 if(invalid==='plan')context.planResult.plan.id='04000000-0000-4000-8000-000000000002';
 exports.dismiss();exports.dismiss();assert.equal(calls.length,invalid?1:2);
 if(!invalid){assert.equal(calls[1][0],'Journal');assert.equal(calls[1][1].planPrompt.prompt,'Saved instruction 1');}
 }
});
test('Journal hook rejects stale owner reads and earlier requests while preserving current owner cache',async()=>{
 const h=harness();let owner='a';const requests=[];const caches=new Map();
 const mocks={react:h.react,'expo-crypto':{randomUUID:()=>id},'../contexts/NetworkContext':{useNetworkStatus:()=>({isOffline:false})},
 '../lib/analytics':{trackEvent(){}},'../lib/offlineStorage':{readJournalCache:async o=>caches.get(o)??[],writeJournalCache:async(o,v)=>caches.set(o,v),subscribeOfflineSync:()=>()=>{},enqueueOfflineWrite:async()=>{}},
 '../lib/offlineSync':{isRetryableOfflineError:()=>false,createJournalQueueItem(){},persistJournalEntry:async()=>{}},
 '../lib/supabase':{supabase:{from(){let account;const query={select(){return query;},eq(_,o){account=o;return query;},order(){const d=deferred();requests.push({owner:account,...d});return d.promise;}};return query;}}}};
 const hook=load('hooks/useJournalEntries.ts',mocks).useJournalEntries;const render=()=>h.render(()=>hook(owner));render();await tick();assert.equal(requests[0].owner,'a');
 owner='b';assert.equal(render().entries.length,0);await tick();requests[1].resolve({data:[{id:'b-entry',user_id:'b',created_at:'2026-11-17'}],error:null});await tick();assert.equal(render().entries[0].id,'b-entry');
 requests[0].resolve({data:[{id:'a-entry',user_id:'a',created_at:'2026-11-17'}],error:null});await tick();assert.equal(render().entries[0].id,'b-entry');assert.equal(caches.has('a'),false);
 const current=render();const r1=current.refresh();await tick();const r2=current.refresh();await tick();requests[3].resolve({data:[{id:'new',created_at:'2026-11-17'}],error:null});await r2;
 requests[2].resolve({data:[{id:'old',created_at:'2026-11-17'}],error:null});await r1;assert.equal(render().entries[0].id,'new');h.unmount();
});
