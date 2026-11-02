import { setAuthPreview } from '@/mocks/authPreview';
import {
  act,
  cleanup,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import { router } from 'expo-router';
import { render } from '@testing-library/react-native';
import { StrictMode } from 'react';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import RootLayout from '@/app/_layout';
import Tabs from '@/app/(tabs)/_layout';
import Home from '@/app/(tabs)/home';
import Calendar from '@/app/(tabs)/calendar';
import Search from '@/app/(tabs)/search';
import Gacha from '@/app/(tabs)/gacha';
import MyPage from '@/app/(tabs)/mypage';
import Opening from '@/app/gacha/opening';
import Reveal from '@/app/gacha/reveal';
import Results from '@/app/gacha/results';
import Collection from '@/app/gacha/collection';
import Detail from '@/app/gacha/mochi/[id]';
import Exchange from '@/app/gacha/exchange';
import ExchangeConfirm from '@/app/gacha/exchange-confirm';
import Exchanged from '@/app/gacha/exchanged';
import Failed from '@/app/gacha/failed';
import { EmotionImage } from '@/components/emotion/Emotion';
import { Splash, splashArtwork } from '@/components/ui/Splash';
import { emotions } from '@/constants/emotions';
import {
  OPENING_CONTINUATION_SECONDS,
  OPENING_INTRO_SECONDS,
  openingClips,
} from '@/constants/gacha';
import { api } from '@/services/api';
import { gachaKeys } from '@/services/gachaApi';
import type { CollectionResponse } from '@/types/gacha';
import { queryClient } from '@/services/queryClient';
import { useGachaStore } from '@/stores/useGachaStore';
import {
  createFakeServer,
  fail,
  timeout,
  type FakeServer,
} from '../test-utils/fakeServer';

// Jest's default asset transformer maps every video to 1. Distinct IDs catch
// selecting the wrong file even when timing and navigation still look correct.
jest.mock('../assets/gacha/opening/intro.mp4', () => 100);
jest.mock('../assets/gacha/opening/base-continuation.mp4', () => 110);
jest.mock('../assets/gacha/opening/legend-continuation.mp4', () => 111);
jest.mock('../assets/gacha/opening/myth-continuation.mp4', () => 112);
jest.mock('@/services/authConfig', () => ({
  ...jest.requireActual('@/services/authConfig'),
  getApiBaseUrl: () => 'https://api.example.test/api/v1',
}));

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': Tabs,
  '(tabs)/home': Home,
  '(tabs)/calendar': Calendar,
  '(tabs)/search': Search,
  '(tabs)/gacha': Gacha,
  '(tabs)/mypage': MyPage,
  'gacha/opening': Opening,
  'gacha/reveal': Reveal,
  'gacha/results': Results,
  'gacha/collection': Collection,
  'gacha/mochi/[id]': Detail,
  'gacha/exchange': Exchange,
  'gacha/exchange-confirm': ExchangeConfirm,
  'gacha/exchanged': Exchanged,
  'gacha/failed': Failed,
};
// 카드 표 (test-utils/fakeServer): 201 수박(영웅) · 202 사과(일반) · 203 천도복숭아(전설, 200)
// · 204 딸기 왕관(신화, 400) · 205 체리(희귀).
const WATERMELON = 201;
const APPLE = 202;
const PEACH = 203;
const CROWN = 204;
const CHERRY = 205;
const INTRO = 100;
const CONTINUATION = { base: 110, legend: 111, myth: 112 } as const;
const advance = async (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
// The players the opening screen created (see the expo-video stand-in in jest.setup.js).
type FakePlayer = {
  play: jest.Mock;
  pause: jest.Mock;
  seekBy: jest.Mock;
  replaceAsync: jest.Mock;
  release: jest.Mock;
  playbackRate: number;
  muted: boolean;
  loop: boolean;
  currentTime: number;
  emit: (name: string, payload?: unknown) => void;
};
// The opening screen makes two players: the shared intro, then the tier's continuation.
// Strict Mode가 초기화 함수를 두 번 불러 버려진 플레이어는 건너뛴다.
const openingPlayers = (used = false) => {
  const players = (
    jest.requireMock('expo-video') as { __players: FakePlayer[] }
  ).__players.filter(player => !used || player.replaceAsync.mock.calls.length);
  return { intro: players.at(-2)!, continuation: players.at(-1)! };
};
const emit = (player: FakePlayer, name: string, payload?: unknown) =>
  act(async () => player.emit(name, payload));
// Lets the draw resolve and the intro start.
const settle = () => advance(10);
const touchArea = () =>
  screen.getByRole('button', { name: '모찌 볼을 당겨 깨우기' });
const still = () => screen.queryByTestId('opening-still')?.props.source;
// 입력 영역의 처리기를 직접 부른다. 같은 틱의 연속 입력을 렌더 없이 재현할 수 있다.
const call = (target: { props: object }, name: string, event?: unknown) =>
  (target.props as Record<string, (event?: unknown) => void>)[name](event);
const point = (pageX: number, pageY = 300) => ({
  nativeEvent: { pageX, pageY },
});
// 화면 어디든 한 번 톡 누른다(제자리에서 떼기).
async function tap(target = touchArea()) {
  await act(async () => {
    call(target, 'onResponderGrant', point(200));
    call(target, 'onResponderRelease', point(202));
  });
}
// 옆으로 끌었다가 놓는다.
async function drag(distance: number, target = touchArea()) {
  await act(async () => {
    call(target, 'onResponderGrant', point(200));
    call(target, 'onResponderMove', point(200 + distance / 2));
    call(target, 'onResponderMove', point(200 + distance));
    call(target, 'onResponderRelease', point(200 + distance));
  });
}
// intro 3초를 끝까지 틀고 입력 대기에 들어간다.
async function playIntro() {
  const { intro } = openingPlayers();
  await emit(intro, 'timeUpdate', { currentTime: 1.5 });
  await emit(intro, 'timeUpdate', { currentTime: OPENING_INTRO_SECONDS });
  await emit(intro, 'playToEnd');
}
// 대기 화면을 한 번 눌러 continuation 11초를 끝까지 튼다.
async function playThrough() {
  await playIntro();
  await tap();
  const { continuation } = openingPlayers();
  await emit(continuation, 'playingChange', { isPlaying: true });
  await emit(continuation, 'timeUpdate', {
    currentTime: OPENING_CONTINUATION_SECONDS,
  });
  await emit(continuation, 'playToEnd');
}
const wallet = () => useGachaStore.getState().wallet;
let server: FakeServer;
const draws = () => server.callsTo('POST', '/gacha/draws');
// 다음 뽑기 응답을 붙잡아 두었다가 원할 때 서버가 처리한 결과로 돌려준다.
function holdDraw() {
  let release!: () => void;
  server.next(
    'POST /gacha/draws',
    (call, config) =>
      new Promise(resolve => {
        release = () => resolve(server.process(call, config));
      }),
  );
  return () => release();
}
async function openApp(url: string) {
  const app = await renderRouter(routes, { initialUrl: url });
  await advance(0);
  return app;
}
// AppState 변화를 흉내 낸다. 개봉 화면이 등록한 처리기를 붙잡아 둔다.
function captureAppState() {
  const listeners = new Set<(state: AppStateStatus) => void>();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, listener) => {
      listeners.add(listener as (state: AppStateStatus) => void);
      return {
        remove: () => listeners.delete(listener as never),
      } as ReturnType<typeof AppState.addEventListener>;
    });
  return (state: AppStateStatus) =>
    act(async () => listeners.forEach(listener => listener(state)));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  // React Native's preset already mocks this method; restoreAllMocks does not
  // reset an existing mock's implementation after the reduced-motion test.
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  setAuthPreview();
  queryClient.clear();
  useGachaStore.getState().resetSession();
  server = createFakeServer('2026-10-28');
  server.state.tickets = 23;
  server.state.shards = 140;
  server.state.owned.set(APPLE, {
    count: 1,
    seen: true,
    at: '2026-10-20T09:00:00+09:00',
  });
  api.defaults.adapter = server.adapter;
});
afterEach(async () => {
  await cleanup();
  queryClient.clear();
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('a new single pull plays the intro, waits for one touch, plays the rest, then reveals', async () => {
  server.state.drawQueue = [WATERMELON];
  const app = await openApp('/gacha');
  expect(screen.getByText('뽑기권 23')).toBeOnTheScreen();
  // 뽑기 탭 상단에는 잔액만 두고 도감 바로가기는 두지 않는다.
  expect(screen.queryByRole('button', { name: '모찌 도감' })).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: '1장 · 뽑기권 1' }));
  expect(app.getPathname()).toBe('/gacha/opening');
  // 결과가 오기 전에는 시작 장면만 보인다.
  expect(still()).toBe(openingClips.base.start);
  await settle();
  expect(draws()).toHaveLength(1);
  expect(draws()[0].body).toEqual({ count: 1 });
  expect(draws()[0].key).toBeTruthy();
  const { intro, continuation } = openingPlayers();
  expect(intro.replaceAsync).toHaveBeenCalledWith(INTRO);
  expect(continuation.replaceAsync).toHaveBeenCalledWith(CONTINUATION.base);
  // 영웅도 일반·희귀와 같이 처음부터, 원래 속도로 튼다.
  expect(intro.play).toHaveBeenCalledTimes(1);
  expect(intro.seekBy).not.toHaveBeenCalled();
  expect(continuation.play).not.toHaveBeenCalled();
  for (const player of [intro, continuation]) {
    expect(player.playbackRate).toBe(1);
    expect(player.muted).toBe(true);
    expect(player.loop).toBe(false);
  }

  // intro의 첫 프레임이 그려지면 시작 이미지를 걷는다.
  expect(still()).toBe(openingClips.base.start);
  await act(async () =>
    call(screen.getByTestId('opening-intro-video'), 'onFirstFrameRender'),
  );
  expect(still()).toBeUndefined();

  await playIntro();
  expect(still()).toBe(openingClips.base.touch);
  expect(app.getPathname()).toBe('/gacha/opening');

  await tap();
  expect(continuation.play).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  // continuation이 실제로 그려지고 흐르기 전까지는 대기 장면을 그대로 둔다.
  expect(still()).toBe(openingClips.base.touch);
  await act(async () =>
    call(
      screen.getByTestId('opening-continuation-video'),
      'onFirstFrameRender',
    ),
  );
  expect(still()).toBe(openingClips.base.touch);
  await emit(continuation, 'playingChange', { isPlaying: true });
  expect(still()).toBeUndefined();

  // 11초 중간에는 결과로 넘어가지 않는다.
  await emit(continuation, 'timeUpdate', { currentTime: 10.9 });
  expect(app.getPathname()).toBe('/gacha/opening');
  await emit(continuation, 'playToEnd');

  expect(app.getPathname()).toBe('/gacha/reveal');
  expect(screen.getByText('수박 모찌')).toBeOnTheScreen();
  expect(wallet()).toEqual({ tickets: 22, shards: 140 });
  expect(draws()).toHaveLength(1);
});

