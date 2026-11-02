import { memo, useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/components/ui/Motion';

// 캘린더 뒤에 까는 크리스마스 배경. 풍경은 고정이고 눈송이와 별만 움직인다.
// 크기는 창 크기가 아니라 실제로 깔린 영역을 재서 정한다. 폴더블을 펼치면 영역이 바뀌어 다시 그린다.
// 동작 줄이기를 켠 기기에서는 눈송이와 별을 제자리에 멈춰 둔다.
type Palette = {
  sky: [string, string, string];
  farHill: string;
  nearHill: string;
  tree: [string, string, string];
  trunk: string;
  snow: string;
  shade: string;
};
const day: Palette = {
  sky: ['#D7E4EF', '#EDF2F6', '#FBF7F3'],
  farHill: '#F4F7FA',
  nearHill: '#FFFFFF',
  tree: ['#7F9C84', '#8DAA91', '#9CB89F'],
  trunk: '#9C7B6B',
  snow: '#FFFFFF',
  shade: '#DCE4EE',
};
const night: Palette = {
  sky: ['#18213D', '#27335A', '#3D4A72'],
  farHill: '#AEBAD2',
  nearHill: '#CBD4E6',
  tree: ['#3E5A4B', '#486756', '#537362'],
  trunk: '#6B5348',
  snow: '#E6ECF5',
  shade: '#A9B6CC',
};
const RED = '#D9625F';
const GOLD = '#F2C14E';

// 화면마다 같은 자리에 눈이 오도록 순번으로 값을 정한다.
const spread = (index: number, salt: number) => {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
};
const flakes = Array.from({ length: 160 }, (_, index) => ({
  left: spread(index, 1),
  size: 2.5 + spread(index, 2) * 6.5,
  start: spread(index, 4),
  sway: 8 + spread(index, 5) * 22,
  opacity: 0.55 + spread(index, 6) * 0.45,
})).map(flake => ({
  ...flake,
  // 큰 눈송이일수록 가까이 있는 것처럼 빨리 내린다.
  duration: 15000 - flake.size * 900 + flake.start * 3000,
}));
const stars = Array.from({ length: 48 }, (_, index) => ({
  x: spread(index, 7),
  y: spread(index, 8) * 0.6,
  r: 0.8 + spread(index, 9) * 1.4,
}));
type Size = { width: number; height: number };

export function SnowBackdrop({ night: isNight = false }: { night?: boolean }) {
  const reduced = useReducedMotion();
  const [size, setSize] = useState<Size>();
  const [nightness] = useState(() => new Animated.Value(isNight ? 1 : 0));
  useEffect(() => {
    const animation = Animated.timing(nightness, {
      toValue: isNight ? 1 : 0,
      duration: reduced ? 0 : 600,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [isNight, nightness, reduced]);
  // 넓을수록 눈송이를 늘려 펼친 화면에서도 같은 밀도로 내린다.
  const count = size
    ? Math.min(
        flakes.length,
        Math.max(70, Math.round((size.width * size.height) / 4200)),
      )
    : 0;
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={({ nativeEvent: { layout } }) =>
        setSize({ width: layout.width, height: layout.height })
      }
    >
      {size && (
        <>
          <Scene size={size} palette={day} />
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: nightness }]}
          >
            <Scene size={size} palette={night} />
            <Stars size={size} reduced={reduced} />
          </Animated.View>
          {flakes.slice(0, count).map((flake, index) => (
            <Snowflake
              key={index}
              flake={flake}
              size={size}
              reduced={reduced}
              night={isNight}
            />
          ))}
        </>
      )}
    </View>
  );
}

