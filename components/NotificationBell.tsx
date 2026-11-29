import React,{useCallback} from 'react';
import {Pressable,View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {useFocusEffect,useNavigation,type NavigationProp} from '@react-navigation/native';
import {useNotificationInbox} from '../contexts/NotificationInboxContext';
import type {AppStackParamList} from '../navigation/AppNavigator';
import {colors} from '../theme';
export default function NotificationBell(){
 const inbox=useNotificationInbox(),navigation=useNavigation<NavigationProp<AppStackParamList>>();
 useFocusEffect(useCallback(()=>{void inbox.refreshCount();},[inbox.refreshCount]));
 return <Pressable accessibilityRole="button" accessibilityLabel={inbox.unreadCount>0?'Notifications, unread updates':'Notifications'}
  onPress={()=>navigation.navigate('Notifications')} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-80">
  <Feather name="bell" size={20} color={colors.text}/>
  {inbox.unreadCount>0?<View className="absolute right-[7px] top-[7px] h-[7px] w-[7px] rounded-full bg-lime"/>:null}
 </Pressable>;
}
