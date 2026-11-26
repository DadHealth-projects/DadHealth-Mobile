import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,mocks={},globals={}) {
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports,require:id=>{assert.ok(id in mocks,id);return mocks[id];},Date,AbortController,setTimeout,clearTimeout,process,...globals});return exports;
}
const contract=load('lib/analyticsContract.ts');
const owner=randomUUID(),other=randomUUID();
const choice=(granted=false,revision=0,operationId=null)=>({owner,granted,revision,operationId,grantedAt:granted?new Date().toISOString():null});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('billing client pins authenticated owner, validates confirmation, rejects foreign and expired sessions',async()=>{
 let session={user:{id:owner},access_token:'fixture'},calls=[];
 const api=load('lib/billingAnalyticsConsent.ts',{'./analyticsContract':contract,'./supabase':{supabase:{auth:{getSession:async()=>({data:{session}})}}}},
 {fetch:async(url,init)=>{calls.push([url,init]);return Response.json(choice());}});
 assert.equal((await api.requestBillingChoice(owner,new AbortController().signal)).granted,false);
 assert.equal(calls[0][1].headers.Authorization,'Bearer fixture');assert.ok(calls[0][0].endsWith('/api/analytics/billing-consent'));
 session={user:{id:other}};await assert.rejects(api.requestBillingChoice(owner,new AbortController().signal));assert.equal(calls.length,1);
 session=null;await assert.rejects(api.requestBillingChoice(owner,new AbortController().signal));
 for(const invalid of [{...choice(),owner:other},{...choice(),revision:-1},{...choice(true),grantedAt:null},{...choice(),operationId:'bad'}])assert.throws(()=>api.parseBillingChoice(invalid,owner));
});
test('stalled session lookup stops on timeout or account cancellation without sending a request',async()=>{
 for(const cause of ['timeout','cancel']) {
  let timeout, calls=0, cleared=false;
  const pending=deferred(), controller=new AbortController();
  const api=load('lib/billingAnalyticsConsent.ts',{'./analyticsContract':contract,'./supabase':{supabase:{auth:{getSession:()=>pending.promise}}}},
   {setTimeout:fn=>{timeout=fn;return 1;},clearTimeout:()=>{cleared=true;},fetch:async()=>{calls++;return Response.json(choice());}});
  const request=api.requestBillingChoice(owner,controller.signal);
  const rejected=assert.rejects(request,/unavailable/);
  if(cause==='timeout')timeout();else controller.abort();
  await rejected;assert.equal(cleared,true);
  pending.resolve({data:{session:{user:{id:owner},access_token:'fixture'}}});
  await new Promise(r=>setImmediate(r));assert.equal(calls,0);
 }
});
function harness(){
 const h={slots:[],index:0,effects:[],dirty:false,requests:[],owner,answer:async()=>choice()};
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={createElement:(type,props,...children)=>({type,props:props??{},children:children.flat(Infinity)}),
 useRef:v=>{const i=h.index++;return h.slots[i]??(h.slots[i]={current:v});},
 useState:v=>{const i=h.index++;if(!(i in h.slots))h.slots[i]=v;return [h.slots[i],n=>{h.slots[i]=typeof n==='function'?n(h.slots[i]):n;h.dirty=true;}];},
 useCallback:(fn,deps)=>{const i=h.index++;if(!h.slots[i]||!same(h.slots[i].deps,deps))h.slots[i]={deps,fn};return h.slots[i].fn;},
 useEffect:(fn,deps)=>{const i=h.index++,old=h.slots[i];if(!old||!same(old.deps,deps)){h.slots[i]={deps,cleanup:old?.cleanup};h.effects.push(()=>{h.slots[i].cleanup?.();h.slots[i].cleanup=fn();});}}};react.default=react;
 const component=load('components/BillingAnalyticsConsentControl.tsx',{react,'react-native':{AppState:{addEventListener:(_n,fn)=>{h.foreground=fn;return {remove(){}};}},Switch:'Switch',Text:'Text',View:'View'},
 '@react-navigation/native':{useFocusEffect:fn=>react.useEffect(fn,[fn])},'expo-crypto':{randomUUID},'../theme':{colors:{lime:'lime'}},
 '../lib/billingAnalyticsConsent':{requestBillingChoice:async(o,signal,change)=>{h.requests.push({owner:o,signal,change});return h.answer(change);}}}).default;
 h.render=()=>{h.index=0;h.dirty=false;h.tree=component({owner:h.owner});h.effects.splice(0).forEach(f=>f());};
 h.flush=async()=>{for(let i=0;i<8;i++){await new Promise(r=>setImmediate(r));if(h.dirty)h.render();}};
 const nodes=(n,type)=>!n||typeof n!=='object'?[]:[...(n.type===type?[n]:[]),...(n.children??[]).flatMap(c=>nodes(c,type))];
 h.switch=()=>nodes(h.tree,'Switch')[0].props;
 h.text=()=>nodes(h.tree,'Text').map(n=>n.children.join('')).join(' ');
 h.render();return h;
}
test('separate switch defaults off; duplicate taps produce one write and only confirmed save turns it on',async()=>{
 const h=harness();await h.flush();assert.equal(h.switch().value,false);
 const d=deferred();h.answer=()=>d.promise;h.switch().onValueChange(true);h.switch().onValueChange(true);
 assert.equal(h.requests.filter(r=>r.change).length,1);await h.flush();assert.equal(h.switch().value,false);assert.equal(h.switch().disabled,true);
 const op=h.requests.at(-1).change;d.resolve(choice(true,1,op.operationId));await h.flush();assert.equal(h.switch().value,true);
});
test('lost write response reconciles without a second POST; unresolved explicit tap repeats the same operation',async()=>{
 const h=harness();await h.flush();h.answer=async change=>{if(change)throw Error('lost response');return choice();};
 h.switch().onValueChange(true);await h.flush();assert.match(h.text(),/couldn’t confirm/);assert.equal(h.switch().value,false);
 const first=h.requests.find(r=>r.change).change;
 h.switch().onValueChange(true);await h.flush();assert.deepEqual(h.requests.filter(r=>r.change).map(r=>r.change.operationId),[first.operationId,first.operationId]);
 h.answer=async()=>choice(true,1,first.operationId);h.foreground('active');await h.flush();assert.equal(h.switch().value,true);
});
test('read/write race and account switch cannot overwrite confirmed choice or expose previous owner state',async()=>{
 const h=harness();await h.flush();const stale=deferred();h.answer=()=>stale.promise;h.foreground('active');
 h.answer=async change=>choice(true,1,change.operationId);h.switch().onValueChange(true);await h.flush();assert.equal(h.switch().value,true);
 stale.resolve(choice());await h.flush();assert.equal(h.switch().value,true);
 const late=deferred();h.answer=()=>late.promise;h.foreground('active');h.owner=other;h.render();assert.equal(h.switch().value,false);assert.equal(h.switch().disabled,true);
 late.resolve(choice());await h.flush();assert.equal(h.switch().value,false);
});
