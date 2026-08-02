import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BottomTabNavigator from './BottomTabNavigator';
import LoginScreen from '../screens/LoginScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import OnboardingGoalsScreen from '../screens/OnboardingGoalsScreen';
import OnboardingCustodyScreen from '../screens/OnboardingCustodyScreen';
import { colors } from '../theme';

export type AppStackParamList = {
  Tabs: undefined;
  Login: undefined;
  Profile: undefined;
  Settings: undefined;
  Welcome: undefined;
  OnboardingGoals: undefined;
  OnboardingCustody: { goals: string[] } | undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator({
  initialRouteName = 'Tabs',
}: {
  initialRouteName?: keyof AppStackParamList;
}) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: colors.dark,
        },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="OnboardingGoals" component={OnboardingGoalsScreen} />
      <Stack.Screen name="OnboardingCustody" component={OnboardingCustodyScreen} />
      {/* Main application */}
      <Stack.Screen
        name="Tabs"
        component={BottomTabNavigator}
      />

      {/* Authentication */}
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />

      {/* Account */}
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />

      {/* Settings (placeholder) */}
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
}
