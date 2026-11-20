import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import ts from 'typescript';import {readFileSync} from 'node:fs';
const id='05000000-0000-4000-8000-000000000011',owner='05000000-0000-4000-8000-000000000001';
function harness(options={}){const h={session:{user:{id:owner},access_token:'fixture-only'},calls:[],result:null,ok:true,writes:[],logs:[]};const exports={};
const deps={'expo-crypto':{getRandomBytesAsync:async()=>new Uint8Array(32).fill(7),randomUUID:()=>id},'./supabase':{supabase:{auth:{getSession:async()=>({data:{session:h.session},error:null}),getUser:async()=>({data:{user:h.session?{...h.session.user,email:'private@example.invalid',app_metadata:{provider:'email'}}:null},error:null}),signInWithPassword:async()=>{h.session={user:{id:owner},access_token:'fresh-private-token'};return {error:null};}}}},'./oauth':{},'expo-secure-store':{setItemAsync:async(k,v)=>h.writes.push({k,v})}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/accountPrivacy.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Uint8Array,btoa,__DEV__:options.dev??false,console:{info:(...v)=>h.logs.push(v)},process:{env:{EXPO_PUBLIC_WEB_URL:'https://fixture.invalid',EXPO_PUBLIC_PRIVACY_DEBUG:options.debug?'true':'false'}},require:id=>{assert.ok(id in deps,id);return deps[id];},fetch:async(url,init)=>{h.calls.push({url,init});return {ok:h.ok,status:h.ok?200:503,headers:{get:()=>id},json:async()=>h.result};}});return {h,api:exports};}
const op={id,owner,kind:'delete',recovery:'a'.repeat(43)};
const status=()=>({id,kind:'delete',state:'cleanup_pending',accountRemoved:true,cleanupCompleted:false,updatedAt:'2026-11-18T10:00:00Z'});
test('deletion status separates removed account from completed cleanup',()=>{const {api}=harness();const s=api.parsePrivacyStatus(status(),op);assert.match(api.privacyStatusMessage(s),/cleanup is still in progress/);assert.throws(()=>api.parsePrivacyStatus({...s,cleanupCompleted:true},op));});
test('privacy parser rejects cross-operation and cross-kind status',()=>{const {api}=harness();assert.throws(()=>api.parsePrivacyStatus({...status(),id:'other'},op));assert.throws(()=>api.parsePrivacyStatus({...status(),kind:'export'},op));});
test('request never proceeds for another signed-in owner',async()=>{const {api,h}=harness();h.session.user.id='other';await assert.rejects(api.privacyRequest(owner,'delete',new AbortController().signal,{},op.recovery));assert.equal(h.calls.length,0);});
test('post-Auth recovery uses narrow header and never a URL token',async()=>{const {api,h}=harness();h.session=null;h.result=status();await api.privacyRequest(owner,'operations/'+id,new AbortController().signal,undefined,op.recovery);assert.equal(h.calls[0].init.headers['X-Privacy-Recovery'],op.recovery);assert.equal(h.calls[0].init.headers.Authorization,undefined);assert.ok(!h.calls[0].url.includes(op.recovery));});
test('ordinary export requests cannot proceed without a session',async()=>{const {api,h}=harness();h.session=null;await assert.rejects(api.privacyRequest(owner,'export',new AbortController().signal,{}));assert.equal(h.calls.length,0);});
test('aborted privacy request performs no fetch',async()=>{const {api,h}=harness();const c=new AbortController();c.abort();await assert.rejects(api.privacyRequest(owner,'export',c.signal,{}));assert.equal(h.calls.length,0);});
test('operation identity is owner-bound with 256-bit recovery value',async()=>{const {api}=harness();const created=await api.newPrivacyOperation(owner,'delete');assert.equal(created.owner,owner);assert.equal(created.id,id);assert.match(created.recovery,/^[\w-]{43}$/);});
test('only deletion receipts enter post-Auth recovery storage',async()=>{const {api,h}=harness();let notifications=0;api.subscribePrivacyRecovery(()=>notifications++);await api.rememberPrivacyRecovery({...op,kind:'export'});assert.equal(h.writes.length,0);await api.rememberPrivacyRecovery(op);assert.equal(h.writes.length,1);assert.equal(notifications,1);});
test('provider acceptance is described as sent for delivery not received',()=>{const {api}=harness();assert.equal(api.privacyStatusMessage({...status(),kind:'export',accountRemoved:false,state:'sent_for_delivery'}),'Your export has been sent for delivery.');});