const Scene = memo(function Scene({
  size: { width, height },
  palette,
}: {
  size: Size;
  palette: Palette;
}) {
  const insets = useSafeAreaInsets();
  const scale = Math.min(Math.max(width / 400, 1), 1.6);
  const hill = Math.min(Math.max(height * 0.16, 110), 190);
  const id = palette === night ? 'nightSky' : 'daySky';
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.sky[0]} />
            <Stop offset="0.55" stopColor={palette.sky[1]} />
            <Stop offset="1" stopColor={palette.sky[2]} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill={`url(#${id})`} />
        {palette === night && (
          <>
            {[22, 15, 10].map((r, index) => (
              <Circle
                key={r}
                cx={width * 0.6}
                cy={insets.top + 28}
                r={r}
                fill="#FFF3C9"
                opacity={[0.12, 0.2, 1][index]}
              />
            ))}
          </>
        )}
      </Svg>
      <Svg
        style={[styles.bottom, { height: hill }]}
        width={width}
        height={hill}
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
      >
        <Path
          d="M0 58 C70 30 140 36 210 56 C280 76 340 52 400 40 L400 120 L0 120 Z"
          fill={palette.farHill}
        />
        <Path
          d="M0 84 C90 62 170 70 250 86 C320 100 360 90 400 80 L400 120 L0 120 Z"
          fill={palette.nearHill}
        />
      </Svg>
      <PineTree
        palette={palette}
        size={78 * scale}
        star
        style={{ left: width * 0.03, bottom: hill * 0.3 }}
      />
      <Gifts
        size={52 * scale}
        style={{ left: width * 0.03 + 50 * scale, bottom: hill * 0.18 }}
      />
      <PineTree
        palette={palette}
        size={50 * scale}
        style={{ left: width * 0.03 + 98 * scale, bottom: hill * 0.26 }}
      />
      {width > 600 && (
        <PineTree
          palette={palette}
          size={58 * scale}
          style={{ left: width * 0.52, bottom: hill * 0.42 }}
        />
      )}
      <Snowman
        palette={palette}
        size={46 * scale}
        style={{ right: width * 0.05 + 70 * scale, bottom: hill * 0.2 }}
      />
      <PineTree
        palette={palette}
        size={66 * scale}
        style={{ right: width * 0.05, bottom: hill * 0.34 }}
      />
    </View>
  );
});

function PineTree({
  palette,
  size,
  star,
  style,
}: {
  palette: Palette;
  size: number;
  star?: boolean;
  style: StyleProp<ViewStyle>;
}) {
  return (
    <Svg
      style={[styles.prop, style]}
      width={size}
      height={size * 1.25}
      viewBox="0 0 80 100"
    >
      <Rect x="35" y="82" width="10" height="14" rx="2" fill={palette.trunk} />
      <Path d="M40 30 L70 84 L10 84 Z" fill={palette.tree[0]} />
      <Path d="M40 18 L63 60 L17 60 Z" fill={palette.tree[1]} />
      <Path d="M40 8 L56 38 L24 38 Z" fill={palette.tree[2]} />
      <Path
        d="M24 38 Q32 34 40 38 Q48 34 56 38 L52 31 L28 31 Z"
        fill={palette.snow}
      />
      <Path
        d="M17 60 Q28 55 40 60 Q52 55 63 60 L58 52 L22 52 Z"
        fill={palette.snow}
      />
      <Path
        d="M10 84 Q25 79 40 84 Q55 79 70 84 L66 77 L14 77 Z"
        fill={palette.snow}
      />
      <Circle cx="31" cy="70" r="3" fill={RED} />
      <Circle cx="50" cy="72" r="3" fill={GOLD} />
      <Circle cx="40" cy="64" r="2.5" fill="#6FA8DC" />
      <Circle cx="44" cy="48" r="2.5" fill={RED} />
      <Circle cx="34" cy="45" r="2.2" fill={GOLD} />
      <Circle cx="40" cy="27" r="2" fill="#6FA8DC" />
      {star && (
        <Path
          d="M40 0 L43 7 L50 7 L44 11 L46 18 L40 14 L34 18 L36 11 L30 7 L37 7 Z"
          fill={GOLD}
        />
      )}
    </Svg>
  );
}

function Snowman({
  palette,
  size,
  style,
}: {
  palette: Palette;
  size: number;
  style: StyleProp<ViewStyle>;
}) {
  return (
    <Svg
      style={[styles.prop, style]}
      width={size}
      height={size * (80 / 60)}
      viewBox="0 0 60 80"
    >
      <Path d="M18 52 L5 43" stroke="#8A6A58" strokeWidth="2" />
      <Path d="M42 52 L55 43" stroke="#8A6A58" strokeWidth="2" />
      <Circle
        cx="30"
        cy="60"
        r="18"
        fill={palette.snow}
        stroke={palette.shade}
      />
      <Circle
        cx="30"
        cy="32"
        r="12"
        fill={palette.snow}
        stroke={palette.shade}
      />
      <Rect x="19" y="18" width="22" height="4" rx="1" fill="#3B3A45" />
      <Rect x="23" y="4" width="14" height="15" rx="1" fill="#3B3A45" />
      <Rect x="23" y="15" width="14" height="3" fill={RED} />
      <Circle cx="26" cy="30" r="1.5" fill="#3B3A45" />
      <Circle cx="34" cy="30" r="1.5" fill="#3B3A45" />
      <Path d="M30 33 L40 35 L30 36 Z" fill="#F0964E" />
      <Path d="M19 42 Q30 47 41 42 L41 46 Q30 51 19 46 Z" fill={RED} />
      <Rect x="33" y="44" width="5" height="13" rx="2" fill={RED} />
      <Circle cx="30" cy="54" r="1.6" fill="#3B3A45" />
      <Circle cx="30" cy="62" r="1.6" fill="#3B3A45" />
    </Svg>
  );
}

