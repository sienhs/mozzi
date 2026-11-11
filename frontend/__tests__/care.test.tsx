import { setAuthPreview } from '@/mocks/authPreview';
import {
  act,
  cleanup,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import { AccessibilityInfo, Image as RNImage } from 'react-native';
import RootLayout from '@/app/_layout';
import Tabs from '@/app/(tabs)/_layout';
import Home from '@/app/(tabs)/home';
import Gacha from '@/app/(tabs)/gacha';
import Care from '@/app/care';
import { api } from '@/services/api';
import { queryClient } from '@/services/queryClient';
import { rewardApi } from '@/services/rewardApi';
import { useRewardStore } from '@/stores/useRewardStore';
import { useAppStore } from '@/stores/useAppStore';
import {
  buildPlayLayout,
  PLAY_CONTACT,
  PLAY_THROW_END,
  sampleScene,
  touchingBallX,
} from '@/features/care/careChoreography';
import {
  compileExpressionTable,
  EXPRESSIONS,
  visibleLayers,
} from '@/features/care/careExpressions';
import { fitSkin, playSize, stageBands } from '@/features/care/careGeometry';
import {
  acceptsInput,
  initialCareState,
  reduceCare,
  type CareEffect,
  type CareEvent,
  type CareState,
} from '@/features/care/careController';
import { careKeyFromUrl, resolveCareSkin } from '@/features/care/careSkin';
import {
  careExpressionSources,
  careShapes,
} from '@/features/care/careAssets.generated';
import { useCareRewardStore } from '@/features/care/useCareRewards';
import { emotions } from '@/constants/emotions';
import {
  createFakeServer,
  fail,
  type FakeServer,
} from '../test-utils/fakeServer';

jest.mock('@/services/authConfig', () => ({
  ...jest.requireActual('@/services/authConfig'),
  getApiBaseUrl: () => 'https://api.example.test/api/v1',
}));

const S3 = 'https://bucket.example.test';
const WATERMELON = `${S3}/GACHA/S2-04-01_mozzi_epic_016_happy.png`;

describe('skin lookup by card file name', () => {
  test('card, thumbnail and basic image addresses map to their keys', () => {
    expect(careKeyFromUrl(WATERMELON)).toBe('S2-04-01_mozzi_epic_016_happy');
    expect(
      careKeyFromUrl(`${S3}/GACHA/thumb/S2-04-01_mozzi_epic_016_happy.webp`),
    ).toBe('S2-04-01_mozzi_epic_016_happy');
    expect(careKeyFromUrl(`${S3}/basic/calm.png`)).toBe('basic-calm');
    expect(careKeyFromUrl('https://elsewhere.test/a.png')).toBeNull();
  });

  test('a known card uses its thumbnail, falls back to the original, and gets its face layers', () => {
    const skin = resolveCareSkin(
      { name: '수박 모찌', imageUrl: WATERMELON },
      'happy',
    );
    expect(skin.key).toBe('S2-04-01_mozzi_epic_016_happy');
    expect(skin.source).toEqual({
      uri: `${S3}/GACHA/thumb/S2-04-01_mozzi_epic_016_happy.webp`,
    });
    expect(skin.fallbackSource).toEqual({ uri: WATERMELON });
    expect(skin.geometry.profile).toHaveLength(24);
    expect(skin.expressions?.layers.map(layer => layer.id)).toEqual([
      'mouth-closed',
      'mouth-small',
      'mouth-wide',
      'blush',
    ]);
    expect(skin.expressions?.anchors.mouth).toBeTruthy();
  });

  test('no pick or the basic card shows the bundled default mochi', () => {
    const none = resolveCareSkin(null, 'happy');
    expect(none.key).toBe('basic-happy');
    expect(none.name).toBe('기본 모찌');
    expect(none.source).toBe(emotions.happy.source);
    expect(none.expressions).not.toBeNull();
    const basic = resolveCareSkin(
      { name: '기본 모찌 (평온)', imageUrl: `${S3}/basic/calm.png` },
      'happy',
    );
    expect(basic.key).toBe('basic-calm');
    // 평온 기본 모찌는 아직 표정 레이어가 없어 공통 동작만 한다.
    expect(basic.expressions).toBeNull();
  });

  test('an unknown card still plays with typical bounds and no face layers', () => {
    const skin = resolveCareSkin(
      { name: '새 모찌', imageUrl: `${S3}/GACHA/ZZ-99-01_new.png` },
      'sad',
    );
    expect(skin.expressions).toBeNull();
    expect(skin.geometry.profile).toBeUndefined();
    expect(skin.geometry.bounds!.width).toBeGreaterThan(500);
  });

  test('the generated table is consistent', () => {
    expect(Object.keys(careShapes).length).toBeGreaterThanOrEqual(325);
    for (const [key, row] of Object.entries(careShapes)) {
      expect(row).toHaveLength(5 + 24 * 2);
      expect(row[3]! > 0 && row[4]! > 0).toBe(true);
      expect(key).toMatch(/^(basic-\w+|[A-Z0-9]+-\d{2}-\d{2}_mozzi_.+)$/);
    }
    for (const [key, set] of Object.entries(careExpressionSources)) {
      expect(careShapes[key]).toBeDefined();
      for (const layer of set.layers) {
        expect(layer.x).toBeGreaterThanOrEqual(0);
        expect(layer.y).toBeGreaterThanOrEqual(0);
        expect(layer.x + layer.width).toBeLessThanOrEqual(1);
        expect(layer.y + layer.height).toBeLessThanOrEqual(1);
      }
      for (const clip of Object.values(set.expressions))
        for (const frame of clip!.frames)
          for (const id of frame.layers)
            expect(set.layers.map(layer => layer.id)).toContain(id);
      expect(
        Object.keys(set.expressions).every(name =>
          (EXPRESSIONS as readonly string[]).includes(name),
        ),
      ).toBe(true);
    }
  });

  test('chewing alternates mouth layers; neutral shows the original', () => {
    const table = compileExpressionTable(
      resolveCareSkin({ name: '수박', imageUrl: WATERMELON }, 'happy')
        .expressions,
    );
    const chew = EXPRESSIONS.indexOf('eat-chew');
    const masks = new Set(
      [0, 100, 160, 300].map(t => visibleLayers(table, chew, t)),
    );
    expect(masks.size).toBeGreaterThan(1);
    expect(visibleLayers(table, EXPRESSIONS.indexOf('neutral'), 0)).toBe(0);
  });
});

describe('play contact on real card shapes', () => {
  const keys = [
    ...Object.keys(careExpressionSources),
    'HW-01-01_mozzi_mythic_011_happy',
    'S1-01-01_mozzi_mythic_001_happy_r2',
  ];
  test.each(keys)('%s meets the ball at its silhouette edge', key => {
    const skin = resolveCareSkin(
      key.startsWith('basic-')
        ? null
        : { name: key, imageUrl: `${S3}/GACHA/${key}.png` },
      'happy',
    );
    for (const width of [300, 340, 706]) {
      const frame = fitSkin(
        skin.geometry,
        width,
        360,
        playSize(skin.geometry, width, 360),
      );
      const bands = stageBands(skin.geometry, frame);
      const origin = { x: frame.left + frame.width / 2, y: frame.baseline };
      const play = buildPlayLayout({
        stageWidth: width,
        floor: frame.baseline,
        origin,
        bands,
        radius: 20,
        round: 0,
        reduced: false,
      });
      expect(play.clearance).toBe(true);
      const layout = {
        origin,
        play,
        reduced: false,
        feed: { from: origin, target: origin, attached: false, radius: 0 },
      };
      const contact = sampleScene('play', PLAY_CONTACT, layout);
      const moved = bands.map(b => ({
        ...b,
        left: b.left + contact.x,
        right: b.right + contact.x,
      }));
      expect(
        Math.abs(
          touchingBallX(moved, play.contactBall.y, 20, 1) - contact.propX,
        ),
      ).toBeLessThan(0.5);
      // 접촉 전에는 공이 돌아오지 않는다.
      let last = -Infinity;
      for (let t = PLAY_THROW_END; t <= PLAY_CONTACT; t += 20) {
        const x = sampleScene('play', t, layout).propX;
        expect(x).toBeGreaterThanOrEqual(last - 1e-9);
        last = x;
      }
    }
  });
});

describe('care controller', () => {
  function run(events: CareEvent[], from: CareState = initialCareState()) {
    let state = from;
    const effects: CareEffect[] = [];
    for (const event of events) {
      const next = reduceCare(state, event);
      state = next.state;
      effects.push(...next.effects);
    }
    return {
      state,
      effects,
      completes: effects.filter(e => e.type === 'complete'),
    };
  }
  const lastTimer = (effects: CareEffect[]) =>
    effects.filter(e => e.type === 'timer').at(-1) as Extract<
      CareEffect,
      { type: 'timer' }
    >;

  test('three real throws complete play once; taps during a flight and repeats do not count', () => {
    let state = initialCareState('play');
    let completes = 0;
    for (let round = 1; round <= 3; round++) {
      const thrown = run(
        [{ type: 'throw' }, { type: 'throw' }, { type: 'throw' }],
        state,
      );
      expect(thrown.effects).toHaveLength(1);
      const id = lastTimer(thrown.effects).interactionId;
      const ended = run(
        [
          { type: 'scene-end', interactionId: id },
          { type: 'scene-end', interactionId: id },
        ],
        thrown.state,
      );
      completes += ended.completes.length;
      expect(ended.state.round).toBe(round);
      state = ended.state;
    }
    expect(completes).toBe(1);
    expect(state.phase).toBe('reward');
    expect(acceptsInput(state, 'play')).toBe(false);
  });

  test('a cancel (app hidden, mode change) voids the pending scene', () => {
    const fed = run([{ type: 'feed' }], initialCareState('feed'));
    const cancelled = run(
      [
        { type: 'cancel' },
        {
          type: 'scene-end',
          interactionId: lastTimer(fed.effects).interactionId,
        },
      ],
      fed.state,
    );
    expect(cancelled.completes).toHaveLength(0);
    expect(cancelled.state.phase).toBe('idle');
  });

  test('the assisted stroke ignores pointer completion and completes once on its timer', () => {
    const assisted = run(
      [{ type: 'pet-assist' }, { type: 'pet-end', completed: true }],
      initialCareState('pet'),
    );
    expect(assisted.completes).toHaveLength(0);
    const done = run(
      [
        {
          type: 'scene-end',
          interactionId: lastTimer(assisted.effects).interactionId,
        },
      ],
      assisted.state,
    );
    expect(done.completes).toEqual([{ type: 'complete', action: 'pet' }]);
  });
});

describe('screens', () => {
  const routes = {
    _layout: RootLayout,
    '(tabs)/_layout': Tabs,
    '(tabs)/home': Home,
    '(tabs)/gacha': Gacha,
    care: Care,
  };
  const TODAY = '2026-10-26';
  let server: FakeServer;
  const advance = async (ms: number) =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });
  const careCalls = () => server.callsTo('POST', '/rewards/care');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-26T03:00:00Z'));
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
    jest.spyOn(RNImage, 'getSize').mockImplementation((_uri, success) => {
      success?.(768, 512);
      return Promise.resolve({ width: 768, height: 512 });
    });
    setAuthPreview();
    useAppStore.getState().resetSession();
    useRewardStore.getState().resetSession();
    useCareRewardStore.setState({ owner: '', outcomes: {} });
    queryClient.clear();
    server = createFakeServer(TODAY);
    server.signUpIcons();
    api.defaults.adapter = server.adapter;
  });
  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  async function openCare(url: string) {
    const app = await renderRouter(routes, { initialUrl: url });
    await advance(0);
    // 무대 크기와 그림 로드(jest에는 없는 레이아웃·이미지 이벤트)를 흉내 낸다.
    await act(async () => {
      fireEvent(screen.getByTestId('mochi-stage'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 340, height: 360 } },
      });
    });
    await act(async () => {
      fireEvent(screen.getByLabelText('기본 모찌'), 'load', {
        nativeEvent: {
          cacheType: 'none',
          source: { url: 'asset', width: 600, height: 600, mediaType: null },
        },
      });
    });
    return app;
  }

  test('home shows the entry for a recorded day and opens the care screen with today’s mochi', async () => {
    const what = server.ownIcon('요리', 'WHAT');
    const place = server.ownIcon('집', 'WHERE');
    server.state.diaries.push({
      diaryId: 700,
      recordDate: TODAY,
      emotion: 'CALM',
      content: null,
      iconIds: [what.myIconId, place.myIconId],
    });
    server.state.images.set(700, {
      status: 'SUCCEEDED',
      failures: 0,
      body: {
        weather: 'NONE',
        whereMyIconId: place.myIconId,
        whoMyIconId: null,
        whatMyIconId: what.myIconId,
      },
    });
    const app = await renderRouter(routes, { initialUrl: '/home' });
    await advance(0);
    await fireEvent.press(screen.getByTestId('home-care-entry'));
    expect(app.getPathname()).toBe('/care');
    expect(app.getSearchParams()).toMatchObject({ emotion: 'calm' });
    expect(screen.getByText('모찌랑 놀기')).toBeOnTheScreen();
  });

  test('home hides the entry before today is recorded', async () => {
    await renderRouter(routes, { initialUrl: '/home' });
    await advance(0);
    expect(screen.queryByTestId('home-care-entry')).toBeNull();
  });

  test('feeding (keyboard path) pays 2 tickets once a day and shows the reward', async () => {
    server.state.tickets = 20;
    await openCare('/care?emotion=happy');
    expect(screen.getByTestId('care-mochi-name')).toHaveTextContent(
      '기본 모찌',
    );
    await fireEvent.press(screen.getByTestId('care-mode-feed'));
    expect(screen.getByTestId('care-status')).toHaveTextContent(
      '간식을 모찌 입으로 가져가 주세요',
    );
    await fireEvent.press(screen.getByTestId('dock-cookie'));
    // 장면 중에는 다시 줄 수 없다.
    expect(screen.queryByTestId('dock-cookie')).toBeNull();
    await advance(4400 + 50);
    expect(careCalls()).toHaveLength(1);
    expect(careCalls()[0]!.body).toEqual({ action: 'FEED' });
    expect(screen.getByText('뽑기권 2장을 받았어요')).toBeOnTheScreen();
    expect(
      screen.getByText('모찌에게 간식을 준 선물이에요.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('닫기'));
    await advance(1600);
    expect(
      screen.getByLabelText(/간식 주기, 오늘 보상 받음/),
    ).toBeOnTheScreen();

    // 같은 날 다시 끝내면 지급 없이 안내만 한다.
    await fireEvent.press(screen.getByTestId('dock-cookie'));
    await advance(4400 + 50);
    expect(careCalls()).toHaveLength(2);
    expect(screen.queryByText(/뽑기권 \d+장을 받았어요/)).toBeNull();
    expect(screen.getByTestId('care-status')).toHaveTextContent(
      /오늘은 이미 받았어요/,
    );
    expect(server.state.tickets).toBe(22);
  });

  test('play pays after the third throw only', async () => {
    await openCare('/care?emotion=happy');
    await fireEvent.press(screen.getByTestId('care-mode-play'));
    for (let round = 1; round <= 3; round++) {
      await fireEvent.press(screen.getByTestId('throw-ball'));
      await advance(2500 + 50);
      if (round < 3) {
        expect(careCalls()).toHaveLength(0);
        expect(screen.getByTestId('care-status')).toHaveTextContent(
          new RegExp(`${round}/3$`),
        );
      }
    }
    expect(careCalls()).toHaveLength(1);
    expect(careCalls()[0]!.body).toEqual({ action: 'PLAY' });
    expect(screen.getByText('뽑기권 2장을 받았어요')).toBeOnTheScreen();
  });

  test('a failed reward call can be retried without replaying', async () => {
    server.next('POST /rewards/care', (_call, config) =>
      fail(config, 503, 'SERVICE_UNAVAILABLE'),
    );
    await openCare('/care?emotion=happy');
    await fireEvent.press(screen.getByTestId('pet-assist'));
    await advance(2400 + 1500 + 100);
    expect(screen.getByTestId('care-status')).toHaveTextContent(
      '뽑기권을 확인하지 못했어요',
    );
    await fireEvent.press(screen.getByRole('button', { name: '다시 받기' }));
    await advance(0);
    expect(careCalls()).toHaveLength(2);
    expect(screen.getByText('뽑기권 2장을 받았어요')).toBeOnTheScreen();
  });

  test('rewardApi.care rejects a malformed response', async () => {
    server.next('POST /rewards/care', (_call, config) => ({
      data: { granted: 'yes' },
      config,
      status: 200,
      statusText: '200',
      headers: {},
    }));
    await expect(rewardApi.care('PET')).rejects.toBeTruthy();
  });
});
