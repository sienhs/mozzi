import { Image, Pressable, StyleSheet, View } from 'react-native';
import { emotionOrder, emotions } from '@/constants/emotions';
import type { Emotion } from '@/types/diary';
import { colors } from '@/theme/tokens';
import { AppText } from '@/components/ui/Text';

export function EmotionImage({
  emotion,
  size = 64,
}: {
  emotion: Emotion;
  size?: number;
}) {
  return (
    <Image
      accessibilityLabel={`${emotions[emotion].label} 모찌`}
      source={size <= 32 ? emotions[emotion].face : emotions[emotion].source}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}
export function EmotionPicker({
  value,
  onChange,
}: {
  value: Emotion | null;
  onChange: (value: Emotion) => void;
}) {
  return (
    <View style={styles.grid}>
      {[emotionOrder.slice(0, 3), emotionOrder.slice(3)].map(
        (row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map(emotion => {
              const selected = value === emotion;
              return (
                <Pressable
                  key={emotion}
                  accessibilityRole="radio"
                  accessibilityLabel={emotions[emotion].label}
                  accessibilityState={{ selected }}
                  onPress={() => onChange(emotion)}
                  style={[
                    styles.option,
                    selected && {
                      backgroundColor: emotions[emotion].color,
                      borderColor: colors.ink,
                    },
                  ]}
                >
                  <EmotionImage emotion={emotion} size={64} />
                  <AppText variant="small" style={{ color: colors.ink }}>
                    {selected ? '✓ ' : ''}
                    {emotions[emotion].label}
                  </AppText>
                </Pressable>
              );
            })}
            {row.length === 2 && <View style={{ flex: 1 }} />}
          </View>
        ),
      )}
    </View>
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
      <AppText variant="caption" style={{ color: colors.ink }}>
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
    minHeight: 122,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
