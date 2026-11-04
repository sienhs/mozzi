import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { CardImage } from '@/components/gacha/CardImage';
import { emotionOrder, emotions } from '@/constants/emotions';
import type { Emotion } from '@/types/diary';
import { cozyColors as colors } from '@/theme/cozy';
import { AppText } from '@/components/ui/Text';
import { companionEmotionSource } from '@/constants/companions';
import { MotionReveal, useReducedMotion } from '@/components/ui/Motion';
import type { Companion } from '@/types/companion';
import { useMozziPicks } from '@/features/gacha/useGachaQueries';

export function EmotionImage({
  emotion,
  size = 64,
  companion,
}: {
  emotion: Emotion;
  size?: number;
  // 그 감정에 고른 모찌. 없으면 기본 모찌.
  companion?: Companion | null;
}) {
  const source = companionEmotionSource(companion, emotion, size <= 44);
  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }}>
      {companion ? (
        <CardImage
          accessibilityLabel={`${emotions[emotion].label} 모찌`}
          uri={companion.imageUrl}
          style={{ width: size, height: size }}
        />
      ) : (
        <Image
          accessibilityLabel={`${emotions[emotion].label} 모찌`}
          source={source}
          contentFit="contain"
          style={{ width: size, height: size }}
        />
      )}
    </View>
  );
}
export function EmotionPicker({
  value,
  onChange,
}: {
  value: Emotion | null;
  onChange: (value: Emotion) => void;
}) {
  const { picks } = useMozziPicks();
  return (
    <View style={styles.grid}>
      {[emotionOrder.slice(0, 3), emotionOrder.slice(3)].map(
        (row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map(emotion => {
              const selected = value === emotion;
              return (
                <EmotionOption
                  key={emotion}
                  emotion={emotion}
                  selected={selected}
                  onPress={() => onChange(emotion)}
                >
                  <MotionReveal pop replayKey={selected ? 'selected' : 'idle'}>
                    <EmotionImage
                      emotion={emotion}
                      size={64}
                      companion={picks[emotion]}
                    />
                  </MotionReveal>
                  <AppText variant="label" style={{ color: colors.ink }}>
                    {selected ? '✓ ' : ''}
                    {emotions[emotion].label}
                  </AppText>
                </EmotionOption>
              );
            })}
            {row.length === 2 && <View style={{ flex: 1 }} />}
          </View>
        ),
      )}
    </View>
  );
}
function EmotionOption({
  emotion,
  selected,
  onPress,
  children,
}: {
  emotion: Emotion;
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(selected ? 1 : 0));
  useEffect(() => {
    const animation = Animated.timing(value, {
      toValue: selected ? 1 : 0,
      duration: reduced ? 0 : 180,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [reduced, selected, value]);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={emotions[emotion].label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          styles.option,
          {
            backgroundColor: value.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.paper, emotions[emotion].color],
            }),
            borderColor: value.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.paperEdge, colors.primary],
            }),
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
export function EmotionPill({ emotion }: { emotion: Emotion }) {
  return (
    <View
      style={{
        borderRadius: 12,
        paddingVertical: 2,
        paddingHorizontal: 10,
        backgroundColor: emotions[emotion].color,
      }}
    >
      <AppText
        variant="label"
        style={{ color: colors.ink, fontSize: 18, lineHeight: 24 }}
      >
        {emotions[emotion].label}
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { gap: 16 },
  row: { flexDirection: 'row', gap: 16 },
  option: {
    flex: 1,
    minHeight: 140,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.paperEdge,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    boxShadow: '0 3px 10px rgba(130, 86, 97, 0.05)',
  },
});
