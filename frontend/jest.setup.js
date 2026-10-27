jest.mock('react-native-safe-area-context', () => {
  return {
    ...require('react-native-safe-area-context/jest/mock').default,
    SafeAreaView: require('react-native').View,
  };
});

// Native font loading is verified by Expo bundles; UI tests can render immediately.
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
}));

// The start screen's minimum display time would only slow every routed test down.
jest.mock('@/components/ui/Splash', () => ({
  ...jest.requireActual('@/components/ui/Splash'),
  SPLASH_MIN_MS: 0,
}));
