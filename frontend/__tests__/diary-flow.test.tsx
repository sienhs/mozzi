import { setAuthPreview } from '@/mocks/authPreview';
import { useRewardStore } from '@/stores/useRewardStore';
import {
  act,
  cleanup,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from 'expo-router/testing-library';
import { router } from 'expo-router';
import { Image, Share } from 'react-native';
import RootLayout from '@/app/_layout';
import Welcome from '@/app/index';
import Onboarding from '@/app/onboarding';
import Tabs from '@/app/(tabs)/_layout';
import Home from '@/app/(tabs)/home';
import Emotion from '@/app/record/emotion';
import Tags from '@/app/record/tags';
import Activity from '@/app/record/activity';
import Generation from '@/app/record/generation';
import Calendar from '@/app/(tabs)/calendar';
import Detail from '@/app/diary/[id]';
import Search from '@/app/(tabs)/search';
import Gacha from '@/app/(tabs)/gacha';
import Settings from '@/app/settings';
import Dev from '@/app/dev';
import { api } from '@/services/api';
import { diaryApi } from '@/services/diaryApi';
import { useAppStore } from '@/stores/useAppStore';
import { useTagStore } from '@/stores/useTagStore';
import { useMockControls } from '@/mocks/controls';
import { queryClient } from '@/services/queryClient';
import {
  createFakeServer,
  fail,
  type FakeServer,
} from '../test-utils/fakeServer';

jest.mock('@/services/authConfig', () => ({
  ...jest.requireActual('@/services/authConfig'),
  getApiBaseUrl: () => 'https://api.example.test/api/v1',
}));

const routes = {
  _layout: RootLayout,
  index: Welcome,
  onboarding: Onboarding,
  '(tabs)/_layout': Tabs,
  '(tabs)/home': Home,
  'record/emotion': Emotion,
  'record/tags': Tags,
  'record/activity': Activity,
  'record/generation': Generation,
  '(tabs)/calendar': Calendar,
  'diary/[id]': Detail,
  '(tabs)/search': Search,
  '(tabs)/gacha': Gacha,
  settings: Settings,
  dev: Dev,
};
const TODAY = '2026-10-26';
let server: FakeServer;
let imageSize: jest.SpyInstance;
beforeEach(() => {
  imageSize = jest
    .spyOn(Image, 'getSize')
    .mockImplementation((_uri, success) => {
      success?.(768, 512);
      return Promise.resolve({ width: 768, height: 512 });
    });
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-26T12:00:00Z'));
  setAuthPreview('signedOut');
  useAppStore.getState().resetSession();
  useTagStore.getState().resetSession();
  useRewardStore.getState().resetSession();
  useMockControls.getState().reset();
  diaryApi.forgetEmoticons();
  queryClient.clear();
  server = createFakeServer(TODAY);
  server.signUpIcons();
  api.defaults.adapter = server.adapter;
});
afterEach(async () => {
  await cleanup();
  imageSize.mockRestore();
  queryClient.clear();
  jest.clearAllTimers();
  jest.useRealTimers();
});
const advance = async (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
async function renderApp(initialUrl: string) {
  const app = await renderRouter(routes, { initialUrl });
  jest.setSystemTime(new Date('2026-10-26T12:00:00Z'));
  await advance(0);
  return app;
}
// 오늘 일기를 서버에 바로 넣는다 (홈 상태별 화면 확인용).
function seedToday(
  image: 'PENDING' | 'SUCCEEDED' | 'FAILED' | null,
  options: { withWhat?: boolean } = {},
) {
  const what = server.ownIcon('요리', 'WHAT');
  const place = server.ownIcon('집', 'WHERE');
  server.state.diaries.push({
    diaryId: 700,
    recordDate: TODAY,
    emotion: 'CALM',
    content: null,
    iconIds:
      options.withWhat === false
        ? [place.myIconId]
        : [what.myIconId, place.myIconId],
  });
  if (image)
    server.state.images.set(700, {
      status: image,
      failures: image === 'FAILED' ? 1 : 0,
      body: {
        weather: 'NONE',
        whereMyIconId: place.myIconId,
        whoMyIconId: null,
        whatMyIconId: what.myIconId,
      },
    });
  return what;
}
// 홈을 다시 그린다 (서버 상태를 바꾼 뒤 새로 연 것처럼).
async function reopenHome() {
  await cleanup();
  queryClient.clear();
  await renderApp('/home');
}

async function chooseDay() {
  await fireEvent.press(screen.getByRole('radio', { name: '평온' }));
  await fireEvent.press(screen.getByRole('button', { name: '다음' }));
  await advance(300);
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('checkbox', { name: '요리' }));
  await fireEvent.press(screen.getByRole('radio', { name: '집' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: '가족' }));
}
async function drawPicture(app: Awaited<ReturnType<typeof renderApp>>) {
  await fireEvent.press(screen.getByRole('button', { name: '다음' }));
  expect(app.getPathname()).toBe('/record/activity');
  expect(screen.getByRole('button', { name: '그림 그리기' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: '요리' }));
  await fireEvent.press(screen.getByRole('button', { name: '그림 그리기' }));
  await advance(0);
  await waitFor(() => expect(app.getPathname()).toBe('/record/generation'));
}

test.each([
  '/home?preview=empty',
  '/home?preview=completed&previewImage=portrait',
  '/home',
])('home never contains a scroll view: %s', async url => {
  const asset = jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({
    uri: 'asset:/diary-preview.png',
    width: 768,
    height: 1280,
    scale: 1,
  });
  setAuthPreview();
  seedToday('PENDING');
  await renderApp(url);
  await screen.findByText('오늘의 한 페이지');
  expect(JSON.stringify(screen.toJSON())).not.toMatch(
    /"type":"[^"]*ScrollView/,
  );
  asset.mockRestore();
});

