import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (active) setReduced(value);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

export function MotionReveal({
  children,
  replayKey,
  ready = true,
  animate = true,
  pop = false,
  style,
}: {
  children: ReactNode;
  replayKey?: string;
  ready?: boolean;
  animate?: boolean;
  pop?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(ready ? 1 : 0));
  useEffect(() => {
    value.stopAnimation();
    if (!ready) {
      value.setValue(0);
      return;
    }
    if (reduced || !animate) {
      value.setValue(1);
      return;
    }
    value.setValue(0);
    const animation = pop
      ? Animated.spring(value, {
          toValue: 1,
          speed: 16,
          bounciness: 8,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        })
      : Animated.timing(value, {
          toValue: 1,
          duration: 260,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        });
    animation.start();
    return () => animation.stop();
  }, [animate, pop, ready, reduced, replayKey, value]);
  return (
    <Animated.View
      style={[
        style,
        pop
          ? {
              transform: [
                {
                  scale: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            }
          : { opacity: value },
      ]}
    >
      {children}
    </Animated.View>
  );
}