test('biometric deletion cleanup preserves another owner and removes matching credentials',async()=>{
 const values=new Map([['dadhealth.biometric.device.owner','other'],['dadhealth.biometric.device.v4.credential','private']]);
 const removed=[];const exports={};const deps={'expo-crypto':{},'expo-local-authentication':{},'expo-secure-store':{
  WHEN_UNLOCKED_THIS_DEVICE_ONLY:1,getItemAsync:async key=>values.get(key)??null,
  deleteItemAsync:async key=>{removed.push(key);values.delete(key);}},
  './supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:owner}}}})}}}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/biometric.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports,process:{env:{}},require:id=>{assert.ok(id in deps,id);return deps[id];}});
 await exports.clearOwnerBiometricCredentials(owner);assert.equal(removed.length,0);
 values.set('dadhealth.biometric.device.owner',owner);await exports.clearOwnerBiometricCredentials(owner);
 assert.ok(removed.includes('dadhealth.biometric.device.v4.credential'));assert.ok(!values.has('dadhealth.biometric.device.owner'));
});

test('unmounted privacy hook cannot start delayed identity confirmation', async () => {
 const cleanups=[];const calls=[];const exports={};
 const react={useRef:value=>({current:value}),useState:value=>[value,()=>{}],useCallback:fn=>fn,
  useEffect:fn=>{const cleanup=fn();if(cleanup)cleanups.push(cleanup);}};
 const deps={react,'react-native':{AppState:{addEventListener:()=>({remove(){}})}},
  'expo-secure-store':{getItemAsync:async()=>null,setItemAsync:async()=>{}},
  '../lib/accountPrivacy':{newPrivacyOperation:async()=>{calls.push('create');return op;},privacyRequest:async()=>{calls.push('request');},PrivacyRequestError:class extends Error{}}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../hooks/useAccountPrivacy.ts',import.meta.url),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports,AbortController,require:id=>{assert.ok(id in deps,id);return deps[id];}});
 const hook=exports.useAccountPrivacy(owner,'delete');await new Promise(resolve=>setImmediate(resolve));
 cleanups.forEach(cleanup=>cleanup());await hook.prepare('fixture-code');assert.deepEqual(calls,[]);
});

test('candidate deletion recovery is durable without announcing acceptance',async()=>{
 const {api,h}=harness();let announcements=0;api.subscribePrivacyRecovery(()=>announcements++);
 await api.rememberPrivacyRecovery(op,false);assert.equal(h.writes.length,1);assert.equal(announcements,0);
 assert.deepEqual(JSON.parse(h.writes[0].v),op);
});

test('stale queued recovery writes cannot overwrite another account receipt',async()=>{
 const {api,h}=harness();await api.rememberPrivacyRecovery({...op,owner:'other'},false);
 await api.rememberPrivacyRecovery(op,false,()=>false);assert.equal(h.writes.length,1);assert.equal(JSON.parse(h.writes[0].v).owner,'other');
});
test('deletion capability is persisted before request even when acceptance response is lost',async()=>{
 const calls=[];const exports={};const react={useRef:value=>({current:value}),useState:value=>[{...value,confirmation:'fixture'},()=>{}],useCallback:fn=>fn,useEffect:fn=>fn()};
 class Failure extends Error{constructor(reason){super(reason);this.reason=reason;}}
 const deps={react,'react-native':{AppState:{addEventListener:()=>({remove(){}})}},'expo-secure-store':{getItemAsync:async()=>null,setItemAsync:async()=>{}},
 '../lib/accountPrivacy':{PrivacyRequestError:Failure,newPrivacyOperation:async()=>op,rememberPrivacyRecovery:async(value,notify)=>calls.push(['persist',value.id,notify]),
 privacyRequest:async(owner,path)=>{calls.push(['request',path]);if(path==='privacy-verification')return {confirmation:'fixture'};throw new Failure(path==='delete'?'transport_lost':'operation_not_found');}}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../hooks/useAccountPrivacy.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,AbortController,require:id=>deps[id]});
 const hook=exports.useAccountPrivacy(owner,'delete');await new Promise(r=>setImmediate(r));await hook.prepare();await hook.submit();
 const saved=calls.findIndex(v=>v[0]==='persist');const sent=calls.findIndex(v=>v[1]==='delete');assert.ok(saved>=0&&sent>saved);assert.equal(calls[saved][2],false);
});

test('idle recovery does not exhaust checks before a deletion is submitted',async()=>{
 const callbacks=[];const h={saved:null,listener:null,reads:0,clears:0};const exports={};
 const react={useRef:value=>({current:value}),useState:value=>[value,()=>{}],useEffect:fn=>fn(),createElement:()=>null};
 const deps={react:{...react,default:react},'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})}},
 'react-native-safe-area-context':{},'@expo/vector-icons':{},'../LimeButton':{},'../InlineFormError':{},'../../theme':{colors:{}},'../../hooks/useAccountPrivacy':{},
 '../../contexts/AuthContext':{useAuth:()=>({user:{id:owner}})},'expo-secure-store':{getItemAsync:async()=>h.saved},
 '../../lib/accountPrivacyCleanup':{clearPrivacyOwnerData:async()=>h.clears++},'../../lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:owner}}}}),signOut:async()=>({error:null})}}},
 '../../lib/nativeSubscriptions':{},'../../lib/accountPrivacy':{PRIVACY_RECOVERY_KEY:'fixture',privacyAcknowledgmentKey:id=>'ack.'+id,PrivacyRequestError:class extends Error{},
 subscribePrivacyRecovery:fn=>{h.listener=fn;return()=>{};},parsePrivacyStatus:value=>value,privacyStatusMessage:()=>'',
 privacyRequest:async()=>{h.reads++;return {id,kind:'delete',state:'queued',accountRemoved:false,cleanupCompleted:false};}}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../components/settings/AccountPrivacySheet.tsx',import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,
 {exports,AbortController,setInterval:fn=>{callbacks.push(fn);return 1;},clearInterval(){},require:id=>{assert.ok(id in deps,id);return deps[id];}});
 exports.AccountPrivacyRecovery();await new Promise(r=>setImmediate(r));
 for(let i=0;i<30;i++){callbacks.forEach(fn=>fn());await new Promise(r=>setImmediate(r));}
 assert.equal(h.reads,0);h.saved=JSON.stringify(op);h.listener();await new Promise(r=>setImmediate(r));
 assert.equal(h.reads,1);assert.equal(h.clears,1);
 for(let i=0;i<20;i++){callbacks.forEach(fn=>fn());await new Promise(r=>setImmediate(r));}
 assert.equal(h.reads,12);assert.equal(h.clears,1);
});

test('owner cleanup drains writes and prevents delayed persistence without clearing another owner',async()=>{
 const secure=new Map([['other-key.other','keep']]);const local=new Map();let release;
 const blocked=new Promise(r=>release=r);const exports={};
 const deps={'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async k=>local.get(k)??null,setItem:async(k,v)=>{local.set(k,v);},getAllKeys:async()=>[...local.keys()],multiRemove:async ks=>ks.forEach(k=>local.delete(k))}},
 'expo-secure-store':{getItemAsync:async k=>secure.get(k)??null,setItemAsync:async(k,v)=>{if(k===`timer.${owner}`)await blocked;secure.set(k,v);},deleteItemAsync:async k=>{secure.delete(k);}},
 './offlineSync':{pauseAndClearOfflineUser:async()=>{}},'./biometric':{clearOwnerBiometricCredentials:async()=>{}}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/accountPrivacyCleanup.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>deps[id]});
 const writing=exports.writeOwnerSecret(owner,`timer.${owner}`,'private');await new Promise(r=>setImmediate(r));
 const clearing=exports.clearPrivacyOwnerData(owner);const late=exports.writeOwnerSecret(owner,`timer.${owner}`,'late');release();
 await Promise.all([writing,clearing,late]);assert.equal(secure.has(`timer.${owner}`),false);assert.equal(secure.get('other-key.other'),'keep');
 assert.equal(await exports.readOwnerSecret(owner,`timer.${owner}`),null);
});