test('completed preview leaves the pending server diary intact and opens a preview detail', async () => {
  const asset = jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({
    uri: 'asset:/diary-preview.png',
    width: 768,
    height: 512,
    scale: 1,
  });
  setAuthPreview();
  seedToday('PENDING');
  const app = await renderApp('/home?preview=completed');
  await screen.findByLabelText('오늘의 그림일기');
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(server.state.images.get(700)!.status).toBe('PENDING');
  await fireEvent.press(
    screen.getByRole('button', { name: '10월 26일 월요일 그림일기 보기' }),
  );
  expect(app.getPathname()).toBe('/diary/700');
  expect(
    await screen.findByText('따뜻한 하루를 모찌와 그림으로 남겼어요.'),
  ).toBeOnTheScreen();
  expect(server.state.images.get(700)!.status).toBe('PENDING');
  expect(server.callsTo('PATCH', '/diaries/700/content')).toHaveLength(0);
  asset.mockRestore();
}, 20000);

test('completed home uses the server image without the previous diary section', async () => {
  setAuthPreview();
  server.addDiary('2026-10-22', 'HAPPY', '오므라이스를 만들었어', [
    ['요리', 'WHAT'],
  ]);
  const todayId = server.addDiary(TODAY, 'CALM', '산책하며 남긴 하루', [
    ['산책', 'WHAT'],
  ]);
  const app = await renderApp('/home');
  expect(await screen.findByLabelText('오늘의 그림일기')).toBeOnTheScreen();
  expect(screen.queryByText('산책하며 남긴 하루')).toBeNull();
  expect(screen.queryByText('오므라이스를 만들었어')).toBeNull();
  expect(screen.queryByText('지난 기록')).toBeNull();
  expect(screen.getByLabelText('오늘의 그림일기').props.source).toEqual({
    uri: `https://cdn.example.test/diary/${todayId}.webp`,
  });
  expect(screen.getByLabelText('오늘의 그림일기').props.resizeMode).toBe(
    'contain',
  );
  expect(screen.queryByRole('button', { name: '일기 쓰기' })).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: '10월 26일 월요일 그림일기 보기' }),
  );
  expect(app.getPathname()).toBe(`/diary/${todayId}`);
  expect(await screen.findByText('산책하며 남긴 하루')).toBeOnTheScreen();
  expect(server.callsTo('GET', '/home').length).toBeGreaterThan(0);
}, 20000);

