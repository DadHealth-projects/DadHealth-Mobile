import './global.css';

import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
} from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';

import BottomTabNavigator from './navigation/BottomTabNavigator';
import { colors } from './theme';

// Force the dark background through React Navigation's own theme so there's
// no white flash between screens.
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.dark,
    card: colors.dark,
    text: colors.text,
    primary: colors.lime,
    border: colors.border,
  },
};

const RootStack = createNativeStackNavigator();

export default function App() {
  // Map @expo-google-fonts modules to the family names used in tailwind.config.js / theme.ts.
  const [fontsLoaded] = useFonts({
    'Barlow-Regular': Barlow_400Regular,
    'Barlow-Medium': Barlow_500Medium,
    'Barlow-SemiBold': Barlow_600SemiBold,
    'BarlowCondensed-SemiBold': BarlowCondensed_600SemiBold,
    'BarlowCondensed-Bold': BarlowCondensed_700Bold,
    'BarlowCondensed-ExtraBold': BarlowCondensed_800ExtraBold,
  });

  // Hold on a dark splash until fonts are ready to avoid a flash of fallback type.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.dark }} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Tabs" component={BottomTabNavigator} />
        </RootStack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
