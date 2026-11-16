import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function load(path, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
  } }).outputText, { exports, Date, Intl, require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  return exports;
}
const calendar = load('lib/checkInCalendar.ts');
test('check-in calendar uses account dates across DST and device-zone differences', () => {
  for (const [zone, at, expected] of [
    ['Europe/London','2026-03-29T23:30:00Z','2026-03-30'],
    ['Europe/London','2026-10-25T23:30:00Z','2026-10-25'],
    ['Pacific/Auckland','2026-11-15T12:00:00Z','2026-11-16'],
    ['America/Los_Angeles','2026-11-16T01:00:00Z','2026-11-15'],
  ]) assert.equal(calendar.checkInDate(calendar.parseCheckInCalendar({timezone:zone,changes:[]}),new Date(at)),expected);
  assert.equal(calendar.checkInDate(null),null);
  assert.equal(calendar.parseCheckInCalendar({timezone:'invented',changes:[]}),null);
  assert.equal(calendar.parseCheckInCalendar({timezone:'Europe/London',changes:[{at:'2026-11-16T08:00:00Z',weekStart:'2026-11-16'}]}),null);
});
test('westward timezone change holds Sunday until the canonical new Monday boundary', () => {
  const value = calendar.parseCheckInCalendar({ timezone:'Europe/London', changes:[{
    at:'2026-11-16T08:00:00Z',timezone:'America/Los_Angeles',weekStart:'2026-11-16',
  }] });
  assert.equal(calendar.checkInDate(value,new Date('2026-11-16T07:59:59Z')),'2026-11-15');
  assert.equal(calendar.checkInDate(value,new Date('2026-11-16T08:00:00Z')),'2026-11-16');
});

