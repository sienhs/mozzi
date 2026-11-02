import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '@/components/ui/Motion';

// 캘린더 카드 윗변에 늘어뜨린 전구 줄. 카드 폭을 재서 처지는 마디 수를 정한다.
const COLORS = ['#D9625F', '#F2C14E', '#5FA36A', '#6FA8DC'];
const WIRE_Y = 4;
const DIP = 9;

export function ChristmasLights() {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
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
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
        Animated.timing(twinkle, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [reduced, twinkle]);
  const swags = Math.max(3, Math.round(width / 90));
  const span = width / swags;
  // 마디마다 2차 베지어로 처지고, 그 위 세 지점에 전구를 단다.
  const wire = Array.from(
    { length: swags },
    (_, index) =>
      `Q${span * (index + 0.5)} ${WIRE_Y + DIP * 2} ${span * (index + 1)} ${WIRE_Y}`,
  ).join(' ');
  const bulbs = Array.from({ length: swags }, (_, index) =>
    [0.25, 0.5, 0.75].map(t => ({
      x: span * (index + t),
      y: WIRE_Y + 2 * (1 - t) * t * DIP * 2,
    })),
  ).flat();
  return (
    <View
      pointerEvents="none"
      style={styles.strand}
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
    >
      {width > 0 && (
        <>
          <Svg width={width} height={30}>
            <Path
              d={`M0 ${WIRE_Y} ${wire}`}
              stroke="#6B7F6E"
              strokeWidth={1.5}
              fill="none"
            />
          </Svg>
          {[0, 1].map(group => (
            <Animated.View
              key={group}
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: twinkle.interpolate({
                    inputRange: [0, 1],
                    outputRange: group ? [0.45, 1] : [1, 0.45],
                  }),
                },
              ]}
            >
              {bulbs.map((bulb, index) => {
                if (index % 2 !== group) return null;
                const color = COLORS[index % COLORS.length];
                return (
                  <View
                    key={index}
                    style={[styles.bulb, { left: bulb.x - 4, top: bulb.y }]}
                  >
                    <View style={styles.cap} />
                    <View
                      style={[
                        styles.glass,
                        {
                          backgroundColor: color,
                          boxShadow: `0 0 6px ${color}`,
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </Animated.View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  strand: {
    position: 'absolute',
    top: -8,
    left: 18,
    right: 18,
    height: 30,
  },
  bulb: { position: 'absolute', width: 8, alignItems: 'center' },
  cap: { width: 4, height: 3, borderRadius: 1, backgroundColor: '#8A8F86' },
  glass: { width: 8, height: 11, borderRadius: 4 },
});