test('bounded operation polling resumes after foreground and stops after dismissal',async()=>{
 const effects=[];const listeners=[];const timers=new Map();let calls=0;let next=0;const exports={};
 const react={useRef:value=>({current:value}),useCallback:fn=>fn,useEffect:fn=>{const stop=fn();if(stop)effects.push(stop);},
 useState:value=>[{...value,key:`${owner}:delete`,status:{id,kind:'delete',state:'queued',accountRemoved:false,cleanupCompleted:false}},()=>{}]};
 const deps={react,'react-native':{AppState:{currentState:'active',addEventListener:(_,fn)=>{listeners.push(fn);return {remove(){}};}}},
 'expo-secure-store':{getItemAsync:async()=>JSON.stringify(op)},'../lib/accountPrivacy':{rememberPrivacyRecovery:async()=>{},
 parsePrivacyStatus:v=>v,privacyRequest:async()=>{calls++;return {id,kind:'delete',state:'queued',accountRemoved:false,cleanupCompleted:false};},PrivacyRequestError:class extends Error{}}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../hooks/useAccountPrivacy.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports,AbortController,setInterval:fn=>{timers.set(++next,fn);return next;},clearInterval:key=>timers.delete(key),require:id=>deps[id]});
 exports.useAccountPrivacy(owner,'delete');const settle=()=>new Promise(r=>setImmediate(r));await settle();
 for(let i=0;i<20;i++){[...timers.values()].forEach(fn=>fn());await settle();}
 const exhausted=calls;[...timers.values()].forEach(fn=>fn());await settle();assert.equal(calls,exhausted);
 listeners.forEach(fn=>fn('active'));await settle();const foreground=calls;
 [...timers.values()].forEach(fn=>fn());await settle();assert.ok(calls>foreground);
 effects.forEach(fn=>fn());const stopped=calls;[...timers.values()].forEach(fn=>fn());await settle();assert.equal(calls,stopped);
});

