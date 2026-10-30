import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { cozyColors as colors } from '@/theme/cozy';
import { Screen } from './Screen';
import { Button } from './Button';

export function CozyScreen(props: ComponentProps<typeof Screen>) {
  return <Screen {...props} appearance="cozy" />;
}

// Reuse Button's handlers, disabled state, hit area and pressed feedback.
export function CozyButton({
  style,
  labelStyle,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      style={[
        styles.button,
        props.variant === 'secondary' && styles.secondary,
        props.disabled && styles.disabled,
        style,
      ]}
      labelStyle={[
        props.variant === 'secondary' || props.disabled
          ? { color: props.disabled ? colors.muted : colors.primary }
          : { color: colors.white },
        labelStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 22,
    backgroundColor: colors.primary,
    borderColor: colors.pressed,
    boxShadow: '0 3px 0 rgba(133, 72, 90, 0.12)',
  },
  secondary: {
    backgroundColor: colors.paper,
    borderColor: colors.roseEdge,
    boxShadow: 'none',
  },
  disabled: {
    backgroundColor: colors.line,
    borderColor: colors.line,
    boxShadow: 'none',
  },
});
