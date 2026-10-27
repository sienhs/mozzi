import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/theme/tokens';

export const splashArtwork = require('../../../assets/figma/splash-diary.jpg');
// Keeps the start screen on long enough to be seen; jest.setup sets it to 0.
export const SPLASH_MIN_MS = 1200;

// Figma 06 · S-C 그림일기.
export function Splash() {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityLabel="오늘의 모찌를 여는 중"
      accessibilityLiveRegion="polite"
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top,
      }}
    >
      <View
        style={{
          width: '100%',
          aspectRatio: 390 / 555,
          maxHeight: '68%',
          overflow: 'hidden',
        }}
      >
        <Image
          source={splashArtwork}
          accessible={false}
          resizeMode="cover"
          style={{ width: '100%', height: '100%' }}
        />
      </View>
      <View style={{ paddingTop: 47, paddingHorizontal: 20, gap: 5 }}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.pen,
            fontSize: 48,
            lineHeight: 60,
            color: colors.primary,
            textAlign: 'center',
          }}
        >
          오늘의 모찌
        </Text>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 13,
            lineHeight: 19,
            color: colors.muted,
            textAlign: 'center',
          }}
        >
          하루의 장면을 오래도록
        </Text>
      </View>
    </View>
  );
}
