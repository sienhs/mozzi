import { setAuthPreview } from '@/mocks/authPreview';
import {
  act,
  cleanup,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import { render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
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
import { api } from '@/services/api';
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
jest.mock('../assets/gacha/opening-myth.mp4', () => 101);
jest.mock('../assets/gacha/opening-legend.mp4', () => 102);
jest.mock('../assets/gacha/opening-mythic.mp4', () => 103);
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
const advance = async (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
// The latest player the opening screen created (see the expo-video stand-in in jest.setup.js).
type FakePlayer = {
  play: jest.Mock;
  pause: jest.Mock;
  seekBy: jest.Mock;
  replaceAsync: jest.Mock;
  emit: (name: string, payload?: unknown) => void;
};
const openingPlayer = () =>
  (jest.requireMock('expo-video') as { __players: FakePlayer[] }).__players.at(
    -1,
  )!;
// Lets the draw resolve and the opening video start.
const settle = () => advance(10);
// The white flash before the result screen lasts 140 ms.
const afterFlash = () => advance(300);
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

test('a new single pull opens, reveals the server card, and spends one ticket', async () => {
  server.state.drawQueue = [WATERMELON];
  const app = await openApp('/gacha');
  expect(screen.getByText('뽑기권 23')).toBeOnTheScreen();
  expect(screen.getByText('도감 1 / 5')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '1장 · 뽑기권 1' }));
  expect(app.getPathname()).toBe('/gacha/opening');
  await settle();
  expect(draws()).toHaveLength(1);
  expect(draws()[0].body).toEqual({ count: 1 });
  expect(draws()[0].key).toBeTruthy();
  const player = openingPlayer();
  expect(player.replaceAsync).toHaveBeenCalledWith(101);
  // 영웅 이상은 영상을 처음부터 튼다.
  expect(player.play).toHaveBeenCalled();
  expect(player.seekBy).not.toHaveBeenCalled();

  // 영상의 진동 시점과 빛이 터지는 4.6초.
  await act(async () => {
    for (const currentTime of [1.5, 3.0, 3.38]) {
      player.emit('timeUpdate', { currentTime });
    }
  });
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(3);
  expect(app.getPathname()).toBe('/gacha/opening');
  await act(async () => player.emit('timeUpdate', { currentTime: 4.6 }));
  await afterFlash();

  expect(app.getPathname()).toBe('/gacha/reveal');
  expect(screen.getByText('수박 모찌')).toBeOnTheScreen();
  expect(wallet()).toEqual({ tickets: 22, shards: 140 });
});

test('a single duplicate returns home and lands its shards after the flight', async () => {
  server.state.drawQueue = [APPLE];
  const app = await openApp('/gacha');

  await fireEvent.press(screen.getByRole('button', { name: '1장 · 뽑기권 1' }));
  await settle();
  // 일반·희귀만 나오면 떨림 구간을 건너뛰고 3초부터 튼다.
  expect(openingPlayer().seekBy).toHaveBeenCalledWith(3);
  await fireEvent.press(screen.getByRole('button', { name: '건너뛰기' }));
  await afterFlash();

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
  // 10장 중 가장 높은 등급(전설) 기준으로 처음부터 튼다.
  expect(openingPlayer().replaceAsync).toHaveBeenCalledWith(102);
  expect(openingPlayer().seekBy).not.toHaveBeenCalled();
  await act(async () => openingPlayer().emit('playToEnd'));
  await afterFlash();
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

  await fireEvent.press(
    screen.getByRole('button', { name: '확인 · 도감으로' }),
  );
  expect(app.getPathname()).toBe('/gacha/collection');
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
  expect(openingPlayer().play).not.toHaveBeenCalled();
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
  await fireEvent.press(screen.getByRole('button', { name: '건너뛰기' }));
  await afterFlash();
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
  await fireEvent.press(screen.getByRole('button', { name: '건너뛰기' }));
  await afterFlash();
  // 서버가 이미 처리한 뽑기의 결과(수박)를 받고, 뽑기권은 한 번만 썼다.
  expect(screen.getByText('수박 모찌')).toBeOnTheScreen();
  expect(server.state.tickets).toBe(22);
  expect(server.state.drawQueue).toEqual([CROWN]);
});

test('the opening still finishes when the video never reports its end', async () => {
  server.state.drawQueue = [WATERMELON];
  const app = await openApp('/gacha');

  await fireEvent.press(screen.getByRole('button', { name: '1장 · 뽑기권 1' }));
  await settle();
  // Skipping before the result arrives is ignored; after the clip length plus a margin
  // the screen moves on by itself.
  await advance(7500);
  expect(app.getPathname()).toBe('/gacha/opening');
  await advance(1000);
  await afterFlash();
  expect(app.getPathname()).toBe('/gacha/reveal');
});

test('reduced motion skips the opening video', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  server.state.drawQueue = [WATERMELON];
  const app = await openApp('/gacha');

  await fireEvent.press(screen.getByRole('button', { name: '1장 · 뽑기권 1' }));
  await settle();

  expect(openingPlayer().play).not.toHaveBeenCalled();
  expect(openingPlayer().replaceAsync).not.toHaveBeenCalled();
  expect(app.getPathname()).toBe('/gacha/reveal');
});

