jest.mock('react-native-safe-area-context', () => {
  return {
    ...require('react-native-safe-area-context/jest/mock').default,
    SafeAreaView: require('react-native').View,
  };
});

// Only the mochi care screen uses Reanimated, through src/features/care/reanimated.ts. Jest has
// no worklet runtime and expo-router/testing-library replaces any 'react-native-reanimated'
// mock on import, so this stand-in replaces that local module with just the API the screen
// uses. Animations jump to their target; the care scene math is tested directly.
jest.mock('./src/features/care/reanimated', () => {
  const { View } = require('react-native');
  const shared = initial => {
    const box = { value: initial };
    box.get = () => box.value;
    box.set = next => {
      box.value = typeof next === 'function' ? next(box.value) : next;
    };
    return box;
  };
  const target = value => value;
  const Animated = {
    View,
    createAnimatedComponent: component => component,
  };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: initial =>
      require('react').useState(() => shared(initial))[0],
    useDerivedValue: updater => ({ value: updater(), get: updater }),
    useAnimatedStyle: updater => updater(),
    useAnimatedProps: updater => updater(),
    withTiming: target,
    withSpring: target,
    withRepeat: animation => animation,
    withSequence: (...steps) => steps[steps.length - 1],
    cancelAnimation: () => undefined,
    Easing: { linear: t => t },
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
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

// expo-notifications has no native module in Jest. Permissions and the FCM token are plain mocks a
// test can override; listeners are recorded so a test can deliver a notification.
jest.mock('expo-notifications', () => {
  const listeners = { token: new Set(), received: new Set() };
  const subscribe = set => listener => {
    set.add(listener);
    return { remove: () => set.delete(listener) };
  };
  return {
    __listeners: listeners,
    AndroidImportance: { HIGH: 4 },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    getPermissionsAsync: jest.fn(async () => ({
      granted: true,
      canAskAgain: true,
    })),
    requestPermissionsAsync: jest.fn(async () => ({
      granted: true,
      canAskAgain: true,
    })),
    getDevicePushTokenAsync: jest.fn(async () => ({
      type: 'android',
      data: 'fcm-token-1',
    })),
    addPushTokenListener: jest.fn(subscribe(listeners.token)),
    addNotificationReceivedListener: jest.fn(subscribe(listeners.received)),
    useLastNotificationResponse: jest.fn(() => null),
    clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// 그림 저장·공유: 내려받기는 대상 파일을 그대로 돌려주고, 공유·사진 저장은 호출만 기록한다.
jest.mock('expo-file-system', () => {
  const join = parts =>
    parts.map(part => (typeof part === 'string' ? part : part.uri)).join('/');
  class Directory {
    constructor(...parts) {
      this.uri = join(parts);
      this.exists = true;
    }
    create() {}
  }
  class File {
    constructor(...parts) {
      this.uri = join(parts);
    }
  }
  File.downloadFileAsync = jest.fn(async (_url, target) => target);
  return { Directory, File, Paths: { cache: { uri: 'file:///cache' } } };
});
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-media-library/legacy', () => ({
  requestPermissionsAsync: jest.fn(async () => ({
    granted: true,
    canAskAgain: true,
    status: 'granted',
  })),
  saveToLibraryAsync: jest.fn(async () => undefined),
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
// 약관 본문(GET /legal/*). 버전은 위 메타와 같은 1.0이다.
jest.mock('@/services/legalApi', () => ({
  ...jest.requireActual('@/services/legalApi'),
  fetchLegal: jest.fn(async type => ({
    type,
    version: '1.0',
    title: type === 'TERMS' ? '이용약관' : '개인정보 처리방침',
    body: `# ${type === 'TERMS' ? '이용약관' : '개인정보 처리방침'}\n\n본문`,
  })),
}));
