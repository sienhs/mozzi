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
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {emotionOrder.map(emotion => (
        <Pressable
          key={emotion}
          accessibilityRole="radio"
          accessibilityLabel={`${emotions[emotion].label} 장착 설정`}
          accessibilityState={{ selected: value === emotion, disabled }}
          disabled={disabled}
          onPress={() => onChange(emotion)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            paddingHorizontal: 2,
            paddingVertical: 8,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: value === emotion ? colors.primary : colors.line,
            backgroundColor:
              value === emotion ? emotions[emotion].color : colors.white,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <AppText variant="label" style={{ color: colors.ink, fontSize: 18 }}>
            {emotions[emotion].label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