test('the clips are 3 + 11 seconds of already-fast video played at normal speed', () => {
  expect(OPENING_INTRO_SECONDS + OPENING_CONTINUATION_SECONDS).toBe(14);
  // intro와 시작·대기 이미지는 세 등급이 같은 파일 하나를 쓴다.
  expect(openingClips.legend.intro).toBe(openingClips.base.intro);
  expect(openingClips.myth.intro).toBe(openingClips.base.intro);
  expect(openingClips.myth.start).toBe(openingClips.base.start);
  expect(openingClips.myth.touch).toBe(openingClips.base.touch);
  expect(openingClips.legend.end).not.toBe(openingClips.base.end);
});

const HINT = '화면을 톡! 모찌를 깨워 주세요';
const skipButton = () => screen.queryByRole('button', { name: '건너뛰기' });

test('the opening shows the skip button once the result is in, and the wake hint only while waiting', async () => {
  server.state.drawQueue = [WATERMELON];
  const release = holdDraw();
  await openApp('/gacha/opening?count=1');
  await settle();
  const check = () => {
    for (const text of [
      '손잡이를 톡, 돌려주세요',
      '오늘의 모찌',
      '전설',
      '신화',
    ])
      expect(screen.queryByText(text)).toBeNull();
    // 영상은 소스가 정해진 뒤에만 붙고, 붙으면 네이티브 컨트롤이 없다.
    for (const id of ['opening-intro-video', 'opening-continuation-video'])
      expect(screen.queryByTestId(id)?.props.nativeControls ?? false).toBe(
        false,
      );
  };
  // 결과 전에는 건너뛸 결과가 없다.
  check();
  expect(skipButton()).toBeNull();
  expect(screen.queryByText(HINT, { includeHiddenElements: true })).toBeNull();
  await act(async () => release());
  await settle();
  check();
  for (const id of ['opening-intro-video', 'opening-continuation-video'])
    expect(screen.getByTestId(id).props.nativeControls).toBe(false);
  expect(skipButton()).toBeOnTheScreen();
  // intro 중에는 안내가 없다.
  expect(screen.queryByText(HINT, { includeHiddenElements: true })).toBeNull();
  await playIntro();
  check();
  // 대기 중에는 떠 있는 안내와 이모지가 보인다. 터치를 막지 않고, 화면 읽기에는 입력 영역 이름으로 알린다.
  expect(
    screen.getByText(HINT, { includeHiddenElements: true }),
  ).toBeOnTheScreen();
  expect(
    screen.getByText('👆', { includeHiddenElements: true }),
  ).toBeOnTheScreen();
  expect(
    screen.getByTestId('opening-wake-hint', { includeHiddenElements: true })
      .props.pointerEvents,
  ).toBe('none');
  expect(touchArea()).toBeOnTheScreen();
  await tap();
  check();
  expect(screen.queryByText(HINT, { includeHiddenElements: true })).toBeNull();
  expect(skipButton()).toBeOnTheScreen();
});

