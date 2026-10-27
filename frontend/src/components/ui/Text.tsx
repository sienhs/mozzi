import { Text, type TextProps } from 'react-native';
import { typography } from '@/theme/tokens';

export function AppText({
  variant = 'body',
  style,
  ...props
}: TextProps & { variant?: keyof typeof typography }) {
  return <Text {...props} style={[typography[variant], style]} />;
}
