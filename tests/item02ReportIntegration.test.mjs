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
const presentation=load('lib/weeklyReportPresentation.ts');
test('verified freeze allowance remains visible when dashboard access is unknown', () => {
  const react = { memo: fn => fn, createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useRef: value => ({ current: value }), useEffect() {} };
  const Card = load('components/dashboard/StreakCard.tsx', {
    react: { ...react, default: react }, '@expo/vector-icons': { Feather: 'Feather' },
    'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View' },
    '../../theme': { colors: { dark: '#000' } }, './ProBadge': { default: 'ProBadge' },
    '../../lib/analytics': { trackEvent() {} }, '../../lib/streakPresentation': load('lib/streakPresentation.ts'),
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

test('overall change is optional, server supplied, bounded and never derived from pillars', () => {
  const data=payload();
  assert.equal(api.parseSavedReport(data).overallChange.state,'unavailable');
  data.report.overallChange=number(5);
  assert.equal(api.parseSavedReport(data).overallChange.value,5);
  data.report.comparison={state:'unavailable',reason:'model_mismatch'};
  assert.equal(api.parseSavedReport(data).comparisonReason,'model_mismatch');
  for(const invalid of [101,-101,1.5,Infinity]) {
    data.report.overallChange=number(invalid);assert.throws(()=>api.parseSavedReport(data));
  }
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
test('failed initial load makes exactly one quick automatic retry, then settles; explicit Retry works',async()=>{
  // 2026-11-26 (client-approved reliability fix): one bounded retry for a temporary failure, never a loop.
  const h=hooks();h.fail=true;await h.flush();await new Promise(r=>setTimeout(r,1100));await h.flush();
  assert.equal(h.result.report,null);assert.equal(h.result.loading,false);
  const calls=h.requests.length;assert.equal(calls,2,'initial request plus one automatic retry');
  for(let i=0;i<4;i++) await h.flush();await new Promise(r=>setTimeout(r,1100));await h.flush();
  assert.equal(h.requests.length,calls,'no further automatic attempts');
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
  await h.flush();await new Promise(r=>setTimeout(r,1100));await h.flush();
  assert.equal(h.requests.length,calls+2,'re-read on the access change plus its one quick retry');assert.equal(h.result.error,'entitlement_unavailable');
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
    './notificationDestinations':load('lib/notificationDestinations.ts',{'./weeklyReport':api,'./weeklyReportPresentation':presentation,'./deepLinks':{isValidCommunityPostId:()=>false}}),
    'react-native-onesignal':{OneSignal:sdk},'./deepLinks':{isValidCommunityPostId:()=>false},'./weeklyReport':api,'./weeklyReportPresentation':presentation,
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
    '../../lib/analytics':{trackEvent(){}},'../../lib/weeklyReport':api, '../../lib/weeklyReportPresentation':presentation,
    '../../lib/weeklyReportSharing':{shareWeeklyDadHealthReport:async()=>null},
    './DadScoreCard':{__esModule:true,default:'DadScoreCard'},'./SectionHeader':{__esModule:true,default:'SectionHeader'},
  });
  let dismissed=0;
  const report=api.parseSavedReport(payload());
  report.pillars[0].score.value=64.9876;report.pillars[0].change.value=3.2345;
  report.totalScore={state:'available',value:72};report.details.focus.pillar='body';
  const original=JSON.stringify(report);
  const view=Sheet({visible:true,report,loading:false,error:null,empty:false,userId:'a',
    onClose(){},onDismiss(){dismissed++;},onRetry(){},onUpgrade(){}});
  const serialized=JSON.stringify(view);
  for(const text of ['Your week in Dad Health','Mind','Body','Bond','workouts','check-ins','Your one focus for next week','Ten minutes for your body']) {
    assert.ok(serialized.includes(text),text);
  }
  const nodes=[];
  const visit=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(visit);return;}nodes.push(n);visit(n.props?.children);};
  visit(view);
  const texts=nodes.filter(n=>n.type==='Text').flatMap(n=>n.props.children).filter(x=>typeof x==='string');
  assert.ok(texts.includes('72'));assert.ok(texts.includes('65'));assert.ok(texts.includes('\u2191 3 pts'));
  assert.doesNotMatch(serialized,/64\.9876|3\.2345|Saved focus/);
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

// --- Task 02 regression tests: report read states and streak display ---
const t02react = { memo: fn => fn, createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useRef: value => ({ current: value }), useEffect() {}, useState: value => [value, () => {}] };
const streakPresentation = () => load('lib/streakPresentation.ts');
function t02StreakCard() {
  return load('components/dashboard/StreakCard.tsx', {
    react: { ...t02react, default: t02react }, '@expo/vector-icons': { Feather: 'Feather' },
    'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View' },
    '../../theme': { colors: { dark: '#000' } }, './ProBadge': { default: 'ProBadge' },
    '../../lib/analytics': { trackEvent() {} }, '../../lib/streakPresentation': streakPresentation(),
  }).default;
}
function t02Sheet() {
  const native = Object.fromEntries(['Modal', 'Pressable', 'ScrollView', 'Text', 'View'].map(n => [n, n]));
  return load('components/dashboard/WeeklyReportSheet.tsx', {
    react: { ...t02react, default: t02react }, '@expo/vector-icons': { Feather: 'Feather', MaterialCommunityIcons: 'MaterialCommunityIcons' },
    'react-native': { ...native, Platform: { OS: 'ios' } }, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../../theme': { colors: { dark: '#000', text: '#fff', lime: '#cf5', border: '#333' } }, '../../lib/analytics': { trackEvent() {} },
    '../../lib/weeklyReport': api, '../../lib/weeklyReportPresentation': presentation,
    '../../lib/weeklyReportSharing': { shareWeeklyDadHealthReport: async () => null },
  }).default;
}
function t02Nodes(tree) {
  const nodes = [];
  const visit = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(visit); return; } nodes.push(n); visit(n.props?.children); };
  visit(tree); return nodes;
}
/** Visible text per Text node, with that node's string pieces joined exactly as rendered. */
const t02Texts = nodes => nodes.filter(n => n.type === 'Text')
  .map(n => [n.props.children].flat(Infinity).filter(x => typeof x === 'string' || typeof x === 'number').join(''))
  .filter(Boolean);
