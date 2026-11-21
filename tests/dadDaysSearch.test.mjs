import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
function setup({status=200,body={results:[]},owner='a',network=false,invalidJson=false,setupFailure=false}={}) {
 const exports={},logs=[],requests=[];
 vm.runInNewContext(ts.transpileModule(readFileSync('lib/dadDaysRequest.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports,__DEV__:true,AbortController,setTimeout,clearTimeout,console:{log:(_tag,data)=>logs.push(data)},
 require:n=>n==='expo-crypto'?{randomUUID:()=> {if(setupFailure) throw Error('PRIVATE native failure');return 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';}}:{supabase:{auth:{getSession:async()=>({data:{session:owner?{user:{id:owner},access_token:'current-token'}:null}})}}},
 fetch:async(url,init)=>{requests.push(init);if(network)throw Error('PRIVATE');return {status,ok:status<400,headers:new Headers(),json:async()=>{if(invalidJson)throw Error('PRIVATE');return body;}}}
 });return {run:payload=>exports.dadDaysRequest('https://example.invalid','a',payload),logs,requests};
}
test('uses current session, accepts empty success and logs only fixed diagnostic fields',async()=>{const h=setup();assert.equal((await h.run({budget:'free'})).results.length,0);assert.equal(h.requests[0].headers.Authorization,'Bearer current-token');assert.deepEqual(Object.keys(h.logs[0]).sort(),['code','requestId','stage','status']);});
test('owner mismatch and expired session cannot search; HTML 401 remains session failure',async()=>{for(const opts of [{owner:'b'},{owner:null},{status:401,invalidJson:true}]){const h=setup(opts);await assert.rejects(h.run({}),e=>e.code==='session_expired');if(opts.owner!==undefined)assert.equal(h.requests.length,0);}});
test('validation, limit, rate, provider, malformed success and network remain distinct',async()=>{for(const [opts,code] of [[{status:400,body:{error:'invalid_request'}},'invalid_request'],[{status:403,body:{error:'search_limit_reached'}},'search_limit_reached'],[{status:503,body:{error:'search_limit_reached'}},'server_failed'],[{status:429,body:{}},'rate_limit_exceeded'],[{status:503,body:{error:'provider_failed'}},'provider_failed'],[{body:{}},'response_invalid'],[{invalidJson:true},'response_invalid'],[{network:true},'network_failed']]){const h=setup(opts);await assert.rejects(h.run({}),e=>e.code===code);assert.ok(!JSON.stringify(h.logs).includes('PRIVATE'));}});
const screen=readFileSync('screens/subscreens/DadDaysSearchScreen.tsx','utf8');
const start=screen.indexOf('const search = useCallback(async () => {')+'const search = useCallback(async () => {'.length;
const end=screen.indexOf('\n  }, [budget',start);
function searchHarness() {
 const h={results:['previous'],error:null,empty:false,owner:'a',calls:0,paywalls:0};const refs={searchLock:{current:false},searchGeneration:{current:0},ageOwner:{current:'a'}};
 const context={__DEV__:true,console:{log(){}},...refs,user:{id:'a'},session:{access_token:'old'},isOffline:false,childAge:'primary',coords:{latitude:1,longitude:1},limitReached:false,WEB_URL:'fixture',postcode:'',budget:'free',radius:'20',quickFilters:[],searchesUsed:0,isPro:false,FREE_LIMIT:3,entitlement:{},route:{key:'fixture'},dadDaysAccess:false,Keyboard:{dismiss(){}},revealResults:{current:false},resultsOwner:{current:'a'},setResultsVersion(){},trackEvent(){},setSearchesUsed(){},setSearching(){},setLocationError:m=>h.error=m,setSearchError:m=>h.error=m,setEmptySearch:v=>h.empty=v,setResults:v=>h.results=v,requestMoment:()=>h.paywalls++,dadDaysRequest:()=>{h.calls++;return new Promise((resolve,reject)=>{h.resolve=resolve;h.reject=reject;});},DadDaysRequestError:class extends Error{},exports:{}};
 vm.runInNewContext(ts.transpileModule('exports.run=async()=>{'+screen.slice(start,end)+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {...h,get state(){return h;},refs,context,run:context.exports.run};
}
test('failed retry preserves results; duplicate tap is ignored; successful retry replaces results and empty is not error',async()=>{const h=searchHarness();const first=h.run();await h.run();assert.equal(h.state.calls,1);h.state.reject(Error('fixture'));await first;assert.deepEqual(h.state.results,['previous']);const retry=h.run();h.state.resolve({results:[]});await retry;assert.equal(h.state.results.length,0);assert.equal(h.state.error,null);assert.equal(h.state.empty,true);assert.equal(h.state.paywalls,0);});
test('missing age never sends; account switch discards late results',async()=>{const h=searchHarness();h.context.childAge=null;await h.run();assert.equal(h.state.calls,0);assert.match(h.state.error,/Choose a child age/);h.context.childAge='primary';const p=h.run();h.refs.ageOwner.current='b';h.state.resolve({results:[{name:'private'}]});await p;assert.deepEqual(h.state.results,['previous']);});

test('native request-ID setup failure is diagnosed before fetch without logging native errors',async()=>{const h=setup({setupFailure:true});await assert.rejects(h.run({}),e=>e.code==='client_setup_failed');assert.equal(h.requests.length,0);assert.equal(h.logs[0].code,'starting');assert.equal(h.logs.at(-1).stage,'setup');assert.equal(h.logs.at(-1).code,'client_setup_failed');assert.ok(!JSON.stringify(h.logs).includes('PRIVATE'));});