function Gifts({ size, style }: { size: number; style: StyleProp<ViewStyle> }) {
  return (
    <Svg
      style={[styles.prop, style]}
      width={size}
      height={size * (44 / 70)}
      viewBox="0 0 70 44"
    >
      <Rect x="2" y="16" width="30" height="28" rx="2" fill={RED} />
      <Rect x="0" y="12" width="34" height="7" rx="2" fill="#C9504E" />
      <Rect x="14" y="12" width="6" height="32" fill={GOLD} />
      <Ellipse cx="12" cy="9" rx="6" ry="4" fill={GOLD} />
      <Ellipse cx="22" cy="9" rx="6" ry="4" fill={GOLD} />
      <Rect x="38" y="22" width="26" height="22" rx="2" fill="#6FA27A" />
      <Rect x="36" y="19" width="30" height="6" rx="2" fill="#5E8F69" />
      <Rect x="48" y="19" width="5" height="25" fill="#F7F3EA" />
      <Ellipse cx="46" cy="16" rx="5" ry="3.5" fill="#F7F3EA" />
      <Ellipse cx="55" cy="16" rx="5" ry="3.5" fill="#F7F3EA" />
    </Svg>
  );
}

// 별을 두 무리로 나눠 번갈아 밝아지게 한다.
function Stars({ size, reduced }: { size: Size; reduced: boolean }) {
  const [twinkle] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) {
      twinkle.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
        Animated.timing(twinkle, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [reduced, twinkle]);
  return (
    <>
      {[0, 1].map(group => (
        <Animated.View
          key={group}
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: twinkle.interpolate({
                inputRange: [0, 1],
                outputRange: group ? [0.35, 1] : [1, 0.35],
              }),
            },
          ]}
        >
          <Svg width={size.width} height={size.height}>
            {stars
              .filter((_, index) => index % 2 === group)
              .map((star, index) => (
                <Circle
                  key={index}
                  cx={star.x * size.width}
                  cy={star.y * size.height}
                  r={star.r}
                  fill="#FFFFFF"
                />
              ))}
          </Svg>
        </Animated.View>
      ))}
    </>
  );
}

const Snowflake = memo(function Snowflake({
  flake,
  size: { width, height },
  reduced,
  night,
}: {
  flake: (typeof flakes)[number];
  size: Size;
  reduced: boolean;
  night: boolean;
}) {
  const [progress] = useState(() => new Animated.Value(flake.start));
  useEffect(() => {
    if (reduced) {
      progress.setValue(flake.start);
      return;
    }
    let animation: Animated.CompositeAnimation | undefined;
    // 처음에는 각자 정해진 높이에서 출발해 화면이 비어 보이지 않게 하고, 그다음부터는 맨 위에서 다시 내린다.
    const fall = (from: number) => {
      progress.setValue(from);
      animation = Animated.timing(progress, {
        toValue: 1,
        duration: flake.duration * (1 - from),
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      });
      animation.start(({ finished }) => {
        if (finished) fall(0);
      });
    };
    fall(flake.start);
    return () => animation?.stop();
  }, [flake, progress, reduced]);
  return (
    <Animated.View
      style={[
        styles.flake,
        // 낮 하늘은 밝아서 테두리를 살짝 둘러야 눈송이가 보인다.
        !night && styles.flakeEdge,
        {
          left: flake.left * width,
          width: flake.size,
          height: flake.size,
          borderRadius: flake.size / 2,
          opacity: flake.opacity,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-flake.size * 2, height + flake.size],
              }),
            },
            {
              translateX: progress.interpolate({
                inputRange: [0, 0.25, 0.5, 0.75, 1],
                outputRange: [0, flake.sway, 0, -flake.sway, 0],
              }),
            },
          ],
        },
      ]}
    />
  );
});

const styles = StyleSheet.create({
  bottom: { position: 'absolute', left: 0, bottom: 0 },
  prop: { position: 'absolute' },
  flake: { position: 'absolute', top: 0, backgroundColor: '#FFFFFF' },
  flakeEdge: { borderWidth: 0.5, borderColor: 'rgba(150, 172, 194, 0.5)' },
});
