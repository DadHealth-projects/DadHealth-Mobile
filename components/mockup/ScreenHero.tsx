import React, { memo } from 'react';
import { Text, View } from 'react-native';

type ScreenHeroProps = {
  /** Small lime eyebrow. */
  eyebrow?: string;
  /** Main headline. Newlines are preserved. */
  headline: string;
  /** Optional final line rendered in lime. */
  accent?: string;
  /** Supporting copy. */
  sub?: string;
  /** Text alignment. */
  align?: 'left' | 'center';
};

function ScreenHero({
  eyebrow,
  headline,
  accent,
  sub,
  align = 'left',
}: ScreenHeroProps) {
  const containerAlign = align === 'center' ? 'items-center' : 'items-start';
  const textAlign = align === 'center' ? 'text-center' : 'text-left';

  return (
    <View className={containerAlign}>
      {eyebrow ? (
        <Text className={`font-heading-bold text-lime uppercase tracking-label text-[11px] ${textAlign}`}>{eyebrow}</Text>
      ) : null}

      <Text
        className={`font-heading uppercase text-white text-[54px] leading-[54px] ${eyebrow ? 'mt-[10px]' : ''} ${textAlign}`}
      >
        {headline}
        {accent ? (
          <Text className="text-lime">{`\n${accent}`}</Text>
        ) : null}
      </Text>

      {sub ? (
        <View className="max-w-[300px] mt-8">
          <Text
            className={`font-body text-white/50 text-[15px] leading-[22px] ${textAlign}`}
          >
            {sub}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default memo(ScreenHero);
