import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../'+file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  return exports;
}
const { createResetPlayback } = load('lib/mindResetPlayback.ts');
const { createSoundPreferences } = load('lib/mindResetSound.ts');
const { getMindResetPhase, getMindResetStepIndex } = load('lib/mindReset.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
const tick = async () => { for(let n=0;n<8;n++) await Promise.resolve(); };
function setup(acquire, configure = () => {}) {
  const players=[], views=[]; let releases=0;
  const session=createResetPlayback(()=>{
    let callback;
    const player={currentTime:0,isLoaded:true,muted:false,loop:false,plays:0,removed:false,seeks:[],
      currentStatus:{currentTime:0,playing:false,isLoaded:true,didJustFinish:false},
      play(){this.plays++;}, pause(){}, remove(){this.removed=true;}, release(){this.released=true;},
      async seekTo(...args){this.seeks.push(args);this.currentTime=args[0];},
      addListener(_,fn){callback=fn;return {remove(){}};},
      emit(time,playing=true,finished=false){this.currentTime=time;this.currentStatus={currentTime:time,playing,isLoaded:true,didJustFinish:finished};callback(this.currentStatus);},
    };configure(player, players.length);players.push(player);return player;
  },acquire??(async()=>async()=>{releases++;}),v=>views.push(v));
  return {session,players,views,get releases(){return releases;}};
}
test('native position drives breathing, all guidance boundaries and completion; tail finishes first',async()=>{
 const x=setup();await x.session.start();const p=x.players[0];
 for(const time of [0,59,60,108,156,204,252,299,300]){
  p.emit(time);assert.equal(x.views.at(-1).seconds,time);
  assert.equal(getMindResetPhase(time),time<60?'breathing':time<300?'reset':'complete');
  if(time>=60&&time<300)assert.equal(getMindResetStepIndex(time),Math.floor((time-60)/48));
 }
 p.emit(301.5,true);assert.equal(p.removed,false);p.emit(307,true);assert.equal(p.removed,false);p.emit(310,false,true);assert.equal(p.removed,true);assert.equal(x.releases,1);
 await x.session.start();assert.equal(x.players.length,1);
});
test('explicit pause removes native interrupted player; resume seeks exact position without restarting cue',async()=>{
 const x=setup();await x.session.start();const p=x.players[0];p.emit(120.75,false);
 x.session.pause();assert.equal(p.removed,true);assert.equal(x.views.at(-1).running,false);
 p.emit(180,true);assert.equal(x.views.at(-1).seconds,120);
 await x.session.start();await tick();const next=x.players[1];
 assert.deepEqual(next.seeks,[[120.75,0,0]]);assert.equal(next.plays,1);
});
test('OS interruption uses native position and resumes without seek, replay or wall-clock catch-up',async()=>{
 const x=setup();await x.session.start();const p=x.players[0];p.emit(61,false);p.emit(61.2,true);
 assert.equal(x.views.at(-1).seconds,61);assert.equal(p.plays,1);assert.equal(p.seeks.length,0);
 p.currentStatus={currentTime:241,playing:true,isLoaded:true,didJustFinish:false};x.session.reconcile();
 assert.equal(x.views.at(-1).seconds,241);
 p.emit(310,false,true);p.emit(0,true);assert.equal(x.views.at(-1).seconds,300);
});
test('muted playback keeps identical native timing and completion',async()=>{
 const x=setup();x.session.setSound(false);await x.session.start();const p=x.players[0];
 assert.equal(p.muted,true);assert.equal(p.plays,1);p.emit(180);assert.equal(x.views.at(-1).seconds,180);
 x.session.setSound(true);assert.equal(p.muted,false);p.emit(310,false,true);assert.equal(p.removed,true);
});
test('exit/account cleanup invalidates late acquire, status and seek callbacks',async()=>{
 const d=deferred();let releases=0;const x=setup(()=>d.promise);const start=x.session.start();
 x.session.dispose();const count=x.views.length;d.resolve(async()=>{releases++;});await start;
 assert.equal(releases,1);assert.equal(x.players.length,0);assert.equal(x.views.length,count);
 const seek=deferred();
 const y=setup(undefined,(player,index)=>{if(index===1)player.seekTo=()=>seek.promise;});
 await y.session.start();y.players[0].emit(61);y.session.pause();
 await y.session.start();assert.equal(y.players[1].plays,0);
 y.session.dispose();seek.resolve();await tick();assert.equal(y.players[1].plays,0);
 const n=y.views.length;y.players[0].emit(120);assert.equal(y.views.length,n);
 assert.ok(y.players.every(p=>p.removed&&p.released));
});
test('failed acquisition is recoverable and never starts playback',async()=>{
 let fail=true;const x=setup(async()=>{if(fail)throw Error('busy');return async()=>{};});
 await x.session.start();assert.equal(x.players.length,0);assert.ok(x.views.at(-1).error);
 fail=false;await x.session.start();assert.equal(x.players[0].plays,1);
});
test('Pause during preparation prevents late playback and duplicate Begin cannot create two players',async()=>{
 const d=deferred();let releases=0;const x=setup(()=>d.promise);
 const pending=x.session.start();await x.session.start();x.session.pause();
 d.resolve(async()=>{releases++;});await pending;
 assert.equal(x.players.length,0);assert.equal(releases,1);assert.equal(x.views.at(-1).preparing,false);
});
test('foreground after native end releases the tail even if the end event was missed',async()=>{
 const x=setup();await x.session.start();const p=x.players[0];
 p.currentStatus={currentTime:310,playing:false,isLoaded:true,didJustFinish:false};
 x.session.reconcile();assert.equal(x.views.at(-1).seconds,300);assert.equal(p.released,true);
 await x.session.start();assert.equal(x.players.length,1);
});
test('media service reset stops the player rather than restarting its track',async()=>{
 const x=setup();await x.session.start();const p=x.players[0];p.emit(130);
 p.currentStatus={currentTime:0,playing:false,isLoaded:true,didJustFinish:false,mediaServicesDidReset:true};
 x.session.reconcile();assert.equal(p.released,true);assert.equal(p.plays,1);assert.ok(x.views.at(-1).error);
});
test('per-account sound defaults on; stale reads cannot overwrite a toggle or another owner',async()=>{
 const a=deferred(),b=deferred();const writes=[];
 const store=createSoundPreferences({getItem:k=>k.endsWith(':a')?a.promise:b.promise,setItem:async(k,v)=>{writes.push([k,v]);}});
 assert.equal(store.get('a'),true);const loadA=store.load('a'),loadB=store.load('b');
 await store.set('a',false);a.resolve('on');await loadA;assert.equal(store.get('a'),false);
 assert.equal(store.get('b'),true);b.resolve('on');await loadB;assert.equal(store.get('b'),true);
 await Promise.all([store.set('a',true),store.set('a',false)]);assert.equal(writes.at(-1)[1],'off');
});
test('audio ownership rejects overlaps and old release cannot reset a new owner',async()=>{
 const calls=[];const {acquireAudio}=load('lib/audioOwnership.ts',{'expo-audio':{setAudioModeAsync:async mode=>calls.push(mode)}});
 const release=await acquireAudio('recording');await assert.rejects(acquireAudio('reset'));
 await release();const reset=await acquireAudio('reset');const count=calls.length;await release();await reset();
 assert.equal(calls.length,count);assert.equal(calls.at(-1).interruptionMode,'mixWithOthers');
 assert.equal(calls.at(-1).playsInSilentMode,true);assert.equal(calls.at(-1).shouldPlayInBackground,true);
});
test('saved sound off loads independently and storage failure is not reported as success',async()=>{
 const store=createSoundPreferences({getItem:async k=>k.endsWith(':a')?'off':null,setItem:async()=>{throw Error('disk');}});
 await store.load('a');await store.load('b');assert.equal(store.get('a'),false);assert.equal(store.get('b'),true);
 await assert.rejects(store.set('a',true));
});
test('selected recording repeats every 10 seconds with complete final cue and silent gaps',()=>{
 const wav=readFileSync(new URL('../assets/audio/mind-reset-provisional.wav',import.meta.url));
 const source=readFileSync(new URL('../assets/audio/mind-reset-chime-source.wav',import.meta.url));
 const rate=wav.readUInt32LE(24),length=(source.length-44)/2;
 assert.equal(rate,16000);assert.equal((wav.length-44)/2/rate,310);
 assert.ok(length/rate>7 && length/rate<8);
 const first=wav.subarray(44,44+length*2);
 for(let second=0;second<=300;second+=10){
  assert.deepEqual(wav.subarray(44+second*rate*2,44+(second*rate+length)*2),first);
  assert.ok(wav.subarray(44+(second*rate+length)*2,44+(second+10)*rate*2).every(v=>v===0),'silent gap');
 }
});

test('selected recording preserves all samples with edge fades and clipping headroom',()=>{
 const wav=readFileSync(new URL('../assets/audio/mind-reset-provisional.wav',import.meta.url));
 const source=readFileSync(new URL('../assets/audio/mind-reset-chime-source.wav',import.meta.url));
 const rate=16000,length=(source.length-44)/2;
 const expected=Array.from({length},(_,i)=>source.readInt16LE(44+i*2)*Math.min(1,i/(rate*0.02))*Math.min(1,(length-1-i)/(rate*0.1)));
 const peak=expected.reduce((m,v)=>Math.max(m,Math.abs(v)),0);
 for(let i=0;i<length;i++)assert.equal(wav.readInt16LE(44+i*2),Math.round(expected[i]/peak*0.6*32767) || 0);
 assert.equal(wav.readInt16LE(44),0);assert.equal(wav.readInt16LE(44+(length-1)*2),0);
 assert.ok(expected.some(v=>v!==0));
});

test('voice cleanup tolerates native release during stop and still deletes cached audio and unlocks ownership', async () => {
 const source=readFileSync(new URL('../components/mind/MindQuickFixes.tsx',import.meta.url),'utf8');
 const callback=source.slice(source.indexOf('  const deleteRecording ='),source.indexOf('  const finishVoice ='));
 for(const cached of ['file:///temporary-voice.m4a',null]) {
  const stopped=deferred();let released=false,unlocks=0,stops=0;const deleted=[];
  const context={useCallback:fn=>fn,voiceCleanupStarted:{current:false},voicePrepare:{current:null},
   recorderUri:{current:cached},releaseAudio:{current:async()=>{unlocks++;}},
   recorder:{stop(){stops++;return stopped.promise;},get uri(){if(released)throw Error('Unable to find the native shared object');return cached;}},
   FileSystem:{deleteAsync:async uri=>{deleted.push(uri);}}};
  const js=ts.transpileModule(callback+'\nglobalThis.cleanup=deleteRecording;',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(js,context);
  const pending=context.cleanup(true);await tick();released=true;stopped.reject(Error('Recorder released'));
  await assert.doesNotReject(pending);await context.cleanup(true);
  assert.equal(stops,1);assert.equal(unlocks,1);assert.deepEqual(deleted,cached?[cached]:[]);
  assert.equal(context.recorderUri.current,null);assert.equal(context.releaseAudio.current,null);
 }
});
const { createMindResetOwner } = load('lib/mindResetOwner.ts', {
 './mindResetPlayback': { createResetPlayback },
});
function ownerSetup(acquire) {
 const players=[];
 const owner=createMindResetOwner(()=>{
  let callback;
  const p={currentTime:0,isLoaded:true,muted:false,loop:false,removed:false,plays:0,seeks:[],
   currentStatus:{currentTime:0,playing:false,isLoaded:true,didJustFinish:false},
   play(){this.plays++;},pause(){},remove(){this.removed=true;},release(){},
   async seekTo(time){this.currentTime=time;this.seeks.push(time);},
   addListener(_,fn){callback=fn;return {remove(){}};},
   emit(time,playing=true,finished=false){this.currentTime=time;this.currentStatus={currentTime:time,playing,isLoaded:true,didJustFinish:finished};callback(this.currentStatus);},
  };players.push(p);return p;
 },acquire??(async()=>async()=>{}));
 return {owner,players};
}
test('screen unsubscribe and repeated navigation retain the same player and native position',async()=>{
 const {owner,players}=ownerSetup();let screenUpdates=0;
 const leave=owner.subscribe(()=>screenUpdates++);owner.start();await tick();players[0].emit(44);
 leave();const count=screenUpdates;players[0].emit(78);assert.equal(screenUpdates,count);
 for(let i=0;i<8;i++){const unsubscribe=owner.subscribe(()=>{});assert.equal(owner.getSnapshot().seconds,78);unsubscribe();}
 assert.equal(players.length,1);assert.equal(players[0].removed,false);assert.equal(players[0].plays,1);
 assert.equal(owner.getSnapshot().started,true);owner.dispose();
});
test('pause away from screen freezes position and resumes without cue restart; end clears state',async()=>{
 const {owner,players}=ownerSetup();owner.setSound(false);owner.start();owner.start();await tick();
 assert.equal(players.length,1);players[0].emit(83);owner.pause();
 assert.equal(players[0].removed,true);assert.equal(owner.getSnapshot().seconds,83);
 assert.equal(owner.getSnapshot().running,false);owner.reconcile();assert.equal(players.length,1);
 owner.start();await tick();assert.deepEqual(players[1].seeks,[83]);assert.equal(players[1].muted,true);
 owner.end();assert.equal(players[1].removed,true);assert.equal(owner.getSnapshot().started,false);
 owner.start();await tick();assert.equal(players[2].muted,true);assert.deepEqual(players[2].seeks,[]);owner.dispose();
});
test('final tail releases once and reopening cannot restart a finished session',async()=>{
 const {owner,players}=ownerSetup();owner.start();await tick();players[0].emit(300);players[0].emit(307);
 assert.equal(players[0].removed,false);players[0].emit(310,false,true);
 assert.equal(owner.getSnapshot().finished,true);assert.equal(players[0].removed,true);
 owner.start();assert.equal(players.length,1);owner.dispose();
});
test('account teardown invalidates queued start, old controls and native responses',async()=>{
 const gate=deferred();let released=0;const old=ownerSetup(()=>gate.promise);
 old.owner.start();old.owner.dispose();const next=ownerSetup();
 gate.resolve(async()=>{released++;});await tick();old.owner.start();assert.equal(old.players.length,0);
 assert.equal(released,1);assert.equal(next.owner.getSnapshot().started,false);
 next.owner.start();await tick();next.players[0].emit(92);next.owner.dispose();
 next.players[0].emit(125);assert.equal(next.owner.getSnapshot().seconds,92);assert.equal(next.players[0].removed,true);
});
test('recording and persistent Reset remain mutually exclusive; explicit pause preserves resumable position',async()=>{
 const {acquireAudio,getAudioOwner}=load('lib/audioOwnership.ts',{'expo-audio':{setAudioModeAsync:async()=>{}}});
 const {owner,players}=ownerSetup(()=>acquireAudio('reset'));owner.start();await tick();players[0].emit(72);
 await assert.rejects(acquireAudio('recording'));assert.equal(getAudioOwner(),'reset');
 owner.pause();await tick();const releaseRecording=await acquireAudio('recording');
 owner.start();await tick();assert.ok(owner.getSnapshot().error);assert.equal(players.length,1);
 assert.equal(owner.getSnapshot().seconds,72);await releaseRecording();owner.start();await tick();
 assert.deepEqual(players[1].seeks,[72]);assert.equal(getAudioOwner(),'reset');owner.dispose();await tick();assert.equal(getAudioOwner(),null);
});
test('navigation wiring keeps root ownership, distinct back/end, and explicit recorder pause',()=>{
 const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const root=read('contexts/RootNavigator.tsx'),screen=read('screens/subscreens/BreathingSessionScreen.tsx');
 assert.match(root,/<MindResetProvider key=\{session\?\.user.id/);
 assert.match(screen,/onPress=\{\(\) => navigation.goBack\(\)\} accessibilityRole="button" accessibilityLabel="Go back"/);
 assert.match(screen,/label="End session" onPress=\{finishHere\}/);
 assert.match(read('hooks/useMindResetSession.ts'),/export \{ useMindResetSession \} from/);
 assert.match(read('components/mind/MindQuickFixes.tsx'),/onPress=\{resetSession.pause\}/);
});