test('tags create the diary, the picture is polled until done, and the one-line step shows the server image without faking a save', async () => {
  setAuthPreview();
  server.addDiary('2026-10-22', 'HAPPY', '오므라이스를 만들었어', [
    ['요리', 'WHAT'],
  ]);
  const app = await renderApp('/home');
  await screen.findByRole('button', { name: '일기 쓰기' });
  expect(screen.queryByText('지난 기록')).toBeNull();
  expect(screen.getByLabelText('10월 26일 월요일')).toBeOnTheScreen();
  expect(screen.queryByText('오늘의 일기를 써볼까요?')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '일기 쓰기' }));
  await chooseDay();
  await fireEvent.press(
    screen.getByRole('button', { name: '무엇을 태그 추가' }),
  );
  await fireEvent.changeText(
    screen.getByLabelText('무엇을 태그 입력'),
    '  오므라이스 ',
  );
  await fireEvent.press(screen.getByRole('button', { name: '태그 만들기' }));
  await advance(0);
  expect(screen.getByRole('checkbox', { name: '오므라이스' })).toBeChecked();
  await drawPicture(app);
  const [created] = server.callsTo('POST', '/diaries');
  expect(created.body.content).toBeNull();
  expect(server.callsTo('POST', '/diaries/501/image')).toHaveLength(1);
  expect(await screen.findByText(/모찌가 오늘의 마음을/)).toBeOnTheScreen();
  expect(screen.getByText('요리 · 집 · 가족')).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '홈에서 기다리기' }),
  );
  expect(app.getPathname()).toBe('/home');
  const before = server.callsTo('GET', '/home').length;
  server.finish(501, 'SUCCEEDED');
  await advance(4000);
  expect(server.callsTo('GET', '/home').length).toBeGreaterThan(before);
  expect(await screen.findByLabelText('오늘의 그림일기')).toBeOnTheScreen();
  expect(screen.queryByText('오늘의 모찌를 그리고 있어요')).toBeNull();
  expect(screen.queryByRole('progressbar')).toBeNull();
  // 그림이 끝나면 더 묻지 않는다.
  const settled = server.callsTo('GET', '/home').length;
  await advance(30000);
  expect(server.callsTo('GET', '/home').length).toBe(settled);
  await fireEvent.press(
    screen.getByRole('button', { name: '10월 26일 월요일 그림일기 보기' }),
  );
  expect(app.getPathname()).toBe('/diary/501');
  await fireEvent.press(
    screen.getByRole('button', { name: '한 줄 남기고 저장하기' }),
  );
  expect(app.getPathname()).toBe('/record/generation');
  expect(screen.getByLabelText('오늘의 그림일기').props.source).toEqual({
    uri: 'https://cdn.example.test/diary/501.webp',
  });
  // 빈 한 줄은 서버가 받지 않아 저장할 수 없다. 쓰지 않을 때는 홈으로 나간다.
  expect(screen.getByRole('button', { name: '기록 저장하기' })).toBeDisabled();
  const memo = screen.getByLabelText('오늘의 한 줄 (선택)');
  expect(memo.props.maxLength).toBe(50);
  await fireEvent.changeText(memo, '  퇴근하고 오므라이스를 만들어 먹었어 ');
  await fireEvent.press(screen.getByRole('button', { name: '기록 저장하기' }));
  await advance(0);
  // PATCH /diaries/{id}/content로 한 줄만 넣고, 일기를 다시 만들지 않는다.
  expect(server.callsTo('PATCH', '/diaries/501/content')).toEqual([
    expect.objectContaining({
      body: { content: '퇴근하고 오므라이스를 만들어 먹었어' },
    }),
  ]);
  expect(server.callsTo('POST', '/diaries')).toHaveLength(1);
  expect(await screen.findByText('오늘도 한 장 남겼어요')).toBeOnTheScreen();
  expect(
    screen.getByText('퇴근하고 오므라이스를 만들어 먹었어'),
  ).toBeOnTheScreen();
}, 30000);