// Stateful component harness: runs real handlers/effects with mocked native/Auth I/O.
function privacyUi(card = false) {
 const h={owner,kind:'export',verified:false,sends:0,reads:0,keyboard:0,closed:0,focus:[],listeners:[],timers:new Map(),clock:0,
 request:{status:null,error:'background failure',busy:false,confirmation:null,destination:null,prepare:async()=>undefined,submit:async()=>undefined,newExport:async()=>{}},
 user:{id:owner,email:'owner@example.invalid',app_metadata:{provider:'email'}},authAnswer:null,sendAnswer:null};
 let slots=[],effects=[],cursor=0,pending=[],dirty=false,tree,props;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),
 useRef:v=>{const i=cursor++;return slots[i]??=( {current:v});},
 useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],next=>{const n=typeof next==='function'?next(slots[i]):next;if(!Object.is(n,slots[i])){slots[i]=n;dirty=true;}}];},
 useEffect:(fn,deps)=>{const i=cursor++;if(!same(effects[i]?.deps,deps))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});}};
 react.default=react;
 const native=Object.fromEntries(['ActivityIndicator','KeyboardAvoidingView','Modal','Pressable','ScrollView','Text','TextInput','View'].map(x=>[x,x]));
 Object.assign(native,{AppState:{addEventListener:(_,fn)=>{h.listeners.push(fn);return {remove:()=>{h.listeners=h.listeners.filter(x=>x!==fn);}};}},
 Keyboard:{dismiss:()=>h.keyboard++,addListener:()=>({remove(){}})},Platform:{OS:'ios'},Linking:{openURL:async()=>{}},findNodeHandle:v=>v?1:null,AccessibilityInfo:{setAccessibilityFocus:n=>h.focus.push(n)}});
 class Failure extends Error{constructor(reason){super(reason);this.reason=reason;}}
 h.Failure=Failure;
 const deps={react,'react-native':native,'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'@expo/vector-icons':{Feather:'Icon'},
 '../LimeButton':{__esModule:true,default:'Button'},'../InlineFormError':{__esModule:true,default:'Error'},'../../theme':{colors:{text:'white',lime:'lime'}},
 '../../hooks/useAccountPrivacy':{useAccountPrivacy:()=>h.request},'../../contexts/AuthContext':{useAuth:()=>({user:h.user})},
 '../../lib/accountPrivacy':{PrivacyRequestError:Failure,confirmPrivacyIdentity:async()=>{},privacyStatusMessage:s=>s.state,
 privacyRequest:async(...args)=>{h.sends++;h.sendArgs=args;return h.sendAnswer?h.sendAnswer():{state:'verification_requested',email:h.user.email};}},
 'expo-secure-store':{},'../../lib/accountPrivacyCleanup':{},'../../lib/nativeSubscriptions':{},
 '../../lib/supabase':{supabase:{auth:{getUser:async()=>{h.reads++;return h.authAnswer?h.authAnswer():{data:{user:{...h.user,email_confirmed_at:h.verified?'confirmed':null}},error:null};}}}}};
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../components/settings/AccountPrivacySheet.tsx',import.meta.url),'utf8')+'\nexport { ExportEmailVerification };',
 {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports,AbortController,require:n=>{assert.ok(n in deps,n);return deps[n];},setTimeout:(fn,ms)=>{const key={};h.timers.set(key,{fn,at:h.clock+ms});return key;},clearTimeout:k=>h.timers.delete(k)});
 const component=card?exports.ExportEmailVerification:exports.default;
 h.render=()=>{let cycles=0;do{dirty=false;cursor=0;pending=[];props={owner:h.owner,kind:h.kind,onClose:()=>h.closed++,onBack:()=>h.closed++};tree=component(props);pending.forEach(fn=>fn());assert.ok(++cycles<20);}while(dirty);return tree;};
 h.settle=async()=>{for(let i=0;i<8;i++){await Promise.resolve();h.render();}};
 h.nodes=()=>{const walk=n=>!n?[]:Array.isArray(n)?n.flatMap(walk):typeof n==='object'?[n,...walk(n.props?.children)]:[];return walk(tree);};
 h.text=()=>JSON.stringify(tree);
 h.button=label=>h.nodes().find(n=>n.type==='Button'&&n.props.label===label);
 h.link=label=>h.nodes().find(n=>n.type==='Pressable'&&JSON.stringify(n.props.children).includes(label));
 h.advance=ms=>{h.clock+=ms;for(const [key,v] of [...h.timers])if(v.at<=h.clock){h.timers.delete(key);v.fn();}h.render();};
 h.unmount=()=>effects.forEach(e=>e?.cleanup?.());h.render();return h;
}

