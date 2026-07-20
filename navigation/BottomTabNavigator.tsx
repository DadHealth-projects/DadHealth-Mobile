import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import FitnessScreen from '../screens/FitnessScreen';
import MindScreen from '../screens/MindScreen';
import BondScreen from '../screens/BondScreen';
import CommunityScreen from '../screens/CommunityScreen';
import { colors, typography, shadows } from '../theme';

const Tab = createBottomTabNavigator();

// Feather icon per tab (lime when active, muted white when inactive).
const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Home: 'home',
  Fitness: 'activity',
  Mind: 'wind',
  Bond: 'heart',
  Community: 'users',
};

export default function BottomTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        // Lime icons, dark bg, white labels
        tabBarActiveTintColor: colors.lime,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          height: 66 + insets.bottom,
          paddingTop: 10,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          ...shadows.tabBar,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
        tabBarLabelStyle: typography.tabLabel,
        tabBarIcon: ({ color, focused }) => (
          // Rounded pill that lights up lime behind the active icon.
          <View
            className={`h-[38px] w-[52px] items-center justify-center rounded-full ${
              focused ? 'bg-lime/12' : 'bg-transparent'
            }`}
          >
            <Feather name={ICONS[route.name]} size={22} color={color} />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Fitness" component={FitnessScreen} />
      <Tab.Screen name="Mind" component={MindScreen} />
      <Tab.Screen name="Bond" component={BondScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
    </Tab.Navigator>
  );
}