test('after the diary is created, back goes home and the tag screens cannot be reopened', async () => {
  setAuthPreview();
  const app = await renderApp('/home');
  await fireEvent.press(
    await screen.findByRole('button', { name: '일기 쓰기' }),
  );
  await chooseDay();
  await drawPicture(app);
  await act(async () => {
    router.back();
  });
  expect(app.getPathname()).toBe('/home');
  await advance(0);
  expect(screen.queryByRole('button', { name: '일기 쓰기' })).toBeNull();
  await act(async () => {
    router.push('/record/tags');
  });
  expect(app.getPathname()).toBe('/record/generation');
  await act(async () => {
    router.push('/record/emotion');
  });
  expect(app.getPathname()).toBe('/record/generation');
}, 30000);

test('home shows each server status: pending, completed with and without a line, failed with and without retries', async () => {
  setAuthPreview();
  seedToday('PENDING');
  await renderApp('/home');
  expect(await screen.findByLabelText('그림 생성 중')).toBeOnTheScreen();
  expect(screen.getByLabelText('그림 생성 중')).toBeOnTheScreen();
  expect(screen.queryByText('오늘의 모찌를 그리고 있어요')).toBeNull();
  expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({
    text: '기록 접수 완료, 그림 그리는 중',
  });
  expect(screen.queryByLabelText('오늘의 그림일기')).toBeNull();
  expect(screen.queryByRole('button', { name: /그림일기 보기/ })).toBeNull();

  server.finish(700, 'SUCCEEDED');
  await reopenHome();
  // 한 줄이 없어도 서버 그림이 완성되면 홈에는 완성 카드를 표시한다.
  expect(await screen.findByLabelText('오늘의 그림일기')).toBeOnTheScreen();
  expect(screen.queryByText('오늘의 모찌를 그리고 있어요')).toBeNull();
  expect(
    screen.getByRole('button', { name: '10월 26일 월요일 그림일기 보기' }),
  ).toBeOnTheScreen();

  server.state.diaries[0].content = '비 오는 날 오므라이스';
  await reopenHome();
  expect(await screen.findByLabelText('오늘의 그림일기')).toBeOnTheScreen();
  expect(screen.queryByText('비 오는 날 오므라이스')).toBeNull();

  server.state.diaries[0].content = null;
  server.state.images.get(700)!.status = 'FAILED';
  await reopenHome();
  expect(
    await screen.findByText('이번 그림은 완성하지 못했어요'),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '다시 그리기' })).toBeOnTheScreen();

  server.state.images.get(700)!.failures = 3;
  await reopenHome();
  expect(
    await screen.findByText('오늘은 그림을 더 그릴 수 없어요'),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '다시 그리기' })).toBeNull();
}, 30000);

test('a lost picture request is recovered with 다시 보내기; without a saved scene the activity is chosen again even with one candidate', async () => {
  setAuthPreview();
  const what = seedToday(null);
  await renderApp('/home');
  expect(
    await screen.findByText('그림 요청이 전달되지 않았어요'),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '다시 보내기' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: '요리' }));
  await fireEvent.press(screen.getByRole('button', { name: '다시 보내기' }));
  await advance(0);
  const [sent] = server.callsTo('POST', '/diaries/700/image');
  expect(sent.body.whatMyIconId).toBe(what.myIconId);
  expect(await screen.findByLabelText('그림 생성 중')).toBeOnTheScreen();
});

