import { isReportWeek } from './weeklyReport';
import { isValidCommunityPostId } from './deepLinks';
export type NotificationDestination = { route:string; params?:Record<string,unknown>; family:string };
/** Only known route names and typed fields. Used by both inbox and legacy pushes. */
export function resolveNotificationDestination(data:Record<string,unknown>):NotificationDestination|null {
 const tab=(screen:string,params?:Record<string,unknown>):NotificationDestination=>({route:'Tabs',params:{screen,...(params?{params}:{})},family:screen});
 switch(data.type){
 case 'lowest_pillar':
   if(data.destination_version!=='1') return null;
   if(data.pillar==='mind') return {route:'BreathingSession',family:'mind-reset'};
   if(data.pillar==='body'&&data.workout_id==='89e97b6c-0bfa-407d-a9f4-5020b086ba11') return {route:'ActiveWorkout',params:{workoutId:data.workout_id},family:'workout'};
   if(data.pillar==='bond') return {...tab('Bond',{revealPresentDad:true}),family:'bond-control'};
   return null;
 case 'trial_ending':return data.destination_version==='1'&&isValidCommunityPostId(data.trial_episode)
   ?{route:'ProSubscription',params:{source:'trial_notification',context:'Your Pro trial'},family:'plan'}:null;
 case 'weekly_score':return isReportWeek(data.reporting_week)?{...tab('Home',{openWeeklyReport:data.reporting_week}),family:'report'}:null;
 case 'morning_checkin':return data.destination_version==='1'?{...tab('Home',{openDailyCheckIn:true}),family:'check-in'}:tab('Home');
 case 'community_reply':case 'community_like':return isValidCommunityPostId(data.post_id)?{route:'CommunityPostThread',params:{postId:data.post_id},family:'community'}:null;
 case 'co_parent_event_added':return {route:'SharedCalendar',family:'calendar'};
 case 'present_dad_mode_complete':
   return isValidCommunityPostId(data.session_id)
    ? {...tab('Bond', { completedPresentDadSessionId: data.session_id }), family: 'present-dad-complete'}
    : null;
 case 'bedtime_story':case 'milestone_anniversary':return tab('Bond');
 case 'workout_window':return tab('Fit');
 case 'journal_prompt':return {route:'Journal',params:{openEditor:true},family:'journal'};
 case 'weekly_challenge':case 'streak_at_risk':return tab('Home');
 case 'score':return tab('Home',{openScoreDetail:true});
 default:
   // Compatibility for old link-only pushes; never use these fallbacks for an inbox event.
   if(data.version!==undefined) return null;
   if(data.link==='/progress'||data.link==='/score') return tab('Home',{openScoreDetail:true});
   if(data.link==='/') return tab('Home');
   if(data.link==='/bond') return tab('Bond');
   if(data.link==='/fitness') return tab('Fit');
   if(data.link==='/mind') return tab('Mind');
   if(data.link==='/community') return tab('Squad');
   return null;
 }
}
