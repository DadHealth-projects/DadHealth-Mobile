import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTopBar from '../../components/AppTopBar';
import LimeButton from '../../components/LimeButton';
import ScreenHero from '../../components/mockup/ScreenHero';
import { useAuth } from '../../contexts/AuthContext';
import { type Therapist, useTherapists } from '../../hooks/useTherapists';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import { colors } from '../../theme';

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk').replace(/\/$/, '');

export default function TherapistDirectoryScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const directory = useTherapists(user?.id);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const close = useCallback(() => navigation.goBack(), [navigation]);
  const openLogin = useCallback(() => navigation.navigate('Login'), [navigation]);
  const openPro = useCallback(() => navigation.navigate('Tabs', { screen: 'Home' }), [navigation]);
  const openBooking = useCallback(() => {
    setBookingError(null);
    void Linking.openURL(`${WEB_URL}/pricing`).catch(() => {
      setBookingError('We could not open booking information. Please try again.');
    });
  }, []);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-xl gap-xl">
        <AppTopBar
          leftAccessory={
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close therapist directory" hitSlop={8} className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70">
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          }
        />

        <ScreenHero
          eyebrow="Mental health support"
          headline={'Find someone\nwho gets it'}
          sub="Dad-friendly sessions, including evening and weekend availability."
        />

        {bookingError ? (
          <View accessibilityRole="alert" className="rounded-button border border-red-400/40 bg-red-400/10 p-md">
            <Text className="font-body text-red-300 text-[13px] leading-[19px]">{bookingError}</Text>
          </View>
        ) : null}

        {!user ? (
          <View className="gap-md border-y border-border py-xl">
            <Feather name="lock" size={24} color={colors.lime} />
            <Text className="font-heading-bold text-white text-[18px] uppercase">Login required</Text>
            <Text className="font-body text-muted-text text-[13px] leading-[20px]">Log in to access the therapist and counsellor directory.</Text>
            <LimeButton label="Log in" onPress={openLogin} />
          </View>
        ) : directory.loading ? (
          <View className="gap-sm">
            {[0, 1, 2].map((item) => <View key={item} className="h-[112px] rounded-button bg-white/5" />)}
          </View>
        ) : directory.error ? (
          <View accessibilityRole="alert" className="gap-md rounded-button border border-red-400/40 bg-red-400/10 p-md">
            <Text className="font-body text-red-300 text-[13px] leading-[19px]">{directory.error}</Text>
            <LimeButton label="Try again" onPress={() => void directory.refresh()} />
          </View>
        ) : !directory.isPro ? (
          <View className="gap-md border-y border-border py-xl">
            <Feather name="lock" size={24} color={colors.lime} />
            <Text className="font-heading-bold text-white text-[18px] uppercase">Dad Health Pro</Text>
            <Text className="font-body text-muted-text text-[13px] leading-[20px]">The gap between thinking about support and finding it should be smaller.</Text>
            <LimeButton label="View Dad Health Pro" onPress={openPro} />
          </View>
        ) : directory.therapists.length === 0 ? (
          <View className="border-y border-border py-xl">
            <Text className="font-heading-bold text-white text-[17px] uppercase">No therapists available yet</Text>
            <Text className="font-body text-muted-text text-[13px] leading-[19px] mt-xs">Therapist and counsellor listings will appear here.</Text>
          </View>
        ) : (
          <View className="gap-sm">
            {directory.therapists.map((therapist) => <TherapistRow key={therapist.id} therapist={therapist} onBook={openBooking} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TherapistRow({ therapist, onBook }: { therapist: Therapist; onBook: () => void }) {
  return (
    <View className="rounded-button border border-border bg-card p-md gap-md">
      <View className="flex-row items-start gap-md">
        <View className="h-[42px] w-[42px] rounded-full bg-lime/10 items-center justify-center">
          <Feather name="heart" size={18} color={colors.lime} />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="font-heading-bold text-white text-[16px] uppercase">{therapist.name}</Text>
          {therapist.spec ? <Text className="font-body text-muted-text text-[12px] leading-[18px] mt-xs">{therapist.spec}</Text> : null}
        </View>
      </View>
      <View className="flex-row gap-md border-t border-border pt-md">
        <Detail icon="calendar" label={therapist.availability ?? 'Unavailable'} />
        <Detail icon="credit-card" label={therapist.price_per_hour != null ? `£${therapist.price_per_hour}/hr` : 'Unavailable'} />
      </View>
      <Pressable onPress={onBook} accessibilityRole="button" accessibilityLabel={`Book with ${therapist.name}`} className="min-h-[44px] rounded-button border border-white/25 items-center justify-center active:opacity-70">
        <Text className="font-heading-bold text-white text-[12px] uppercase">Book</Text>
      </Pressable>
    </View>
  );
}

function Detail({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) {
  return (
    <View className="flex-1 flex-row items-center gap-xs min-w-0">
      <Feather name={icon} size={14} color={colors.lime} />
      <Text numberOfLines={2} className="font-body text-muted-text text-[11px] leading-[16px] flex-1">{label}</Text>
    </View>
  );
}
