import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, radii } from '@/theme/tokens';
import { AppText } from './Text';
import { Icon } from './Icon';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'google';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  labelStyle,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || loading;
  const light = disabled || variant !== 'primary';
  // NativeWind wraps Pressable on native and drops a function `style`, so pressed state is tracked here.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.button,
        variant !== 'primary' && styles.secondary,
        variant === 'google' && styles.google,
        disabled && styles.disabled,
        pressed &&
          !inactive && {
            backgroundColor:
              variant === 'primary' ? colors.pressed : colors.line,
          },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={light ? colors.ink : colors.white}
          size="small"
        />
      ) : variant === 'google' ? (
        <Icon name="google" size={20} />
      ) : null}
      <AppText
        variant="label"
        style={[
          {
            color: light ? colors.ink : colors.white,
            textAlign: 'center',
          },
          labelStyle,
        ]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
export function TextButton({
  label,
  onPress,
}: Pick<ButtonProps, 'label' | 'onPress'>) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.link}>
      <AppText variant="small">{label}</AppText>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondary: { backgroundColor: colors.white },
  google: { borderWidth: 1, borderColor: colors.border },
  disabled: { backgroundColor: colors.line },
  link: {
    minHeight: 48,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
