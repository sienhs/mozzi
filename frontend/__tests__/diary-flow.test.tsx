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
import Home from '@/app/home';
import Emotion from '@/app/record/emotion';
import Memo from '@/app/record/memo';
import Generation from '@/app/record/generation';
import Calendar from '@/app/calendar';
import Detail from '@/app/diary/[id]';
import Search from '@/app/search';
import Settings from '@/app/settings';
import Dev from '@/app/dev';
import { emptyDraft, useAppStore } from '@/stores/useAppStore';
import { useMockControls } from '@/mocks/controls';
import { createMockEntries } from '@/mocks/diaries';
import { queryClient } from '@/services/queryClient';

const routes = {
  _layout: RootLayout,
  index: Welcome,
  onboarding: Onboarding,
  home: Home,
  'record/emotion': Emotion,
  'record/memo': Memo,
  'record/generation': Generation,
  calendar: Calendar,
  'diary/[id]': Detail,
  search: Search,
  settings: Settings,
  dev: Dev,
};
beforeEach(() => {
  useAppStore.setState({
    profile: null,
    draft: emptyDraft(),
    entries: createMockEntries(),
    saveStatus: 'idle',
    saveError: '',
  });
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

test('logs in, writes a diary, waits on home, and opens the completed entry from the calendar', async () => {
  const app = await renderApp('/');
  await fireEvent.press(
    screen.getByRole('button', { name: 'Google로 시작하기' }),
  );
  await advance(650);
  expect(app.getPathname()).toBe('/onboarding');
  await fireEvent.changeText(screen.getByLabelText('닉네임'), '하루');
  await fireEvent.press(screen.getByRole('button', { name: '시작하기' }));
  expect(app.getPathname()).toBe('/home');
  await fireEvent.press(screen.getByRole('button', { name: '오늘 기록하기' }));
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: '평온' }));
  await fireEvent.press(screen.getByRole('button', { name: '다음' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: '가족' }));
  await fireEvent.changeText(
    screen.getByLabelText('남기고 싶은 한 줄 (선택)'),
    '함께 먹은 저녁',
  );
  await fireEvent.press(screen.getByRole('button', { name: '기록 저장하기' }));
  expect(
    screen.getByRole('button', { name: '저장하고 있어요' }),
  ).toBeDisabled();
  await advance(1000);
  expect(app.getPathname()).toBe('/record/generation');
  await fireEvent.press(
    screen.getByRole('button', { name: '홈에서 기다리기' }),
  );
  expect(app.getPathname()).toBe('/home');
  await advance(6000);
  expect(screen.getByText('오늘도 한 장 남겼어요')).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '캘린더에서 돌아보기' }),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: '10월 26일 월요일 평온' }),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: '10월 26일 월요일 함께 먹은 저녁' }),
  );
  expect(app.getPathname()).toBe('/diary/diary-2026-10-26');
  expect(screen.getByText('함께 먹은 저녁')).toBeOnTheScreen();
}, 30000);

test('calendar empty-day sheet closes and logout removes protected screen access', async () => {
  useAppStore.getState().login('하루');
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
  useAppStore.getState().login('하루');
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