test('export ignores background form errors; card opens without sending and keeps password and native modal',async()=>{
 const h=privacyUi();h.nodes().find(n=>n.type==='TextInput').props.onChangeText('private fixture');h.render();
 assert.ok(!h.text().includes('background failure'));
 h.link('Verify account email').props.onPress();h.render();
 assert.equal(h.sends,0);assert.equal(h.keyboard,1);assert.equal(h.nodes().filter(n=>n.type==='Modal').length,1);
 const overlay=h.nodes().find(n=>typeof n.type==='function'&&n.type.name==='ExportEmailVerification');assert.ok(overlay);
 assert.equal(h.nodes().find(n=>n.type==='SafeAreaView').props.pointerEvents,'none');
 overlay.props.onBack();h.render();assert.equal(h.nodes().find(n=>n.type==='TextInput').props.value,'private fixture');
 assert.equal(h.closed,0);assert.equal(h.nodes().find(n=>n.type==='SafeAreaView').props.pointerEvents,'auto');
 const scroll=h.nodes().find(n=>n.type==='ScrollView');assert.match(JSON.stringify(scroll),/Current password/);assert.match(JSON.stringify(scroll),/Confirm my identity/);
 h.nodes().find(n=>n.type==='TextInput').props.onSubmitEditing();assert.equal(h.keyboard,2);h.unmount();
});

