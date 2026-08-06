import React, { useCallback } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import AppTopBar from '../../components/AppTopBar';
import ScreenHero from '../../components/mockup/ScreenHero';
import { colors } from '../../theme';

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk')
  .replace(/^https:\/\/dadhealth\.co\.uk(?=\/|$)/, 'https://www.dadhealth.co.uk')
  .replace(/\/$/, '');

const documents = [
  { label: 'Terms and conditions', path: '/terms' },
  { label: 'Privacy policy', path: '/privacy' },
  { label: 'Cookies policy', path: '/cookies' },
  { label: 'End-user licence agreement', path: '/eula' },
] as const;

export default function TermsPrivacyScreen() {
  const navigation = useNavigation();
  const openDocument = useCallback((path: string) => {
    void Linking.openURL(`${WEB_URL}${path}`);
  }, []);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-lg pt-lg pb-[120px] gap-xl">
        <AppTopBar
          leftAccessory={
            <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close terms and privacy" className="h-[44px] w-[44px] rounded-full border border-border items-center justify-center active:opacity-70">
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          }
        />
        <ScreenHero eyebrow="Settings" headline={'Terms &\nprivacy'} />

        <View className="border-t border-border">
          {documents.map((document) => (
            <Pressable
              key={document.path}
              onPress={() => openDocument(document.path)}
              accessibilityRole="link"
              accessibilityLabel={`Open ${document.label}`}
              className="min-h-[64px] flex-row items-center gap-md border-b border-border active:opacity-70"
            >
              <View className="h-[36px] w-[36px] items-center justify-center">
                <Feather name="file-text" size={18} color={colors.lime} />
              </View>
              <Text className="flex-1 font-heading-bold text-white text-[14px] uppercase">{document.label}</Text>
              <Feather name="external-link" size={17} color={colors.lime} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