test('a diary that lost its activity icon cannot request a picture', async () => {
  setAuthPreview();
  seedToday(null, { withWhat: false });
  await renderApp('/home');
  expect(
    await screen.findByText('지금은 그림을 요청할 수 없어요'),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '다시 보내기' })).toBeNull();
});

test('IMAGE_ALREADY_REQUESTED from another device refreshes home instead of failing', async () => {
  setAuthPreview();
  seedToday('FAILED');
  await renderApp('/home');
  await screen.findByText('이번 그림은 완성하지 못했어요');
  await fireEvent.press(screen.getByRole('radio', { name: '요리' }));
  server.next('POST /diaries/700/image', (_call, config) => {
    server.state.images.get(700)!.status = 'PENDING';
    return fail(config, 409, 'IMAGE_ALREADY_REQUESTED');
  });
  await fireEvent.press(screen.getByRole('button', { name: '다시 그리기' }));
  await advance(0);
  expect(await screen.findByLabelText('그림 생성 중')).toBeOnTheScreen();
  expect(screen.queryByText(/IMAGE_ALREADY_REQUESTED/)).toBeNull();
});

test('first load shows progress, a failed home load offers a retry, and the date change reloads home', async () => {
  setAuthPreview();
  let release!: () => void;
  server.next(
    'GET /home',
    (call, config) =>
      new Promise(resolve => {
        release = () => resolve(server.process(call, config));
      }),
  );
  await renderApp('/home');
  expect(screen.getByText('오늘의 기록을 불러오고 있어요')).toBeOnTheScreen();
  await act(async () => release());
  expect(
    await screen.findByRole('button', { name: '일기 쓰기' }),
  ).toBeOnTheScreen();

  await cleanup();
  queryClient.clear();
  server.next('GET /home', (_call, config) =>
    fail(config, 500, 'INTERNAL_ERROR'),
  );
  await renderApp('/home');
  expect(
    await screen.findByText('오늘의 기록을 불러오지 못했어요'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '다시 불러오기' }));
  expect(
    await screen.findByRole('button', { name: '일기 쓰기' }),
  ).toBeOnTheScreen();
  // 서울 자정이 지나면 다시 읽는다 (지금은 서울 21시).
  const before = server.callsTo('GET', '/home').length;
  await advance(3 * 3_600_000 + 2_000);
  expect(server.callsTo('GET', '/home').length).toBeGreaterThan(before);
}, 20000);

test('detail reads the server diary by date with its image, tags and line, and handles a missing day', async () => {
  setAuthPreview();
  server.addDiary('2026-10-22', 'HAPPY', '오므라이스를 만들었어', [
    ['요리', 'WHAT'],
    ['집', 'WHERE'],
    ['동생', 'WHO'],
  ]);
  const app = await renderApp('/diary/500?date=2026-10-22');
  expect(app.getPathname()).toBe('/diary/500');
  expect(await screen.findByText('오므라이스를 만들었어')).toBeOnTheScreen();
  expect(screen.getByText('요리 · 집 · 동생')).toBeOnTheScreen();
  expect(screen.getByLabelText('오늘의 그림일기').props.source).toEqual({
    uri: 'https://cdn.example.test/diary/500.webp',
  });
  // 그림 주소를 불러오지 못하면 다시 불러오기를 보여 준다.
  await fireEvent(screen.getByLabelText('오늘의 그림일기'), 'error');
  expect(screen.getByText('그림을 불러오지 못했어요')).toBeOnTheScreen();
  await act(async () => {
    router.push({
      pathname: '/diary/[id]',
      params: { id: '999', date: '2026-10-01' },
    });
  });
  expect(await screen.findByText('기록을 찾지 못했어요')).toBeOnTheScreen();
}, 20000);

