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
import { tierOrder, tiers } from '@/constants/gacha';
import { mockGachaService, rollMochi } from '@/mocks/services';
import { useMockControls } from '@/mocks/controls';
import { initialGachaState, useGachaStore } from '@/stores/useGachaStore';
import type { PullItem } from '@/types/gacha';

// Jest's default asset transformer maps every video to 1. Distinct IDs catch
// selecting the wrong file even when timing and navigation still look correct.
jest.mock('../assets/gacha/opening-myth.mp4', () => 101);
jest.mock('../assets/gacha/opening-legend.mp4', () => 102);
jest.mock('../assets/gacha/opening-mythic.mp4', () => 103);

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': Tabs,
  '(tabs)/home': Home,
  '(tabs)/calendar': Calendar,
  '(tabs)/search': Search,
  '(tabs)/gacha': Gacha,
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
const advance = async (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
// Feeds rollMochi a fixed sequence: [tier roll, pick roll, tier roll, pick roll, ...].
const sequence = (values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length];
};
const mockPull = (items: PullItem[]) =>
  jest.spyOn(mockGachaService, 'pull').mockResolvedValue(items);
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
// Lets the pull resolve and the opening video start.
const settle = () => advance(10);
// The white flash before the result screen lasts 140 ms.
const afterFlash = () => advance(300);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  // React Native's preset already mocks this method; restoreAllMocks does not
  // reset an existing mock's implementation after the reduced-motion test.
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  setAuthPreview();
  useGachaStore.setState(initialGachaState());
  useMockControls.getState().reset();
});
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('rollMochi', () => {
  test('odds add up to 100% as in the Figma sheet', () => {
    expect(tierOrder.reduce((sum, tier) => sum + tiers[tier].odds, 0)).toBe(
      100,
    );
  });

  test('maps rolls onto tiers and grants duplicate shards per tier', () => {
    // 10 → 일반, 50 → 희귀 (45–75), 80 → 영웅 (75–92).
    const items = rollMochi(
      3,
      ['apple', 'cherry', 'grape'],
      sequence([0.1, 0, 0.5, 0, 0.8, 0.5]),
    );
    expect(items).toEqual([
      { id: 'apple', isNew: false, shards: 1 },
      { id: 'cherry', isNew: false, shards: 2 },
      { id: 'grape', isNew: false, shards: 5 },
    ]);
  });

  test('counts a repeat within the same pull as a duplicate', () => {
    const items = rollMochi(2, [], sequence([0.1, 0.9]));
    expect(items.map(item => [item.id, item.isNew])).toEqual([
      ['mango', true],
      ['mango', false],
    ]);
  });

  test('gives 신화 the unowned mochi first', () => {
    const [item] = rollMochi(1, [], sequence([0.995, 0]));
    expect(item).toEqual({ id: 'strawberry-crown', isNew: true, shards: 0 });
  });
});

test('a new single pull opens, reveals the mochi, and spends one ticket', async () => {
  mockPull([{ id: 'watermelon', isNew: true, shards: 0 }]);
  const app = await renderRouter(routes, { initialUrl: '/gacha' });
  expect(screen.getByText('뽑기권 23')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '1장 · 뽑기권 1' }));
  expect(app.getPathname()).toBe('/gacha/opening');
  await settle();
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
  expect(useGachaStore.getState()).toMatchObject({ tickets: 22, shards: 140 });
  expect(useGachaStore.getState().owned).toContain('watermelon');
});

test('a single duplicate returns home and lands its shards after the flight', async () => {
  mockPull([{ id: 'apple', isNew: false, shards: 1 }]);
  const app = await renderRouter(routes, { initialUrl: '/gacha' });

  await fireEvent.press(screen.getByRole('button', { name: '1장 · 뽑기권 1' }));
  await settle();
  // 일반·희귀만 나오면 떨림 구간을 건너뛰고 3초부터 튼다.
  expect(openingPlayer().seekBy).toHaveBeenCalledWith(3);
  await fireEvent.press(screen.getByRole('button', { name: '건너뛰기' }));
  await afterFlash();

  expect(app.getPathname()).toBe('/gacha');
  expect(useGachaStore.getState().shards).toBe(140);
  await advance(2000);
  expect(useGachaStore.getState()).toMatchObject({
    shards: 141,
    pendingDuplicate: null,
  });
  expect(screen.getByText('별조각 141')).toBeOnTheScreen();
});