test('verified card never sends and unverified card needs explicit send; duplicates are synchronously prevented',async()=>{
 const verified=privacyUi(true);await verified.settle();verified.verified=true;verified.listeners.forEach(fn=>fn('active'));await verified.settle();assert.match(verified.text(),/Your email is verified/);assert.equal(verified.button('Send verification email'),undefined);assert.equal(verified.sends,0);verified.unmount();
 const h=privacyUi(true);await h.settle();assert.equal(h.sends,0);let release;h.sendAnswer=()=>new Promise(r=>release=r);
 const tap=h.button('Send verification email').props.onPress;tap();tap();h.render();assert.equal(h.sends,1);assert.equal(h.button('Send verification email').props.disabled,true);
 release({state:'verification_requested',email:'server@example.invalid'});await h.settle();assert.match(h.text(),/Check your inbox/);assert.match(h.text(),/server@example.invalid/);assert.doesNotMatch(h.text(),/Your email is verified/);
 assert.deepEqual(JSON.parse(JSON.stringify(h.sendArgs[3])),{action:'verify_email'});h.unmount();
});

test('verification same-error attempts get independent five-second feedback; foreground reads cannot revive errors',async()=>{
 const h=privacyUi(true);await h.settle();h.sendAnswer=async()=>{throw new h.Failure('email_verification_unavailable');};
 for(let attempt=0;attempt<2;attempt++){
  h.button('Send verification email').props.onPress();await h.settle();assert.match(h.text(),/request a verification email/);
  h.advance(4999);assert.match(h.text(),/request a verification email/);h.advance(1);assert.doesNotMatch(h.text(),/request a verification email/);
  h.listeners.forEach(fn=>fn('active'));await h.settle();assert.doesNotMatch(h.text(),/request a verification email/);
 }
 assert.equal(h.sends,2);h.unmount();
});

test('returning from email checks authoritative Auth; returning alone never claims verification',async()=>{
 const h=privacyUi(true);await h.settle();h.listeners.forEach(fn=>fn('active'));await h.settle();assert.doesNotMatch(h.text(),/Your email is verified/);
 h.verified=true;h.listeners.forEach(fn=>fn('active'));await h.settle();assert.match(h.text(),/Your email is verified/);assert.equal(h.sends,0);h.unmount();
});

test('verification dismissal aborts late send, reopening clears feedback, wrong owner Auth blocks sending',async()=>{
 const h=privacyUi(true);await h.settle();let release;h.sendAnswer=()=>new Promise(r=>release=r);h.button('Send verification email').props.onPress();h.unmount();
 assert.equal(h.sendArgs[2].aborted,true);release({state:'verification_requested',email:'old@example.invalid'});await Promise.resolve();
 const reopened=privacyUi(true);await reopened.settle();reopened.user.id='another-owner';reopened.listeners.forEach(fn=>fn('active'));await reopened.settle();assert.equal(reopened.button('Send verification email').props.disabled,true);assert.doesNotMatch(reopened.text(),/Check your inbox|old@example/);reopened.unmount();
});

test('export action errors expire per attempt; background reads and submission errors stay in their action scope',async()=>{
 const h=privacyUi();h.request.prepare=async()=> 'Identity fixture error';
 for(let i=0;i<2;i++){
  h.button('Confirm my identity').props.onPress();await h.settle();assert.match(h.text(),/Identity fixture error/);h.advance(5000);assert.doesNotMatch(h.text(),/Identity fixture error/);
  h.request.error='later background error';h.render();assert.doesNotMatch(h.text(),/later background error/);
 }
 h.request.confirmation='confirmed';h.request.submit=async()=> 'Submission fixture error';h.render();h.button('Email my data').props.onPress();await h.settle();assert.match(h.text(),/Submission fixture error/);
 h.request.status={state:'queued'};h.advance(5000);assert.doesNotMatch(h.text(),/Submission fixture error/);assert.match(h.text(),/queued/);h.unmount();
});

