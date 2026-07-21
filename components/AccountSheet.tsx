import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  useNavigation,
  type NavigationProp,
} from '@react-navigation/native';

import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';
import type { AppStackParamList } from '../navigation/AppNavigator';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://dadhealth.co.uk';

const SCREEN_HEIGHT = Dimensions.get('window').height;
/** Slide + backdrop-fade duration (ms). */
const ANIM_MS = 300;
/** Drag distance past which release dismisses the sheet. */
const DISMISS_THRESHOLD = 110;

type AccountSheetProps = {
  visible: boolean;
  onClose: () => void;
};

type Row = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  onPress: () => void;
  /** Destructive rows (Log Out) render in red with no chevron. */
  destructive?: boolean;
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
export default function AccountSheet({ visible, onClose }: AccountSheetProps) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
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

  const rows: Row[] = session
    ? [
        {
          icon: 'user',
          title: 'My Profile',
          onPress: () => closeThen(() => navigation.navigate('Profile')),
        },
        {
          icon: 'settings',
          title: 'Settings',
          onPress: () => closeThen(() => navigation.navigate('Settings')),
        },
        {
          icon: 'help-circle',
          title: 'Help & Support',
          onPress: () => closeThen(() => Linking.openURL(`${WEB_URL}/help`).catch(() => {})),
        },
      ]
    : [
        {
          icon: 'log-in',
          title: 'Sign In',
          onPress: () => closeThen(() => navigation.navigate('Login')),
        },
        {
          icon: 'settings',
          title: 'Settings',
          onPress: () => closeThen(() => navigation.navigate('Settings')),
        },
        {
          icon: 'help-circle',
          title: 'Help & Support',
          onPress: () => closeThen(() => Linking.openURL(`${WEB_URL}/help`).catch(() => {})),
        },
      ];

  // Logout closes the sheet and defers to the existing signOut(); the auth
  // listener drops the tree back to UnauthedFlow. No auth logic duplicated here.
  const handleSignOut = () => {
    onClose();
    void signOut();
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
          accessibilityLabel="Close account menu"
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
          transform: [{ translateY }],
        }}
        className="bg-card rounded-t-card"
      >
        <SafeAreaView edges={['bottom']}>
          <View className="p-lg pt-md" {...panResponder.panHandlers}>
            {/* Grab handle */}
            <View className="h-[5px] w-[40px] rounded-full bg-border self-center mb-lg" />

            {/* Header: ──── ACCOUNT ──── */}
            <View className="flex-row items-center gap-md mb-lg">
              <View className="flex-1 h-[1px] bg-border" />
              <Text className="font-heading-semibold text-muted-text text-[13px] tracking-label uppercase">
                Account
              </Text>
              <View className="flex-1 h-[1px] bg-border" />
            </View>

            {session && email ? (
              <Text
                className="font-body text-tertiary-text text-[13px] text-center mb-md"
                numberOfLines={1}
              >
                {email}
              </Text>
            ) : null}

            {/* Menu rows */}
            <View className="gap-md">
              {rows.map((row) => (
                <AccountRow key={row.title} {...row} />
              ))}
            </View>

            {/* Log Out (logged in only) */}
            {session ? (
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
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

function AccountRow({ icon, title, onPress, destructive }: Row) {
  const tint = destructive ? '#F87171' : colors.lime;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      className="h-[56px] flex-row items-center gap-md rounded-button px-sm active:bg-muted/40"
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