test.each(['intro', 'awaitingInteraction', 'continuation'] as const)(
  'skipping during %s goes to the same result once without drawing again',
  async step => {
    server.state.drawQueue = [APPLE, CROWN];
    const app = await openApp('/gacha');
    const replace = jest.spyOn(router, 'replace');
    await act(async () => router.push('/gacha/opening?count=2'));
    await settle();
    replace.mockClear();
    const { intro, continuation } = openingPlayers();
    if (step !== 'intro') await playIntro();
    if (step === 'continuation') await tap();
    const skip = skipButton()!;
    await act(async () => {
      await fireEvent.press(skip);
      await fireEvent.press(skip);
    });
    await advance(30000);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/gacha/results');
    expect(app.getPathname()).toBe('/gacha/results');
    // 건너뛰기는 영상을 잇지 않는다.
    expect(continuation.play).toHaveBeenCalledTimes(
      step === 'continuation' ? 1 : 0,
    );
    expect(intro.pause).toHaveBeenCalled();
    expect(draws()).toHaveLength(1);
    expect(wallet()).toEqual({ tickets: 21, shards: 141 });
  },
);

test('a single duplicate returns home and lands its shards after the flight', async () => {
  server.state.drawQueue = [APPLE];
  const app = await openApp('/gacha');

  await fireEvent.press(screen.getByRole('button', { name: '1장 · 뽑기권 1' }));
  await settle();
  // 일반도 앞부분을 건너뛰지 않고 처음부터 튼다.
  expect(openingPlayers().intro.seekBy).not.toHaveBeenCalled();
  expect(openingPlayers().continuation.replaceAsync).toHaveBeenCalledWith(
    CONTINUATION.base,
  );
  await playThrough();

  expect(app.getPathname()).toBe('/gacha');
  expect(wallet()?.shards).toBe(140);
  await advance(2000);
  expect(wallet()).toEqual({ tickets: 22, shards: 141 });
  expect(useGachaStore.getState().pendingDuplicate).toBeNull();
  expect(screen.getByText('별조각 141')).toBeOnTheScreen();
});