const t02Week = Array.from({ length: 7 }, (_, i) => `2026-11-${String(i + 16).padStart(2, '0')}`);

test('report read failures show neutral recovery without Retry or raw reasons', () => {
  const Sheet = t02Sheet();
  const cases = [
    ['read_failed', 'We couldn’t load your weekly report. Please try again.'],
    ['invalid_snapshot', 'We couldn’t load your weekly report. Please try again.'],
    ['PRIVATE_SERVER_DETAIL', 'We couldn’t load your weekly report. Please try again.'],
    ['entitlement_unavailable', 'We couldn’t confirm your account to load this report. Please try again.'],
    ['authorization_unavailable', 'We couldn’t confirm your account to load this report. Please try again.'],
    ['account_changed', 'We couldn’t confirm your account to load this report. Please try again.'],
    ['offline', 'You’re offline. Reconnect, then try again to load your weekly report.'],
  ];
  for (const [reason, message] of cases) {
    assert.equal(presentation.reportReadMessage(reason), message, reason);
    let retries = 0;
    const view = Sheet({ visible: true, userId: 'a', report: null, loading: false, empty: false, error: reason, onRetry: () => { retries++; } });
    const nodes = t02Nodes(view), texts = t02Texts(nodes);
    assert.ok(texts.includes('Your weekly summary will appear here when ready.'), reason);
    assert.ok(!texts.includes(message), reason);
    assert.ok(!texts.some(text => text.includes(reason)), reason);
    assert.ok(!texts.some(text => /ready on Sunday/.test(text)), reason);
    assert.ok(!nodes.some(n => n.props?.accessibilityLabel === 'Retry loading your weekly report'));
    assert.ok(!nodes.some(n => n.type === 'Text' && n.props.accessibilityRole === 'alert'));
    assert.equal(retries, 0);

  }
  // While loading, neither a message nor Retry is offered.
  const loading = t02Nodes(Sheet({ visible: true, userId: 'a', report: null, loading: true, empty: false, error: 'read_failed', onRetry() {} }));
  assert.ok(loading.some(n => n.props?.accessibilityLabel === 'Preparing weekly report'));
  assert.ok(!loading.some(n => n.props?.accessibilityLabel === 'Retry loading your weekly report'));
});

