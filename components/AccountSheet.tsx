import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
} from '@react-navigation/native';

import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';
import type { AppStackParamList } from '../navigation/AppNavigator';
import type { BottomTabsParamList } from '../navigation/BottomTabNavigator';

const SCREEN_HEIGHT = Dimensions.get('window').height;
/** Slide + backdrop-fade duration (ms). */
const ANIM_MS = 300;
/** Drag distance past which release dismisses the sheet. */
const DISMISS_THRESHOLD = 110;

type AccountSheetProps = {
  visible: boolean;
  onClose: () => void;
  variant?: 'navigation' | 'account';
  activeSection?: DashboardSection;
  onSelectSection?: (section: DashboardSection) => void;
};

export type DashboardSection = 'HOME' | 'FITNESS' | 'MIND' | 'BOND' | 'COMMUNITY' | 'PROGRESS';

type Row = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  onPress: () => void;
  /** Destructive rows (Log Out) render in red with no chevron. */
  destructive?: boolean;
  active?: boolean;
};

/**
 * Modern mobile Account Sheet — a custom animated bottom sheet (Apple Fitness /
 * Spotify / GitHub Mobile style) replacing the old avatar → Profile navigation.
 *
 * UX-only: it owns overlay, backdrop, animation, menu rows and close gestures.
 * Everything auth-related comes from `useAuth()`; no auth logic lives here.
 *
 * Built on RN's built-in `Animated` + `Modal` (NOT Reanimated) — same reason as
 * FadeInView: Reanimated's worklets runtime can crash under Expo Go here.
 */
