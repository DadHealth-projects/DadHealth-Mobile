import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';
const read=p=>readFileSync(p,'utf8');
function load(p,mocks={}) { const exports={}; vm.runInNewContext(ts.transpileModule(read(p),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,esModuleInterop:false}}).outputText,
 {exports,Date,AbortController,setTimeout,clearTimeout,require:n=>{assert.ok(n in mocks,n);return mocks[n];}});return exports; }
const onboarding=load('lib/onboarding.ts');
const handoff=load('lib/onboardingHandoff.ts');
function renderHarness() {
 const h={slots:[],index:0,effects:[],dirty:false};
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 h.react={createElement:(type,props,...children)=>({type,props:props??{},children:children.flat(Infinity)}),
 useRef:v=>{const i=h.index++;return h.slots[i]??(h.slots[i]={current:v});},
 useState:v=>{const i=h.index++;if(!(i in h.slots))h.slots[i]=typeof v==='function'?v():v;return [h.slots[i],n=>{h.slots[i]=typeof n==='function'?n(h.slots[i]):n;h.dirty=true;}];},
 useEffect:(f,deps)=>{const i=h.index++,old=h.slots[i];if(!old||!same(old.deps,deps)){h.slots[i]={deps,cleanup:old?.cleanup};h.effects.push(()=>{h.slots[i].cleanup?.();h.slots[i].cleanup=f();});}}};
 h.react.default=h.react;
 h.render=()=>{h.index=0;h.dirty=false;h.value=h.run();h.effects.splice(0).forEach(f=>f());};
 h.flush=async()=>{for(let i=0;i<8;i++){await new Promise(r=>setImmediate(r));if(h.dirty)h.render();}};
 h.unmount=()=>h.slots.forEach(s=>s?.cleanup?.());
 return h;
}
function nodes(root,type) {if(!root||typeof root!=='object')return [];return [...(root.type===type?[root]:[]),...(root.children??[]).flatMap(c=>nodes(c,type))];}
test('canonical ages use youngest known band; unknown/no children never become primary; completed accounts remain complete',()=>{
 for(const [ages,want] of [[[],null],[null,null],[['unknown'],null],[['primary_5_11','unknown'],null],[['teen_12_plus','toddler_0_4'],'toddler'],[['adult_18_plus','primary_5_11'],'primary'],[['adult_18_plus'],'teen']])assert.equal(onboarding.youngestChildBand(ages),want);
 assert.equal(onboarding.isOnboardingComplete({goals:['saved'],custody_pattern:'daily'}),true);
 assert.equal(onboarding.isOnboardingComplete({goals:['saved'],custody_pattern:'no_children'}),true);
 assert.equal(onboarding.LEGACY_CUSTODY_MAP.no_children,'no_children');
});
test('progress restores profile/draft, preserves unknown saved ages and rejects old account responses',async()=>{
 const h=renderHarness();let owner='a';const requests=[],writes=[];
 const q={select:()=>q,eq:()=>q,maybeSingle:()=>new Promise(resolve=>requests.push(resolve))};
 const hook=load('hooks/useOnboardingProgress.ts',{react:h.react,...restoreLifecycleMocks(),'../lib/supabase':{supabase:{from:()=>q}},'../lib/accountPrivacyCleanup':{
 readOwnerSecret:async id=>id==='a'?JSON.stringify({goals:['draft']}):null,
 writeOwnerSecret:async(...args)=>writes.push(args),
 }}).default;
 h.run=()=>hook(owner);h.render();requests.shift()({data:{goals:['saved'],custody_pattern:'split',kids_ages:['legacy-value']}});await h.flush();
 assert.deepEqual(JSON.parse(JSON.stringify(h.value.choices)),{goals:['draft'],custody:'split',ages:['legacy-value']});
 h.value.change({ages:['toddler_0_4','teen_12_plus']});await h.flush();assert.equal(writes[0][0],'a');assert.ok(writes[0][1].endsWith('.a'));
 owner='b';h.render();assert.equal(h.value.ready,false);
 owner='c';h.render();requests.shift()({data:{goals:['b'],kids_ages:['primary_5_11']}});await h.flush();assert.equal(h.value.ready,false);
 requests.shift()({data:{goals:['c'],custody_pattern:'no_children',kids_ages:[]}});await h.flush();assert.equal(h.value.choices.goals[0],'c');
});
test('failed progress read never authorises an empty overwrite',async()=>{
 const h=renderHarness();let writes=0;const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({error:{code:'network'}})};
 const hook=load('hooks/useOnboardingProgress.ts',{react:h.react,...restoreLifecycleMocks(),'../lib/supabase':{supabase:{from:()=>q}},'../lib/accountPrivacyCleanup':{readOwnerSecret:async()=>null,writeOwnerSecret:async()=>writes++}}).default;
 h.run=()=>hook('a');h.render();await h.flush();assert.equal(h.value.ready,false);assert.ok(h.value.error);h.value.change({goals:['x']});assert.equal(writes,0);
});
test('initial check-in blocks upgrades only for its owner and ends on dismissal, not reopening on account return',()=>{
 handoff.setupOwner('a',false);assert.equal(handoff.setupBlocksUpgrade('a'),true);
 handoff.beginInitialCheckIn('a');handoff.setupOwner('a',true);assert.equal(handoff.initialCheckInPending('a'),true);
 handoff.finishInitialCheckIn('b');assert.equal(handoff.setupBlocksUpgrade('a'),true);
 handoff.finishInitialCheckIn('a');assert.equal(handoff.setupBlocksUpgrade('a'),false);
 handoff.setupOwner('b',true);assert.equal(handoff.initialCheckInPending('b'),false);
 handoff.setupOwner('a',true);assert.equal(handoff.initialCheckInPending('a'),false);
});
test('explicit consent persists/restarts, cannot backfill earlier events, regrant refreshes occurrence scope',async()=>{
 const contract=load('lib/analyticsContract.ts');const {createAnalyticsQueue}=load('lib/analyticsQueue.ts',{'./analyticsContract':contract});
 let saved=null,scopes=[];const d={credential:async(owner,previous)=>({owner,consent:previous?.consent??randomUUID(),secret:previous?.secret??randomUUID()+randomUUID(),expiresAt:new Date(Date.now()+30*86400000).toISOString()}),read:async()=>saved,write:async v=>saved=v,random:randomUUID,now:Date.now,send:async()=> 'later',withdraw:async()=>false,scopesChanged:s=>scopes=s};
 let q=createAnalyticsQueue(d);assert.equal(await q.consentGranted('a'),false);
 await q.capture('app_opened',{},'a');await q.consent('a',true);assert.equal(JSON.parse(saved).queue.length,0);
 assert.equal(await q.consentGranted('a'),true);await q.capture('app_opened',{},'a');
 q=createAnalyticsQueue(d);assert.equal(await q.consentGranted('a'),true);assert.equal(await q.consentGranted('b'),false);
 await q.consent('a',false);assert.equal(JSON.parse(saved).queue.length,0);assert.equal(scopes.length,0);assert.equal(JSON.parse(saved).revoked.length,1);
 await q.consent('a',true);assert.equal(scopes.length,1);assert.equal(scopes[0].owner,'a');
});
test('consent switch remains default off until read; grant confirmation is owner-bound',async()=>{
 const h=renderHarness();let owner='a',resolveRead,resolveWrite;const grants=[];
 const C=load('components/AnalyticsConsentControl.tsx',{react:h.react,'react-native':{View:'View',Text:'Text',Pressable:'Pressable',Switch:'Switch'},
 '@react-navigation/native':{useNavigation:()=>({navigate(){}})},'../theme':{colors:{lime:'lime'}},
 '../lib/analytics':{getAnalyticsConsentStatus:()=>new Promise(r=>resolveRead=value=>r({granted:value,ready:value})),setAnalyticsConsent:()=>new Promise(r=>resolveWrite=r)}}).default;
 h.run=()=>C({owner,onGranted:()=>grants.push(owner)});h.render();assert.equal(nodes(h.value,'Switch')[0].props.value,false);assert.equal(nodes(h.value,'Switch')[0].props.disabled,true);
 resolveRead(false);await h.flush();nodes(h.value,'Switch')[0].props.onValueChange(true);await h.flush();assert.equal(nodes(h.value,'Switch')[0].props.value,false);
 owner='b';h.render();resolveWrite();await h.flush();resolveRead(true);await h.flush();assert.equal(grants.length,0);
});
test('family no-children save confirms empty ages before one check-in handoff, duplicate taps cannot submit twice',async()=>{
 const h=renderHarness();let owner='a',finish;const calls=[],nav=[];
 const q={upsert:p=>{calls.push(p);return q;},select:()=>q,single:()=>new Promise(r=>finish=r)};
 const choices={goals:['goal'],custody:'no_children',ages:['primary_5_11']};
 const C=load('screens/subscreens/OnboardingCustodyScreen.tsx',{
 react:h.react,'@expo/vector-icons':{Feather:'Feather'},'react-native':{View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView'},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
 '../../components/Card':{default:'Card'},'../../components/FadeInView':{default:'FadeInView'},'../../components/LimeButton':{default:'Button'},
 '../../contexts/AuthContext':{useAuth:()=>({user:{id:owner},refreshOnboarding:async()=>true})},'../../lib/onboarding':onboarding,
 '../../lib/onboardingHandoff':{beginInitialCheckIn:id=>nav.push(['handoff',id])},'../../hooks/useOnboardingProgress':{default:()=>({choices,ready:true,error:'',change(){}})},
 '../../lib/supabase':{supabase:{from:()=>q}},'../../theme':{colors:{dark:'#000'}}}).default;
 h.run=()=>C({navigation:{reset:v=>nav.push(['reset',v])},route:{params:{}}});h.render();
 const press=nodes(h.value,'Button')[0].props.onPress;const first=press();await press();assert.equal(calls.length,1);assert.equal(calls[0].custody_pattern,'no_children');assert.equal(calls[0].kids_ages.length,0);assert.equal(nav.length,0);
 finish({data:{goals:['goal'],custody_pattern:'no_children',kids_ages:[],onboarding_complete:true}});await first;await h.flush();assert.equal(nav[0][0],'handoff');assert.equal(nav[1][0],'reset');
 nav.length=0;owner='b';h.render();const pending=nodes(h.value,'Button')[0].props.onPress();owner='c';h.render();
 finish({data:{goals:['goal'],custody_pattern:'no_children',kids_ages:[],onboarding_complete:true}});await pending;await h.flush();assert.equal(nav.length,0);
 const failed=nodes(h.value,'Button')[0].props.onPress();finish({error:{code:'42501'}});await failed;await h.flush();assert.equal(nav.length,0);
 assert.ok(nodes(h.value,'Text').some(n=>n.children.some(c=>typeof c==='string'&&c.includes('verify your account'))));

});
test('onboarding remains three screens, uses existing check-in prompt and registered owner draft cleanup',()=>{
 const welcome=read('screens/subscreens/WelcomeScreen.tsx'),goals=read('screens/subscreens/OnboardingGoalsScreen.tsx'),family=read('screens/subscreens/OnboardingCustodyScreen.tsx');
 assert.match(welcome,/navigate\('OnboardingGoals'\)/);assert.match(goals,/replace\('OnboardingCustody'/);assert.match(family,/name: 'Tabs'/);
 for(const source of [welcome,goals,family])assert.doesNotMatch(source,/navigate\('ProSubscription'/);
 const dashboard=read('screens/DashboardScreen.tsx');assert.equal((dashboard.match(/<DailyCheckInModal/g)??[]).length,1);assert.match(dashboard,/finishInitialCheckIn\(user.id\)/);
 assert.match(read('hooks/useOnboardingProgress.ts'),/writeOwnerSecret/);assert.match(read('lib/accountPrivacyCleanup.ts'),/registerOwnerKey/);
});

test('actual Dad Days default callback preserves explicit choices and ignores account-switched responses',async()=>{
 const text=read('screens/subscreens/DadDaysSearchScreen.tsx');
 const ast=ts.createSourceFile('screen.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='loadAccess')callback=node.initializer.arguments[0].getText(ast);ts.forEachChild(node,visit);}visit(ast);assert.ok(callback);
 const emitted=ts.transpileModule(`exports.run = ${callback}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const values=[],requestId={current:0},ageOwner={current:'a'},ageChosen={current:false};let respond;
 const exports={};vm.runInNewContext(emitted,{exports,accessRequestId:requestId,ageOwner,ageChosen,user:{id:'a'},session:{access_token:'fixture'},isOffline:false,WEB_URL:'https://example.invalid',AGES:[{value:'toddler'},{value:'primary'},{value:'teen'}],
 dadDaysRequest:()=>new Promise(r=>respond=r),DadDaysRequestError:Error,setSearchError(){},setAccessReady(){},setIsPro(){},setSearchesUsed(){},setChildAge:v=>values.push(v)});
 const response={ok:true,json:async()=>({isPro:false,searchesUsed:0,childAge:'toddler'})};
 const first=exports.run();ageChosen.current=true;respond(await response.json());await first;assert.deepEqual(values,[]);
 ageChosen.current=false;const second=exports.run();ageOwner.current='b';respond(await response.json());await second;assert.deepEqual(values,[]);
 ageOwner.current='a';const third=exports.run();respond(await response.json());await third;assert.deepEqual(values,['toddler']);
 const missing=exports.run();respond({isPro:false,childAge:null});await missing;assert.deepEqual(values,['toddler',null]);
});

function restoreLifecycleMocks() {
 const apps=new Set(),networks=new Set();
 return {
  'react-native':{AppState:{addEventListener:(_event,listener)=>{apps.add(listener);return {remove:()=>apps.delete(listener)};}}},
  '@react-native-community/netinfo':{default:{addEventListener:listener=>{networks.add(listener);return ()=>networks.delete(listener);}}},
  apps,networks,
 };
}
test('failed onboarding restoration recovers on reconnect and foreground, then unsubscribes',async()=>{
 const h=renderHarness(),lifecycle=restoreLifecycleMocks();let calls=0,succeed=false;
 const q={select:()=>q,eq:()=>q,maybeSingle:async()=>{calls++;return succeed?{data:{goals:['saved'],custody_pattern:'no_children',kids_ages:[]}}:{error:{code:'network'}};}};
 const hook=load('hooks/useOnboardingProgress.ts',{react:h.react,...lifecycle,'../lib/supabase':{supabase:{from:()=>q}},'../lib/accountPrivacyCleanup':{readOwnerSecret:async()=>null,writeOwnerSecret:async()=>{}}}).default;
 h.run=()=>hook('a');h.render();await h.flush();assert.equal(calls,1);assert.equal(h.value.ready,false);
 for(const f of lifecycle.networks)f({isConnected:true,isInternetReachable:true});await h.flush();assert.equal(calls,1);
 for(const f of lifecycle.networks)f({isConnected:false});
 for(const f of lifecycle.networks)f({isConnected:true,isInternetReachable:true});await h.flush();assert.equal(calls,2);assert.equal(h.value.ready,false);
 for(const f of lifecycle.apps)f('background');await h.flush();assert.equal(calls,2);
 succeed=true;for(const f of lifecycle.apps)f('active');await h.flush();assert.equal(calls,3);assert.equal(h.value.ready,true);assert.equal(h.value.choices.goals[0],'saved');
 assert.equal(lifecycle.apps.size,0);assert.equal(lifecycle.networks.size,0);h.unmount();
});

test('family controls expose radios and checkboxes, preserve multi-select ages and save exact values',async()=>{
 const h=renderHarness(),choices={goals:['goal'],custody:'daily',ages:['primary_5_11']},saved=[];
 const q={upsert:p=>{saved.push(p);return q;},select:()=>q,single:async()=>({data:{...saved.at(-1)}})};
 const C=load('screens/subscreens/OnboardingCustodyScreen.tsx',{
 react:h.react,'@expo/vector-icons':{Feather:'Feather'},'react-native':{View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView'},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
 '../../components/Card':{default:'Card'},'../../components/FadeInView':{default:'FadeInView'},'../../components/LimeButton':{default:'Button'},
 '../../contexts/AuthContext':{useAuth:()=>({user:{id:'a'},refreshOnboarding:async()=>true})},'../../lib/onboarding':onboarding,
 '../../lib/onboardingHandoff':{beginInitialCheckIn(){}},'../../hooks/useOnboardingProgress':{default:()=>({choices,ready:true,error:'',change:p=>{Object.assign(choices,p);h.dirty=true;}})},
 '../../lib/supabase':{supabase:{from:()=>q}},'../../theme':{colors:{dark:'#000',lime:'lime',text:'white'}}}).default;
 h.run=()=>C({navigation:{reset(){}},route:{params:{}}});h.render();
 let controls=nodes(h.value,'Pressable');
 assert.equal(controls.filter(n=>n.props.accessibilityRole==='radio'&&n.props.accessibilityState.checked).length,1);
 assert.ok(nodes(h.value,'Feather').some(n=>n.props.name==='check-circle'));
 assert.ok(nodes(h.value,'Feather').some(n=>n.props.name==='square'));
 controls.filter(n=>n.props.accessibilityRole==='checkbox')[0].props.onPress();await h.flush();
 assert.equal(choices.ages.length,2);assert.equal(choices.ages[0],'primary_5_11');assert.equal(choices.ages[1],'toddler_0_4');
 assert.equal(nodes(h.value,'Feather').filter(n=>n.props.name==='check-square').length,2);
 await nodes(h.value,'Button')[0].props.onPress();assert.deepEqual(Array.from(saved[0].kids_ages),['primary_5_11','toddler_0_4']);
 choices.custody='no_children';h.render();assert.equal(nodes(h.value,'Pressable').filter(n=>n.props.accessibilityRole==='checkbox').length,0);
 assert.equal(nodes(h.value,'ScrollView').flatMap(n=>nodes(n,'Button')).length,0);
});

test('welcome places optional consent below introduction in scroll content and progress/Continue in footer',()=>{
 const h=renderHarness();const C=load('screens/subscreens/WelcomeScreen.tsx',{
 react:h.react,'react-native':{View:'View',Text:'Text',ScrollView:'ScrollView'},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
 '../../components/AnalyticsConsentControl':{default:'Consent'},'../../hooks/useAnalyticsPresentation':{useAnalyticsPresentation:()=>()=>{}},
 '../../contexts/AuthContext':{useAuth:()=>({user:{id:'a'},onboardingComplete:false})},'@react-navigation/native':{useNavigation:()=>({navigate(){}}),useIsFocused:()=>true},
 '../../lib/analytics':{trackEvent(){}},'../../components/FadeInView':{default:'Fade'},'../../components/LimeButton':{default:'Button'},'../../theme':{colors:{dark:'#000'}}}).default;
 h.run=()=>C();h.render();const scroll=nodes(h.value,'ScrollView')[0];assert.equal(nodes(scroll,'Consent').length,1);assert.equal(nodes(scroll,'Consent')[0].props.card,true);assert.equal(nodes(scroll,'Button').length,0);assert.equal(nodes(h.value,'Button')[0].props.label,'Continue');assert.ok(!scroll.props.contentContainerClassName.includes('justify-between'));
});

test('saved consent without registration stays selected with truthful feedback and never fires activation callback',async()=>{
 const h=renderHarness();let granted=false,ready=false,activated=0;
 const C=load('components/AnalyticsConsentControl.tsx',{react:h.react,'react-native':{View:'View',Text:'Text',Pressable:'Pressable',Switch:'Switch'},
 '@react-navigation/native':{useNavigation:()=>({navigate(){}})},'../theme':{colors:{lime:'lime'}},
 '../lib/analytics':{getAnalyticsConsentStatus:async()=>({granted,ready,enabled:true}),setAnalyticsConsent:async(_owner,value)=>{granted=value==='granted';}}}).default;
 h.run=()=>C({owner:'a',onGranted:()=>activated++});h.render();await h.flush();
 nodes(h.value,'Switch')[0].props.onValueChange(true);await h.flush();
 assert.equal(nodes(h.value,'Switch')[0].props.value,true);assert.equal(activated,0);
 assert.ok(nodes(h.value,'Text').some(n=>n.children.includes('We couldn’t turn this on right now. Please try again later.')));
 nodes(h.value,'Switch')[0].props.onValueChange(false);await h.flush();assert.equal(nodes(h.value,'Switch')[0].props.value,false);
 ready=true;nodes(h.value,'Switch')[0].props.onValueChange(true);await h.flush();assert.equal(activated,1);
});
