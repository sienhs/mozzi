import { Text, type TextProps } from 'react-native';
import { fonts, typography } from '@/theme/tokens';
import { isLoaded } from 'expo-font';

export function AppText({
  variant = 'body',
  style,
  ...props
}: TextProps & { variant?: keyof typeof typography }) {
  const fallback =
    typography[variant].fontFamily === fonts.pen && !isLoaded(fonts.pen)
      ? { fontFamily: fonts.regular }
      : undefined;
  return <Text {...props} style={[typography[variant], style, fallback]} />;
}
