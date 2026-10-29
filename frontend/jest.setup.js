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

// expo-video has no native player in Jest. This stand-in records play/seek calls and lets a
// test fire player events (timeUpdate, playToEnd) the way the real player would.
jest.mock('expo-video', () => {
  const React = require('react');
  const { View } = require('react-native');
  const players = [];
  const createPlayer = () => {
    const listeners = {};
    const player = {
      muted: false,
      loop: false,
      currentTime: 0,
      timeUpdateEventInterval: 0,
      status: 'readyToPlay',
      playing: false,
      play: jest.fn(() => {
        player.playing = true;
      }),
      pause: jest.fn(() => {
        player.playing = false;
      }),
      seekBy: jest.fn(seconds => {
        player.currentTime += seconds;
      }),
      replaceAsync: jest.fn(async source => {
        player.currentTime = 0;
        player.source = source;
        player.status = 'readyToPlay';
      }),
      release: jest.fn(),
      addListener: (name, listener) => {
        listeners[name] = listeners[name] || new Set();
        listeners[name].add(listener);
        return { remove: () => listeners[name].delete(listener) };
      },
      emit: (name, payload) =>
        (listeners[name] || new Set()).forEach(listener => listener(payload)),
    };
    players.push(player);
    return player;
  };
  return {
    __players: players,
    useVideoPlayer: (_source, setup) => {
      const [player] = React.useState(() => {
        const created = createPlayer();
        if (setup) setup(created);
        return created;
      });
      return player;
    },
    // A plain View: no JSX here, NativeWind's JSX transform can't run inside jest.mock.
    VideoView: View,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
beforeEach(() => {
  // Cache collection timers must not keep Jest alive after API queries finish.
  // Tests clear the cache explicitly; production query settings stay unchanged.
  const { queryClient } = require('@/services/queryClient');
  const options = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    ...options,
    queries: { ...options.queries, gcTime: Infinity },
  });
  require('@/stores/useAuthStore').useAuthStore.setState({
    status: 'signedOut',
    member: null,
    ticket: null,
    pending: false,
    error: '',
  });
});

// GET /meta runs at app start before any screen. Routed tests get a current, supported
// response by default; tests about meta failure or updates override fetchMeta.
jest.mock('@/services/metaApi', () => ({
  fetchMeta: jest.fn(async () => ({
    termsVersions: { TERMS: '1.0', PRIVACY: '1.0' },
    minSupportedVersion: '1.0.0',
    latestVersion: '1.0.0',
  })),
}));
