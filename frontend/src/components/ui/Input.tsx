import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import { AppText } from './Text';

export function Input({
  label,
  helper,
  error,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label?: string; helper?: string; error?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8, flexShrink: 1 }}>
      {label && (
        <AppText variant="small" style={{ color: colors.ink }}>
          {label}
        </AppText>
      )}
      <TextInput
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        {...props}
        onFocus={event => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={event => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          typography.body,
          styles.input,
          focused && { borderColor: colors.primary, borderWidth: 1.5 },
          error ? { borderColor: colors.error, borderWidth: 1.5 } : null,
          style,
        ]}
      />
      {(error || helper) && (
        <AppText
          variant="caption"
          accessibilityLiveRegion="polite"
          style={error ? { color: colors.error } : undefined}
        >
          {error || helper}
        </AppText>
      )}
    </View>
  );
}
export function MemoInput({
  value,
  onChangeText,
  editable = true,
  label = '남기고 싶은 한 줄 (선택)',
  placeholder = '오늘의 작은 장면을 남겨 보세요',
  maxLength = 100,
}: {
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
  label?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="small" style={{ color: colors.ink }}>
        {label}
      </AppText>
      <View style={[styles.memo, focused && { borderColor: colors.primary }]}>
        <TextInput
          accessibilityLabel={label}
          multiline
          maxLength={maxLength}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          textAlignVertical="top"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[typography.body, { flex: 1, padding: 0 }]}
        />
        <AppText variant="caption">
          {value.length} / {maxLength}
        </AppText>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  input: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.paperEdge,
    borderRadius: radii.input,
  },
  memo: {
    minHeight: 112,
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: colors.paperEdge,
    borderRadius: radii.input,
    backgroundColor: colors.white,
    gap: 12,
  },
});