test('late identity result cannot update reopened export or another owner; deletion retains durable errors',async()=>{
 const h=privacyUi();let release;h.request.prepare=()=>new Promise(r=>release=r);h.button('Confirm my identity').props.onPress();await h.settle();
 h.kind=null;h.render();h.kind='export';h.render();release('stale identity');await h.settle();assert.doesNotMatch(h.text(),/stale identity/);
 h.owner='other';h.render();assert.equal(h.nodes().find(n=>n.type==='TextInput').props.value,'');assert.equal(h.nodes().some(n=>typeof n.type==='function'&&n.type.name==='ExportEmailVerification'),false);
 h.kind='delete';h.render();assert.match(h.text(),/background failure/);assert.match(h.text(),/Keep my account/);h.unmount();
});

test('export fits content with an 85 percent cap while deletion keeps its height; both retain keyboard scrolling',()=>{
 const h=privacyUi();let surface=h.nodes().find(n=>n.type==='SafeAreaView');let scroll=h.nodes().find(n=>n.type==='ScrollView');
 assert.equal(surface.props.style.height,undefined);assert.equal(surface.props.style.maxHeight,'85%');assert.equal(scroll.props.style.flex,undefined);assert.equal(scroll.props.style.flexShrink,1);
 assert.equal(scroll.props.keyboardShouldPersistTaps,'handled');assert.equal(scroll.props.keyboardDismissMode,'interactive');
 h.kind='delete';h.render();surface=h.nodes().find(n=>n.type==='SafeAreaView');assert.equal(surface.props.style.height,'85%');h.unmount();
});

test('send can confirm already-verified status; recent-auth failures stay inside card and never claim success',async()=>{
 const h=privacyUi(true);await h.settle();h.sendAnswer=async()=>{throw new h.Failure('reauthentication_required');};
 h.button('Send verification email').props.onPress();await h.settle();assert.match(h.text(),/confirm your identity before sending/);assert.doesNotMatch(h.text(),/Check your inbox/);
 h.advance(5000);h.sendAnswer=async()=>({state:'verified',email:h.user.email});h.button('Send verification email').props.onPress();await h.settle();
 assert.match(h.text(),/Your email is verified/);assert.equal(h.button('Send verification email'),undefined);h.unmount();
});

