import { Check, Star, X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { cozyColors as colors } from '@/theme/cozy';
import { AppText } from './Text';

// 태그 칩. 폭은 라벨에 맞춰 줄바꿈한다 (칩 수가 늘고 내 태그 라벨 길이가 제각각이라서).
export function TagChip({
  label,
  selected,
  onPress,
  disabled,
  single,
  main,
  removable,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  // 하나만 고르는 분류(어디서·날씨)는 radio로 읽힌다.
  single?: boolean;
  // 대표 활동 표시.
  main?: boolean;
  // 편집 상태의 내 태그. 누르면 삭제를 묻는다.
  removable?: boolean;
}) {
  const state = single
    ? { selected, disabled: !!disabled }
    : { checked: selected, disabled: !!disabled };
  return (
    <Pressable
      accessibilityRole={removable ? 'button' : single ? 'radio' : 'checkbox'}
      accessibilityLabel={removable ? `${label} 지우기` : label}
      accessibilityHint={main ? '대표 활동' : undefined}
      accessibilityState={removable ? { disabled: !!disabled } : state}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: selected ? colors.sage : colors.paperEdge,
        backgroundColor: selected ? colors.sageSoft : colors.paper,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        opacity: disabled && !selected ? 0.4 : 1,
      }}
    >
      {main && <Star size={14} color={colors.sage} fill={colors.sage} />}
      <AppText variant="small" style={{ color: colors.ink }}>
        {label}
      </AppText>
      {removable && <X size={14} color={colors.muted} />}
    </Pressable>
  );
}
export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: checked ? colors.primary : colors.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <Check size={16} color={colors.white} />}
      </View>
      <AppText variant="small">{label}</AppText>
    </Pressable>
  );
}
