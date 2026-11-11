// 돌보기 화면이 쓰는 Reanimated API를 한곳에서 가져온다.
// Jest에서는 jest.setup.js가 이 모듈을 대신한다. expo-router/testing-library가 import될 때
// 'react-native-reanimated' 목을 덮어쓰기 때문에 패키지 이름으로는 목을 걸 수 없다.
export {
  default,
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
export type { SharedValue } from 'react-native-reanimated';