test('a 10-pull starts sealed, opens one card, then opens the rest', async () => {
  server.state.drawQueue = [PEACH, ...Array(9).fill(APPLE)];
  const app = await openApp('/gacha');

  await fireEvent.press(
    screen.getByRole('button', { name: '10장 · 뽑기권 10' }),
  );
  await settle();
  // 10장 중 가장 높은 등급(전설)의 연출을 한 번 튼다.
  expect(openingPlayers().continuation.replaceAsync).toHaveBeenCalledWith(
    CONTINUATION.legend,
  );
  await playThrough();
  expect(app.getPathname()).toBe('/gacha/results');
  expect(screen.getByText('10장 뽑기 결과')).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: '열어보기' })).toHaveLength(10);

  await fireEvent.press(screen.getAllByRole('button', { name: '열어보기' })[0]);
  expect(
    screen.getByRole('button', { name: '천도복숭아 모찌 전설' }),
  ).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '남은 9장 모두 열기' }),
  );
  expect(screen.queryAllByRole('button', { name: '열어보기' })).toHaveLength(0);
  expect(wallet()).toEqual({ tickets: 13, shards: 149 });

  // 확인은 도감이 아니라 원래 뽑기 화면으로 돌아간다.
  await fireEvent.press(screen.getByRole('button', { name: '확인' }));
  await advance(0);
  expect(app.getPathname()).toBe('/gacha');
  expect(screen.getByText('뽑기권 13')).toBeOnTheScreen();
});

test('the home buttons follow the server ticket count', async () => {
  server.state.tickets = 3;
  await openApp('/gacha');
  expect(
    screen.getByRole('button', { name: '3장 · 뽑기권 3' }),
  ).toBeOnTheScreen();

  await act(async () =>
    useGachaStore.getState().setWallet({ tickets: 0, shards: 140 }),
  );
  expect(screen.getByRole('button', { name: '뽑기권 없음' })).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: '1장 · 뽑기권 1' }),
  ).not.toBeOnTheScreen();
});

test('a refused pull keeps the tickets and the retry sends the same key', async () => {
  server.next('POST /gacha/draws', (_call, config) =>
    fail(config, 503, 'GACHA_UNAVAILABLE', {
      message: '지금은 뽑기를 할 수 없어요. 잠시 후에 다시 시도해 주세요.',
    }),
  );
  server.state.drawQueue = [WATERMELON];
  const app = await openApp('/gacha');

  await fireEvent.press(screen.getByRole('button', { name: '1장 · 뽑기권 1' }));
  await settle();

  // 실패면 개봉 영상을 틀지 않고 바로 안내한다.
  expect(openingPlayers().intro.play).not.toHaveBeenCalled();
  expect(openingPlayers().intro.replaceAsync).not.toHaveBeenCalled();
  expect(app.getPathname()).toBe('/gacha/failed');
  expect(screen.getByText('뽑기권은 사용되지 않았어요.')).toBeOnTheScreen();
  expect(
    screen.getByText(
      '지금은 뽑기를 할 수 없어요. 잠시 후에 다시 시도해 주세요.',
    ),
  ).toBeOnTheScreen();
  expect(server.state.tickets).toBe(23);

  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  await settle();
  await playThrough();
  expect(app.getPathname()).toBe('/gacha/reveal');
  expect(draws()[1].key).toBe(draws()[0].key);
  expect(server.state.tickets).toBe(22);
});

test('a pull whose answer was lost is not called a failure of spent tickets, and the retry gets the same result', async () => {
  server.next('POST /gacha/draws', (call, config) => {
    server.process(call, config);
    timeout(config);
  });
  server.state.drawQueue = [WATERMELON, CROWN];
  const app = await openApp('/gacha');
  await fireEvent.press(screen.getByRole('button', { name: '1장 · 뽑기권 1' }));
  await settle();
  expect(app.getPathname()).toBe('/gacha/failed');
  expect(screen.queryByText('뽑기권은 사용되지 않았어요.')).toBeNull();
  expect(screen.getByText(/뽑기 결과를 확인하지 못했어요/)).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  await settle();
  await playThrough();
  // 서버가 이미 처리한 뽑기의 결과(수박)를 받고, 뽑기권은 한 번만 썼다.
  expect(screen.getByText('수박 모찌')).toBeOnTheScreen();
  expect(server.state.tickets).toBe(22);
  expect(server.state.drawQueue).toEqual([CROWN]);
});

test('waiting for the touch never times out, however long it takes', async () => {
  server.state.drawQueue = [WATERMELON];
  const app = await openApp('/gacha/opening?count=1');
  await settle();
  await playIntro();
  await advance(10 * 60 * 1000);
  expect(app.getPathname()).toBe('/gacha/opening');
  expect(still()).toBe(openingClips.base.touch);
  expect(openingPlayers().continuation.play).not.toHaveBeenCalled();
  await tap();
  expect(openingPlayers().continuation.play).toHaveBeenCalledTimes(1);
});

