import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import FitnessScreen from '../screens/FitnessScreen';
import MindScreen from '../screens/MindScreen';
import BondScreen from '../screens/BondScreen';
import CommunityScreen from '../screens/CommunityScreen';
import { colors, fonts } from '../theme';

export type BottomTabsParamList = {
  Fit: undefined;
  Mind: undefined;
  Home: undefined;
  Bond: undefined;
  Squad: undefined;
};

const Tab = createBottomTabNavigator<BottomTabsParamList>();

type TabMeta = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  center?: boolean;
};

const TAB_META: Record<keyof BottomTabsParamList, TabMeta> = {
  Fit: {
    label: 'Fit',
    icon: 'activity',
  },
  Mind: {
    label: 'Mind',
    icon: 'wind',
  },
  Home: {
    label: 'Home',
    icon: 'home',
    center: true,
  },
  Bond: {
    label: 'Bond',
    icon: 'heart',
  },
  Squad: {
    label: 'Squad',
    icon: 'users',
  },
};

const INACTIVE = 'rgba(255,255,255,0.32)';

function MockupTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: colors.dark,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        paddingTop: 8,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 14,
      }}
    >
      {state.routes.map((route, index) => {
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

        if (meta.center) {
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  marginTop: -14,
                  borderRadius: 16,
                  backgroundColor: colors.lime,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: colors.lime,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.45,
                  shadowRadius: 12,
                  elevation: 10,
                }}
              >
                <Feather
                  name={meta.icon}
                  size={24}
                  color={colors.dark}
                />
              </View>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Feather
              name={meta.icon}
              size={20}
              color={focused ? colors.lime : INACTIVE}
            />

            <Text
              style={{
                fontFamily: fonts.bodySemiBold,
                fontSize: 9,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: focused ? colors.lime : INACTIVE,
              }}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
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
      }}
      tabBar={(props) => <MockupTabBar {...props} />}
    >
      <Tab.Screen name="Fit" component={FitnessScreen} />
      <Tab.Screen name="Mind" component={MindScreen} />
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Bond" component={BondScreen} />
      <Tab.Screen name="Squad" component={CommunityScreen} />
    </Tab.Navigator>
  );
}