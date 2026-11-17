import { supabase } from './supabase';
import { fetchItem02 } from '../hooks/useWeeklyReport';
import { resolveNotificationDestination } from './notificationDestinations';

export type InboxEvent = { id:string; user_id:string; type:string; title:string; description:string;
  destination:Record<string,unknown>; created_at:string; read_at:string|null; day_group?:'Today'|'Yesterday'|'Earlier' };
export type InboxPage = { items:InboxEvent[]; unreadCount:number; event:InboxEvent|null; timezone:string; today:string; cutoff:string };
export const isInboxId=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function parseInbox(value:unknown,owner:string):InboxPage {
 const p=value as InboxPage;
 if(!p||!Array.isArray(p.items)||!Number.isInteger(p.unreadCount)||p.unreadCount<0) throw Error('Invalid notification response');
 if (typeof p.timezone!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.today)||!Number.isFinite(Date.parse(p.cutoff))) throw Error('Invalid account calendar');
 new Intl.DateTimeFormat('en',{timeZone:p.timezone}).format(new Date());
 const event=(e:InboxEvent)=>{
   if(!isInboxId(e.id)||e.user_id!==owner||typeof e.title!=='string'||typeof e.description!=='string'
     ||!Number.isFinite(Date.parse(e.created_at))||(e.read_at!==null&&!Number.isFinite(Date.parse(e.read_at)))
     ||e.destination?.version!=='1'||e.destination.type!==e.type||!resolveNotificationDestination(e.destination)) throw Error('Invalid notification');
   return e;
 };
 return {...p,items:p.items.map(event),event:p.event?event(p.event):null};
}
export async function readInbox(
  owner: string,
  signal: AbortSignal,
  query = '',
): Promise<InboxPage> {
  const payload = await fetchItem02(
    owner,
    '/api/notifications/inbox' + query,
    signal,
  );
  return parseInbox(payload, owner);
}
export async function acknowledgeInbox(
 owner: string,
 signal: AbortSignal,
 id?: string,
 markUnread = false,
): Promise<InboxPage> {
 const session=await supabase.auth.getSession();
 if(signal.aborted||session.error||session.data.session?.user.id!==owner) throw Error('Account changed');
 const base=(process.env.EXPO_PUBLIC_WEB_URL??'https://www.dadhealth.co.uk').replace(/\/$/,'');
 const response=await fetch(base+'/api/notifications/inbox',{method:'POST',signal,
   headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},
      body: JSON.stringify(
    id ? { action: 'read', id }
       : { action: markUnread ? 'unread_all' : 'read_all' },
   )});
 if(!response.ok) throw Error('Unable to update notifications');
 return parseInbox(await response.json(),owner);
}
