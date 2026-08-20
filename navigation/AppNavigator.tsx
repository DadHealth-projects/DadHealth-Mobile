import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';

import BottomTabNavigator, { type BottomTabsParamList } from './BottomTabNavigator';
import LoginScreen from '../screens/subscreens/LoginScreen';
import ProfileScreen from '../screens/subscreens/ProfileScreen';
import SettingsScreen from '../screens/subscreens/SettingsScreen';
import WelcomeScreen from '../screens/subscreens/WelcomeScreen';
import OnboardingGoalsScreen from '../screens/subscreens/OnboardingGoalsScreen';
import OnboardingCustodyScreen from '../screens/subscreens/OnboardingCustodyScreen';
import ProgressScreen from '../screens/subscreens/ProgressScreen';
import ActiveWorkoutScreen from '../screens/subscreens/ActiveWorkoutScreen';
import AIWorkoutScreen from '../screens/subscreens/AIWorkoutScreen';
import MealPlannerScreen from '../screens/subscreens/MealPlannerScreen';
import TDEECalculatorScreen from '../screens/subscreens/TDEECalculatorScreen';
import BreathingSessionScreen from '../screens/subscreens/BreathingSessionScreen';
import JournalScreen from '../screens/subscreens/JournalScreen';
import TherapistDirectoryScreen from '../screens/subscreens/TherapistDirectoryScreen';
import DadDaysSearchScreen from '../screens/subscreens/DadDaysSearchScreen';
import MilestoneTrackerScreen from '../screens/subscreens/MilestoneTrackerScreen';
import CookTogetherScreen from '../screens/subscreens/CookTogetherScreen';
import SharedCalendarScreen from '../screens/subscreens/SharedCalendarScreen';
import CreateCommunityPostScreen from '../screens/subscreens/CreateCommunityPostScreen';
import CommunityPostThreadScreen from '../screens/subscreens/CommunityPostThreadScreen';
import CommunityFeedScreen from '../screens/subscreens/CommunityFeedScreen';
import NotificationSettingsScreen from '../screens/subscreens/NotificationSettingsScreen';
import PrivacySecurityScreen from '../screens/subscreens/PrivacySecurityScreen';
import TermsPrivacyScreen from '../screens/subscreens/TermsPrivacyScreen';
import HealthPermissionsScreen from '../screens/subscreens/HealthPermissionsScreen';
import ProSubscriptionScreen from '../screens/subscreens/ProSubscriptionScreen';
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
  BreathingSession: undefined;
  Journal: undefined;
  TherapistDirectory: undefined;
  DadDaysSearch: undefined;
  MilestoneTracker: undefined;
  CookTogether: undefined;
  SharedCalendar: { token?: string } | undefined;
  CreateCommunityPost: undefined;
  CommunityPostThread: { postId: string };
  CommunityFeed: undefined;
  NotificationSettings: undefined;
  PrivacySecurity: undefined;
  TermsPrivacy: undefined;
  HealthPermissions: undefined;
  ProSubscription: undefined;
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
      <Stack.Screen
        name="BreathingSession"
        component={BreathingSessionScreen}
        options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="Journal"
        component={JournalScreen}
        options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="TherapistDirectory"
        component={TherapistDirectoryScreen}
        options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="DadDaysSearch"
        component={DadDaysSearchScreen}
        options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
      />
        <Stack.Screen
          name="MilestoneTracker"
        component={MilestoneTrackerScreen}
        options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
        />
        <Stack.Screen
          name="CookTogether"
          component={CookTogetherScreen}
          options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
        />
        <Stack.Screen
          name="SharedCalendar"
          component={SharedCalendarScreen}
          options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
        />
        <Stack.Screen
          name="CreateCommunityPost"
          component={CreateCommunityPostScreen}
          options={{ presentation: 'card', animation: 'slide_from_bottom', gestureEnabled: true }}
        />
        <Stack.Screen
          name="CommunityPostThread"
          component={CommunityPostThreadScreen}
          options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
        />
        <Stack.Screen
          name="CommunityFeed"
          component={CommunityFeedScreen}
          options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
        />
        <Stack.Screen
          name="NotificationSettings"
          component={NotificationSettingsScreen}
          options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
        />
        <Stack.Screen
          name="PrivacySecurity"
          component={PrivacySecurityScreen}
          options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
        />
        <Stack.Screen
          name="TermsPrivacy"
          component={TermsPrivacyScreen}
          options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
        />
        <Stack.Screen
          name="HealthPermissions"
          component={HealthPermissionsScreen}
          options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true }}
        />
        <Stack.Screen
          name="ProSubscription"
          component={ProSubscriptionScreen}
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