test('signing in shows the daily visit tickets once and the sheet closes', async () => {
  setAuthPreview();
  server.state.rewardsOn = true;
  await renderApp('/home');
  expect(screen.getByText('뽑기권 10장을 받았어요')).toBeOnTheScreen();
  expect(screen.getByText('지금 뽑기권 30장')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '닫기' }));
  expect(screen.queryByText('뽑기권 10장을 받았어요')).toBeNull();
}, 20000);

test('withdrawal asks first, keeps the session when the server fails, and signs out after it succeeds', async () => {
  setAuthPreview();
  server.next('DELETE /members/me', (_call, config) =>
    fail(config, 500, 'INTERNAL_ERROR', {
      message: '잠시 후 다시 시도해 주세요.',
    }),
  );
  const app = await renderApp('/settings');
  await fireEvent.press(screen.getByRole('button', { name: '회원 탈퇴' }));
  expect(screen.getByText('탈퇴할까요?')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '취소' }));
  expect(server.callsTo('DELETE', '/members/me')).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: '회원 탈퇴' }));
  await fireEvent.press(screen.getByRole('button', { name: '탈퇴하기' }));
  await advance(0);
  expect(screen.getByText('잠시 후 다시 시도해 주세요.')).toBeOnTheScreen();
  expect(app.getPathname()).toBe('/settings');
  await fireEvent.press(screen.getByRole('button', { name: '탈퇴하기' }));
  await advance(0);
  expect(server.state.withdrawn).toBe(true);
  await waitFor(() => expect(app.getPathname()).toBe('/'));
  expect(
    screen.getByRole('button', { name: 'Google로 시작하기' }),
  ).toBeOnTheScreen();
}, 20000);

test('calendar draws the server month, opens a day by date, and retries a failed month', async () => {
  setAuthPreview();
  server.addDiary('2026-10-21', 'SAD', '조금 늦었던 퇴근', [['요리', 'WHAT']]);
  server.addDiary('2026-10-22', 'CALM', null, [['산책', 'WHAT']]);
  server.addDiary('2026-09-30', 'HAPPY', '구월의 마지막 날', [
    ['요리', 'WHAT'],
  ]);
  server.next('GET /diaries/monthly', (_call, config) =>
    fail(config, 500, 'INTERNAL_ERROR'),
  );
  const app = await renderApp('/calendar');
  expect(
    await screen.findByText('이달의 기록을 불러오지 못했어요'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '다시 불러오기' }));
  await advance(0);
  expect(
    screen.getByRole('button', { name: '10월 21일 수요일 우울' }),
  ).toBeOnTheScreen();
  expect(
    server.callsTo('GET', '/diaries/monthly').map(call => call.params),
  ).toEqual([{ yearMonth: '2026-10' }, { yearMonth: '2026-10' }]);
  // 한 줄이 없는 날은 감정 기본 제목을 보여 준다.
  await fireEvent.press(
    screen.getByRole('button', { name: '10월 22일 목요일 평온' }),
  );
  await advance(0);
  expect(screen.getByText('평온 모찌와 남긴 하루')).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '10월 21일 수요일 우울' }),
  );
  await advance(0);
  // 상세 화면으로 넘기지 않고 캘린더 아래에 그날 기록을 펼친다.
  expect(app.getPathname()).toBe('/calendar');
  expect(screen.getByText('조금 늦었던 퇴근')).toBeOnTheScreen();
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  await fireEvent.press(screen.getByRole('button', { name: '기록 공유' }));
  expect(share).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringContaining('조금 늦었던 퇴근'),
    }),
    { dialogTitle: '기록 공유' },
  );
  share.mockRestore();
  await fireEvent.press(screen.getByRole('button', { name: '이전 달' }));
  await advance(0);
  expect(
    screen.getByRole('button', { name: '9월 30일 수요일 행복' }),
  ).toBeOnTheScreen();
  expect(server.callsTo('GET', '/diaries/monthly').at(-1)?.params).toEqual({
    yearMonth: '2026-09',
  });
}, 20000);

