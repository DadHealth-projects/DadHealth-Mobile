import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';

import HomeTabScreen from '../screens/HomeTabScreen';
import FitnessScreen from '../screens/FitnessScreen';
import MindScreen from '../screens/MindScreen';
import BondScreen from '../screens/BondScreen';
import CommunityScreen from '../screens/CommunityScreen';
import { colors } from '../theme';

export type BottomTabsParamList = {
  Home: undefined;
  Mind: undefined;
  Fit: undefined;
  Bond: undefined;
  Squad: undefined;
};

const Tab = createBottomTabNavigator<BottomTabsParamList>();

type TabMeta = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
};

const TAB_META: Record<keyof BottomTabsParamList, TabMeta> = {
  Home: { label: 'Today', icon: 'home' },
  Mind: { label: 'Mind', icon: 'wind' },
  Fit: { label: 'Body', icon: 'activity' },
  Bond: { label: 'Bond', icon: 'heart' },
  Squad: { label: 'Community', icon: 'users' },
};

const INACTIVE = 'rgba(200,245,90,0.9)';

function MockupTabBar({ state, navigation }: BottomTabBarProps) {
  const centerButtonSize = 54;
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const closingRef = useRef(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (!logSheetOpen) return;

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, logSheetOpen, sheetTranslateY]);

  const openLogSheet = () => {
    closingRef.current = false;
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(400);
    setLogSheetOpen(true);
  };

  const dismissLogSheet = (afterDismiss?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    backdropOpacity.stopAnimation();
    sheetTranslateY.stopAnimation();

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 400,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setLogSheetOpen(false);
      closingRef.current = false;
      afterDismiss?.();
    });
  };

  const renderTab = (route: (typeof state.routes)[number], index: number) => {
    const meta = TAB_META[route.name as keyof BottomTabsParamList];
    const focused = state.index === index;
    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name as never);
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        className="min-w-0 flex-1 items-center justify-center active:opacity-75"
      >
        <View
          className="relative h-[60px] w-full max-w-[68px] items-center justify-center gap-[3px] rounded-[14px] bg-transparent"
        >
          <Feather
            name={meta.icon}
            size={21}
            color={focused ? colors.lime : INACTIVE}
          />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            className={`w-full px-[2px] text-center font-body-semibold text-[9px] tracking-[0.5px] uppercase ${focused ? 'text-lime' : 'text-[rgba(200,245,90,0.9)]'}`}
          >
            {meta.label}
          </Text>
          {focused && (
            <View className="absolute bottom-[2px] h-[3px] w-[12px] rounded-full bg-lime" />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View
      className="absolute bottom-0 left-0 right-0 z-50 bg-transparent px-5 pt-[48px]"
      pointerEvents="box-none"
    >
      <View className="relative h-[82px] overflow-visible rounded-[36px] bg-[#111214]">
        <View className="flex-1 flex-row items-center">
          {state.routes.map((route, index) => renderTab(route, index))}
        </View>
        <View
          pointerEvents="none"
          className="absolute top-0 h-[11px] w-[54px] rounded-b-[18px] bg-dark"
          style={{ left: '50%', transform: [{ translateX: -centerButtonSize / 2 }] }}
        />
        <Pressable
          onPress={openLogSheet}
          accessibilityRole="button"
          accessibilityLabel="LOG"
          className="absolute top-[-43px] z-10 h-[54px] w-[54px] items-center justify-center rounded-[18px] bg-lime"
          style={{
            left: '50%',
            transform: [{ translateX: -centerButtonSize / 2 }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 5,
            elevation: 8,
          }}
        >
          <Feather name="plus" size={24} color={colors.dark} />
        </Pressable>
      </View>

      <Modal
        visible={logSheetOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => dismissLogSheet()}
      >
        <View className="flex-1 justify-end">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close LOG sheet"
            onPress={() => dismissLogSheet()}
            className="absolute inset-0"
          >
            <Animated.View
              className="flex-1 bg-black/60"
              style={{ opacity: backdropOpacity }}
            />
          </Pressable>
          <Animated.View
            className="rounded-t-[26px] border border-white/10 bg-[#151618] px-[22px] pt-3"
            style={{ transform: [{ translateY: sheetTranslateY }] }}
          >
            <View className="mb-[15px] h-1 w-[38px] self-center rounded-full bg-white/25" />
            <Text className="font-body-semibold text-[13px] tracking-[1.1px] text-lime">
              LOG
            </Text>
            <Text className="mb-[13px] mt-1 font-body text-[13px] text-white/70">
              Choose what you want to log.
            </Text>
            {[
              {
                label: 'Log workout',
                icon: 'activity' as const,
                action: () => navigation.getParent()?.navigate('ActiveWorkout' as never),
              },
              {
                label: 'Log Bond time',
                icon: 'heart' as const,
                action: () => navigation.navigate('Bond' as never),
              },
              {
                label: 'Log Mind activity',
                icon: 'wind' as const,
                action: () => navigation.navigate('Mind' as never),
              },
            ].map((item) => (
              <Pressable
                key={item.label}
                onPress={() => dismissLogSheet(item.action)}
                accessibilityRole="button"
                className="min-h-12 flex-row items-center border-t border-white/10"
              >
                <Feather name={item.icon} size={18} color={colors.lime} />
                <Text className="ml-[13px] font-body-semibold text-[14px] text-white">
                  {item.label}
                </Text>
                <View className="ml-auto">
                  <Feather name="chevron-right" size={17} color={INACTIVE} />
                </View>
              </Pressable>
            ))}
            <Pressable
              onPress={() => dismissLogSheet()}
              accessibilityRole="button"
              className="mt-1 min-h-[42px] items-center justify-center"
            >
              <Text className="font-body-semibold text-[13px] text-[rgba(200,245,90,0.9)]">
                Cancel
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        lazy: false,
        animation: 'fade',
        sceneStyle: { backgroundColor: colors.dark },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
      tabBar={(props) => <MockupTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeTabScreen} />
      <Tab.Screen name="Mind" component={MindScreen} />
      <Tab.Screen name="Fit" component={FitnessScreen} />
      <Tab.Screen name="Bond" component={BondScreen} />
      <Tab.Screen name="Squad" component={CommunityScreen} />
    </Tab.Navigator>
  );
}
