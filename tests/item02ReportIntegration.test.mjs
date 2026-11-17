import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(path, mocks = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText, { exports, Date, Intl, AbortController, setTimeout, clearTimeout, process: { env: {} }, __DEV__: false,
    ...globals, require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  return exports;
}
const trend = { formatScoreTrend: value => ({ arrow: '', change: value }) };
const reportApi = (dev = false) => load('lib/weeklyReport.ts', { './scoreTrends': trend }, { __DEV__: dev });
const api = reportApi();
test('verified freeze allowance remains visible when dashboard access is unknown', () => {
  const react = { memo: fn => fn, createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useRef: value => ({ current: value }), useEffect() {} };
  const Card = load('components/dashboard/StreakCard.tsx', {
    react: { ...react, default: react }, '@expo/vector-icons': { Feather: 'Feather' },
    'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View' },
    '../../theme': { colors: { dark: '#000' } }, './ProBadge': { default: 'ProBadge' },
    '../../lib/analytics': { trackEvent() {} },
  }).default;
  const status = { state: 'current', count: 6, allowance: 1, protectedDates: [], calendarDays: [] };
  const render = (changes = {}) => JSON.stringify(Card({ status, freezeAccess: null, error: null,
    onRetry() {}, onUpgrade() {}, ...changes }));
  assert.match(render(), /One automatic freeze available this week/);
  assert.match(render(), /6-day streak/);
  for (const changes of [{ status: null }, { error: 'read_failed' },
    { status: { ...status, state: 'pending', count: null, allowance: null } },
    { status: { ...status, allowance: 0 } }]) {
    assert.doesNotMatch(render(changes), /One automatic freeze available this week/);
  }
  assert.match(render({ status: { ...status, allowance: 0 }, freezeAccess: false }), /Freeze your streak once a week/);
});
const number = value => ({ state: 'available', value });
function payload(access = 'pro') {
  return { state: 'available', access, report: { version: 2,
    period: { weekStart: '2026-11-09', weekEndExclusive: '2026-11-16' }, comparison: { state: 'available' },
    pillars: Object.fromEntries(['mind','body','bond'].map(p => [p, { score: number(64), changePoints: number(3), trendMessage: null }])),
    details: { workouts: number(2), bondSessions: number(3), checkins: number(5),
      streak: { days: number(6), protectedDates: ['2026-11-10'] },
      narrative: 'private', focus: { pillar: 'mind', action: 'mind_breathing', text: 'Saved focus' } } } };
}
test('saved Free projection cannot retain injected Pro details', () => {
  const result = api.parseSavedReport(payload('free'));
  assert.equal(result.details, undefined); assert.equal(result.pillars.length,3);
  assert.doesNotMatch(JSON.stringify(result), /private|workouts|protectedDates|focus/);
});
test('Pro reads only saved values, dates and score-point comparisons', () => {
  const result = api.parseSavedReport(payload());
  assert.equal(result.details.streak.days.value,6); assert.equal(result.details.workouts.value,2);
  assert.equal(api.savedChange(result.pillars[0], true),'↑ 3 pts');
  assert.equal(api.reportDates(result.weekStart,result.weekEndExclusive),'9 Nov – 15 Nov');
});
test('missing history uses exact fallback; unknown access and malformed weeks fail closed', () => {
  const data = payload(); data.report.comparison.state = 'unavailable';
  data.report.pillars.mind.changePoints = { state: 'unavailable' };
  data.report.pillars.mind.trendMessage = 'Building first 7 day trend';
  const result = api.parseSavedReport(data);
  assert.equal(api.savedChange(result.pillars[0], result.comparisonAvailable),'Building first 7 day trend');
  assert.throws(() => api.parseSavedReport(payload('unknown')));
  assert.equal(api.isReportWeek('2026-11-15'),false); assert.equal(api.isReportWeek('2026-02-30'),false);
});
test('development mode cannot substitute preview data for saved API reports', () => {
  assert.equal(api.developmentReportPreview, undefined);
  assert.equal(reportApi(true).developmentReportPreview, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseSavedReport(payload()))),
    JSON.parse(JSON.stringify(reportApi(true).parseSavedReport(payload()))));
});
const tick = () => new Promise(resolve => setImmediate(resolve));
function hooks(initialAccess = true) {
  const slots=[], effects=[]; let cursor=0, pending=[];
  const equal = (a,b) => a && b && a.length===b.length && a.every((v,i)=>v===b[i]);
  const react = {
    useState(initial) { const i=cursor++; if (!(i in slots)) slots[i]=initial;
      return [slots[i],v=>{ slots[i]=typeof v==='function'?v(slots[i]):v; }]; },
    useRef(initial) { const i=cursor++; return slots[i]??= {current:initial}; },
    useCallback(fn,deps) { const i=cursor++; if (!equal(slots[i]?.deps,deps)) slots[i]={fn,deps}; return slots[i].fn; },
    useEffect(fn,deps) { const i=cursor++; if (!equal(effects[i]?.deps,deps)) pending.push(()=>{
      effects[i]?.cleanup?.(); effects[i]={deps,cleanup:fn()}; }); },
  };
  const h={owner:'a',access:initialAccess,offline:false,requests:[], answer:payload(), fail:false};
  const module=load('hooks/useWeeklyReport.ts', {
    react, 'react-native': { AppState: {currentState:'active',addEventListener(_,fn){h.resume=fn;return {remove(){}};}} },
    '../contexts/NetworkContext':{useNetworkStatus:()=>({isOffline:h.offline})},
    '../lib/offlineStorage':{subscribeOfflineSync:fn=>{h.sync=fn;return ()=>{};}},
    '../lib/weeklyReport':api,
    '../lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:h.owner},access_token:'mock'}}})}}},
  },{fetch:async(url,options)=>{
    h.requests.push({url,options}); if(h.respond) return h.respond(url, options); if(h.wait) await h.wait;
    if(h.fail) throw Error('offline'); return {ok:h.ok !== false,json:async()=>h.answer};
  }});
  h.render=()=>{cursor=0;pending=[];h.result=module.useWeeklyReport(h.owner,h.access,h.week);pending.forEach(fn=>fn());return h.result;};
  h.flush=async()=>{await tick();h.render();await tick();h.render();};
  h.unmount=()=>effects.forEach(e=>e?.cleanup?.());
  h.render();return h;
}
test('loaded content stays interactive through background refresh and recoverable failure',async()=>{
  const h=hooks();await h.flush();assert.equal(h.result.report.details.workouts.value,2);
  let release;h.wait=new Promise(r=>release=r);const pending=h.result.refresh();await tick();h.render();
  assert.equal(h.result.loading,true);assert.equal(h.result.report.details.workouts.value,2);
  h.fail=true;release();await pending;await h.flush();
  assert.equal(h.result.loading,false);assert.equal(h.result.error,'read_failed');assert.ok(h.result.report);
  h.fail=false;h.wait=null;await h.result.refresh();await h.flush();assert.equal(h.result.error,null);h.unmount();
});
test('failed initial load settles without repeated automatic attempts; explicit Retry works',async()=>{
  const h=hooks();h.fail=true;await h.flush();assert.equal(h.result.report,null);assert.equal(h.result.loading,false);
  const calls=h.requests.length;for(let i=0;i<4;i++) await h.flush();assert.equal(h.requests.length,calls);
  h.fail=false;await h.result.refresh();await h.flush();assert.ok(h.result.report);h.unmount();
});
test('account changes abort stale work; downgrade and private-cache cleanup remove Pro details',async()=>{
  const h=hooks();await h.flush();let release;h.wait=new Promise(r=>release=r);
  const pending=h.result.refresh();await tick();const activeRequest=h.requests.at(-1);h.owner='b';h.render();assert.equal(h.result.report,null);
  assert.equal(activeRequest.options.signal.aborted,true);
  release();await pending;await h.flush();h.wait=null;
  h.access=false;h.answer=payload('free');h.render();assert.equal(h.result.report,null);await h.flush();
  assert.equal(h.result.report.details,undefined);
  h.sync({userId:'b',status:'cleared'});h.render();assert.equal(h.result.report,null);h.unmount();
});
test('exact week is requested, offline preserves content, unmount cancels pending fetch',async()=>{
  const h=hooks();await h.flush();h.week='2026-11-09';h.render();await h.flush();
  assert.match(h.requests.at(-1).url,/\?week=2026-11-09$/);
  h.offline=true;h.render();await h.flush();assert.ok(h.result.report);assert.equal(h.result.error,'offline');
  h.offline=false;let release;h.wait=new Promise(r=>release=r);h.render();await tick();h.unmount();
  assert.equal(h.requests.at(-1).options.signal.aborted,true);release();await tick();
});
test('missing saved week settles empty, while unknown entitlement removes private data',async()=>{
  const h=hooks();await h.flush();h.ok=false;h.answer={state:'unavailable',reason:'snapshot_missing'};
  await h.result.refresh();await h.flush();assert.equal(h.result.empty,true);assert.equal(h.result.error,null);
  assert.equal(h.result.report,null);
  h.answer={state:'unavailable',reason:'entitlement_unavailable'};
  await h.result.refresh();await h.flush();assert.equal(h.result.empty,false);
  assert.equal(h.result.error,'entitlement_unavailable');assert.equal(h.result.report,null);
  const calls=h.requests.length;h.access=null;h.render();assert.equal(h.result.report,null);
  await h.flush();assert.equal(h.requests.length,calls+1);assert.equal(h.result.error,'entitlement_unavailable');
  assert.equal(h.result.report,null);h.unmount();
});
test('live streak reader preserves pending versus current and canonical calendar dates',()=>{
  const {parseStreakStatus}=load('hooks/useStreakStatus.ts',{'./useWeeklyReport':{}});
  const streak={state:'current',count:4,lastKnownCount:4,reconciledThrough:'2026-11-14',allowance:0,
    protectedDates:['2026-11-10'],calendarDays:Array.from({length:7},(_,i)=>`2026-11-${String(i+9).padStart(2,'0')}`),currentDate:'2026-11-15'};
  assert.equal(parseStreakStatus({streak}).count,4);
  assert.equal(parseStreakStatus({streak:{...streak,state:'pending',count:null,allowance:null}}).count,null);
  assert.throws(()=>parseStreakStatus({streak:{...streak,state:'pending'}}));
});
function pushHarness() {
  const h={routes:[]};
  const sdk={initialize(){},login(){},logout(){},Notifications:{addEventListener(_,fn){h.click=fn;}}};
  h.api=load('lib/pushNotifications.ts',{
    'react-native':{Platform:{OS:'ios'},NativeModules:{OneSignal:{}},TurboModuleRegistry:{get:()=>({})}},
    './notificationDestinations':load('lib/notificationDestinations.ts',{'./weeklyReport':api,'./deepLinks':{isValidCommunityPostId:()=>false}}),
    'react-native-onesignal':{OneSignal:sdk},'./deepLinks':{isValidCommunityPostId:()=>false},'./weeklyReport':api,
  },{process:{env:{EXPO_PUBLIC_ONESIGNAL_APP_ID:'mock'}}});
  h.api.initializePushNotifications();h.api.attachPushNavigation({isReady:()=>true,navigate:(...args)=>h.routes.push(args)});
  h.tap=(week='2026-11-09',id='notification')=>h.click({notification:{notificationId:id,additionalData:{type:'weekly_score',reporting_week:week}}});
  return h;
}
test('weekly push waits for login then opens exact saved week once',()=>{
  const h=pushHarness();h.api.setPushNavigationLifecycleReady(true,false);h.tap();assert.equal(h.routes.length,0);
  h.api.loginPushUser('a');h.api.setPushNavigationLifecycleReady(true,true);
  assert.equal(h.routes.length,1);assert.equal(h.routes[0][1].params.openWeeklyReport,'2026-11-09');
  h.tap();assert.equal(h.routes.length,1);
});
test('malformed week and account-bound pending push cannot navigate for another account',()=>{
  const h=pushHarness();h.api.loginPushUser('a');h.api.setPushNavigationLifecycleReady(false,true);h.tap();
  h.api.loginPushUser('b');h.api.setPushNavigationLifecycleReady(true,true);assert.equal(h.routes.length,0);
  h.tap('2026-11-15','bad');assert.equal(h.routes.length,0);
  h.tap('2026-11-02','new');assert.equal(h.routes[0][1].params.openWeeklyReport,'2026-11-02');
});
test('approved report sheet uses saved overall and rounded pillars without mutating saved data',()=>{
  const effects=[];
  const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useRef:v=>({current:v}),useEffect:fn=>effects.push(fn),useState:v=>[v,()=>{}]};
  const native=Object.fromEntries(['ActivityIndicator','Modal','Pressable','ScrollView','Text','View'].map(n=>[n,n]));
  const {default:Sheet}=load('components/dashboard/WeeklyReportSheet.tsx',{
    react:{...react,default:react},'@expo/vector-icons':{Feather:'Feather',MaterialCommunityIcons:'MaterialCommunityIcons'},
    'react-native':{...native,Platform:{OS:'ios'},useColorScheme:()=> 'dark'},
    'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'../../theme':{colors:{dark:'#000',text:'#fff',lime:'#cf5',border:'#333'}},
    '../../lib/analytics':{trackEvent(){}},'../../lib/weeklyReport':api,
    '../../lib/weeklyReportSharing':{shareWeeklyDadHealthReport:async()=>null},
    './DadScoreCard':{__esModule:true,default:'DadScoreCard'},'./SectionHeader':{__esModule:true,default:'SectionHeader'},
  });
  let dismissed=0;
  const report=api.parseSavedReport(payload());
  report.pillars[0].score.value=64.9876;report.pillars[0].change.value=3.2345;
  report.totalScore={state:'available',value:72};
  const original=JSON.stringify(report);
  const view=Sheet({visible:true,report,loading:false,error:null,empty:false,userId:'a',
    onClose(){},onDismiss(){dismissed++;},onRetry(){},onUpgrade(){}});
  const serialized=JSON.stringify(view);
  for(const text of ['Weekly report','Mind','Body','Bond','Workouts','Check-ins','Your week','Next week','Saved focus']) {
    assert.ok(serialized.includes(text),text);
  }
  const nodes=[];
  const visit=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(visit);return;}nodes.push(n);visit(n.props?.children);};
  visit(view);
  const card=nodes.find(n=>n.type==='DadScoreCard');
  assert.equal(card.props.score,72);assert.equal(card.props.missingScore,'\u2014');
  assert.equal(card.props.items[0].value,65);assert.equal(card.props.items[0].trend,3);
  assert.equal(JSON.stringify(report),original,'display formatting cannot mutate saved data');
  assert.equal(serialized.includes('Preview'),false);
  assert.equal(dismissed,0);view.props.onDismiss();assert.equal(dismissed,1);
});
test('check-in preserves close/save callers; optional dismissal fires only from the native callback',()=>{
  const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),
    useRef:v=>({current:v}),useEffect(){},useState:v=>[v,()=>{}]};
  const native=Object.fromEntries(['InputAccessoryView','KeyboardAvoidingView','Modal','Pressable','ScrollView','Text','TextInput','View'].map(n=>[n,n]));
  const {default:CheckIn}=load('components/dashboard/DailyCheckInModal.tsx',{
    react:{...react,default:react},'@expo/vector-icons':{Feather:'Feather'},
    'react-native':{...native,Platform:{OS:'ios'},Keyboard:{dismiss(){}},useWindowDimensions:()=>({height:800})},
    'react-native-safe-area-context':{SafeAreaProvider:'SafeAreaProvider',SafeAreaView:'SafeAreaView'},
    '../InlineFormError':{default:'InlineFormError'},'../mockup/MoodCheckInRow':{MOOD_OPTIONS:[]},'../../theme':{colors:{}},
  });
  let closed=0,dismissed=0,shown=0;
  const props={visible:true,saving:false,initialAnswers:{moodValue:null,energyLevel:null,connectionLevel:null},
    onClose(){closed++;},onDismiss(){dismissed++;},onShow(){shown++;},onSave:async()=>({error:null})};
  const view=CheckIn(props);assert.equal(shown,0);view.props.onShow();assert.equal(shown,1);view.props.onRequestClose();assert.equal(closed,1);assert.equal(dismissed,0);
  view.props.onDismiss();assert.equal(dismissed,1);
  CheckIn({...props,saving:true}).props.onRequestClose();assert.equal(closed,1);
  assert.equal(CheckIn({...props,onDismiss:undefined}).props.onDismiss,undefined);
});
test('queued saved-week request waits for native dismissal and focus before being consumed',()=>{
  const source=readFileSync(new URL('../screens/DashboardScreen.tsx',import.meta.url),'utf8');
  const begin=source.indexOf('// Retain the request while another native modal');
  const end=source.indexOf('}, [isFocused, openWeeklyReport',begin);
  assert.ok(begin>0&&end>begin);
  const effects=[], state={isFocused:true,openWeeklyReport:'2026-11-09',checkInModalOpen:true,checkInNativePresented:true,
    scoreSheetOpen:false,scoreNativePresented:false,openScoreDetail:false,pendingBiometricEnrollment:false,
    isReportWeek:api.isReportWeek,setReportWeek:v=>effects.push(['week',v]),
    setReportOpen:v=>effects.push(['open',v]),onWeeklyReportRequestConsumed:()=>effects.push(['consumed'])};
  const run=()=>vm.runInNewContext(`(function(){${source.slice(begin,end)}})()`,state);
  run();assert.equal(effects.length,0);
  state.checkInModalOpen=false;run();assert.equal(effects.length,0);
  state.checkInNativePresented=false;state.isFocused=false;run();assert.equal(effects.length,0);
  state.isFocused=true;run();assert.deepEqual(effects,[['week','2026-11-09'],['open',true],['consumed']]);
});