test('touching during the intro neither skips nor starts the rest early', async () => {
  server.state.drawQueue = [WATERMELON];
  const app = await openApp('/gacha/opening?count=1');
  await settle();
  const { intro, continuation } = openingPlayers();
  expect(intro.play).toHaveBeenCalledTimes(1);
  const pausesBefore = intro.pause.mock.calls.length;
  const area = screen.getByLabelText('모찌 개봉 중');
  await tap(area);
  await drag(120, area);
  await act(async () => call(area, 'onAccessibilityTap'));
  await emit(intro, 'timeUpdate', { currentTime: 1 });
  await tap(area);
  expect(continuation.play).not.toHaveBeenCalled();
  expect(intro.pause).toHaveBeenCalledTimes(pausesBefore);
  expect(app.getPathname()).toBe('/gacha/opening');
  expect(
    screen.queryByRole('button', { name: '모찌 볼을 당겨 깨우기' }),
  ).toBeNull();

  await emit(intro, 'playToEnd');
  expect(touchArea()).toBeOnTheScreen();
  expect(continuation.play).not.toHaveBeenCalled();
});

test('a sideways drag of about 36 points continues; a shorter drag or a vertical swipe does not', async () => {
  server.state.drawQueue = [WATERMELON];
  await openApp('/gacha/opening?count=1');
  await settle();
  await playIntro();
  const { continuation } = openingPlayers();
  await drag(30);
  expect(continuation.play).not.toHaveBeenCalled();
  await act(async () => {
    call(touchArea(), 'onResponderGrant', point(200, 300));
    call(touchArea(), 'onResponderMove', point(205, 380));
    call(touchArea(), 'onResponderRelease', point(205, 380));
  });
  expect(continuation.play).not.toHaveBeenCalled();

  // 손을 떼기 전, 36을 넘는 순간 바로 잇는다.
  const area = touchArea();
  await act(async () => {
    call(area, 'onResponderGrant', point(200));
    call(area, 'onResponderMove', point(164));
  });
  expect(continuation.play).toHaveBeenCalledTimes(1);
});

test('rapid taps, a double tap, a drag and its release start the rest once and finish once', async () => {
  server.state.drawQueue = [APPLE, CROWN];
  const app = await openApp('/gacha');
  const replace = jest.spyOn(router, 'replace');
  await act(async () => router.push('/gacha/opening?count=2'));
  await settle();
  replace.mockClear();
  await playIntro();
  const { continuation } = openingPlayers();
  const area = touchArea();
  await act(async () => {
    // 같은 틱 안의 연속 입력: 상태 반영을 기다리지 않고 첫 입력에서 잠긴다.
    call(area, 'onResponderGrant', point(200));
    call(area, 'onResponderRelease', point(200));
    call(area, 'onResponderGrant', point(200));
    call(area, 'onResponderRelease', point(200));
    call(area, 'onResponderGrant', point(200));
    call(area, 'onResponderMove', point(260));
    call(area, 'onResponderRelease', point(260));
    call(area, 'onAccessibilityTap');
  });
  await tap(screen.getByLabelText('모찌 개봉 중'));
  expect(continuation.play).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

  await emit(continuation, 'playingChange', { isPlaying: true });
  await act(async () => {
    continuation.emit('playToEnd');
    continuation.emit('playToEnd');
  });
  await advance(30000);
  expect(replace).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledWith('/gacha/results');
  expect(app.getPathname()).toBe('/gacha/results');
  expect(draws()).toHaveLength(1);
  expect(wallet()).toEqual({ tickets: 21, shards: 141 });
});

test('a stalled video still reaches the result after showing a still frame', async () => {
  server.state.drawQueue = [WATERMELON];
  const app = await openApp('/gacha/opening?count=1');
  await settle();
  // intro가 시작했지만 전혀 진행하지 않는다.
  await advance(7900);
  expect(app.getPathname()).toBe('/gacha/opening');
  await advance(200);
  expect(app.getPathname()).toBe('/gacha/reveal');
  expect(draws()).toHaveLength(1);
});

test('a missed intro end event still waits for the touch instead of giving up', async () => {
  server.state.drawQueue = [WATERMELON];
  const app = await openApp('/gacha/opening?count=1');
  await settle();
  const { intro, continuation } = openingPlayers();
  intro.currentTime = OPENING_INTRO_SECONDS;
  await emit(intro, 'timeUpdate', { currentTime: OPENING_INTRO_SECONDS });
  await advance(9000);
  expect(app.getPathname()).toBe('/gacha/opening');
  expect(still()).toBe(openingClips.base.touch);
  await tap();
  expect(continuation.play).toHaveBeenCalledTimes(1);
});

test('a stalled continuation finishes once, without drawing again', async () => {
  server.state.drawQueue = [WATERMELON];
  const app = await openApp('/gacha/opening?count=1');
  await settle();
  await playIntro();
  await tap();
  const { continuation } = openingPlayers();
  // 진행하는 동안은 멈춤으로 보지 않는다.
  for (let second = 1; second <= 6; second++) {
    await advance(5000);
    await emit(continuation, 'timeUpdate', { currentTime: second });
  }
  expect(app.getPathname()).toBe('/gacha/opening');
  await advance(8000);
  expect(app.getPathname()).toBe('/gacha/reveal');
  expect(draws()).toHaveLength(1);
});

test('a playback error keeps the awarded result and does not draw again', async () => {
  server.state.drawQueue = [PEACH];
  const app = await openApp('/gacha/opening?count=1');
  await settle();
  await playIntro();
  await tap();
  await emit(openingPlayers().continuation, 'statusChange', {
    status: 'error',
    error: { message: 'decoder failed' },
  });
  expect(app.getPathname()).toBe('/gacha/reveal');
  expect(draws()).toHaveLength(1);
  expect(server.state.tickets).toBe(22);
});

