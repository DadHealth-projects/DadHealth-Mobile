import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createUpgradeMomentSession } from '../lib/upgradeMomentManager.js';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
const request = { id:'weeklyReport', screen:'today', feature:'weekly_report', userId:'a', isPro:false, trialActive:false, loading:false, featureAccess:false, hasCompletedAction:true };

test('explicit prompts reopen without consuming or bypassing automatic caps', () => {
  const m=createUpgradeMomentSession();
  assert.equal(m.request(request),true); m.dismiss('today');
  assert.equal(m.request(request),false);
  for(let i=0;i<3;i++) { assert.equal(m.request({...request,trigger:'explicit',hasCompletedAction:false}),true); assert.equal(m.request({...request,trigger:'explicit'}),false); m.dismiss('today'); }
  assert.equal(m.request(request),false);
  const fresh=createUpgradeMomentSession(); fresh.request({...request,trigger:'explicit'}); fresh.dismiss('today'); assert.equal(fresh.request(request),true);
});
test('explicit prompts still reject Pro, trial, unknown and loading access',()=>{
  for(const change of [{isPro:true},{isPro:null},{trialActive:true},{trialActive:null},{featureAccess:null},{featureAccess:true},{loading:true}]) assert.equal(createUpgradeMomentSession().request({...request,trigger:'explicit',...change}),false);
});
function providerHarness() {
 const h={owner:'a',events:[],actions:[],ready:true}; let cursor=0,queued=[];const slots=[],effects=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>x===b[i]);
 const react={createContext:()=>({Provider:'Provider'}),useContext:()=>null,
  createElement:(type,props,...children)=>({type,props:props??{},children}),
  useRef:v=>{const i=cursor++;return slots[i]??={current:v};},
  useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
  useMemo:(fn,deps)=>{const i=cursor++;if(!same(slots[i]?.deps,deps))slots[i]={deps,value:fn()};return slots[i].value;},
  useCallback:(fn,deps)=>react.useMemo(()=>fn,deps),
  useEffect:(fn,deps)=>{const i=cursor++;if(!same(effects[i]?.deps,deps))queued.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});}};
 const navigationRef={isReady:()=>h.ready,getCurrentRoute:()=>({name:h.route??'Tabs'}),dispatch:a=>h.actions.push(a)};
 const mocks={react,'@react-navigation/native':{StackActions:{push:(name,params)=>({name,params})}},'../components/ProPromptModal':{default:'Prompt'},'../lib/proMoments':{PRO_MOMENTS:{weeklyReport:{body:'Weekly report'}}},'../lib/upgradeMomentManager':{createUpgradeMomentSession},'../lib/analytics':{trackEvent:(...a)=>h.events.push(a)},'./AuthContext':{useAuth:()=>({user:h.owner?{id:h.owner}:null})}};
 const exports={};vm.runInNewContext(compile(read('contexts/UpgradeMomentContext.tsx')),{exports,require:n=>{assert.ok(n in mocks,n);return mocks[n];}});
 h.render=()=>{cursor=0;queued=[];const tree=exports.UpgradeMomentProvider({children:null,navigationRef});h.request=tree.props.value.requestMoment;h.modal=tree.children[1];queued.forEach(fn=>fn());};
 h.unmount=()=>effects.forEach(e=>e?.cleanup?.());h.render();h.render();return h;
}
test('prompt waits for native dismissal, navigates once with metadata and reopens',()=>{
 const h=providerHarness();assert.equal(h.request({...request,trigger:'explicit'}),true);h.render();h.modal.props.onUpgrade();h.modal.props.onUpgrade();assert.equal(h.actions.length,0);h.render();assert.equal(h.modal.props.visible,false);h.modal.props.onDismissed();h.modal.props.onDismissed();assert.equal(h.actions.length,1);assert.equal(h.actions[0].params.feature,'weekly_report');h.render();assert.equal(h.request({...request,trigger:'explicit'}),true);h.unmount();
});
test('account change cancels old callbacks and resets only that account session',()=>{
 const h=providerHarness();h.request(request);h.render();h.modal.props.onUpgrade();h.render();const old=h.modal.props.onDismissed,oldRequest=h.request;
 h.owner='b';h.render();h.render();old();assert.equal(h.actions.length,0);assert.equal(oldRequest(request),false);assert.equal(h.request({...request,userId:'a'}),false);assert.equal(h.request({...request,userId:'b'}),true);h.render();h.modal.props.onDismiss();h.render();h.modal.props.onDismissed();h.render();assert.equal(h.request({...request,userId:'b'}),false);h.unmount();
});
test('unmounted prompt cannot navigate from a late dismissal',()=>{const h=providerHarness();h.request(request);h.render();h.modal.props.onUpgrade();h.render();const finish=h.modal.props.onDismissed;h.unmount();finish();assert.equal(h.actions.length,0);});
function navigationHarness() {
 const h={events:[],actions:[],state:{key:'stack-a',index:0,routes:[{key:'origin',name:'Tabs'}]},listeners:new Set(),auth:new Set()};
 const nav={getParent:()=>undefined,getState:()=>h.state,addListener:(_,fn)=>{h.listeners.add(fn);return()=>h.listeners.delete(fn);},dispatch:a=>h.actions.push(a)};
 const exports={};vm.runInNewContext(compile(read('lib/proNavigation.ts')),{exports,require:n=>{
  if(n==='@react-navigation/native')return {StackActions:{push:(name,params)=>({name,params})}};
  if(n==='./supabase')return {supabase:{auth:{onAuthStateChange:fn=>{h.auth.add(fn);return {data:{subscription:{unsubscribe:()=>h.auth.delete(fn)}}};}}}};
  return {trackEvent:(...a)=>h.events.push(a)};
 }});
 h.open=(owner='a')=>exports.navigateToProSubscription(nav,'aiWorkout','AI Workout',owner,'lock','ai_workout');
 h.emit=()=>[...h.listeners].forEach(fn=>fn());
 h.showPro=()=>{h.state={...h.state,index:1,routes:[h.state.routes[0],{key:'pro-new',name:'ProSubscription',params:h.actions.at(-1).params}]};h.emit();};
 return h;
}
test('unrelated state events cannot release pending Pro navigation; Back allows another entry',()=>{
 const h=navigationHarness();h.open();h.emit();h.emit();h.open();
 assert.equal(h.actions.length,1);assert.equal(h.listeners.size,1);assert.equal(h.auth.size,1);
 assert.equal(h.events.filter(e=>e[0]==='paywall_opened').length,1);
 assert.equal(h.actions[0].params.source,'aiWorkout');assert.equal(h.actions[0].params.feature,'ai_workout');
 h.showPro();assert.equal(h.listeners.size,0);assert.equal(h.auth.size,0);h.open();assert.equal(h.actions.length,1);
 h.state={...h.state,index:0,routes:[h.state.routes[0]]};h.emit();h.open();assert.equal(h.actions.length,2);h.showPro();
 assert.equal(h.listeners.size,0);assert.equal(h.auth.size,0);
});
test('navigator reset releases pending lock and removes listeners',()=>{
 for(const change of [{key:'stack-b'},{routes:[{key:'replacement',name:'Tabs'}]}]) {
  const h=navigationHarness();h.open();h.state={...h.state,...change};h.emit();assert.equal(h.listeners.size,0);assert.equal(h.auth.size,0);h.open();assert.equal(h.actions.length,2);h.showPro();
 }
});
test('account changes release navigation protection without waiting for another tap',()=>{
 const h=navigationHarness();h.open();const stale=[...h.auth][0];stale('SIGNED_IN',{user:{id:'b'}});
 assert.equal(h.listeners.size,0);assert.equal(h.auth.size,0);h.open('b');stale('SIGNED_OUT',null);assert.equal(h.listeners.size,1);h.showPro();assert.equal(h.listeners.size,0);assert.equal(h.auth.size,0);
});
test('same-account auth refresh preserves pending lock; next-owner call cleans old claim',()=>{
 const h=navigationHarness();h.open();[...h.auth][0]('TOKEN_REFRESHED',{user:{id:'a'}});h.emit();h.open();assert.equal(h.actions.length,1);
 h.open('b');assert.equal(h.actions.length,2);assert.equal(h.auth.size,1);assert.equal(h.listeners.size,1);h.showPro();assert.equal(h.auth.size,0);
});