export default function AccountSheet({
  visible,
  onClose,
  variant = 'account',
  activeSection,
  onSelectSection,
}: AccountSheetProps) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute();
  const { session, user, signOut } = useAuth();

  // Keep the Modal mounted through the exit animation: `mounted` trails `visible`.
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(SCREEN_HEIGHT * 0.5);

  // translateY in px: 0 = fully open, sheetHeight = fully closed (off-screen).
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const animateTo = (toValue: number, onDone?: () => void) => {
    Animated.timing(translateY, {
      toValue,
      duration: ANIM_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDone?.();
    });
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Start fully off-screen (guaranteed below the sheet regardless of its
      // measured height), then slide up.
      translateY.setValue(SCREEN_HEIGHT);
      requestAnimationFrame(() => animateTo(0));
    } else if (mounted) {
      animateTo(sheetHeight, () => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - sheetHeight) > 1) setSheetHeight(h);
  };

  // Backdrop fades in lock-step with the slide (fully open → 1, closed → 0).
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, sheetHeight],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Drag-down-to-dismiss (optional polish). Only claims downward drags.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) =>
        g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_evt, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_evt, g) => {
        if (g.dy > DISMISS_THRESHOLD || g.vy > 0.8) {
          onClose();
        } else {
          animateTo(0);
        }
      },
    })
  ).current;

  /** Close the sheet, then run an action once its exit animation is done. */
  const closeThen = (action?: () => void) => {
    onClose();
    if (action) setTimeout(action, ANIM_MS);
  };

  const goTab = (screen: keyof BottomTabsParamList) =>
    closeThen(() => navigation.navigate('Tabs', { screen }));

  const dashboardRows: Array<{ icon: keyof typeof Feather.glyphMap; title: string; section: DashboardSection }> = [
    { icon: 'home', title: 'Home', section: 'HOME' },
    { icon: 'activity', title: 'Fitness', section: 'FITNESS' },
    { icon: 'wind', title: 'Mind', section: 'MIND' },
    { icon: 'heart', title: 'Bond', section: 'BOND' },
    { icon: 'users', title: 'Community', section: 'COMMUNITY' },
    { icon: 'bar-chart-2', title: 'Progress', section: 'PROGRESS' },
  ];

  const navigationRows: Row[] = [
    ...dashboardRows.map((row) => ({
      icon: row.icon,
      title: row.title,
      active: activeSection === row.section,
      onPress: () => closeThen(() => onSelectSection?.(row.section)),
    })),
    {
      icon: 'award',
      title: 'Dad Health Pro',
      onPress: () => goTab('Home'),
    },
  ];

  const accountRows: Row[] = session
    ? [
        {
          icon: 'user',
          title: 'Profile',
          active: route.name === 'Profile',
          onPress: () => closeThen(() => navigation.navigate('Profile')),
        },
        {
          icon: 'award',
          title: 'Dad Health Pro',
          onPress: () => goTab('Home'),
        },
        {
          icon: 'settings',
          title: 'Settings',
          active: route.name === 'Settings',
          onPress: () => closeThen(() => navigation.navigate('Settings')),
        },
      ]
    : [
        {
          icon: 'log-in',
          title: 'Login',
          onPress: () => closeThen(() => navigation.navigate('Login')),
        },
        {
          icon: 'award',
          title: 'Dad Health Pro',
          onPress: () => goTab('Home'),
        },
        {
          icon: 'settings',
          title: 'Settings',
          onPress: () => closeThen(() => navigation.navigate('Settings')),
        },
      ];

  const rows = variant === 'navigation' ? navigationRows : accountRows;

  // Logout closes the sheet first, then signs out after the exit animation so
  // the tree swap to UnauthedFlow happens after this modal has fully dismissed.
  // Signing out mid-dismissal unmounts the Modal abruptly, which can make the
  // subsequent Face ID prompt fail to present (`app_cancel`).
  const handleSignOut = () => {
    onClose();
    setTimeout(() => void signOut(), ANIM_MS);
  };

  const email = user?.email ?? null;

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          opacity: backdropOpacity,
        }}
      >
        <Pressable
          style={{ flex: 1 }}
          accessibilityRole="button"
          accessibilityLabel={variant === 'navigation' ? 'Close navigation menu' : 'Close account menu'}
          onPress={onClose}
        />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        onLayout={onLayout}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: SCREEN_HEIGHT * 0.9,
          transform: [{ translateY }],
        }}
        className="bg-card rounded-t-card"
      >
        <SafeAreaView edges={['bottom']}>
          <View className="pt-md" {...panResponder.panHandlers}>
            {/* Grab handle */}
            <View className="h-[5px] w-[40px] rounded-full bg-border self-center mb-lg" />

            {/* Header: ──── ACCOUNT ──── */}
            <View className="flex-row items-center gap-md mb-lg px-lg">
              <View className="flex-1 h-[1px] bg-border" />
              <Text className="font-heading-semibold text-muted-text text-[13px] tracking-label uppercase">
                {variant === 'navigation' ? 'Navigate' : 'Account'}
              </Text>
              <View className="flex-1 h-[1px] bg-border" />
            </View>

            {variant === 'account' && session && email ? (
              <Text
                className="font-body text-tertiary-text text-[13px] text-center mb-md px-lg"
                numberOfLines={1}
              >
                {email}
              </Text>
            ) : null}

            {/* Menu rows */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pb-lg">
              <View className="gap-xs">
                {rows.map((row) => (
                  <AccountRow key={row.title} {...row} />
                ))}
              </View>

              {variant === 'account' && session ? (
                <>
                  <View className="h-[1px] bg-border my-md" />
                  <AccountRow
                    icon="log-out"
                    title="Log Out"
                    destructive
                    onPress={handleSignOut}
                  />
                </>
              ) : null}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

function AccountRow({ icon, title, onPress, destructive, active }: Row) {
  const tint = destructive ? '#F87171' : colors.lime;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={active ? { selected: true } : undefined}
      className={`h-[52px] flex-row items-center gap-md rounded-button px-sm active:bg-muted/40 ${
        active ? 'bg-lime/10 border border-lime/25' : ''
      }`}
    >
      <View
        className="h-[40px] w-[40px] rounded-button items-center justify-center"
        style={{ backgroundColor: destructive ? 'rgba(248,113,113,0.1)' : 'rgba(200,245,90,0.1)' }}
      >
        <Feather name={icon} size={20} color={tint} />
      </View>

      <Text
        className={`flex-1 font-heading-bold text-[18px] uppercase tracking-[0.5px] ${
          destructive ? 'text-[#F87171]' : 'text-white'
        }`}
      >
        {title}
      </Text>

      {!destructive ? (
        <Feather name="chevron-right" size={22} color={colors.tertiaryText} />
      ) : null}
    </Pressable>
  );
}
