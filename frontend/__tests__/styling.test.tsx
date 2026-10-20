import { render, screen } from '@testing-library/react-native';
import { Camera } from 'lucide-react-native';
import { StyleSheet } from 'nativewind';
import postcss from 'postcss';
import { View } from 'react-native';
import { cssToReactNativeRuntime } from 'react-native-css-interop/css-to-rn';
import { setupAllComponents } from 'react-native-css-interop/test';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../tailwind.config';

beforeAll(setupAllComponents);

test('applies a Tailwind utility through NativeWind', async () => {
  const { css } = await postcss([
    tailwindcss({
      ...tailwindConfig,
      content: [{ raw: '<View className="flex-1" />' }],
    }),
  ]).process('@tailwind utilities;', { from: undefined });
  StyleSheet.registerCompiled(cssToReactNativeRuntime(css));

  await render(<View testID="nativewind-check" className="flex-1" />);

  expect(screen.getByTestId('nativewind-check')).toHaveStyle({
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
  });
});

test('renders a Lucide icon using React Native SVG', async () => {
  await render(<Camera testID="lucide-check" size={24} />);
  const icon = screen.getByTestId('lucide-check', {
    includeHiddenElements: true,
  });

  expect(icon).toHaveStyle({ width: 24, height: 24 });
});