test('calendar empty-day sheet closes and logout removes protected screen access', async () => {
  setAuthPreview();
  const app = await renderApp('/calendar');
  await fireEvent.press(
    screen.getByRole('button', { name: '10월 18일 일요일 기록 없음' }),
  );
  expect(screen.getByText('이날은 기록이 없어요')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '닫기' }));
  await act(async () => {
    router.push('/settings');
  });
  await fireEvent.press(screen.getByRole('button', { name: '로그아웃' }));
  await fireEvent.press(
    screen.getAllByRole('button', { name: '로그아웃' }).at(-1)!,
  );
  await waitFor(() => expect(app.getPathname()).toBe('/'));
  expect(
    screen.getByRole('button', { name: 'Google로 시작하기' }),
  ).toBeOnTheScreen();
  await act(async () => {
    router.push('/home');
  });
  expect(app.getPathname()).toBe('/');
}, 20000);

test('search asks the server: suggestions, a failed answer retry, found records, stats and empty results', async () => {
  setAuthPreview();
  server.addDiary('2026-10-21', 'CALM', '공원에서 천천히 걸었어', [
    ['산책', 'WHAT'],
  ]);
  server.addDiary('2026-10-15', 'CALM', null, [['독서', 'WHAT']]);
  server.addDiary('2026-10-10', 'SAD', '조금 늦었던 퇴근', [['요리', 'WHAT']]);
  server.next('POST /emotion-search', (_call, config) =>
    fail(config, 503, 'SEARCH_UNAVAILABLE', {
      message: '지금은 답을 찾지 못했어요. 잠시 후 다시 물어봐 주세요.',
    }),
  );
  const app = await renderApp('/search');
  await fireEvent.press(
    await screen.findByRole('button', { name: '마음이 편했던 날을 보여 줘' }),
  );
  await advance(0);
  expect(screen.getByText('지금은 답을 찾지 못했어요')).toBeOnTheScreen();
  expect(
    screen.getByText('지금은 답을 찾지 못했어요. 잠시 후 다시 물어봐 주세요.'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '다시 물어보기' }));
  await advance(0);
  expect(
    screen.getByText('평온 모찌를 고른 날이 2일 있었어요.'),
  ).toBeOnTheScreen();
  expect(
    server.callsTo('POST', '/emotion-search').map(call => call.body),
  ).toEqual([
    { question: '마음이 편했던 날을 보여 줘' },
    { question: '마음이 편했던 날을 보여 줘' },
  ]);
  // 큰 카드 아래 행에는 큰 카드의 기록을 다시 넣지 않는다. 한 줄이 없으면 감정 기본 제목이다.
  expect(screen.getAllByRole('button', { name: /10월 21일/ })).toHaveLength(1);
  await fireEvent.press(
    screen.getByRole('button', {
      name: '10월 15일 목요일 평온 모찌와 남긴 하루',
    }),
  );
  await advance(0);
  expect(app.getPathname()).toBe('/diary/501');
  await act(async () => {
    router.back();
  });
  await fireEvent.changeText(
    screen.getByLabelText('궁금한 날을 물어보세요'),
    '이번 달엔 어떤 기분이 많았어?',
  );
  await fireEvent.press(screen.getByRole('button', { name: '질문 보내기' }));
  await advance(0);
  expect(
    screen.getByText('평온 모찌를 고른 날이 가장 많았어요.'),
  ).toBeOnTheScreen();
  expect(screen.getByText('2일')).toBeOnTheScreen();
  await fireEvent.changeText(
    screen.getByLabelText('궁금한 날을 물어보세요'),
    '눈 오는 날 기록 보여 줘',
  );
  await fireEvent.press(screen.getByRole('button', { name: '질문 보내기' }));
  await advance(0);
  expect(screen.getByText('찾는 기록이 아직 없어요')).toBeOnTheScreen();
}, 20000);