test('reduced motion skips the opening video and moves on once', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  server.state.drawQueue = [WATERMELON];
  const app = await openApp('/gacha');

  await fireEvent.press(screen.getByRole('button', { name: '1장 · 뽑기권 1' }));
  await settle();

  const { intro, continuation } = openingPlayers();
  for (const player of [intro, continuation]) {
    expect(player.play).not.toHaveBeenCalled();
    expect(player.replaceAsync).not.toHaveBeenCalled();
  }
  expect(app.getPathname()).toBe('/gacha/reveal');
  await advance(30000);
  expect(app.getPathname()).toBe('/gacha/reveal');
  expect(draws()).toHaveLength(1);
});

test('going to the background pauses the video and returning resumes the same step', async () => {
  const setAppState = captureAppState();
  server.state.drawQueue = [WATERMELON];
  const app = await openApp('/gacha/opening?count=1');
  await settle();
  const { intro, continuation } = openingPlayers();
  expect(intro.play).toHaveBeenCalledTimes(1);

  // intro 도중: 멈추고, 돌아오면 그 자리에서 잇는다. 백그라운드에 있는 동안은 멈춤 감시도 쉰다.
  await setAppState('background');
  expect(intro.pause).toHaveBeenCalled();
  await advance(60000);
  expect(app.getPathname()).toBe('/gacha/opening');
  await setAppState('active');
  expect(intro.play).toHaveBeenCalledTimes(2);
  expect(intro.seekBy).not.toHaveBeenCalled();

  // 입력 대기 중: 돌아와도 후반부를 저절로 시작하지 않는다.
  await playIntro();
  await setAppState('background');
  await advance(60000);
  await setAppState('active');
  expect(continuation.play).not.toHaveBeenCalled();
  expect(still()).toBe(openingClips.base.touch);

  // continuation 도중.
  await tap();
  expect(continuation.play).toHaveBeenCalledTimes(1);
  await setAppState('background');
  expect(continuation.pause).toHaveBeenCalled();
  await advance(60000);
  expect(app.getPathname()).toBe('/gacha/opening');
  await setAppState('active');
  expect(continuation.play).toHaveBeenCalledTimes(2);
  await emit(continuation, 'playToEnd');
  expect(app.getPathname()).toBe('/gacha/reveal');
});

test('a draw that lands while the app is in the background waits to start the intro', async () => {
  const setAppState = captureAppState();
  server.state.drawQueue = [WATERMELON];
  const release = holdDraw();
  await openApp('/gacha/opening?count=1');
  await settle();
  await setAppState('background');
  await act(async () => release());
  await settle();
  const { intro } = openingPlayers();
  expect(intro.replaceAsync).toHaveBeenCalledWith(INTRO);
  expect(intro.play).not.toHaveBeenCalled();
  await setAppState('active');
  expect(intro.play).toHaveBeenCalledTimes(1);
});

test.each([2, 3, 4, 5, 6, 7, 8, 9, 10])(
  'a %i-pull plays one highest-tier opening then reveals every card without drawing again',
  async count => {
    const mythic = count % 2 === 1;
    server.state.drawQueue = [
      ...Array(count - 1).fill(APPLE),
      mythic ? CROWN : PEACH,
    ];
    await openApp('/gacha');
    const app = await renderRouter(routes, {
      initialUrl: `/gacha/opening?count=${count}`,
    });
    await settle();
    const { intro, continuation } = openingPlayers();
    expect(draws()).toHaveLength(1);
    expect(draws()[0].body).toEqual({ count });
    expect(intro.replaceAsync).toHaveBeenCalledTimes(1);
    expect(continuation.replaceAsync).toHaveBeenCalledTimes(1);
    expect(continuation.replaceAsync).toHaveBeenCalledWith(
      mythic ? CONTINUATION.myth : CONTINUATION.legend,
    );
    await playThrough();
    expect(intro.play).toHaveBeenCalledTimes(1);
    expect(continuation.play).toHaveBeenCalledTimes(1);
    expect(app.getPathname()).toBe('/gacha/results');
    expect(screen.getAllByRole('button', { name: '열어보기' })).toHaveLength(
      count,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: `남은 ${count}장 모두 열기` }),
    );
    expect(screen.queryAllByRole('button', { name: '열어보기' })).toHaveLength(
      0,
    );
    expect(draws()).toHaveLength(1);
    expect(wallet()).toEqual({ tickets: 23 - count, shards: 140 + count - 1 });
    expect(useGachaStore.getState().lastPull.map(item => item.isNew)).toEqual([
      ...Array(count - 1).fill(false),
      true,
    ]);
  },
);