test('privacy requests retain errors and correlation headers without debug output',async()=>{
 const {api,h}=harness({dev:true,debug:true});h.ok=false;h.result={reason:'confirmation_unavailable'};
 await assert.rejects(api.privacyRequest(owner,'privacy-verification',new AbortController().signal,{confirmation:'SECRET'}),e=>e.reason==='confirmation_unavailable');
 assert.equal(h.calls[0].init.headers['X-Privacy-Request-ID'],id);assert.equal(h.logs.length,0);
});
test('successful privacy status requests remain silent even with old debug setting enabled',async()=>{
 const {api,h}=harness({dev:true,debug:true});h.result={};await api.privacyRequest(owner,'operations/'+id,new AbortController().signal);
 assert.equal(h.logs.length,0);assert.equal(h.calls.length,1);
});
test('password reauthentication is followed by current session token selection, not a captured pre-auth token',async()=>{
 const {api,h}=harness({dev:true,debug:true});await api.confirmPrivacyIdentity(owner,'NEVER_PRINT_PASSWORD',true);h.result={};
 await api.privacyRequest(owner,'privacy-verification',new AbortController().signal,{kind:'delete'});
 assert.equal(h.calls[0].init.headers.Authorization,'Bearer fresh-private-token');assert.doesNotMatch(JSON.stringify(h.logs),/NEVER_PRINT_PASSWORD|fresh-private-token|private@example/);
});
// Real hook, controlled React lifecycle and network/storage fixtures.
function exportHook() {
 const h={owner,values:new Map(),calls:[],latest:null,postError:null},slots=[],effects=[],listeners=[];let cursor=0;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
 const react={useRef:v=>{const i=cursor++;return slots[i]??(slots[i]={current:v});},
 useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
 useCallback:(fn,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn;},
 useEffect:(fn,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){slots[i]?.cleanup?.();slots[i]={deps};effects.push(()=>{slots[i].cleanup=fn();});}}};
 const {api}=harness();const exports={};const fresh={...op,id:'05000000-0000-4000-8000-000000000012',kind:'export'};
 const deps={react,'react-native':{AppState:{currentState:'active',addEventListener:(_,fn)=>{listeners.push(fn);return {remove(){}};}}},
 'expo-secure-store':{getItemAsync:async k=>h.values.get(k)??null,setItemAsync:async(k,v)=>h.values.set(k,v),deleteItemAsync:async k=>h.values.delete(k)},
 '../lib/accountPrivacy':{...api,newPrivacyOperation:async()=>({...fresh,owner:h.owner}),privacyRequest:async(who,path,_signal,body)=>{
 h.calls.push({who,path,body});if(path==='privacy-verification')return {confirmation:'fixture',destination:'fixture@example.invalid'};
 if(path==='export'&&body){if(h.postError)throw new api.PrivacyRequestError(h.postError);throw Error('lost response');}
 if(path==='export')return typeof h.latest==='function'?await h.latest():{status:h.latest};
 if(path.startsWith('operations/')){if(h.latest?.id===path.slice(11))return h.latest;throw new api.PrivacyRequestError('operation_not_found');}
 }}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../hooks/useAccountPrivacy.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,AbortController,setInterval:()=>1,clearInterval(){},require:id=>deps[id]});
 h.render=()=>{cursor=0;h.hook=exports.useAccountPrivacy(h.owner,'export');while(effects.length)effects.shift()();return h.hook;};
 h.settle=async()=>{await new Promise(r=>setImmediate(r));h.render();await new Promise(r=>setImmediate(r));h.render();};
 h.sent=()=>({...status(),kind:'export',accountRemoved:false,state:'sent_for_delivery'});h.render();return h;
}
test('missing export receipt recovers sent status from authenticated server without resending',async()=>{
 const h=exportHook();h.latest=h.sent();await h.settle();assert.equal(h.hook.status.state,'sent_for_delivery');
 assert.equal(JSON.parse(h.values.get(`dadhealth.privacy.${owner}.export`)).id,id);assert.ok(h.calls.every(c=>!c.body));
});
test('new export preserves receipt; export limit restores sent export without polling rejected ID',async()=>{
 const h=exportHook();h.latest=h.sent();await h.settle();await h.hook.newExport();h.render();
 assert.equal(JSON.parse(h.values.get(`dadhealth.privacy.${owner}.export.previous`)).id,id);
 await h.hook.prepare();h.render();h.postError='export_limit';h.calls=[];const message=await h.hook.submit();await h.settle();
 assert.match(message,/last 24 hours/);assert.equal(h.hook.status.id,id);assert.equal(h.hook.busy,false);
 assert.ok(!h.calls.some(c=>c.path.startsWith('operations/')));assert.equal(h.calls.filter(c=>c.body).length,1);
});
test('lost older receipt and rejected candidate recover latest export after reopening',async()=>{
 const h=exportHook();await h.settle();await h.hook.prepare();h.render();h.latest=h.sent();await h.hook.refresh();await h.settle();
 assert.equal(h.hook.status.id,id);assert.ok(h.calls.some(c=>c.path.startsWith('operations/')));assert.ok(h.calls.some(c=>c.path==='export'&&!c.body));
});
test('delayed latest export cannot overwrite another account or expose its status',async()=>{
 const h=exportHook();let resolve;h.latest=()=>new Promise(r=>resolve=r);await new Promise(r=>setImmediate(r));
 h.owner='other';h.latest=null;h.render();resolve({status:h.sent()});await h.settle();assert.equal(h.hook.status,null);
 assert.equal(h.values.has('dadhealth.privacy.other.export'),false);
});
test('failed recovery never invents sent status or automatically resubmits',async()=>{
 const h=exportHook();await h.settle();await h.hook.prepare();h.render();h.postError='export_limit';h.latest=()=>{throw Error('offline');};
 await h.hook.submit();await h.settle();assert.equal(h.hook.status,null);assert.match(h.hook.error,/last 24 hours/);
 assert.equal(h.calls.filter(c=>c.path==='export'&&c.body).length,1);
});
