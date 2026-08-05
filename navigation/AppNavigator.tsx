import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';

import BottomTabNavigator, { type BottomTabsParamList } from './BottomTabNavigator';
import LoginScreen from '../screens/LoginScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import OnboardingGoalsScreen from '../screens/OnboardingGoalsScreen';
import OnboardingCustodyScreen from '../screens/OnboardingCustodyScreen';
import ProgressScreen from '../screens/ProgressScreen';
import ActiveWorkoutScreen from '../screens/ActiveWorkoutScreen';
import AIWorkoutScreen from '../screens/AIWorkoutScreen';
import MealPlannerScreen from '../screens/MealPlannerScreen';
import TDEECalculatorScreen from '../screens/TDEECalculatorScreen';
import { colors } from '../theme';

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<BottomTabsParamList> | undefined;
  Login: undefined;
  Profile: undefined;
  Settings: undefined;
  Welcome: undefined;
  OnboardingGoals: undefined;
  OnboardingCustody: { goals: string[] } | undefined;
  Progress: undefined;
  ActiveWorkout: { workoutId?: string } | undefined;
  AIWorkout: { workoutId?: string } | undefined;
  MealPlanner: undefined;
  TDEECalculator: undefined;
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
      <Stack.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="ActiveWorkout"
        component={ActiveWorkoutScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="AIWorkout"
        component={AIWorkoutScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="MealPlanner"
        component={MealPlannerScreen}
        options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="TDEECalculator"
        component={TDEECalculatorScreen}
        options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
      />
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
