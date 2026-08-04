import React, { memo, useCallback } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { FOOTER } from '../../lib/homeContent';
import { colors } from '../../theme';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://dadhealth.co.uk';

type PublicFooterProps = {
  /** Platform links map to bottom tabs (Home / Fit / Mind / Bond / Squad). */
  onOpenTab: (tab: string) => void;
};

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={label} hitSlop={6}>
      <Text className="font-body text-white/70 text-[14px] py-xs">{label}</Text>
    </Pressable>
  );
}

/** Web `components/SiteFooter.tsx`, stacked for mobile. */
function PublicFooter({ onOpenTab }: PublicFooterProps) {
  const openPath = useCallback((path: string) => {
    void Linking.openURL(`${WEB_URL}${path}`).catch(() => {});
  }, []);

  return (
    <View className="border-t border-border pt-lg gap-lg">
      <View>
        <View className="flex-row items-baseline">
          <Text className="font-heading text-lime text-[24px] leading-[25px] uppercase">Dad</Text>
          <Text className="font-heading text-white text-[24px] leading-[25px] uppercase"> Health</Text>
        </View>
        <Text className="font-body text-muted-text text-[14px] leading-[21px] mt-sm">
          {FOOTER.blurb}
        </Text>
      </View>

      <View className="flex-row gap-lg">
        <View className="flex-1">
          <Text className="font-heading-bold text-muted-text text-[10px] tracking-label uppercase mb-sm">
            Platform
          </Text>
          {FOOTER.platform.map((link) => (
            <FooterLink key={link.label} label={link.label} onPress={() => onOpenTab(link.tab)} />
          ))}
        </View>

        <View className="flex-1">
          <Text className="font-heading-bold text-muted-text text-[10px] tracking-label uppercase mb-sm">
            Legal
          </Text>
          {FOOTER.legal.map((link) => (
            <FooterLink key={link.label} label={link.label} onPress={() => openPath(link.path)} />
          ))}

          <Text className="font-heading-bold text-muted-text text-[10px] tracking-label uppercase mt-md mb-sm">
            {FOOTER.supportLabel}
          </Text>
          <FooterLink
            label={FOOTER.supportEmail}
            onPress={() => {
              void Linking.openURL(`mailto:${FOOTER.supportEmail}`).catch(() => {});
            }}
          />
        </View>
      </View>

      <View className="border-t border-border pt-md gap-md">
        <Text className="font-body text-muted-text text-[12px]">{FOOTER.copyright}</Text>
        <Pressable
          onPress={() => {
            void Linking.openURL(`tel:${FOOTER.crisis.tel}`).catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel={FOOTER.crisis.label}
          className="self-start flex-row items-center gap-sm rounded-button border border-border px-md py-sm active:border-lime/50"
        >
          <Feather name="life-buoy" size={16} color={colors.lime} />
          <Text className="font-heading-bold text-muted-text text-[11px] tracking-[1px] uppercase">
            {FOOTER.crisis.label}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default memo(PublicFooter);