test('a 10-pull starts sealed, opens one card, then opens the rest', async () => {
  mockPull(
    Array.from({ length: 10 }, (_, index) => ({
      id: index === 0 ? 'peach' : 'apple',
      isNew: index === 0,
      shards: index === 0 ? 0 : 1,
    })),
  );
  const app = await renderRouter(routes, { initialUrl: '/gacha' });

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
    screen.getByRole('button', { name: '천도복숭아 전설' }),
  ).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '남은 9장 모두 열기' }),
  );
  expect(screen.queryAllByRole('button', { name: '열어보기' })).toHaveLength(0);
  expect(useGachaStore.getState()).toMatchObject({ tickets: 13, shards: 149 });

  await fireEvent.press(
    screen.getByRole('button', { name: '확인 · 도감으로' }),
  );
  expect(app.getPathname()).toBe('/gacha/collection');
});

test('the home buttons follow the ticket count', async () => {
  useGachaStore.setState({ tickets: 3 });
  await renderRouter(routes, { initialUrl: '/gacha' });
  expect(
    screen.getByRole('button', { name: '3장 · 뽑기권 3' }),
  ).toBeOnTheScreen();

  await act(async () => useGachaStore.setState({ tickets: 0 }));
  expect(screen.getByRole('button', { name: '뽑기권 없음' })).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: '1장 · 뽑기권 1' }),
  ).not.toBeOnTheScreen();
});

test('a failed pull keeps the tickets and offers a retry', async () => {
  useMockControls.getState().failNext('gacha');
  const app = await renderRouter(routes, { initialUrl: '/gacha' });

  await fireEvent.press(screen.getByRole('button', { name: '1장 · 뽑기권 1' }));
  // The mock service answers after 600 ms.
  await advance(700);

  // 실패면 개봉 영상을 틀지 않고 바로 안내한다.
  expect(openingPlayer().play).not.toHaveBeenCalled();
  expect(app.getPathname()).toBe('/gacha/failed');
  expect(screen.getByText('다시 시도해 주세요')).toBeOnTheScreen();
  expect(useGachaStore.getState().tickets).toBe(23);
});

test('the opening still finishes when the video never reports its end', async () => {
  mockPull([{ id: 'watermelon', isNew: true, shards: 0 }]);
  const app = await renderRouter(routes, { initialUrl: '/gacha' });

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
  mockPull([{ id: 'watermelon', isNew: true, shards: 0 }]);
  const app = await renderRouter(routes, { initialUrl: '/gacha' });

  await fireEvent.press(screen.getByRole('button', { name: '1장 · 뽑기권 1' }));
  await settle();

  expect(openingPlayer().play).not.toHaveBeenCalled();
  expect(openingPlayer().replaceAsync).not.toHaveBeenCalled();
  expect(app.getPathname()).toBe('/gacha/reveal');
});

test.each([2, 3, 4, 5, 6, 7, 8, 9, 10])(
  'a %i-pull plays one highest-tier video then reveals every card without rerolling',
  async count => {
    const mythic = count % 2 === 1;
    const items: PullItem[] = Array.from({ length: count }, (_, index) => ({
      id:
        index === count - 1 ? (mythic ? 'strawberry-crown' : 'peach') : 'apple',
      isNew: index === count - 1,
      shards: index === count - 1 ? 0 : 1,
    }));
    const pull = mockPull(items);
    const app = await renderRouter(routes, {
      initialUrl: `/gacha/opening?count=${count}`,
    });
    await settle();
    const player = openingPlayer();
    expect(pull).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledWith(count, expect.any(Array));
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
    expect(pull).toHaveBeenCalledTimes(1);
    expect(useGachaStore.getState()).toMatchObject({
      tickets: 23 - count,
      shards: 140 + count - 1,
      lastPull: items,
    });
  },
);