test('unknown dashboard access cannot block authoritative weekly-report verification', async () => {
  const h = hooks(null); await h.flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.result.report.access, 'pro');
  assert.equal(h.result.error, null);
  for (let i=0; i<3; i++) await h.flush();
  assert.equal(h.requests.length, 1, 'no render-triggered retry loop');
  h.unmount();
});


for (const outcome of ['success', 'failure']) {
  test(`successful subscription resolution replaces unknown access; stale ${outcome} cannot overwrite its report`, async () => {
    const h=hooks(null);await h.flush();
    let resolveOld,rejectOld;
    h.respond=()=>new Promise((resolve,reject)=>{resolveOld=resolve;rejectOld=reject;});
    const old=h.result.refresh();await tick();const request=h.requests.at(-1);
    h.respond=async()=>({ok:true,json:async()=>payload('pro')});
    h.access=true;h.render();assert.equal(h.result.report,null);
    assert.equal(request.options.signal.aborted,true);
    await h.flush();assert.equal(h.result.report.access,'pro');
    if(outcome==='failure') rejectOld(Error('older failed request'));
    else resolveOld({ok:true,json:async()=>payload('free')});
    await old;await h.flush();assert.equal(h.result.report.access,'pro');assert.equal(h.result.error,null);
    h.unmount();
  });
}

test('unknown access discards cached Pro details before server revalidation and accepts Free projection',async()=>{
  const h=hooks();await h.flush();assert.ok(h.result.report.details);
  let resolve;
  h.respond=()=>new Promise(r=>resolve=r);h.access=null;h.render();
  assert.equal(h.result.report,null);await tick();
  resolve({ok:true,json:async()=>payload('free')});await h.flush();
  assert.equal(h.result.report.access,'free');assert.equal(h.result.report.details,undefined);h.unmount();
});

test('backend authorization failure removes restricted report data and explicit retry recovers',async()=>{
  const h=hooks(null);await h.flush();assert.ok(h.result.report.details);
  h.respond=async()=>({ok:false,status:403,json:async()=>({})});
  await h.result.refresh();await h.flush();assert.equal(h.result.report,null);
  assert.equal(h.result.error,'authorization_unavailable');
  h.respond=async()=>({ok:true,json:async()=>payload('free')});
  await h.result.refresh();await h.flush();assert.equal(h.result.report.access,'free');assert.equal(h.result.error,null);h.unmount();
});
