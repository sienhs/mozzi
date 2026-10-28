import { fireEvent, render, screen } from '@testing-library/react-native';
import { setupAllComponents } from 'react-native-css-interop/test';
import { Button } from '../src/components/ui/Button';
import { DiaryArtwork } from '../src/components/ui/DiaryCard';
import { colors, radii } from '../src/theme/tokens';

// NativeWind's native Pressable wrapper is what dropped every Button style on Android.
beforeAll(setupAllComponents);

const shape = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 52,
  borderRadius: radii.button,
} as const;

test.each([
  ['primary', {}, { backgroundColor: colors.primary }],
  ['secondary', {}, { backgroundColor: colors.white }],
  [
    'google',
    {},
    {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
    },
  ],
  ['primary', { disabled: true }, { backgroundColor: colors.line }],
  ['primary', { loading: true }, { backgroundColor: colors.primary }],
] as const)(
  'renders the %s button %j with its own frame',
  async (variant, flags, look) => {
    await render(
      <Button
        label="계속하기"
        variant={variant}
        onPress={jest.fn()}
        {...flags}
      />,
    );

    expect(screen.getByRole('button', { name: '계속하기' })).toHaveStyle({
      ...shape,
      ...look,
    });
  },
);

test.each([
  ['primary', colors.primary, colors.pressed],
  ['secondary', colors.white, colors.line],
  ['google', colors.white, colors.line],
] as const)(
  'darkens the %s button while pressed',
  async (variant, idle, pressed) => {
    await render(
      <Button label="계속하기" variant={variant} onPress={jest.fn()} />,
    );
    const button = screen.getByRole('button', { name: '계속하기' });

    await fireEvent(button, 'pressIn');
    expect(button).toHaveStyle({ ...shape, backgroundColor: pressed });

    await fireEvent(button, 'pressOut');
    expect(button).toHaveStyle({ backgroundColor: idle });
  },
);

test('keeps the Google icon and label on one centred row', async () => {
  await render(
    <Button label="Google로 시작하기" variant="google" onPress={jest.fn()} />,
  );
  const button = screen.getByRole('button', { name: 'Google로 시작하기' });

  expect(button).toHaveStyle({ flexDirection: 'row', alignItems: 'center' });
  expect(button.children).toHaveLength(2);
});

test('lets the artwork frame own the ratio: diary pictures are square, the welcome art stays 3:2', async () => {
  const label = '따뜻한 방에서 오므라이스를 먹는 모찌의 그림일기';
  const result = await render(<DiaryArtwork />);
  const image = screen.getByLabelText(label);

  expect(image).toHaveStyle({ width: '100%', height: '100%' });
  expect(image).not.toHaveStyle({ aspectRatio: 1 });
  expect(image.parent).toHaveStyle({
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.card,
    overflow: 'hidden',
  });
  await result.rerender(<DiaryArtwork ratio={3 / 2} />);
  expect(screen.getByLabelText(label).parent).toHaveStyle({
    aspectRatio: 3 / 2,
  });
});
