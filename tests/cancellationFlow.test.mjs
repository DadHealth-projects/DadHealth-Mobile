import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const item={id:'sub-a',provider:'apple',plan:'monthly',status:'active',currentPeriodEnd:'2099-01-01T00:00:00Z',canCancel:true,cancellation:{state:'unknown',end:null}};
function harness(overrides={}) {
 const slots=[],effects=[];let cursor=0,pending=[];
 const h={saves:[],opens:[],closes:0,refreshes:0,props:{owner:'owner-a',subscriptions:[item],loading:false,loadError:null,returnState:'idle',offline:false,...overrides}};
 h.save=async(...args)=>{h.saves.push(args);};
 h.props.manage=async(id)=>{h.opens.push(id);return true;};h.props.onClose=()=>h.closes++;
 h.props.refresh=async()=>{h.refreshes++;return true;};
 const react={createElement(type,props,...children){if(typeof type==='function')return type({...props,children});return {type,props:props??{},children};},
 useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
 useRef(initial){const i=cursor++;return slots[i]??={current:initial};},
 useEffect(fn,deps){const i=cursor++;if(!effects[i]||deps.some((d,j)=>d!==effects[i].deps[j]))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});}};
 const mocks={react:{...react,default:react},'react-native':Object.fromEntries(['View','Text','Pressable','ScrollView','TextInput','ActivityIndicator'].map(n=>[n,n])),
 '@expo/vector-icons':{Feather:'Feather',MaterialCommunityIcons:'MaterialCommunityIcons'},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
 'expo-crypto':{randomUUID:()=> 'attempt-1'},'../../theme':{colors:{}},'../../lib/nativeSubscriptions':{saveCancellationFeedback:(...args)=>h.save(...args)}};
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../components/subscriptions/CancellationFlow.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{exports,require:n=>{assert.ok(n in mocks,n);return mocks[n];}});
 h.render=()=>{cursor=0;pending=[];h.tree=exports.default(h.props);pending.forEach(f=>f());h.nodes=[];h.text='';function walk(n){if(Array.isArray(n))return n.forEach(walk);if(typeof n==='string'||typeof n==='number'){h.text+=n+' ';return;}if(n&&typeof n==='object'){h.nodes.push(n);walk(n.children);}}walk(h.tree);};
 h.press=label=>{const n=h.nodes.find(n=>n.props.accessibilityLabel===label);assert.ok(n,`Missing ${label}: ${h.text}`);assert.ok(!n.props.disabled,`Disabled ${label}`);n.props.onPress();h.render();};
 h.next=()=>h.press('Continue');h.flush=async()=>{await tick();h.render();};h.unmount=()=>effects.forEach(e=>e?.cleanup?.());
 h.toHandoff=(reason='Other')=>{h.next();h.press(reason);h.next();h.next();};h.render();return h;
}
for(const reason of ['Too expensive','Not using it enough','Missing a feature','Technical problem','Other'])test(`cancellation accepts ${reason} with optional empty feedback`,async()=>{
 const h=harness();h.toHandoff(reason);h.press('Continue to Apple');await h.flush();assert.equal(h.saves.length,1);assert.equal(h.saves[0][1].details,'');assert.deepEqual(h.opens,['sub-a']);assert.match(h.text,/Thanks for/);assert.doesNotMatch(h.text,/Cancellation Scheduled/);h.unmount();
});
test('text is capped at 1000 and chevron preserves steps',()=>{const h=harness();h.next();h.press('Other');h.next();const input=h.nodes.find(n=>n.type==='TextInput');assert.equal(input.props.maxLength,1000);input.props.onChangeText('a'.repeat(1001));h.render();assert.equal(h.nodes.find(n=>n.type==='TextInput').props.value.length,1000);h.press('Go back');assert.match(h.text,/Tell us why/);h.press('Go back');h.press('Go back');assert.equal(h.closes,1);h.unmount();});
test('rapid taps save once; uncertain retry reuses exact payload and bypass remains available',async()=>{
 const h=harness();const gate=deferred();h.save=async(...args)=>{h.saves.push(args);await gate.promise;};h.toHandoff();const action=h.nodes.find(n=>n.props.accessibilityLabel==='Continue to Apple');action.props.onPress();action.props.onPress();assert.equal(h.saves.length,1);gate.reject(Error('lost response'));await h.flush();assert.doesNotMatch(h.text,/Thanks for/);
 h.save=async(...args)=>{h.saves.push(args);throw Error('offline');};h.press('Retry');await h.flush();assert.deepEqual(h.saves[0],h.saves[1]);h.press('Continue without saving feedback');await h.flush();assert.equal(h.opens.length,1);assert.equal(h.closes,1);h.unmount();
});
test('saved feedback is not sent again after management failure',async()=>{const h=harness();h.props.manage=async()=>false;h.toHandoff();h.press('Continue to Apple');await h.flush();assert.match(h.text,/Thanks for/);assert.equal(h.saves.length,1);h.props.manage=async id=>{h.opens.push(id);return true;};h.render();h.press('Continue to Apple');await h.flush();assert.equal(h.saves.length,1);assert.deepEqual(h.opens,['sub-a']);h.unmount();});
for(const mode of ['unmount','switch'])test(`late feedback cannot hand off after ${mode}`,async()=>{const h=harness();const gate=deferred();h.save=()=>gate.promise;h.toHandoff();h.press('Continue to Apple');if(mode==='unmount')h.unmount();else {h.props.owner='owner-b';h.render();}gate.resolve();await h.flush();assert.equal(h.opens.length,0);h.unmount();});
test('legacy Stripe records never enter the new Apple cancellation flow',async()=>{const h=harness({subscriptions:[item,{...item,id:'sub-b',provider:'stripe',plan:'annual'}]});assert.doesNotMatch(h.text,/Stripe|Choose subscription/);h.toHandoff();h.press('Continue to Apple');await h.flush();assert.deepEqual(h.opens,['sub-a']);h.unmount();const legacy=harness({subscriptions:[{...item,provider:'stripe'}]});assert.ok(!legacy.nodes.some(n=>n.props.accessibilityLabel==='Continue'));legacy.unmount();});
test('no eligible or unknown subscriptions do not offer provider handoff; load failure can retry',()=>{for(const subscriptions of [[],null]){const h=harness({subscriptions,loadError:'Unable to verify'});assert.ok(!h.nodes.some(n=>n.props.accessibilityLabel==='Continue'));h.press('Try again');assert.equal(h.refreshes,2);h.unmount();}});
test('feedback receipt does not itself claim scheduled cancellation',async()=>{const h=harness();h.toHandoff();h.press('Continue to Apple');await h.flush();assert.match(h.text,/Thanks for/);assert.doesNotMatch(h.text,/Cancellation Scheduled/);h.props.returnState='refreshed';h.render();assert.doesNotMatch(h.text,/Cancellation Scheduled/);h.unmount();});
