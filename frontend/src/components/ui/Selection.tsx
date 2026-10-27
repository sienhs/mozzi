import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { AppText } from './Text';

export function ActivityChip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: '29.14%',
        minHeight: 44,
        borderRadius: 16,
        backgroundColor: selected ? colors.sageSoft : colors.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText variant="small" style={{ color: colors.ink }}>
        {label}
      </AppText>
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
