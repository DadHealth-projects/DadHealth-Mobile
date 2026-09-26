import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Keyboard, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NavigationContainerRef } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppStackParamList } from '../navigation/AppNavigator';
import { openCrisisSupport } from '../lib/crisisSupport';
import { FOOTER } from '../lib/homeContent';

const TAB_NAV_CLEARANCE = 110;
const AUTH_SAFE_CLEARANCE = 88;
const BUTTON_SIZE = 48;
const PROMPT_INTERVAL_MS = 10 * 60 * 1000;
const PROMPT_VISIBLE_MS = 30 * 1000;
const HIDDEN_ROUTES = new Set(['Welcome', 'Login', 'OnboardingGoals', 'OnboardingCustody']);

type Props = {
  navigationRef: NavigationContainerRef<AppStackParamList>;
  screenContentReady: boolean;
};

export default function GlobalCrisisHelpButton({ navigationRef, screenContentReady }: Props) {
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [rootRouteName, setRootRouteName] = useState<string | undefined>(() => activeRootRoute(navigationRef));
  const routeAllowed = isCrisisRoute(rootRouteName);
  const [promptVisible, setPromptVisible] = useState(false);
  const promptOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const initialPromptShownRef = useRef(false);
  const keyboardOpenRef = useRef(keyboardOpen);
  const appActiveRef = useRef(appActive);
  const routeAllowedRef = useRef(routeAllowed);
  const screenContentReadyRef = useRef(screenContentReady);

  useEffect(() => { keyboardOpenRef.current = keyboardOpen; }, [keyboardOpen]);
  useEffect(() => { appActiveRef.current = appActive; }, [appActive]);
  useEffect(() => { routeAllowedRef.current = routeAllowed; }, [routeAllowed]);
  useEffect(() => {
    if (keyboardOpen || !appActive || !routeAllowed || !screenContentReady) {
      promptOpacity.stopAnimation();
      promptOpacity.setValue(0);
      setPromptVisible(false);
    }
  }, [appActive, keyboardOpen, promptOpacity, routeAllowed, screenContentReady]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const syncRoute = () => {
      const routeName = activeRootRoute(navigationRef);
      routeAllowedRef.current = isCrisisRoute(routeName);
      setRootRouteName(routeName);
    };
    syncRoute();
    const unsubscribeState = navigationRef.addListener('state', syncRoute);
    const unsubscribeReady = navigationRef.addListener('ready', syncRoute);
    return () => {
      unsubscribeState();
      unsubscribeReady();
    };
  }, [navigationRef]);

  const presentPrompt = useCallback(() => {
    if (
      keyboardOpenRef.current
      || !appActiveRef.current
      || !routeAllowedRef.current
      || !screenContentReadyRef.current
    ) return;
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    promptOpacity.stopAnimation();
    promptOpacity.setValue(0);
    setPromptVisible(true);
    Animated.timing(promptOpacity, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.spring(buttonScale, { toValue: 1.07, speed: 24, bounciness: 7, useNativeDriver: true }),
      Animated.spring(buttonScale, { toValue: 1, speed: 20, bounciness: 4, useNativeDriver: true }),
    ]).start();
    collapseTimerRef.current = setTimeout(() => {
      Animated.timing(promptOpacity, { toValue: 0, duration: 220, useNativeDriver: true })
        .start(({ finished }) => { if (finished) setPromptVisible(false); });
    }, PROMPT_VISIBLE_MS);
  }, [buttonScale, promptOpacity]);

  useEffect(() => {
    screenContentReadyRef.current = screenContentReady;
    if (
      screenContentReady
      && routeAllowed
      && !keyboardOpen
      && appActive
      && !initialPromptShownRef.current
    ) {
      initialPromptShownRef.current = true;
      presentPrompt();
    }
  }, [appActive, keyboardOpen, presentPrompt, routeAllowed, screenContentReady]);

  useEffect(() => {
    const interval = setInterval(presentPrompt, PROMPT_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      promptOpacity.stopAnimation();
    };
  }, [presentPrompt, promptOpacity]);

  if (keyboardOpen || !appActive || !routeAllowed || !screenContentReady) return null;

  const hasBottomNavigation = rootRouteName === 'Tabs';
  const bottom = insets.bottom + (hasBottomNavigation ? TAB_NAV_CLEARANCE : AUTH_SAFE_CLEARANCE);

  return (
    <View pointerEvents="box-none" className="absolute inset-0 z-[1000]" style={{ elevation: 20 }}>
      <View pointerEvents="box-none" className="absolute right-lg items-end" style={{ bottom }}>
        {promptVisible ? (
          <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity: promptOpacity, transform: [{ translateY: promptOpacity.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] }} className="absolute bottom-[58px] right-0 w-[230px] rounded-button border border-red-400/30 bg-[#171A10] px-md py-sm">
            <Text className="w-full text-left font-body-semibold text-white text-[12px] leading-[17px]">Need to talk to someone?</Text>
          </Animated.View>
        ) : null}
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <Pressable
            onPress={() => void openCrisisSupport()}
            accessibilityRole="button"
            accessibilityLabel={FOOTER.crisis.label}
            accessibilityHint="Opens your phone app to call crisis support."
            className="items-center justify-center rounded-full border border-red-400/50 bg-[#241616] active:opacity-75"
            style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 6 }}
          >
            <Feather name="life-buoy" size={21} color="#F87171" />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

function activeRootRoute(navigationRef: NavigationContainerRef<AppStackParamList>) {
  if (!navigationRef.isReady()) return undefined;
  const state = navigationRef.getRootState();
  return state?.routes[state.index]?.name;
}

function isCrisisRoute(routeName?: string) {
  return Boolean(routeName && !HIDDEN_ROUTES.has(routeName));
}