test('going back keeps context, but removing the chosen activity requires an explicit new choice even for one candidate', async () => {
  setAuthPreview();
  useAppStore.getState().selectEmotion('calm');
  const app = await renderApp('/record/tags');
  await advance(300);
  await fireEvent.press(screen.getByRole('checkbox', { name: '공부' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: '산책' }));
  await fireEvent.press(screen.getByRole('radio', { name: '집' }));
  await fireEvent.press(screen.getByRole('button', { name: '다음' }));
  await fireEvent.press(screen.getByRole('radio', { name: '산책' }));
  await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
  expect(app.getPathname()).toBe('/record/tags');
  await fireEvent.press(screen.getByRole('checkbox', { name: '산책' }));
  expect(useAppStore.getState().draft.mainActivityId).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '다음' }));
  expect(screen.getAllByRole('radio')).toHaveLength(1);
  expect(screen.getByRole('button', { name: '그림 그리기' })).toBeDisabled();
  expect(screen.getByText('어디서 · 집')).toBeOnTheScreen();
});

test('custom tags are saved as server icons per category, and a custom activity can be the image scene', async () => {
  setAuthPreview();
  useAppStore.getState().selectEmotion('happy');
  const app = await renderApp('/record/tags');
  async function add(category: string, name: string) {
    await fireEvent.press(
      screen.getByRole('button', { name: `${category} 태그 추가` }),
    );
    await fireEvent.changeText(
      screen.getByLabelText(`${category} 태그 입력`),
      name,
    );
    await fireEvent.press(screen.getByRole('button', { name: '태그 만들기' }));
    await advance(0);
  }
  await add('무엇을', '악기 연습');
  await fireEvent.press(screen.getByRole('checkbox', { name: '공부' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: '산책' }));
  expect(screen.getByRole('checkbox', { name: '요리' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: '집' }));
  await add('어디서', '연습실');
  expect(screen.getByRole('radio', { name: '연습실' })).toBeSelected();
  await fireEvent.press(screen.getByRole('checkbox', { name: '친구' }));
  await add('누구와', '동아리 친구');
  // 기본 태그는 이미 있으니 만든 태그만 새로 생긴다.
  expect(server.callsTo('POST', '/my-icons')).toHaveLength(3);
  expect(
    server.state.icons.slice(-3).map(icon => [icon.name, icon.category]),
  ).toEqual([
    ['악기 연습', 'WHAT'],
    ['연습실', 'WHERE'],
    ['동아리 친구', 'WHO'],
  ]);
  await fireEvent.press(screen.getByRole('button', { name: '다음' }));
  expect(app.getPathname()).toBe('/record/activity');
  expect(screen.getByText('어디서 · 연습실')).toBeOnTheScreen();
  // 그림에는 처음 고른 동행 한 명만 들어간다.
  expect(screen.getByText('누구와 · 친구')).toBeOnTheScreen();
  expect(
    screen.getByText(/그림에는 처음 고른 동행 한 명이 함께 담겨요/),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: '악기 연습' }));
  await fireEvent.press(screen.getByRole('button', { name: '그림 그리기' }));
  await advance(0);
  await waitFor(() => expect(app.getPathname()).toBe('/record/generation'));
  const icon = (name: string) =>
    server.state.icons.find(item => item.name === name)!.myIconId;
  // 고른 순서대로 붙인다 (만든 태그는 만들 때 바로 골라진다).
  expect(server.callsTo('POST', '/diaries')[0].body.myIconIds).toEqual([
    icon('악기 연습'),
    icon('공부'),
    icon('산책'),
    icon('연습실'),
    icon('친구'),
    icon('동아리 친구'),
  ]);
  const [image] = server.callsTo('POST', '/diaries/500/image');
  expect(image.body).toMatchObject({
    whatMyIconId: icon('악기 연습'),
    whereMyIconId: icon('연습실'),
    whoMyIconId: icon('친구'),
    weather: 'NONE',
  });
}, 30000);
