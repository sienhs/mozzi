import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/Text';
import { emotionOrder, emotions } from '@/constants/emotions';
import { colors } from '@/theme/tokens';
import type { Emotion } from '@/types/diary';

export function EmotionSlotPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Emotion;
  onChange: (emotion: Emotion) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {emotionOrder.map(emotion => (
        <Pressable
          key={emotion}
          accessibilityRole="radio"
          accessibilityLabel={`${emotions[emotion].label} 장착 설정`}
          accessibilityState={{ selected: value === emotion, disabled }}
          disabled={disabled}
          onPress={() => onChange(emotion)}
          style={{
            minHeight: 44,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: value === emotion ? colors.primary : colors.line,
            backgroundColor:
              value === emotion ? emotions[emotion].color : colors.white,
            justifyContent: 'center',
          }}
        >
          <AppText variant="small" style={{ color: colors.ink }}>
            {emotions[emotion].label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
