import { fireEvent, render, screen } from '@testing-library/react-native';
import { setupAllComponents } from 'react-native-css-interop/test';
import { Button } from '../src/components/ui/Button';
import { DiaryArtwork } from '../src/components/ui/DiaryCard';
import { colors, radii } from '../src/theme/tokens';

// The project has no Node typings, so only the two calls used below are typed.
// Asset paths are relative to the frontend root, where `npm test` runs Jest.
const { readFileSync } = jest.requireActual<{
  readFileSync: (path: string) => Uint8Array;
}>('fs');
const { inflateSync } = jest.requireActual<{
  inflateSync: (data: Uint8Array) => Uint8Array;
}>('zlib');

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

test('lets the artwork frame own the 3:2 ratio', async () => {
  await render(<DiaryArtwork />);
  const image = screen.getByLabelText(
    '따뜻한 방에서 오므라이스를 먹는 모찌의 그림일기',
  );

  expect(image).toHaveStyle({ width: '100%', height: '100%' });
  expect(image).not.toHaveStyle({ aspectRatio: 3 / 2 });
  expect(image.parent).toHaveStyle({
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: radii.card,
    overflow: 'hidden',
  });
});

// tintColor recolours every opaque pixel, so a white icon background turns into a solid square.
test.each([
  'back',
  'chevron-right',
  'close',
  'pencil',
  'refresh',
  'send',
  'settings',
  'share',
])('ships the tinted %s icon with a transparent background', name => {
  const png = readFileSync(`assets/figma/${name}.png`);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const colorType = png[25];
  const data: number[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (type === 'IDAT')
      data.push(...png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  // Row 0 starts with a filter byte; the top-left pixel's alpha is the fourth sample.
  const firstPixelAlpha = inflateSync(Uint8Array.from(data))[4];

  expect(colorType).toBe(6);
  expect(firstPixelAlpha).toBe(0);
});
