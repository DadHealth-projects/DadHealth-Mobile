import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import ts from 'typescript';import {readFileSync} from 'node:fs';
// 6ee3f50 added a 5 s visibility retry timer; record timers instead of running them so tests stay deterministic.
const scheduledTimers=[];const fakeSetTimeout=(fn,ms)=>{scheduledTimers.push({fn,ms});return scheduledTimers.length;};
// Since 6ee3f50 the RPCs chain .abortSignal(...) and block/unblock keep a durable pending change on the device.
const rpcResult=(work)=>{const p=Promise.resolve().then(work);p.abortSignal=()=>p;return p;};
const storageMock=(over={})=>{const m=new Map();return {rememberCommunityVisibilityChange:async(o,c)=>{m.set(o,c);},readCommunityVisibilityChange:async o=>m.get(o)??null,finishCommunityVisibilityChange:async o=>{m.delete(o);},prepareCommunityCacheChange:async()=>{},invalidateCommunityCache:async()=>true,...over};};
function load(path,deps){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,{exports,require:id=>{assert.ok(id in deps,id);return deps[id];},Date,Map,Set,Promise,AbortSignal,setTimeout:fakeSetTimeout,clearTimeout:()=>{},process:{env:{EXPO_PUBLIC_SUPABASE_URL:"https://fixture.invalid",EXPO_PUBLIC_SUPABASE_ANON_KEY:"public-fixture"}}});return exports;}
function harness(){const calls=[];let owner='a',answer={data:{state:'received',id:'receipt'}};const api=load('lib/communityModeration.ts',{'@supabase/supabase-js':{createClient:(_url,_key,options)=>({rpc:(name,args)=>rpcResult(async()=>{calls.push({name,args,token:await options.accessToken()});return answer;})})},'./supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'token-'+owner}}})},rpc:async(name,args)=>{calls.push({name,args});return answer;}}},'./offlineStorage':storageMock({invalidateCommunityCache:async()=>{calls.push({clear:true});}})});return {api,calls,setOwner:v=>owner=v,setAnswer:v=>answer=v};}
test('report derives session owner and sends only target reason explanation',async()=>{const h=harness();assert.equal(await h.api.reportCommunity('a',{kind:'post',id:'p'},'spam','text'),'receipt');assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].args)),{p_kind:'post',p_id:'p',p_reason:'spam',p_explanation:'text'});h.setOwner('b');await assert.rejects(h.api.reportCommunity('a',{kind:'post',id:'p'},'spam','text'),/Sign in/);assert.equal(h.calls.length,1);});
test('report validates limits and never invents persistence success',async()=>{const h=harness();await assert.rejects(h.api.reportCommunity('a',{kind:'post',id:'p'},'wrong',''),/Check/);await assert.rejects(h.api.reportCommunity('a',{kind:'post',id:'p'},'spam','x'.repeat(1001)),/Check/);assert.equal(h.calls.length,0);h.setAnswer({error:{code:'P0001'}});await assert.rejects(h.api.reportCommunity('a',{kind:'post',id:'p'},'spam',''),/limit/);h.setAnswer({data:{state:'queued'}});await assert.rejects(h.api.reportCommunity('a',{kind:'post',id:'p'},'spam',''),/confirm/);});
test('confirmed block invalidates only owner and increments late-response revision',async()=>{const h=harness();const events=[];h.api.subscribeCommunityModeration((owner,ready)=>events.push([owner,ready]));await tick();events.length=0;
 h.setAnswer({data:{state:'blocked',id:'block'}});await h.api.blockCommunity('a',{kind:'comment',id:'c'});
 // The block hides content at once (not ready) and settles ready only after server confirmation.
 assert.ok(events.length>=2&&events.every(([owner])=>owner==='a'));assert.deepEqual(events[0],['a',false]);assert.deepEqual(events.at(-1),['a',true]);
 assert.deepEqual(h.calls.filter(c=>c.name).map(c=>c.name),['block_community_author']);
 const revision=h.api.communityRevision('a');assert.ok(revision>=1);assert.equal(h.api.communityRevision('b'),0);
 events.length=0;h.setAnswer({error:{}});await assert.rejects(h.api.blockCommunity('a',{kind:'post',id:'p'}),/confirm this change/);
 assert.ok(!events.some(([,ready])=>ready),'an unconfirmed block never reports ready');assert.ok(h.api.communityRevision('a')>=revision);assert.equal(h.api.communityRevision('b'),0);
 assert.ok(scheduledTimers.some(t=>t.ms===5000),'an unconfirmed change is retried automatically');});