test('unreleased and missing saved reports are distinct states', () => {
  const Sheet = t02Sheet();
  const render = props => t02Nodes(Sheet({ visible: true, userId: 'a', report: null, loading: false, error: null, empty: true, onRetry() {}, ...props }));
  const unreleased = render({ emptyReason: 'not_released' });
  assert.ok(t02Texts(unreleased).includes('Your next weekly report will be ready on Sunday at 6am UK time.'));
  const missing = render({ emptyReason: 'snapshot_missing' });
  assert.ok(t02Texts(missing).includes('Your weekly summary will appear here once your report has been published.'));
  assert.ok(!t02Texts(missing).some(text => /ready on Sunday/.test(text)));
  for (const nodes of [unreleased, missing, render({ emptyReason: null }), render({})]) {
    assert.ok(!nodes.some(n => n.props?.accessibilityLabel === 'Retry loading your weekly report'));
    assert.ok(!nodes.some(n => n.type === 'Text' && n.props.accessibilityRole === 'alert'));
  }

});

test('Free reports never gain Pro details from the new read states', () => {
  const Sheet = t02Sheet();
  const free = api.parseSavedReport(payload('free'));
  for (const props of [{ error: 'read_failed' }, { empty: true, emptyReason: 'snapshot_missing' }, {}]) {
    const tree = Sheet({ visible: true, userId: 'a', report: free, loading: false, error: null, empty: false, onRetry() {}, ...props });
    const view = JSON.stringify(tree), texts = t02Texts(t02Nodes(tree));
    assert.doesNotMatch(view, /private|Saved focus|Your one focus for next week|day streak|At report time|Streak protected/);
    // Pro activity tiles render counts with these exact labels; the Free teaser sentence may name them.
    for (const label of ['workouts', 'workout', 'Bond sessions', 'Bond session', 'check-ins', 'check-in', '2', '3', '5', '6']) {
      assert.ok(!texts.includes(label), `Free must not show Pro tile ${label}`);
    }
    assert.match(view, /See my full week/);
    // A retained report is shown as-is; the read-state message is only for the no-report case.
    assert.doesNotMatch(view, /couldn|saved report for this week|Retry loading/);
  }
});

test('report hook keeps not-released and snapshot-missing reasons distinct and clears them on success or error', async () => {
  const h = hooks(); await h.flush(); assert.equal(h.result.emptyReason, null);
  h.ok = false;
  for (const reason of ['not_released', 'snapshot_missing']) {
    h.answer = { state: 'unavailable', reason };
    await h.result.refresh(); await h.flush();
    assert.equal(h.result.empty, true); assert.equal(h.result.error, null); assert.equal(h.result.emptyReason, reason);
    assert.equal(h.result.report, null);
  }
  h.answer = { state: 'unavailable', reason: 'read_failed' };
  await h.result.refresh(); await h.flush();
  assert.equal(h.result.empty, false); assert.equal(h.result.emptyReason, null); assert.equal(h.result.error, 'read_failed');
  h.ok = true; h.answer = payload();
  await h.result.refresh(); await h.flush();
  assert.equal(h.result.emptyReason, null); assert.ok(h.result.report);
  // An account change starts from a neutral state.
  h.owner = 'b'; h.render(); assert.equal(h.result.emptyReason, null); h.unmount();
});