test.each([
  { cardId: APPLE, tier: 'common', clip: 'base' },
  { cardId: CHERRY, tier: 'rare', clip: 'base' },
  { cardId: WATERMELON, tier: 'epic', clip: 'base' },
  { cardId: PEACH, tier: 'legend', clip: 'legend' },
  { cardId: CROWN, tier: 'myth', clip: 'myth' },
] as const)(
  'a $tier card plays the $clip opening from the start',
  async ({ cardId, clip }) => {
    server.state.drawQueue = [cardId];
    await openApp('/gacha');
    await renderRouter(routes, { initialUrl: '/gacha/opening?count=1' });
    await settle();
    const { intro, continuation } = openingPlayers();
    expect(intro.replaceAsync).toHaveBeenCalledWith(INTRO);
    expect(continuation.replaceAsync).toHaveBeenCalledWith(CONTINUATION[clip]);
    expect(intro.seekBy).not.toHaveBeenCalled();
    await playIntro();
    await tap();
    await emit(continuation, 'playingChange', { isPlaying: true });
    await act(async () =>
      call(
        screen.getByTestId('opening-continuation-video'),
        'onFirstFrameRender',
      ),
    );
    await emit(continuation, 'timeUpdate', { currentTime: 10.9 });
    // 마지막 눈빛 장면 전에 끊지 않는다.
    expect(screen.getByTestId('opening-continuation-video')).toBeOnTheScreen();
    expect(still()).toBeUndefined();
  },
);

test('video load failure keeps the awarded result and does not draw again', async () => {
  server.state.drawQueue = [PEACH];
  const release = holdDraw();
  const app = await openApp('/gacha/opening?count=1');
  await settle();
  openingPlayers().continuation.replaceAsync.mockRejectedValueOnce(
    new Error('video unavailable'),
  );
  await act(async () => release());
  await settle();
  expect(app.getPathname()).toBe('/gacha/reveal');
  expect(draws()).toHaveLength(1);
  expect(server.state.tickets).toBe(22);
  expect(server.state.owned.has(PEACH)).toBe(true);
});

test('touching before the result neither draws again nor starts a video', async () => {
  server.state.drawQueue = [CROWN];
  const release = holdDraw();
  const app = await openApp('/gacha/opening?count=1');
  await settle();
  const { intro, continuation } = openingPlayers();
  const area = screen.getByLabelText('모찌 개봉 중');
  await tap(area);
  await drag(80, area);
  expect(app.getPathname()).toBe('/gacha/opening');
  expect(intro.replaceAsync).not.toHaveBeenCalled();
  expect(still()).toBe(openingClips.base.start);
  await act(async () => release());
  await settle();
  expect(continuation.replaceAsync).toHaveBeenCalledWith(CONTINUATION.myth);
  expect(continuation.play).not.toHaveBeenCalled();
  expect(draws()).toHaveLength(1);
  expect(server.state.tickets).toBe(22);
});

test('leaving the opening early never plays or navigates later', async () => {
  let resolveVideo!: () => void;
  server.state.drawQueue = [CROWN];
  const release = holdDraw();
  const app = await openApp('/gacha');
  await act(async () => router.push('/gacha/opening?count=1'));
  await settle();
  const { intro } = openingPlayers();
  intro.replaceAsync.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        resolveVideo = resolve;
      }),
  );
  await act(async () => release());
  await settle();
  await act(async () => router.back());
  await advance(0);
  expect(app.getPathname()).toBe('/gacha');
  await act(async () => resolveVideo());
  await advance(30000);
  expect(intro.play).not.toHaveBeenCalled();
  expect(app.getPathname()).toBe('/gacha');
  // 결과는 이미 확정돼 저장됐다.
  expect(useGachaStore.getState().lastPull[0].card.cardId).toBe(CROWN);
  expect(draws()).toHaveLength(1);
});

test('Strict Mode effect replays neither draw twice nor drop the answer', async () => {
  server.state.drawQueue = [WATERMELON];
  const app = await renderRouter(routes, {
    initialUrl: '/gacha/opening?count=1',
    wrapper: StrictMode,
  });
  await settle();
  expect(draws()).toHaveLength(1);
  const { intro, continuation } = openingPlayers(true);
  expect(intro.replaceAsync).toHaveBeenCalledTimes(1);
  expect(continuation.replaceAsync).toHaveBeenCalledTimes(1);
  expect(intro.play).toHaveBeenCalledTimes(1);
  await act(async () => intro.emit('playToEnd'));
  await tap();
  await act(async () => continuation.emit('playToEnd'));
  expect(continuation.play).toHaveBeenCalledTimes(1);
  expect(app.getPathname()).toBe('/gacha/reveal');
  expect(server.state.tickets).toBe(22);
});

test('the odds sheet shows the server rates for every tier', async () => {
  await openApp('/gacha');
  await fireEvent.press(screen.getByRole('button', { name: '확률 보기' }));
  await advance(0);

  expect(screen.getByText('등급별 획득 확률')).toBeOnTheScreen();
  for (const rate of ['45%', '30%', '17%', '7%', '1%'])
    expect(screen.getByText(rate)).toBeOnTheScreen();
  expect(screen.getByText('+40')).toBeOnTheScreen();
});

test('the collection hides missing cards and viewing a new card clears its NEW mark', async () => {
  server.state.owned.set(WATERMELON, {
    count: 1,
    seen: false,
    at: '2026-10-27T09:00:00+09:00',
  });
  const app = await openApp('/gacha/collection');
  expect(screen.getByText('모은 모찌 2 / 5')).toBeOnTheScreen();
  expect(
    screen.getAllByRole('button', { name: '아직 못 만난 모찌' }),
  ).toHaveLength(3);
  expect(screen.getByText('NEW')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '미보유' }));
  expect(screen.queryByRole('button', { name: '수박 모찌 영웅' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '보유' }));
  expect(
    screen.queryAllByRole('button', { name: '아직 못 만난 모찌' }),
  ).toHaveLength(0);
  // 컨셉(시리즈) 칩은 없고 등급 칩으로만 거른다.
  expect(screen.queryByRole('button', { name: '과일 모찌' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '영웅' }));
  expect(
    screen.getByRole('button', { name: '수박 모찌 영웅' }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '영웅' }));
  await fireEvent.press(screen.getByRole('button', { name: '전체' }));
  await fireEvent.press(screen.getByRole('button', { name: '수박 모찌 영웅' }));
  await advance(0);
  expect(app.getPathname()).toBe(`/gacha/mochi/${WATERMELON}`);
  expect(
    server.callsTo('POST', '/gacha/collection/seen').map(call => call.body),
  ).toEqual([{ cardIds: [WATERMELON] }]);
  expect(server.state.owned.get(WATERMELON)?.seen).toBe(true);
});