const dashboard = source('screens/DashboardScreen.tsx');
test('report and check-in sibling keys are distinct, stable and account-bound', () => {
  const ast = ts.createSourceFile('DashboardScreen.tsx', dashboard, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const expressions = new Map();
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(ast);
      if (['WeeklyReportSheet', 'DailyCheckInModal'].includes(name)) {
        const key = node.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(ast) === 'key');
        assert.ok(key?.initializer && ts.isJsxExpression(key.initializer));
        expressions.set(name, key.initializer.expression.getText(ast));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(expressions.size, 2);
  const keys = id => [...expressions.values()].map(expression => vm.runInNewContext(expression, { user: { id } }));
  const first = keys('account-a');
  assert.equal(new Set(first).size, 2);
  assert.deepEqual(keys('account-a'), first);
  keys('account-b').forEach((key, index) => assert.notEqual(key, first[index]));
});
test('Free teaser handler opens the weekly sheet rather than the paywall; native modal overlap is blocked', () => {
  const begin=dashboard.indexOf('onOpen={() => {',dashboard.indexOf('<WeeklyReportCard'));
  const end=dashboard.indexOf('\n                }}',begin);
  const body=dashboard.slice(begin+'onOpen={() => {'.length,end);
  const calls=[];
  const context={reportOpen:false,reportNativePresented:false,checkInModalOpen:false,checkInNativePresented:false,
    scoreSheetOpen:false,scoreNativePresented:false,weeklyReportAccess:false,
    setReportWeek:v=>calls.push(['week',v]),setReportOpen:v=>calls.push(['open',v]),
    latestReport:{loading:false,refresh:()=>calls.push(['refresh'])},openPro:()=>assert.fail('Free entry must not open paywall')};
  vm.runInNewContext(`(()=>{${body}})()`,context);
  assert.deepEqual(calls,[['week',undefined],['open',true],['refresh']]);
  calls.length=0;context.reportNativePresented=true;vm.runInNewContext(`(()=>{${body}})()`,context);assert.equal(calls.length,0);
});
test('check-in waits for native report dismissal and only onShow commits one appearance', () => {
  const start=dashboard.indexOf('  useEffect(() => {\n    if (!todayDate');
  const end=dashboard.indexOf('\n  }, [activeSection',start);
  assert.ok(start>=0 && end>start);
  const body=ts.transpileModule(`(()=>{${dashboard.slice(start+'  useEffect(() => {'.length,end)}})()`, {
    compilerOptions:{target:ts.ScriptTarget.ES2022},
  }).outputText;
  const writes=[];
  const context={todayDate:'2026-11-15',isFocused:true,activeSection:'HOME',data:{},checkedInToday:false,loading:false,
    checkInModalOpen:false,checkInNativePresented:false,reportOpen:false,reportNativePresented:true,
    openWeeklyReport:undefined,scoreSheetOpen:false,pendingBiometricEnrollment:false,openScoreDetail:false,
    promptDecisionKey:'a:day:session',user:{id:'a'},dailyCheckInStorageKey:'a',
    attemptedCheckInPromptSessions:new Set(),promptSessionRequestKey:{current:null},pendingPrompt:{current:null},
    promptStateRef:{current:{userId:'a',date:'2026-11-15',appearances:0}},
    setPromptDecisionReadyKey(){},setReminderMessage(){},setCheckInModalOpen:v=>{context.checkInModalOpen=v},
    dailyCheckInPrompt:prompt,
    AsyncStorage:{setItem:(...args)=>{writes.push(args);return Promise.resolve();}}};
  // CommonJS helper uses module.exports; use its real module directly below.
  context.dailyCheckInPrompt = prompt;
  vm.runInNewContext(body,context);
  assert.equal(context.checkInModalOpen,false);assert.equal(writes.length,0);
  const dismissStart=dashboard.indexOf('onDismiss={() => {',dashboard.indexOf('<WeeklyReportSheet'));
  const dismissEnd=dashboard.indexOf('\n        }}',dismissStart);
  const dismiss=dashboard.slice(dismissStart+'onDismiss={() => {'.length,dismissEnd);
  context.reportMounted={current:true};context.reportUpgradePending={current:null};
  context.setReportNativePresented=v=>{context.reportNativePresented=v};
  context.openPro=()=>assert.fail('Normal dismissal must not navigate to Pro');
  vm.runInNewContext(`(()=>{${dismiss}})()`,context);
  assert.equal(context.reportNativePresented,false);
  vm.runInNewContext(body,context);
  assert.equal(context.checkInModalOpen,true);assert.equal(writes.length,0);
  assert.equal(context.attemptedCheckInPromptSessions.size,0);
  const a=dashboard.indexOf('  const confirmCheckInShown = useCallback(() => {');
  const b=dashboard.indexOf('\n  }, [promptDecisionKey',a);
  const shown=dashboard.slice(a+'  const confirmCheckInShown = useCallback(() => {'.length,b);
  context.reportMounted={current:true};context.promptPresentation={current:{key:context.promptDecisionKey,visible:true}};
  vm.runInNewContext(`(()=>{${shown}})()`,context);vm.runInNewContext(`(()=>{${shown}})()`,context);
  assert.equal(writes.length,1);assert.equal(JSON.parse(writes[0][1]).appearances,1);
  context.pendingPrompt.current={key:context.promptDecisionKey,state:{appearances:2}};
  context.promptPresentation.current.visible=false;vm.runInNewContext(`(()=>{${shown}})()`,context);
  assert.equal(writes.length,1);
  context.promptPresentation.current.visible=true;
  context.promptPresentation.current.key='another-account';vm.runInNewContext(`(()=>{${shown}})()`,context);
  assert.equal(writes.length,1);
  context.reportNativePresented=true;context.reportMounted.current=false;
  vm.runInNewContext(`(()=>{${dismiss}})()`,context);
  assert.equal(context.reportNativePresented,true,'Stale dismissal cannot update another account');
});
const promptModule={exports:{}};
vm.runInNewContext(source('lib/dailyCheckInPrompt.js'),{module:promptModule});
const prompt=promptModule.exports;

const api=load('lib/weeklyReport.ts',{'./scoreTrends':{formatScoreTrend:()=>({})}});
const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useRef:v=>({current:v}),useEffect(){},useState:v=>[v,()=>{}]};
test('actual Free teaser renders no Pro badge and invokes only the report-opening callback', () => {
  const Card=load('components/dashboard/WeeklyReportCard.tsx',{
    react:{...react,default:react,memo:value=>value},'@expo/vector-icons':{Feather:'Feather'},
    'react-native':{Pressable:'Pressable',Text:'Text',View:'View'},'../../theme':{colors:{}},'../../lib/weeklyReport':api,
  }).default;
  let opened=0;
  for (const saved of [null,report]) {
    const view=Card({report:saved,onOpen:()=>opened++});
    assert.doesNotMatch(JSON.stringify(view),/"PRO"|"lock"|Build my plan|onUpgrade/);
    const button=view.props.children[0];
    assert.equal(button.type,'Pressable');
    assert.equal(button.props.accessibilityLabel,'Open your weekly report');
    button.props.onPress();
  }
  assert.equal(opened,2);
});
const report={access:'free',weekStart:'2026-11-09',weekEndExclusive:'2026-11-16',comparisonAvailable:true,
  totalScore:{state:'available',value:42},pillars:[{name:'Mind',score:{state:'available',value:42},change:{state:'available',value:2}}],
  details:{workouts:{state:'available',value:987654},focus:{text:'PRIVATE FOCUS'}}};