test.each([2, 3, 4, 5, 6, 7, 8, 9, 10])(
  'a %i-pull plays one highest-tier video then reveals every card without drawing again',
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
    const player = openingPlayer();
    expect(draws()).toHaveLength(1);
    expect(draws()[0].body).toEqual({ count });
    expect(player.replaceAsync).toHaveBeenCalledTimes(1);
    expect(player.replaceAsync).toHaveBeenCalledWith(mythic ? 103 : 102);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.seekBy).not.toHaveBeenCalled();
    // The old common 4.6-second cutoff must not truncate either new reveal.
    await act(async () => player.emit('timeUpdate', { currentTime: 4.6 }));
    expect(app.getPathname()).toBe('/gacha/opening');
    await act(async () => player.emit('playToEnd'));
    await afterFlash();
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
  { cardId: PEACH, source: 102, beats: [1.65, 3.8, 4.12], flashAt: 5.65 },
  { cardId: CROWN, source: 103, beats: [2.4, 3.85, 5.2], flashAt: 6.65 },
] as const)(
  'card $cardId uses its own video haptics and reveal cutoff',
  async ({ cardId, source, beats, flashAt }) => {
    server.state.drawQueue = [cardId];
    await openApp('/gacha');
    const app = await renderRouter(routes, {
      initialUrl: '/gacha/opening?count=1',
    });
    await settle();
    const player = openingPlayer();
    expect(player.replaceAsync).toHaveBeenCalledWith(source);
    for (const currentTime of beats) {
      await act(async () => player.emit('timeUpdate', { currentTime }));
    }
    expect(
      jest.mocked(Haptics.impactAsync).mock.calls.map(([strength]) => strength),
    ).toEqual(['light', 'medium', 'heavy']);
    await act(async () =>
      player.emit('timeUpdate', { currentTime: flashAt - 0.1 }),
    );
    expect(app.getPathname()).toBe('/gacha/opening');
    await act(async () => player.emit('timeUpdate', { currentTime: flashAt }));
    await afterFlash();
    expect(app.getPathname()).toBe('/gacha/reveal');
  },
);

test('video load failure keeps the awarded result and does not draw again', async () => {
  server.state.drawQueue = [PEACH];
  const release = holdDraw();
  const app = await openApp('/gacha/opening?count=1');
  await settle();
  openingPlayer().replaceAsync.mockRejectedValueOnce(
    new Error('video unavailable'),
  );
  await act(async () => release());
  await afterFlash();
  expect(app.getPathname()).toBe('/gacha/reveal');
  expect(draws()).toHaveLength(1);
  expect(server.state.tickets).toBe(22);
  expect(server.state.owned.has(PEACH)).toBe(true);
});

test('skipping a mixed draw repeatedly cannot spend tickets or award shards twice', async () => {
  server.state.drawQueue = [APPLE, CROWN];
  await openApp('/gacha');
  const app = await renderRouter(routes, {
    initialUrl: '/gacha/opening?count=2',
  });
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: '건너뛰기' }));
  await fireEvent.press(screen.getByRole('button', { name: '건너뛰기' }));
  await afterFlash();
  expect(app.getPathname()).toBe('/gacha/results');
  expect(draws()).toHaveLength(1);
  expect(wallet()).toEqual({ tickets: 21, shards: 141 });
});

test('waits for the result and never starts a late-loading video after skipping', async () => {
  let resolveVideo!: () => void;
  server.state.drawQueue = [CROWN];
  const release = holdDraw();
  const app = await openApp('/gacha/opening?count=1');
  await settle();
  const player = openingPlayer();
  await fireEvent.press(screen.getByRole('button', { name: '건너뛰기' }));
  expect(app.getPathname()).toBe('/gacha/opening');
  expect(player.replaceAsync).not.toHaveBeenCalled();
  player.replaceAsync.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        resolveVideo = resolve;
      }),
  );
  await act(async () => release());
  await settle();
  expect(player.replaceAsync).toHaveBeenCalledWith(103);
  expect(player.play).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '건너뛰기' }));
  await afterFlash();
  expect(app.getPathname()).toBe('/gacha/reveal');
  await act(async () => resolveVideo());
  expect(player.play).not.toHaveBeenCalled();
  expect(draws()).toHaveLength(1);
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
  await fireEvent.press(screen.getByRole('button', { name: '전체' }));
  await fireEvent.press(screen.getByRole('button', { name: '수박 모찌 영웅' }));
  await advance(0);
  expect(app.getPathname()).toBe(`/gacha/mochi/${WATERMELON}`);
  expect(
    server.callsTo('POST', '/gacha/collection/seen').map(call => call.body),
  ).toEqual([{ cardIds: [WATERMELON] }]);
  expect(server.state.owned.get(WATERMELON)?.seen).toBe(true);
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
