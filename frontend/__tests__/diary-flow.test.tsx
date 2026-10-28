import { mockDiaryService } from '@/mocks/services';
import { setAuthPreview } from '@/mocks/authPreview';
import {
  act,
  cleanup,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from 'expo-router/testing-library';
import { router } from 'expo-router';
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
import { useAppStore } from '@/stores/useAppStore';
import { useTagStore } from '@/stores/useTagStore';
import { useMockControls } from '@/mocks/controls';
import { queryClient } from '@/services/queryClient';

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
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-26T12:00:00Z'));
  setAuthPreview('signedOut');
  useAppStore.getState().resetSession();
  useTagStore.getState().resetSession();
  useMockControls.getState().reset();
  queryClient.clear();
});
afterEach(async () => {
  await cleanup();
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
  return app;
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
  expect(
    screen.getByRole('button', { name: '그림을 부탁하고 있어요' }),
  ).toBeDisabled();
  await advance(1000);
  expect(app.getPathname()).toBe('/record/generation');
}

test('tags draw the picture first, then the one-line diary is written and saved', async () => {
  setAuthPreview();
  const app = await renderApp('/home');
  await fireEvent.press(screen.getByRole('button', { name: '오늘 기록하기' }));
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  await chooseDay();
  expect(screen.queryByLabelText(/한 줄/)).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: '무엇을 태그 추가' }),
  );
  await fireEvent.changeText(
    screen.getByLabelText('무엇을 태그 입력'),
    '  오므라이스 ',
  );
  await fireEvent.press(screen.getByRole('button', { name: '태그 만들기' }));
  await advance(400);
  expect(screen.getByRole('checkbox', { name: '오므라이스' })).toBeChecked();
  await drawPicture(app);
  expect(screen.getByText('요리 · 집 · 가족')).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '홈에서 기다리기' }),
  );
  expect(app.getPathname()).toBe('/home');
  await advance(6000);
  expect(screen.getByText('그림이 완성됐어요')).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '한 줄 남기고 저장하기' }),
  );
  expect(app.getPathname()).toBe('/record/generation');
  await fireEvent.changeText(
    screen.getByLabelText('오늘의 한 줄 (선택)'),
    '비 오는 날 오므라이스',
  );
  await fireEvent.press(screen.getByRole('button', { name: '기록 저장하기' }));
  await advance(1000);
  expect(screen.getByText('오늘도 한 장 남겼어요')).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '기록 자세히 보기' }),
  );
  expect(app.getPathname()).toBe('/diary/diary-2026-10-26');
  expect(screen.getByText('비 오는 날 오므라이스')).toBeOnTheScreen();
  expect(screen.getByText('요리 · 오므라이스 · 집 · 가족')).toBeOnTheScreen();
}, 30000);

test('after the picture is requested, back goes home and the tag screens cannot be reopened', async () => {
  setAuthPreview();
  const app = await renderApp('/home');
  await fireEvent.press(screen.getByRole('button', { name: '오늘 기록하기' }));
  await chooseDay();
  await drawPicture(app);
  await act(async () => {
    router.back();
  });
  expect(app.getPathname()).toBe('/home');
  expect(screen.queryByRole('button', { name: '오늘 기록하기' })).toBeNull();
  await act(async () => {
    router.push('/record/tags');
  });
  expect(app.getPathname()).toBe('/record/generation');
  await act(async () => {
    router.push('/record/emotion');
  });
  expect(app.getPathname()).toBe('/record/generation');
}, 30000);

test('a blocked picture lets the day be rewritten with the earlier choices filled in', async () => {
  setAuthPreview();
  useMockControls.getState().failNext('generationBlocked');
  const app = await renderApp('/home');
  await fireEvent.press(screen.getByRole('button', { name: '오늘 기록하기' }));
  await chooseDay();
  await drawPicture(app);
  await advance(6000);
  expect(
    screen.getByText('이 내용으로는 그림을 그릴 수 없어요'),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '다시 그리기' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '다시 작성하기' }));
  expect(app.getPathname()).toBe('/record/emotion');
  expect(screen.getByRole('radio', { name: '평온' })).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: '다음' }));
  expect(screen.getByRole('checkbox', { name: '요리' })).toBeChecked();
  expect(screen.getByRole('radio', { name: '집' })).toBeSelected();
  await fireEvent.press(screen.getByRole('radio', { name: '눈' }));
  await drawPicture(app);
  await advance(6000);
  expect(screen.getByText('그림이 완성됐어요')).toBeOnTheScreen();
  expect(screen.getByText('요리 · 집 · 가족 · 눈')).toBeOnTheScreen();
}, 30000);

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

test('search supports suggestions, a failed answer retry, and empty results', async () => {
  setAuthPreview();
  useMockControls.getState().failNext('search');
  await renderApp('/search');
  await fireEvent.press(
    screen.getByRole('button', { name: '마음이 편했던 날을 보여 줘' }),
  );
  await advance(700);
  expect(
    await screen.findByText('지금은 답을 찾지 못했어요'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '다시 물어보기' }));
  await advance(700);
  expect(
    await screen.findByText(/평온 모찌를 고른 날이 5일/),
  ).toBeOnTheScreen();
  await fireEvent.changeText(
    screen.getByLabelText('궁금한 날을 물어보세요'),
    '눈 오는 날 기록 보여 줘',
  );
  await fireEvent.press(screen.getByRole('button', { name: '질문 보내기' }));
  await advance(700);
  expect(await screen.findByText('찾는 기록이 아직 없어요')).toBeOnTheScreen();
}, 20000);

