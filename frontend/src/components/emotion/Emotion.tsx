import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import { emotionOrder, emotions } from '@/constants/emotions';
import type { Emotion } from '@/types/diary';
import { colors } from '@/theme/tokens';
import { AppText } from '@/components/ui/Text';
import { companionEmotionSource, companions } from '@/constants/companions';
import { companionArtworkStyle } from '@/constants/companionArtwork';
import { MotionReveal, useReducedMotion } from '@/components/ui/Motion';
import type { CompanionId } from '@/types/companion';
import { useGachaStore } from '@/stores/useGachaStore';

export function EmotionImage({
  emotion,
  size = 64,
  companionId = 'default',
}: {
  emotion: Emotion;
  size?: number;
  companionId?: CompanionId;
}) {
  const source = companionEmotionSource(companionId, emotion, size <= 32);
  const normalize =
    companionId !== 'default' && source === companions[companionId].source;
  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }}>
      <Image
        accessibilityLabel={`${emotions[emotion].label} 모찌`}
        source={source}
        resizeMode="contain"
        style={[
          { width: size, height: size },
          normalize && companionArtworkStyle(companionId),
        ]}
      />
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
  const equippedByEmotion = useGachaStore(state => state.equippedByEmotion);
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
                      companionId={equippedByEmotion[emotion]}
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
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.paperEdge,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
