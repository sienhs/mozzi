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
  expect(screen.getByRole('button', { name: '그림 그리기' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('checkbox', { name: '요리' }));
  await fireEvent.press(screen.getByRole('radio', { name: '집' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: '가족' }));
}
async function drawPicture(app: Awaited<ReturnType<typeof renderApp>>) {
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
  await fireEvent.press(screen.getByRole('button', { name: '내 태그 추가' }));
  await fireEvent.changeText(
    screen.getByLabelText('내 태그 입력'),
    '  오므라이스 ',
  );
  await fireEvent.press(screen.getByRole('button', { name: '추가' }));
  await advance(400);
  expect(screen.getByRole('checkbox', { name: '오므라이스' })).toBeChecked();
  await drawPicture(app);
  expect(screen.getByText('요리 · 집 · 가족 · 오므라이스')).toBeOnTheScreen();
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
  expect(screen.getByText('요리 · 집 · 가족 · 오므라이스')).toBeOnTheScreen();
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