test('streak shows verified counts and neutral pending states', () => {
  const Card = t02StreakCard();
  const base = { state: 'current', count: 6, lastKnownCount: 6, allowance: 1, protectedDates: [], calendarDays: t02Week, currentDate: '2026-11-18' };
  const texts = (status, error = null) => t02Texts(t02Nodes(Card({ status, freezeAccess: true, error, onRetry() {}, onUpgrade() {} })));
  assert.deepEqual(texts(base).slice(0, 2), ['6-day streak', 'Keep showing up, one check-in at a time.']);
  assert.deepEqual(texts({ ...base, count: 0 }).slice(0, 2), ['Start your streak', "Complete today's check-in to begin."]);
  // Pending states use neutral wording without displaying an unverified count.
  const pending = texts({ ...base, state: 'pending', count: null, allowance: null, lastKnownCount: 12 });
  assert.deepEqual(pending.slice(0, 2), ['Your check-in streak', 'Keep showing up, one check-in at a time.']);
  assert.ok(!pending.some(t => t.includes('12')));
  assert.deepEqual(texts(null, 'read_failed').slice(0, 2), ['Your check-in streak', 'Keep showing up, one check-in at a time.']);
  assert.deepEqual(texts({ ...base, state: 'pending', count: null, allowance: null }, 'read_failed').slice(0, 2), ['Your check-in streak', 'Keep showing up, one check-in at a time.']);
  assert.ok(!t02Nodes(Card({ status: null, error: 'read_failed', onRetry() {} })).some(n => n.props?.accessibilityLabel === 'Retry loading your streak'));
});

test('protected days use readable, timezone-stable dates in text and screen-reader labels', () => {
  const Card = t02StreakCard();
  const { streakDateLabel, protectedDatesText } = streakPresentation();
  const status = { state: 'current', count: 5, lastKnownCount: 5, allowance: 0, protectedDates: ['2026-11-18'], calendarDays: t02Week, currentDate: '2026-11-20' };
  const nodes = t02Nodes(Card({ status, freezeAccess: true, error: null, onRetry() {} }));
  const texts = t02Texts(nodes).join(' ');
  assert.match(texts, /Streak protected · Wednesday 18 November/);
  assert.match(texts, /Freeze used · Resets Monday/);
  const labels = nodes.map(n => n.props?.accessibilityLabel).filter(Boolean);
  assert.ok(labels.includes('Wednesday 18 November, streak protected'));
  assert.ok(labels.includes('Monday 16 November'));
  assert.ok(!labels.some(label => /\d{4}-\d{2}-\d{2}/.test(label)), 'no raw ISO dates in labels');
  assert.doesNotMatch(texts, /\d{4}-\d{2}-\d{2}/);
  const previous = t02Texts(t02Nodes(Card({ status: { ...status, state: 'pending', count: null, allowance: null }, error: null, onRetry() {} }))).join(' ');
  assert.match(previous, /Previously recorded protection · Wednesday 18 November/);
  assert.equal(protectedDatesText(['2026-11-16', '2026-11-22']), 'Monday 16 November, Sunday 22 November');
  for (const zone of ['Pacific/Auckland', 'America/Los_Angeles', 'Europe/London', 'UTC']) {
    const original = process.env.TZ; process.env.TZ = zone;
    try {
      assert.equal(streakDateLabel('2026-11-18'), 'Wednesday 18 November', zone);
      assert.equal(streakDateLabel('2027-01-01'), 'Friday 1 January', zone);
    } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
  }
  for (const invalid of ['2026-02-30', '18/11/2026', '']) assert.equal(streakDateLabel(invalid), invalid);
});