test('Free sheet and PDF exclude injected restricted details while retaining headline scores',()=>{
  const native=Object.fromEntries(['Modal','Pressable','ScrollView','Text','View'].map(x=>[x,x]));
  const Sheet=load('components/dashboard/WeeklyReportSheet.tsx',{
    react:{...react,default:react},'@expo/vector-icons':{Feather:'Feather',MaterialCommunityIcons:'MaterialCommunityIcons'},
    'react-native':{...native,Platform:{OS:'ios'}},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
    '../../theme':{colors:{}},'../../lib/analytics':{trackEvent(){}},'../../lib/weeklyReport':api,
    '../../lib/weeklyReportSharing':{shareWeeklyDadHealthReport:async()=>null},
    './DadScoreCard':{__esModule:true,default:'DadScoreCard'},'./SectionHeader':{__esModule:true,default:'SectionHeader'},
  }).default;
  const view=JSON.stringify(Sheet({visible:true,report,userId:'a'}));
  assert.doesNotMatch(view,/987654|PRIVATE FOCUS/);assert.match(view,/Explore Dad Health Pro/);assert.match(view,/"score":42/);
  const sharing=load('lib/weeklyReportSharing.ts',{'./weeklyReport':api,'expo-print':{},'expo-sharing':{}});
  const html=sharing.buildWeeklyReportHtml(report);
  assert.doesNotMatch(html,/987654|PRIVATE FOCUS/);assert.match(html,/>42<\/div>/);assert.match(html,/\+2 pts/);
});
test('export stops before native sharing after account/visibility invalidation and reports no false completion',async()=>{
  let current=true,shares=0,resolve;
  const sharing=load('lib/weeklyReportSharing.ts',{'./weeklyReport':api,
    'expo-sharing':{isAvailableAsync:async()=>true,shareAsync:async()=>{shares++;}},
    'expo-print':{printToFileAsync:()=>new Promise(r=>resolve=r)}});
  const pending=sharing.shareWeeklyDadHealthReport(report,()=>current);
  await new Promise(setImmediate);current=false;resolve({uri:'file://test.pdf'});
  assert.equal(await pending,null);assert.equal(shares,0);
});

test('Pro PDF contains saved total, activities, captured streak, protection and focus',()=>{
  const sharing=load('lib/weeklyReportSharing.ts',{'./weeklyReport':api,'expo-print':{},'expo-sharing':{}});
  const available=value=>({state:'available',value});
  const saved={...report,access:'pro',details:{workouts:available(12),bondSessions:available(4),checkins:available(6),
    streak:{days:available(6),protectedDates:['2026-11-10']},focus:{pillar:'bond',text:'Make time to connect.'}}};
  const before=JSON.stringify(saved), html=sharing.buildWeeklyReportHtml(saved);
  for(const text of ['>42</div>','Workouts','>12</td>','Bond sessions','>4</td>','Check-in days','>6</td>',
    'Streak at report time','6 days','Streak protected','10 Nov','Make time to connect.','9 Nov']) assert.ok(html.includes(text),text);
  assert.equal(JSON.stringify(saved),before);
});

test('rapid Save taps share once; cancelled sharing releases the guard for retry without a saved message',async()=>{
  const sheet=source('components/dashboard/WeeklyReportSheet.tsx');
  const start=sheet.indexOf('  const saveReport = async () => {');
  const end=sheet.indexOf('\n  useEffect',start);
  assert.ok(start>=0&&end>start);
  let shares=0,settle;
  const busy=[];
  const context={visible:true,report,exportInFlight:{current:false},exportSequence:{current:0},exportMounted:{current:true},
    setPreparingExport:v=>busy.push(v),shareWeeklyDadHealthReport:()=>{shares++;return new Promise(resolve=>settle=resolve);}};
  const save=vm.runInNewContext(`${sheet.slice(start,end)}\nsaveReport`,context);
  const first=save();await save();assert.equal(shares,1);
  settle(null);await first;assert.equal(context.exportInFlight.current,false);
  const second=save();assert.equal(shares,2);settle(null);await second;
  assert.deepEqual(busy,[true,false,true,false]);
  assert.doesNotMatch(sheet,/Report ready to save|Report ready to share|PDF saved/);
});
