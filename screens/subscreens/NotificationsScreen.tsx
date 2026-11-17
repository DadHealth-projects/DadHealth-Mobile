import React,{useCallback} from 'react';
import {Pressable,RefreshControl,ScrollView,Text,View} from 'react-native';
import SkeletonBlock from '../../components/skeleton/SkeletonBlock';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather} from '@expo/vector-icons';
import {useFocusEffect,useNavigation,type NavigationProp} from '@react-navigation/native';
import AppTopBar from '../../components/AppTopBar';
import {useNotificationInbox} from '../../contexts/NotificationInboxContext';
import type {AppStackParamList} from '../../navigation/AppNavigator';
import {colors} from '../../theme';

const titleStyle='font-heading-bold text-white text-[22px] leading-[26px] uppercase';
const bodyStyle='font-body text-white text-[14px] leading-[20px]';
const labelStyle='font-heading-bold text-lime text-[13px] uppercase';
function icon(type:string):React.ComponentProps<typeof Feather>['name']{
 if(type.startsWith('community'))return 'message-circle';
 if(type==='weekly_score')return 'file-text';
 if(type==='trial_ending')return 'star';
 if(type==='morning_checkin')return 'check-circle';
 if(type==='workout_window')return 'activity';
 if(type==='journal_prompt')return 'edit-3';
 if(type==='co_parent_event_added'||type==='milestone_anniversary')return 'calendar';
 return 'bell';
}
export default function NotificationsScreen(){
 const navigation=useNavigation<NavigationProp<AppStackParamList>>(),inbox=useNotificationInbox();
 useFocusEffect(useCallback(()=>{void inbox.refresh();},[inbox.refresh]));
 return <SafeAreaView edges={['top']} className="flex-1 bg-dark">
  <ScrollView
  showsVerticalScrollIndicator={false}
  contentContainerClassName="px-lg pt-lg pb-xl gap-lg"
  refreshControl={
    <RefreshControl
      refreshing={false}
      onRefresh={() => void inbox.refresh()}
      tintColor={colors.lime}
    />
  }
>
   <View className="gap-xs">
    <AppTopBar
      title="Notifications"
      showNotifications={false}
      leftAccessory={
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-80"
        >
          <Feather name="chevron-left" size={20} color={colors.text} />
        </Pressable>
      }
    />
    <View className="flex-row items-center justify-between gap-sm">
      <Text className={bodyStyle + ' flex-1'}>
        Here’s what you missed.
      </Text>
      <Pressable
        disabled={inbox.busy || !inbox.loaded || !inbox.items.length}
        onPress={() => void inbox.markAll()}
        accessibilityRole="button"
        className="min-h-[44px] justify-center"
        style={{ opacity: inbox.busy || !inbox.loaded || !inbox.items.length ? 0.5 : 1 }}
      >
        <Text className={labelStyle}>{inbox.unreadCount > 0 ? 'Mark all read' : 'Mark all unread'}</Text>
      </Pressable>
    </View>
   </View>
   {inbox.error ? (
  <Text accessibilityRole="alert" className={bodyStyle}>
    {inbox.error}
  </Text>
) : null}

{!inbox.loaded && !inbox.error ? (
  <View
    accessibilityLabel="Loading notifications"
    accessibilityState={{ busy: true }}
  >
    {[0, 1, 2, 3].map(index => (
      <View
        key={index}
        className="flex-row items-start gap-md border-b border-border py-lg"
      >
        <SkeletonBlock width={24} height={24} radius={4} />
        <View className="flex-1 gap-sm">
          <SkeletonBlock width="75%" height={20} radius={4} />
          <SkeletonBlock width="95%" height={14} radius={4} />
          <SkeletonBlock width="35%" height={12} radius={4} />
        </View>
      </View>
    ))}
  </View>
) : null}

{inbox.loaded &&
 !inbox.error &&
 !inbox.items.length ? (
  <View className="py-xl">
    <Text className={titleStyle}>You’re all caught up</Text>
    <Text className={bodyStyle + ' mt-sm'}>
      Your updates will appear here.
    </Text>
  </View>
) : null}
   {(['Today','Yesterday','Earlier'] as const).map(group=>{
    const rows=inbox.items.filter(e=>e.day_group===group);if(!rows.length)return null;
    return <View key={group}><Text className={labelStyle+' mb-sm'}>{group}</Text>{rows.map(e=><Pressable key={e.id} onPress={()=>inbox.open(e.id)} accessibilityRole="button"
      accessibilityLabel={e.title+(e.read_at?'':', unread')} className="flex-row items-center gap-md border-b border-border py-md">
     <Feather name={icon(e.type)} size={22} color={colors.lime}/><View className="flex-1"><Text className={titleStyle}>{e.title}</Text><Text className={bodyStyle+' mt-xs'}>{e.description}</Text>
      <Text className={bodyStyle+' mt-xs'}>{new Intl.DateTimeFormat('en-GB',{timeZone:inbox.timezone!,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(e.created_at))}</Text></View>
     {!e.read_at?<View className="h-[7px] w-[7px] rounded-full bg-lime"/>:null}<Feather name="chevron-right" size={18} color={colors.text}/>
    </Pressable>)}</View>;
   })}
   {inbox.hasMore?<Pressable disabled={inbox.loading} onPress={()=>void inbox.refresh(true)} className="min-h-[44px] justify-center"><Text className={labelStyle}>Show more</Text></Pressable>:null}
  </ScrollView>
 </SafeAreaView>;
}