test('blocked list strips extra fields and rejects identity-bearing labels',async()=>{const h=harness();h.setAnswer({data:[{id:'block',label:'Blocked dad',createdAt:'2026-11-19',privateAuthor:'secret'}]});const rows=await h.api.readCommunityBlocks('a');assert.deepEqual(Object.keys(rows[0]),['id','label','createdAt']);h.setAnswer({data:[{id:'block',label:'Actual identity',createdAt:'2026-11-19'}]});await assert.rejects(h.api.readCommunityBlocks('a'));});
test('cache invalidation suppresses late writes without clearing another owner',async()=>{const map=new Map();const storage=load('lib/offlineStorage.ts',{'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async k=>map.get(k)??null,setItem:async(k,v)=>map.set(k,v),removeItem:async k=>map.delete(k),getAllKeys:async()=>[...map.keys()],multiRemove:async keys=>keys.forEach(k=>map.delete(k))}}});const data={posts:[{id:'p'}],likedIds:[],savedIds:[],anonymousOwnedIds:[]};await storage.writeCommunityCache('a',data);await storage.writeCommunityCache('b',data);const stale=storage.communityCacheVersion('a');await storage.invalidateCommunityCache('a');await storage.writeCommunityCache('a',data,stale);assert.equal(await storage.readCommunityCache('a'),null);assert.equal((await storage.readCommunityCache('b')).posts.length,1);});
test('all existing surfaces wire actions and visibility generations protect later pages',()=>{const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');for(const p of ['components/community/InteractiveFeedPost.tsx','screens/CommunityScreen.tsx','screens/subscreens/CommunityPostThreadScreen.tsx'])assert.match(read(p),/CommunityActionsMenu/);for(const p of ['hooks/useCommunityFeed.ts','screens/subscreens/CommunityPostThreadScreen.tsx']){const s=read(p);assert.match(s,/requestKey = .*communityRevision/);assert.match(s,/subscribeCommunityModeration/);}assert.match(read('screens/subscreens/CommunityPostThreadScreen.tsx'),/!comments.some\(parent => parent.id === comment.parent_id\)/);assert.match(read('components/community/CommunityActionsMenu.tsx'),/lock.current = true/);assert.match(read('components/community/CommunityActionsMenu.tsx'),/epoch.current === generation/);});

function menu(api, own=false) {
 const state=[],refs=[],effects=[];let si=0,ri=0,ei=0,owner='a';
 const react={createElement:(type,props,...children)=>({type,props:props??{},children}),useState:initial=>{const n=si++;if(!(n in state))state[n]=initial;return [state[n],v=>{state[n]=typeof v==='function'?v(state[n]):v;}];},useRef:initial=>refs[ri++]??=( {current:initial}),useEffect:(fn,deps)=>{const n=ei++;const old=effects[n];if(!old||deps.some((v,i)=>v!==old.deps[i])){old?.cleanup?.();effects[n]={deps,cleanup:fn()};}}};
 const Component=load('components/community/CommunityActionsMenu.tsx',{react,'react-native':Object.fromEntries(['ActivityIndicator','KeyboardAvoidingView','Modal','Pressable','ScrollView','Text','TextInput','View'].map(x=>[x,x]).concat([['Platform',{OS:'ios'}],['Keyboard',{dismiss(){}}]])),'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'@expo/vector-icons':{Feather:'Feather'},'../../contexts/AuthContext':{useAuth:()=>({user:owner?{id:owner}:null})},'../../lib/communityModeration':{reportReasons:[['spam','Spam']],...api},'../LimeButton':{__esModule:true,default:'LimeButton'},'../../theme':{colors:{text:'#fff',lime:'#c8f55a'}}}).default;
 return {render:()=>{si=ri=ei=0;return Component({target:{kind:'post',id:'p'},own});},owner:v=>owner=v};
}
function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...(tree.children??[]).flatMap(nodes)]:[];}
// The menu rows are Pressables with visible text (no label prop); find them the way a reader sees them.
const textOf=n=>Array.isArray(n)?n.map(textOf).join(''):typeof n==='string'||typeof n==='number'?String(n):n&&typeof n==='object'?textOf(n.children??[]):'';
const rowWithText=(tree,text)=>nodes(tree).find(n=>n.type==='Pressable'&&textOf(n).trim()===text);
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
test('report menu prevents duplicate taps and shows receipt only after persistence',async()=>{let resolve,calls=0;const ui=menu({reportCommunity:()=>{calls++;return new Promise(r=>resolve=r);}});ui.render();let tree=ui.render();nodes(tree).find(n=>n.type==='Pressable').props.onPress({stopPropagation(){}});tree=ui.render();rowWithText(tree,'Report post').props.onPress();tree=ui.render();const submit=nodes(tree).find(n=>n.props.label==='Submit report');submit.props.onPress();submit.props.onPress();assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(ui.render()),/Report received/);resolve('receipt');await tick();assert.match(JSON.stringify(ui.render()),/Report received/);});
test('late report completion cannot update a different account menu',async()=>{let resolve;const ui=menu({reportCommunity:()=>new Promise(r=>resolve=r)});ui.render();nodes(ui.render()).find(n=>n.type==='Pressable').props.onPress({stopPropagation(){}});rowWithText(ui.render(),'Report post').props.onPress();nodes(ui.render()).find(n=>n.props.label==='Submit report').props.onPress();ui.owner('b');ui.render();resolve('receipt');await tick();assert.doesNotMatch(JSON.stringify(ui.render()),/Report received/);assert.equal(nodes(ui.render()).find(n=>n.type==='Modal').props.visible,false);});
test('official lookup accepts only server-confirmed requested IDs',async()=>{const api=load('lib/communityAuthorAvatars.ts',{'./supabase':{supabase:{rpc:async()=>({data:[{contribution_id:'p'},{contribution_id:'not-requested'}]})}}});assert.deepEqual([...await api.loadCommunityOfficialAuthors(['p'])],['p']);});

test('thread owner reset runs before focus loading and deferred reads reject old owners',()=>{
 const thread=readFileSync(new URL('../screens/subscreens/CommunityPostThreadScreen.tsx',import.meta.url),'utf8');
 assert.ok(thread.indexOf('useEffect(() => { loadSequence.current++; setPost(null); setComments([]); }, [user?.id])') < thread.indexOf("if (!focused || appState !== 'active') return;"));
 assert.match(thread,/if \(!screenActiveRef.current \|\| currentOwner.current !== user\?\.id\) return/);
 const feed=readFileSync(new URL('../hooks/useCommunityFeed.ts',import.meta.url),'utf8');
 assert.match(feed,/if \(!screenActiveRef.current \|\| currentOwner.current !== userId\) return/);
});


test('official lookup deduplicates and batches mixed threads at the 250 boundary',async()=>{
 const calls=[];
 const api=load('lib/communityAuthorAvatars.ts',{'./supabase':{supabase:{rpc:async(name,args)=>{calls.push(args);const ids=[...args.p_post_ids,...args.p_comment_ids];assert.ok(ids.length<=250);return {data:ids.map(contribution_id=>({contribution_id})).concat([{contribution_id:'intruder'}])};}}}});
 const posts=Array.from({length:2},(_,i)=>'p'+i),comments=Array.from({length:501},(_,i)=>'c'+i);
 const result=await api.loadCommunityOfficialAuthors([...posts,'p0'],[...comments,'c0']);
 assert.deepEqual(calls.map(c=>c.p_post_ids.length+c.p_comment_ids.length),[250,250,3]);
 assert.equal(result.size,503);assert.equal(result.has('c500'),true);assert.equal(result.has('intruder'),false);
 calls.length=0;assert.equal((await api.loadCommunityOfficialAuthors(['p'],comments.slice(0,249))).size,250);assert.equal(calls.length,1);
});
test('transient cache removal failure recovers without exposing stale disk or poisoning reads',async()=>{
 const map=new Map();let fail=false;
 const deps={'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async k=>map.get(k)??null,setItem:async(k,v)=>map.set(k,v),removeItem:async k=>{if(fail&&k.endsWith('.community_v3'))throw Error('disk');map.delete(k);},getAllKeys:async()=>[...map.keys()],multiRemove:async keys=>keys.forEach(k=>map.delete(k))}}};
 const storage=load('lib/offlineStorage.ts',deps),old={posts:[{id:'blocked'}],likedIds:[],savedIds:[],anonymousOwnedIds:[]};
 await storage.writeCommunityCache('a',old);await storage.writeCommunityCache('b',old);const stale=storage.communityCacheVersion('a');
 await storage.prepareCommunityCacheChange('a');fail=true;assert.equal(await storage.invalidateCommunityCache('a'),false);
 assert.equal(await storage.readCommunityCache('a'),null);await storage.writeCommunityCache('a',old,stale);assert.equal(await storage.readCommunityCache('a'),null);
 assert.equal((await storage.readCommunityCache('b')).posts[0].id,'blocked');
 // The persisted marker also protects a fresh module after an app restart.
 const restarted=load('lib/offlineStorage.ts',deps);assert.equal(await restarted.readCommunityCache('a'),null);
 fail=false;assert.equal(await storage.readCommunityCache('a'),null);
 const fresh={...old,posts:[{id:'allowed'}]};await storage.writeCommunityCache('a',fresh);assert.equal((await storage.readCommunityCache('a')).posts[0].id,'allowed');
 await storage.prepareCommunityCacheChange('a');assert.equal(await storage.invalidateCommunityCache('a'),true);await storage.writeCommunityCache('a',old);assert.equal((await storage.readCommunityCache('a')).posts[0].id,'blocked');
});
test('confirmed block and unblock emit ready; a failed local clean-up keeps the change pending and never reports ready',async()=>{
 let owner='a',finishFails=false;const events=[];
 const storage=storageMock();const finish=storage.finishCommunityVisibilityChange;storage.finishCommunityVisibilityChange=async(o,c)=>{if(finishFails)throw Error('storage busy');return finish(o,c);};
 const api=load('lib/communityModeration.ts',{'@supabase/supabase-js':{createClient:()=>({rpc:name=>rpcResult(async()=>({data:{state:name==='block_community_author'?'blocked':'unblocked',id:'b'}}))})},'./supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'test'}}})}}},'./offlineStorage':storage});
 api.subscribeCommunityModeration((o,ready)=>events.push([o,ready]));await tick();events.length=0;
 await api.blockCommunity('a',{kind:'post',id:'p'});assert.deepEqual(events.at(-1),['a',true]);
 events.length=0;await api.unblockCommunity('a','b');assert.deepEqual(events.at(-1),['a',true]);
 events.length=0;finishFails=true;await assert.rejects(api.blockCommunity('a',{kind:'post',id:'p'}),/confirm this change/);
 assert.ok(!events.some(([,ready])=>ready),'clean-up failure is not reported as done');assert.ok(await storage.readCommunityVisibilityChange('a'),'the pending change is kept for retry');
 events.length=0;owner='b';await assert.rejects(api.blockCommunity('a',{kind:'post',id:'p'}));assert.equal(events.length,0,'another signed-in account cannot settle it');
});

test('trending resolves named and private anonymous ownership before offering moderation',()=>{
 const source=readFileSync(new URL('../screens/CommunityScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/from\('posts'\)\.select\('id'\)\.eq\('user_id', acceptedOwner\)/);
 assert.match(source,/from\('anonymous_post_owners'\)\.select\('post_id'\)\.eq\('user_id', acceptedOwner\)/);
 assert.match(source,/post\.ownershipKnown \? <CommunityActionsMenu[^\n]+own=\{post\.own\}/);
});

test('own-content menu offers neither reporting nor self-blocking',()=>{
 const ui=menu({},true);assert.equal(ui.render(),null);
});
test('failed durable safety marker prevents submitting a visibility mutation',async()=>{
 let writes=0;
 const api=load('lib/communityModeration.ts',{'@supabase/supabase-js':{createClient:()=>({rpc:()=>rpcResult(async()=>{writes++;return {data:{state:'blocked',id:'b'}};})})},'./supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:'a'},access_token:'test'}}})}}},'./offlineStorage':storageMock({rememberCommunityVisibilityChange:async()=>{throw Error('internal storage detail');}})});
 await assert.rejects(api.blockCommunity('a',{kind:'post',id:'p'}),/confirm this change/);assert.equal(writes,0);
});
