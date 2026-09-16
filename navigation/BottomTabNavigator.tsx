import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeTabScreen from '../screens/HomeTabScreen';
import FitnessScreen from '../screens/FitnessScreen';
import MindScreen from '../screens/MindScreen';
import BondScreen from '../screens/BondScreen';
import CommunityScreen from '../screens/CommunityScreen';
import ProgressScreen from '../screens/subscreens/ProgressScreen';
import { colors, fonts } from '../theme';

export type BottomTabsParamList = {
  Home: undefined;
  Mind: undefined;
  Score: undefined;
  Fit: undefined;
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
  Home: {
    label: 'Today',
    icon: 'home',
  },
  Mind: {
    label: 'Mind',
    icon: 'wind',
  },
  Score: {
    label: 'Score',
    icon: 'bar-chart-2',
    center: true,
  },
  Fit: {
    label: 'Body',
    icon: 'activity',
  },
  Bond: {
    label: 'Bond',
    icon: 'heart',
  },
  Squad: {
    label: 'Community',
    icon: 'users',
  },
};

const INACTIVE = 'rgba(200,245,90,0.68)';

function MockupTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const spacious = width >= 390;
  const iconSize = compact ? 20 : spacious ? 23 : 21;
  const labelFontSize = compact ? 8 : spacious ? 10 : 9;
  const labelLetterSpacing = compact ? 0.25 : spacious ? 0.9 : 0.55;
  const centerButtonSize = compact ? 50 : 56;

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
                gap: compact ? 3 : 5,
              }}
            >
              <View
                style={{
                  width: centerButtonSize,
                  height: centerButtonSize,
                  marginTop: -20,
                  borderRadius: centerButtonSize / 2,
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
                  size={compact ? 25 : 27}
                  color={colors.dark}
                />
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={{
                  width: '100%',
                  paddingHorizontal: 2,
                  textAlign: 'center',
                  fontFamily: fonts.bodySemiBold,
                  fontSize: labelFontSize,
                  letterSpacing: labelLetterSpacing,
                  textTransform: 'uppercase',
                  color: focused ? colors.lime : INACTIVE,
                }}
              >
                {meta.label}
              </Text>
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
              gap: compact ? 3 : 5,
            }}
          >
            <Feather
              name={meta.icon}
              size={iconSize}
              color={focused ? colors.lime : INACTIVE}
            />

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={{
                width: '100%',
                paddingHorizontal: 2,
                textAlign: 'center',
                fontFamily: fonts.bodySemiBold,
                fontSize: labelFontSize,
                letterSpacing: labelLetterSpacing,
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
        animation: 'fade',
        sceneStyle: { backgroundColor: colors.dark },
      }}
      tabBar={(props) => <MockupTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeTabScreen} />
      <Tab.Screen name="Mind" component={MindScreen} />
      <Tab.Screen name="Score" component={ScoreTabScreen} options={{ lazy: true }} />
      <Tab.Screen name="Fit" component={FitnessScreen} />
      <Tab.Screen name="Bond" component={BondScreen} />
      <Tab.Screen name="Squad" component={CommunityScreen} />
    </Tab.Navigator>
  );
}

function ScoreTabScreen() {
  return <ProgressScreen tabMode />;
}