test('three selected activities become candidates, but the image request contains only the explicitly chosen one', async () => {
  setAuthPreview();
  useAppStore.getState().selectEmotion('calm');
  const start = jest.spyOn(mockDiaryService, 'start');
  const app = await renderApp('/record/tags');
  await advance(300);
  expect(screen.queryByRole('header', { name: '내 태그' })).toBeNull();
  for (const name of ['공부', '산책', '식사'])
    await fireEvent.press(screen.getByRole('checkbox', { name }));
  await fireEvent.press(screen.getByRole('radio', { name: '공원' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: '친구' }));
  await fireEvent.press(screen.getByRole('button', { name: '다음' }));
  expect(app.getPathname()).toBe('/record/activity');
  expect(screen.getByText('어디서 · 공원')).toBeOnTheScreen();
  expect(screen.getByText('누구와 · 친구')).toBeOnTheScreen();
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  expect(screen.getByRole('button', { name: '그림 그리기' })).toBeDisabled();
  expect(start).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('radio', { name: '산책' }));
  await fireEvent.press(screen.getByRole('button', { name: '그림 그리기' }));
  expect(start.mock.calls[0][0]).toMatchObject({
    activities: ['WALK'],
    place: 'PARK',
    companions: ['FRIEND'],
    weather: null,
  });
  expect(start.mock.calls[0][1].map(tag => tag.label)).toEqual([
    '공부',
    '산책',
    '식사',
    '공원',
    '친구',
  ]);
  expect(start.mock.calls[0][3]?.map(tag => tag.label)).toEqual([
    '산책',
    '공원',
    '친구',
  ]);
  await advance(1000);
  expect(app.getPathname()).toBe('/record/generation');
  expect(screen.getByText('산책 · 공원 · 친구')).toBeOnTheScreen();
  expect(screen.queryByText('공부 · 산책 · 식사 · 공원 · 친구')).toBeNull();
  start.mockRestore();
});

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

test('each category creates and selects its own custom tags within shared limits, and a custom activity can be the image scene', async () => {
  setAuthPreview();
  useAppStore.getState().selectEmotion('happy');
  const app = await renderApp('/record/tags');
  await advance(300);
  async function add(category: string, name: string) {
    await fireEvent.press(
      screen.getByRole('button', { name: `${category} 태그 추가` }),
    );
    await fireEvent.changeText(
      screen.getByLabelText(`${category} 태그 입력`),
      name,
    );
    await fireEvent.press(screen.getByRole('button', { name: '태그 만들기' }));
    await advance(400);
  }
  await add('무엇을', '악기 연습');
  await fireEvent.press(screen.getByRole('checkbox', { name: '공부' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: '산책' }));
  expect(screen.getByRole('checkbox', { name: '요리' })).toBeDisabled();
  await add('무엇을', '독서 모임');
  expect(screen.getByRole('checkbox', { name: '독서 모임' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: '집' }));
  await add('어디서', '연습실');
  expect(screen.getByRole('radio', { name: '연습실' })).toBeSelected();
  expect(screen.getByRole('radio', { name: '집' })).not.toBeSelected();
  await fireEvent.press(screen.getByRole('checkbox', { name: '친구' }));
  await add('누구와', '동아리 친구');
  expect(screen.getByRole('checkbox', { name: '가족' })).toBeDisabled();
  const library = useTagStore.getState().tags;
  const selectedActivity = library.find(tag => tag.label === '악기 연습')!;
  expect(selectedActivity.category).toBe('activity');
  const selectedPlace = library.find(tag => tag.label === '연습실')!;
  expect(selectedPlace.category).toBe('place');
  const selectedCompanion = library.find(tag => tag.label === '동아리 친구')!;
  expect(selectedCompanion.category).toBe('companion');
  await fireEvent.press(screen.getByRole('button', { name: '다음' }));
  expect(app.getPathname()).toBe('/record/activity');
  expect(screen.queryByRole('radio', { name: '독서 모임' })).toBeNull();
  expect(screen.getByText('어디서 · 연습실')).toBeOnTheScreen();
  expect(screen.getByText('누구와 · 친구 · 동아리 친구')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: '악기 연습' }));
  const start = jest.spyOn(mockDiaryService, 'start');
  await fireEvent.press(screen.getByRole('button', { name: '그림 그리기' }));
  expect(start.mock.calls[0][0]).toMatchObject({
    activities: [],
    customTagIds: [selectedActivity.id, selectedPlace.id, selectedCompanion.id],
    weather: null,
  });
  expect(start.mock.calls[0][3]?.map(tag => tag.label)).toEqual([
    '악기 연습',
    '연습실',
    '친구',
    '동아리 친구',
  ]);
  await advance(1000);
  expect(app.getPathname()).toBe('/record/generation');
  start.mockRestore();
}, 30000);