test('the album shows tier then Korean name order without reordering the shared server cache', async () => {
  server.state.cards.push({
    cardId: 206,
    code: 'S2-99-01',
    name: '귤 모찌',
    tier: 'COMMON',
    emotion: 'CALM',
    exchangeCost: null,
  });
  for (const cardId of [PEACH, 206])
    server.state.owned.set(cardId, {
      count: 1,
      seen: true,
      at: '2026-10-20T09:00:00+09:00',
    });
  await openApp('/gacha/collection');
  const labels = ['천도복숭아 모찌 전설', '귤 모찌 일반', '사과 모찌 일반'];
  expect(
    screen
      .getAllByRole('button')
      .map(button => button.props.accessibilityLabel)
      .filter(label => labels.includes(label)),
  ).toEqual(labels);
  const cached = queryClient.getQueryData<CollectionResponse>(
    gachaKeys.collection(0),
  );
  expect(
    cached?.cards.filter(card => card.tier === 'common').map(card => card.name),
  ).toEqual(['사과 모찌', '귤 모찌']);
});

test('shards buy a missing legend card with the server price', async () => {
  server.state.shards = 250;
  const app = await openApp('/gacha/collection');
  await fireEvent.press(
    screen.getByRole('button', { name: '✦ 250  ·  별조각으로 모찌 만나기' }),
  );
  await advance(0);
  expect(screen.getByText('필요한 별조각 200')).toBeOnTheScreen();
  // 신화는 400이라 아직 바꿀 수 없다.
  expect(
    screen.getByRole('button', { name: '별조각이 부족해요' }),
  ).toBeDisabled();
  await fireEvent.press(
    screen.getByRole('button', { name: '천도복숭아 모찌 교환   ✦ 200' }),
  );
  await advance(0);
  expect(screen.getByText('−200')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '교환하기' }));
  await advance(0);

  expect(app.getPathname()).toBe('/gacha/exchanged');
  expect(screen.getByText('새로운 만남')).toBeOnTheScreen();
  await advance(0);
  expect(screen.getByText('✦ 50')).toBeOnTheScreen();
  const [exchange] = server.callsTo('POST', '/gacha/exchanges');
  expect(exchange.body).toEqual({ cardId: PEACH });
  expect(exchange.key).toBeTruthy();
  expect(server.state.owned.has(PEACH)).toBe(true);
});

test('a refused exchange shows the server reason and keeps the shards', async () => {
  server.state.shards = 250;
  server.next('POST /gacha/exchanges', (_call, config) =>
    fail(config, 409, 'NOT_ENOUGH_SHARDS', { message: '별조각이 부족해요.' }),
  );
  const app = await openApp(`/gacha/exchange-confirm?id=${PEACH}`);
  await fireEvent.press(screen.getByRole('button', { name: '교환하기' }));
  await advance(0);
  expect(app.getPathname()).toBe('/gacha/exchange-confirm');
  expect(screen.getByText('별조각이 부족해요.')).toBeOnTheScreen();
  expect(server.state.shards).toBe(250);
});

test('the tab bar switches between the five tabs', async () => {
  const app = await openApp('/home');
  for (const [label, path] of [
    ['캘린더', '/calendar'],
    ['감정 검색', '/search'],
    ['뽑기', '/gacha'],
    ['마이페이지', '/mypage'],
    ['홈', '/home'],
  ]) {
    await fireEvent.press(screen.getByRole('tab', { name: label }));
    expect(app.getPathname()).toBe(path);
    expect(screen.getByRole('tab', { name: label })).toBeSelected();
  }
});

test('the splash shows only the full-screen diary artwork', async () => {
  await render(<Splash />);
  const splash = screen.getByLabelText('오늘의 모찌를 여는 중');
  expect(splash.children).toHaveLength(1);
  expect(splash.children[0]).toMatchObject({
    type: 'Image',
    props: { source: splashArtwork, resizeMode: 'cover' },
  });
  expect(screen.queryByText('오늘의 모찌')).toBeNull();
  expect(screen.queryByText('하루의 장면을 오래도록')).toBeNull();
  expect(splash).toHaveStyle({
    flex: 1,
    backgroundColor: '#FAF7F2',
  });
});

test('small emotion faces use the transparent Figma face', async () => {
  await render(
    <>
      <EmotionImage emotion="calm" size={28} />
      <EmotionImage emotion="happy" size={64} />
    </>,
  );
  expect(screen.getByLabelText('평온 모찌').props.source).toBe(
    emotions.calm.face,
  );
  expect(screen.getByLabelText('행복 모찌').props.source).toBe(
    emotions.happy.source,
  );
});
