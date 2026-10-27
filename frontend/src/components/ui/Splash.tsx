import { Image, View } from 'react-native';
import { colors } from '@/theme/tokens';

export const splashArtwork = require('../../../assets/figma/splash-diary.jpg');
// Keeps the start screen on long enough to be seen; jest.setup sets it to 0.
export const SPLASH_MIN_MS = 1200;

// Figma 06 · S-C 그림일기.
export function Splash() {
  return (
    <View
      accessibilityLabel="오늘의 모찌를 여는 중"
      accessibilityLiveRegion="polite"
      style={{
        flex: 1,
        backgroundColor: colors.bg,
      }}
    >
      <Image
        source={splashArtwork}
        accessible={false}
        resizeMode="cover"
        style={{ flex: 1, width: '100%' }}
      />
    </View>
  );
}