function sheetHarness() {
 const source=read('components/AccountSheet.tsx');
 const animation=source.slice(source.indexOf('  const visibilityCycle ='),source.indexOf('  const onLayout ='));
 const membership=source.slice(source.indexOf('  const closeMembership ='),source.indexOf('  const dashboardRows:'));
 const h={visible:true,mounted:true,owner:{owner:'a'},pending:{current:null},frames:new Map(),animations:[],opened:0,closed:0};
 let cursor=0,queued=[],frameId=0,activeAnimation=null;const slots=[],effects=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
 const ctx={exports:{},SCREEN_HEIGHT:800,ANIM_MS:300,sheetHeight:400,
  useRef:v=>{const i=cursor++;return slots[i]??={current:v};},
  useMemo:(fn,deps)=>{const i=cursor++;if(!same(slots[i]?.deps,deps))slots[i]={deps,value:fn()};return slots[i].value;},
  useEffect:(fn,deps)=>{const i=cursor++;if(!same(effects[i]?.deps,deps))queued.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});},
  requestAnimationFrame:fn=>{h.frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>h.frames.delete(id),
  setMounted:v=>h.mounted=v,onClose:()=>{h.closed++;h.visible=false;},
  Animated:{timing:()=>({start:fn=>{activeAnimation?.({finished:false});activeAnimation=fn;h.animations.push(fn);}})},
  translateY:{setValue(){},stopAnimation(){activeAnimation?.({finished:false});activeAnimation=null;}},
 };
 const js=compile('export function render() { '+animation+membership+' return {closeMembership,finishMembershipDismissal}; }');
 vm.runInNewContext(js,ctx);
 h.render=()=>{cursor=0;queued=[];Object.assign(ctx,{visible:h.visible,mounted:h.mounted,ownerScope:h.owner,currentOwner:{current:h.owner},pendingMembership:h.pending});h.result=ctx.exports.render();queued.forEach(fn=>fn());};
 h.flushFrame=()=>{const frames=[...h.frames.values()];h.frames.clear();frames.forEach(fn=>fn());};
 h.finishAnimation=()=>activeAnimation?.({finished:true});
 h.unmount=()=>effects.forEach(e=>e?.cleanup?.());
 h.render();return h;
}
test('closing cancels pending opening frame; animation then native dismissal precede navigation',()=>{
 const h=sheetHarness();const staleFrame=[...h.frames.values()][0];
 h.result.closeMembership(()=>h.opened++);h.result.closeMembership(()=>h.opened++);
 assert.equal(h.closed,1);assert.equal(h.frames.size,0);h.render();staleFrame();assert.equal(h.animations.length,1);
 h.result.finishMembershipDismissal();assert.equal(h.opened,0);assert.equal(h.mounted,true);
 h.finishAnimation();assert.equal(h.mounted,false);assert.equal(h.opened,0);h.render();h.result.finishMembershipDismissal();h.result.finishMembershipDismissal();assert.equal(h.opened,1);h.unmount();
});
test('closing interrupts opening; old completion cannot hide a reopened sheet or navigate',()=>{
 const h=sheetHarness();h.flushFrame();const opening=h.animations[0];h.result.closeMembership(()=>h.opened++);h.render();const closing=h.animations.at(-1),oldDismiss=h.result.finishMembershipDismissal;
 opening({finished:true});assert.equal(h.mounted,true);h.visible=true;h.render();closing({finished:true});oldDismiss();assert.equal(h.mounted,true);assert.equal(h.opened,0);assert.equal(h.pending.current,null);h.unmount();
});
test('late animation and dismissal after account change or unmount cannot navigate',()=>{
 for(const mode of ['account','unmount']) {
  const h=sheetHarness();h.result.closeMembership(()=>h.opened++);h.render();const closing=h.animations.at(-1),dismiss=h.result.finishMembershipDismissal;
  if(mode==='account'){h.owner={owner:'b'};h.render();}else h.unmount();
  closing({finished:true});dismiss();assert.equal(h.opened,0);assert.equal(h.mounted,true);if(mode==='account')h.unmount();
 }
});
test('Dad Days only confirmed quota failure enters upgrade branch',()=>{
 const source=read('screens/subscreens/DadDaysSearchScreen.tsx');const condition=source.match(/if \((response.status === 403 && body.error === 'search_limit_reached')\)/)?.[1];assert.ok(condition);
 for(const [status,error,want] of [[403,'search_limit_reached',true],[403,'forbidden',false],[401,'Unauthorized',false],[503,'allowance_unavailable',false]]) assert.equal(vm.runInNewContext(condition,{response:{status},body:{error}}),want);
 assert.match(source,/remaining === 0/);assert.match(source,/FREE_LIMIT = 3/);
});
test('existing purchase refresh, manual Back, offline and initial-route contracts remain wired',()=>{
 const pro=read('screens/subscreens/ProSubscriptionScreen.tsx');assert.match(pro,/refreshDashboardForUser\(user.id\)/);assert.match(pro,/useNativeSubscriptions\(user\?\.id, refreshEntitlement\)/);assert.match(pro,/onPress=\{\(\) => navigation.goBack\(\)\}/);
 assert.match(pro,/isOffline \? showOfflineAction\('subscriptions'\)/);assert.doesNotMatch(read('hooks/useNativeSubscriptions.ts'),/navigation\.(navigate|goBack|dispatch)/);
 assert.match(read('hooks/useDashboard.ts'),/refreshDashboardIfIdle\(userId\)/);assert.doesNotMatch(read('contexts/RootNavigator.tsx'),/initialRouteName=['"]ProSubscription/);
});

test('entry inventory preserves source IDs and explicit feature mappings',()=>{
 const cases=[
 ['screens/DashboardScreen.tsx',"'score', 'Understand your score', 'lock', 'score_insights'"],
 ['screens/DashboardScreen.tsx',"'streak_freeze', 'Freeze your streak once a week', 'lock'"],
 ['screens/FitnessScreen.tsx',"'progressTrends', 'Body progress trends', user?.id, 'lock', 'trends'"],
 ['screens/FitnessScreen.tsx',"'aiWorkout', 'AI Workout', user?.id, 'lock', 'ai_workout'"],
 ['screens/FitnessScreen.tsx',"'meal_planner', 'Meal Planner'"],
 ['screens/FitnessScreen.tsx',"'workout_library', 'Workout library'"],
 ['screens/MindScreen.tsx',"'mind_plan', 'Personalised Mind Plan'"],
 ['screens/MindScreen.tsx',"'trends', 'Mood trends'"],
 ['screens/subscreens/AIWorkoutScreen.tsx',"'ai_workout', 'AI Workout'"],
 ['screens/subscreens/ActiveWorkoutScreen.tsx',"'ai_workout', 'AI Workout'"],
 ['screens/subscreens/MealPlannerScreen.tsx',"'meal_planner', 'Meal Planner'"],
 ['screens/subscreens/TDEECalculatorScreen.tsx',"'full_tdee', 'Full TDEE targets'"],
 ['screens/subscreens/MilestoneTrackerScreen.tsx',"'milestone_photos', 'Milestone photos and insights'"],
 ['screens/subscreens/ManualActivityHistoryScreen.tsx',"'progressTrends', 'Manual activity trends', user?.id, 'lock', 'trends'"],
 ['screens/subscreens/ProfileScreen.tsx',"source: 'profile_membership', context: 'Membership', feature: 'profile_membership'"],
 ['components/AccountSheet.tsx',"'account', 'Dad Health Pro'"],
 ['components/AccountSheet.tsx',"source: 'account_membership', context: 'Membership', feature: 'account_membership'"],
 ];
 for(const [path,text] of cases) assert.ok(read(path).includes(text),`${path}: ${text}`);
 for(const [path,id,feature] of [['screens/DashboardScreen.tsx','checkIn','mind_plan'],['screens/DashboardScreen.tsx','weeklyReport','weekly_report'],['screens/subscreens/DadDaysSearchScreen.tsx','dadDaysCounter','dad_days_unlimited']]) assert.match(read(path),new RegExp(`id: '${id}', trigger: 'explicit', screen: route.key, feature: '${feature}'`));
});


test('Dad Days permits three free searches and gates the fourth attempt',()=>{
 const source=read('screens/subscreens/DadDaysSearchScreen.tsx');
 const formula=source.slice(source.indexOf('  const remaining ='), source.indexOf('  // The usage counter'));
 for(let searchesUsed=0;searchesUsed<=3;searchesUsed++) {
  assert.equal(vm.runInNewContext(formula+'; limitReached', {FREE_LIMIT:3,searchesUsed,accessReady:true,isPro:false}),searchesUsed===3);
 }
 assert.equal(vm.runInNewContext(formula+'; limitReached', {FREE_LIMIT:3,searchesUsed:3,accessReady:true,isPro:true}),false);
 assert.doesNotMatch(source, /<ProUpgradeSection/);
 assert.match(source, /if \(limitReached\) \{\s*requestMoment\(\{ id: 'dadDaysCounter'/);
});