test.each([
  { id: 'peach', source: 102, beats: [1.65, 3.8, 4.12], flashAt: 5.65 },
  {
    id: 'strawberry-crown',
    source: 103,
    beats: [2.4, 3.85, 5.2],
    flashAt: 6.65,
  },
] as const)(
  'the $id video uses its own haptics and reveal cutoff',
  async ({ id, source, beats, flashAt }) => {
    mockPull([{ id, isNew: true, shards: 0 }]);
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
  let resolvePull!: (items: PullItem[]) => void;
  const pull = jest.spyOn(mockGachaService, 'pull').mockImplementation(
    () =>
      new Promise(resolve => {
        resolvePull = resolve;
      }),
  );
  const app = await renderRouter(routes, {
    initialUrl: '/gacha/opening?count=1',
  });
  await settle();
  openingPlayer().replaceAsync.mockRejectedValueOnce(
    new Error('video unavailable'),
  );
  await act(async () => resolvePull([{ id: 'peach', isNew: true, shards: 0 }]));
  await afterFlash();
  expect(app.getPathname()).toBe('/gacha/reveal');
  expect(pull).toHaveBeenCalledTimes(1);
  expect(useGachaStore.getState().tickets).toBe(22);
  expect(useGachaStore.getState().owned).toContain('peach');
});

test('skipping a mixed draw repeatedly cannot spend tickets or award shards twice', async () => {
  const pull = mockPull([
    { id: 'apple', isNew: false, shards: 1 },
    { id: 'strawberry-crown', isNew: true, shards: 0 },
  ]);
  const app = await renderRouter(routes, {
    initialUrl: '/gacha/opening?count=2',
  });
  await settle();
  await fireEvent.press(screen.getByRole('button', { name: '건너뛰기' }));
  await fireEvent.press(screen.getByRole('button', { name: '건너뛰기' }));
  await afterFlash();
  expect(app.getPathname()).toBe('/gacha/results');
  expect(pull).toHaveBeenCalledTimes(1);
  expect(useGachaStore.getState()).toMatchObject({ tickets: 21, shards: 141 });
});

test('waits for the result and never starts a late-loading video after skipping', async () => {
  let resolvePull!: (items: PullItem[]) => void;
  let resolveVideo!: () => void;
  const pull = jest.spyOn(mockGachaService, 'pull').mockImplementation(
    () =>
      new Promise(resolve => {
        resolvePull = resolve;
      }),
  );
  const app = await renderRouter(routes, {
    initialUrl: '/gacha/opening?count=1',
  });
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
  await act(async () =>
    resolvePull([{ id: 'strawberry-crown', isNew: true, shards: 0 }]),
  );
  await settle();
  expect(player.replaceAsync).toHaveBeenCalledWith(103);
  expect(player.play).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: '건너뛰기' }));
  await afterFlash();
  expect(app.getPathname()).toBe('/gacha/reveal');
  await act(async () => resolveVideo());
  expect(player.play).not.toHaveBeenCalled();
  expect(pull).toHaveBeenCalledTimes(1);
  expect(useGachaStore.getState().tickets).toBe(22);
});

test('the odds sheet lists every tier', async () => {
  await renderRouter(routes, { initialUrl: '/gacha' });
  await fireEvent.press(screen.getByRole('button', { name: '확률 보기' }));

  expect(screen.getByText('등급별 획득 확률')).toBeOnTheScreen();
  for (const tier of tierOrder)
    expect(screen.getByText(`${tiers[tier].odds}%`)).toBeOnTheScreen();
});

test('shards buy the cheapest missing mochi (Figma: 수박 50, 140 → 90)', async () => {
  const app = await renderRouter(routes, { initialUrl: '/gacha/collection' });
  expect(
    screen.getAllByRole('button', { name: '아직 못 만난 모찌' }),
  ).toHaveLength(3);

  await fireEvent.press(
    screen.getByRole('button', { name: '✦ 140  ·  별조각으로 모찌 만나기' }),
  );
  expect(screen.getByText('필요한 별조각 50')).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '수박 모찌 교환   ✦ 50' }),
  );
  expect(screen.getByText('−50')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '교환하기' }));
  await advance(500);

  expect(app.getPathname()).toBe('/gacha/exchanged');
  expect(screen.getByText('새로운 만남')).toBeOnTheScreen();
  expect(screen.getByText('✦ 90')).toBeOnTheScreen();
  expect(useGachaStore.getState().owned).toContain('watermelon');
});

test('the tab bar switches between the four tabs', async () => {
  const app = await renderRouter(routes, { initialUrl: '/home' });
  for (const [label, path] of [
    ['캘린더', '/calendar'],
    ['감정 검색', '/search'],
    ['뽑기', '/gacha'],
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
