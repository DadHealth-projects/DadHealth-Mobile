import React,{createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import { AppState } from 'react-native';
import { useIsFocused,useRoute } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import { useNetworkStatus } from './NetworkContext';
import { acknowledgeInbox,readInbox,type InboxEvent } from '../lib/notificationInbox';
import { configureInboxNavigation,confirmNotificationPresentation,notificationOperationFamily,openInboxNotification } from '../lib/pushNotifications';

const unavailable='This update is no longer available.';
type State={items:InboxEvent[];unreadCount:number;loaded:boolean;loading:boolean;hasMore:boolean;error:string|null;destinationError:string|null;timezone:string|null};
const initial:State={items:[],unreadCount:0,loaded:false,loading:false,hasMore:false,error:null,destinationError:null,timezone:null};
type Value=State&{refresh:(more?:boolean)=>Promise<void>;refreshCount:()=>Promise<void>;markAll:()=>Promise<void>;open:(id:string)=>void;busy:boolean};
const Context=createContext<Value|null>(null);
export function NotificationInboxProvider({children}:{children:React.ReactNode}){
 const {user}=useAuth(),{isOffline}=useNetworkStatus();
 const scope=useMemo(()=>({owner:user?.id,alive:true,sequence:0, countSequence:0,countApplied:0,controllers:new Set<AbortController>(),writing:false}),[user?.id]);
 const current=useRef(scope);current.current=scope;
 const [stored,setStored]=useState({scope,state:initial});
 const state=stored.scope===scope?stored.state:initial;
 const latest=useRef(state);latest.current=state;
 const [busyOwner,setBusyOwner]=useState<string|null>(null);
 const valid=useCallback(()=>scope.alive&&current.current===scope,[scope]);
 const update=useCallback((patch:Partial<State>)=>{if(valid())setStored(old=>({scope,state:{...(old.scope===scope?old.state:initial),...patch}}));},[scope,valid]);
 const refresh=useCallback(async(more=false)=>{
  if(!scope.owner||!valid()||scope.writing)return;
  if (isOffline) {
  update({
    loading: false,
    error: latest.current.loaded ? null : 'Connect to see your updates.',
  });
  return;
}
  const seq=++scope.sequence,countSeq=++scope.countSequence,c=new AbortController();scope.controllers.add(c);
  const previous=latest.current.items,last=more?previous.at(-1):null;
  update({loading:true,error:null});
  try{
   const query=last?'?before_at='+encodeURIComponent(last.created_at)+'&before_id='+last.id:'';
   const page=await readInbox(scope.owner,c.signal,query);
   if(!valid()||seq!==scope.sequence)return;
   const applyCount = countSeq > scope.countApplied;
   if (applyCount) scope.countApplied = countSeq;

   update({
    items: [...new Map(
     [...(more ? previous : []), ...page.items].map(row => [row.id, row]),
    ).values()],
    ...(applyCount ? { unreadCount: page.unreadCount } : {}),
    timezone: page.timezone,
    loaded: true,
    hasMore: page.items.length === 25,
   });
  }catch(error){if(valid()&&seq===scope.sequence&&!c.signal.aborted){
   const reason=(error as {reason?:string})?.reason;
   update({...(reason==='account_changed'||reason==='authorization_unavailable'
     ?{items:[],unreadCount:0,loaded:false,hasMore:false}:{}), error:'We couldn’t load your updates.'});
  }}
  finally{scope.controllers.delete(c);if(valid()&&seq===scope.sequence)update({loading:false});}
 },[scope,valid,update,isOffline]);
 const refreshCount=useCallback(async()=>{
  if(!scope.owner||!valid()||isOffline||scope.writing)return;
  const seq=scope.sequence,countSeq=++scope.countSequence,c=new AbortController();scope.controllers.add(c);
  try {
   const page = await readInbox(scope.owner, c.signal, '?count=1');

   if (
    valid() &&
    !c.signal.aborted &&
    seq === scope.sequence &&
    countSeq > scope.countApplied
   ) {
    scope.countApplied = countSeq;
    update({ unreadCount: page.unreadCount });
   }
  }
  catch{/* Preserve known count; the list exposes read failures with an explicit retry. */}
  finally{scope.controllers.delete(c);}
 },[scope,valid,update,isOffline]);
   const acknowledge=useCallback(async(
  id:string|undefined,
  signal?:AbortSignal,
  markUnread=false,
 )=>{
  if(!scope.owner||!valid()||scope.writing)return;
  if(isOffline){update({error:'Reconnect to mark your updates read.'});return;}
  scope.writing=true;++scope.sequence;setBusyOwner(scope.owner);
  const c=new AbortController();scope.controllers.add(c);
  const cancel=()=>c.abort();signal?.addEventListener('abort',cancel);if(signal?.aborted)c.abort();
  try{
   const page=await acknowledgeInbox(scope.owner,c.signal,id,markUnread);
   if(!valid()||c.signal.aborted)return;
   // Only show the server-confirmed read result. A failed write changes nothing.
   update({unreadCount:page.unreadCount,error:null,loading:false,
     items:latest.current.items.map(e=>(!id||e.id===id)&&Date.parse(e.created_at)<=Date.parse(page.cutoff)?{...e,read_at:markUnread?null:e.read_at??page.cutoff}:e)});
  }catch{if(valid())update({ error:'Your read status wasn’t saved.',loading:false});}
  finally{signal?.removeEventListener('abort',cancel);scope.controllers.delete(c);scope.writing=false;if(valid())setBusyOwner(null);}
 },[scope,valid,update,isOffline]);
  const acknowledgeRef = useRef(acknowledge);
 acknowledgeRef.current = acknowledge;

 useEffect(() => {
  scope.alive = true;

  configureInboxNavigation(scope.owner ? {
   owner: scope.owner,
   read: async (id, signal) => {
    const page = await readInbox(
     scope.owner!,
     signal,
     '?id=' + encodeURIComponent(id),
    );
    if (!valid() || !page.event) throw Error('Unavailable');
    return page.event;
   },
   acknowledge: async (id, signal) => {
    if (!valid() || signal.aborted) return;
    await acknowledgeRef.current(id, signal);
   },
   unavailable: () => update({ destinationError: unavailable }),
  } : null);

  return () => {
   scope.alive = false;
   ++scope.sequence;
   scope.controllers.forEach(controller => controller.abort());
   scope.controllers.clear();
   configureInboxNavigation(null);
  };
 }, [scope, valid, update]);
 useEffect(()=>{void refreshCount();let previous=AppState.currentState;
  const sub=AppState.addEventListener('change',next=>{if(next==='active'&&previous!=='active')void refreshCount();previous=next;});
  return()=>sub.remove();
 },[refreshCount]);
 const value:Value={...state,error:state.destinationError??state.error,refresh,refreshCount,markAll:()=>acknowledge(undefined,undefined,latest.current.unreadCount===0),open:id=>{update({destinationError:null});void openInboxNotification(id);},busy:busyOwner===scope.owner&&Boolean(scope.owner)};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useNotificationInbox(){const value=useContext(Context);if(!value)throw Error('Notification inbox provider missing');return value;}

/** Registered destination screens call this only when their actual content resolves. */
export function useNotificationPresentation(ready:boolean,failed=false,family?:string){
 const {user}=useAuth(),focused=useIsFocused(),route=useRoute();
 const token=(route.params as {notificationOperation?:string}|undefined)?.notificationOperation;
 const activeFamily=notificationOperationFamily(token);
 useEffect(()=>{
  if(!focused||!token||!user?.id||(!ready&&!failed))return;
  if(family&&activeFamily!==family)return;
  if(!family&&['report','check-in','bond-control','present-dad-complete'].includes(activeFamily??''))return;
  void confirmNotificationPresentation(token,user.id,!failed);
 },[focused,token,user?.id,ready,failed,family,activeFamily]);
}
