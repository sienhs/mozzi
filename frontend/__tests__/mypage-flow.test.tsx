import {
  act,
  cleanup,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import { render } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { EmotionPicker } from '@/components/emotion/Emotion';
import { CalendarDay } from '@/features/calendar/CalendarScreen';
import { emotionOrder, emotions } from '@/constants/emotions';
import { emptyDraft, useAppStore } from '@/stores/useAppStore';
import { useGachaStore } from '@/stores/useGachaStore';
import { setAuthPreview } from '@/mocks/authPreview';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/services/api';
import { mozziKeys } from '@/services/mozziApi';
import { queryClient } from '@/services/queryClient';
import { todayKey } from '@/constants/date';
import { emptyPicks } from '@/types/companion';
import type { DiaryEntry } from '@/types/diary';
import {
  createFakeServer,
  fail,
  type FakeServer,
} from '../test-utils/fakeServer';

jest.mock('@/services/authConfig', () => ({
  ...jest.requireActual('@/services/authConfig'),
  getApiBaseUrl: () => 'https://api.example.test/api/v1',
}));
const defaultAdapter = api.defaults.adapter;
// 카드 표 (test-utils/fakeServer): 201 수박(행복) · 202 사과(평온) · 204 딸기 왕관(우울, 신화) · 205 체리(우울).
const owned = (cardIds: number[]) => {
  for (const cardId of cardIds)
    server.state.owned.set(cardId, {
      count: 1,
      seen: true,
      at: `2026-10-${20 + cardId - 200}T09:00:00+09:00`,
    });
};
let server: FakeServer;
const advance = async (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
async function openApp(url: string) {
  const app = await renderRouter('./src/app', { initialUrl: url });
  await advance(0);
  return app;
}
beforeEach(() => {
  jest.useFakeTimers();
  queryClient.clear();
  server = createFakeServer(todayKey());
  owned([201, 202, 204, 205]);
  api.defaults.adapter = server.adapter;
  useGachaStore.getState().resetSession();
  setAuthPreview();
  useAuthStore.setState({
    member: { memberId: 0, nickname: '테스트', email: 'test@example.com' },
  });
  useAppStore.setState({
    draft: emptyDraft(),
    saveStatus: 'idle',
  });
});
afterEach(async () => {
  await cleanup();
  queryClient.clear();
  api.defaults.adapter = defaultAdapter;
  await jest.runOnlyPendingTimersAsync();
  jest.useRealTimers();
});

test('mypage tab shows server picks; a refused equip keeps the pick and a retry returns to the tab', async () => {
  const app = await openApp('/home');
  await fireEvent.press(screen.getByRole('tab', { name: '마이페이지' }));
  await advance(0);
  expect(app.getPathname()).toBe('/mypage');
  expect(screen.getByRole('tab', { name: '마이페이지' })).toBeSelected();
  expect(screen.getByText('테스트 님')).toBeOnTheScreen();
  expect(screen.getAllByText('기본 모찌')).toHaveLength(5);
  expect(screen.getByRole('button', { name: '설정' })).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '행복 모찌 변경하기' }),
  );
  await advance(0);
  expect(app.getPathname()).toBe('/mypage/owned');
  // 행복 카드만 행복에 장착할 수 있다.
  expect(screen.getByText('1종')).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: '보유 모찌' })).toHaveStyle({
    fontSize: 28,
  });
  expect(server.callsTo('GET', '/members/me/mozzis').at(-1)?.params).toEqual({
    sort: 'RECENT',
    emotion: 'HAPPY',
  });
  await fireEvent.press(screen.getByRole('button', { name: '수박 모찌' }));
  await advance(0);
  expect(app.getPathname()).toBe('/mypage/mochi/201');
  server.next('PUT /members/me/mozzis/HAPPY', (_call, config) =>
    fail(config, 500, 'INTERNAL_ERROR', {
      message: '잠시 후 다시 시도해 주세요.',
    }),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: '행복에 장착하기' }),
  );
  await advance(0);
  expect(screen.getByText('잠시 후 다시 시도해 주세요.')).toBeOnTheScreen();
  expect(server.state.picks.get('HAPPY')).toBeUndefined();
  await fireEvent.press(
    screen.getByRole('button', { name: '행복에 장착하기' }),
  );
  await advance(0);
  expect(app.getPathname()).toBe('/mypage');
  expect(server.state.picks.get('HAPPY')).toBe(201);
  expect(
    server.callsTo('PUT', '/members/me/mozzis/HAPPY').at(-1)?.body,
  ).toEqual({ cardId: 201 });
  expect(screen.getByText('장착 완료!')).toBeOnTheScreen();
  expect(screen.getAllByText('수박 모찌').length).toBeGreaterThan(0);
  await advance(3000);
  expect(screen.queryByText('장착 완료!')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: '뽑기' }));
  expect(app.getPathname()).toBe('/gacha');
  expect(screen.getByRole('tab', { name: '뽑기' })).toBeSelected();
  expect(screen.getByRole('button', { name: '확률 보기' })).toBeOnTheScreen();
  expect(server.callsTo('POST', '/gacha/draws')).toHaveLength(0);
}, 30000);

test('settings gear opens settings while profile card is static, and back returns to mypage', async () => {
  const app = await openApp('/mypage');
  expect(screen.getAllByRole('tab')).toHaveLength(5);
  expect(screen.getByRole('tab', { name: '마이페이지' })).toBeSelected();
  expect(screen.queryByRole('button', { name: '설정으로 이동' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '설정' }));
  expect(app.getPathname()).toBe('/settings');
  expect(screen.getByRole('button', { name: '프로필 정보' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '프로필 정보' }));
  expect(
    screen.getByText('닉네임은 가입 후 변경할 수 없어요.'),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('textbox', { name: '닉네임' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '확인' }));
  await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
  expect(app.getPathname()).toBe('/mypage');
  expect(screen.getByRole('tab', { name: '마이페이지' })).toBeSelected();
}, 20000);

test('mypage opens the mochi collection and back returns to mypage', async () => {
  const app = await openApp('/mypage');
  await fireEvent.press(screen.getByRole('button', { name: '모찌 도감' }));
  await advance(0);
  expect(app.getPathname()).toBe('/gacha/collection');
  await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
  expect(app.getPathname()).toBe('/mypage');
}, 20000);

test('owned filters go to the server, closing a sheet keeps the old filter, and empty results can be reset', async () => {
  await openApp('/mypage/owned?emotion=sad');
  expect(screen.getByRole('button', { name: '체리 모찌' })).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: '딸기 왕관 모찌' }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '등급 · 전체' }));
  await fireEvent.press(screen.getByRole('radio', { name: '영웅' }));
  await fireEvent.press(screen.getByRole('button', { name: '필터 닫기' }));
  expect(screen.getByRole('button', { name: '등급 · 전체' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '등급 · 전체' }));
  await fireEvent.press(screen.getByRole('radio', { name: '신화' }));
  await fireEvent.press(screen.getByRole('button', { name: '적용하기' }));
  await advance(0);
  expect(server.callsTo('GET', '/members/me/mozzis').at(-1)?.params).toEqual({
    sort: 'RECENT',
    emotion: 'SAD',
    tier: 'MYTHIC',
  });
  expect(screen.queryByRole('button', { name: '체리 모찌' })).toBeNull();
  expect(
    screen.getByRole('button', { name: '딸기 왕관 모찌' }),
  ).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('모찌 이름 검색'), '체리');
  await advance(0);
  expect(screen.getByText('조건에 맞는 모찌가 없어요.')).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '검색·필터 초기화' }),
  );
  await advance(0);
  expect(screen.getByRole('button', { name: '체리 모찌' })).toBeOnTheScreen();
}, 30000);

test('the emotion picker shows the mochi picked for each emotion and the default for the rest', async () => {
  const picks = emptyPicks();
  picks.happy = {
    cardId: 201,
    name: '수박 모찌',
    tier: 'epic',
    imageUrl: 'https://cdn.example.test/cards/S2-04-01.png',
  };
  queryClient.setQueryData(mozziKeys.picks(0), picks);
  await render(
    <QueryClientProvider client={queryClient}>
      <EmotionPicker value="happy" onChange={jest.fn()} />
    </QueryClientProvider>,
  );
  expect(screen.getByLabelText('행복 모찌').props.source[0]).toEqual({
    uri: 'https://cdn.example.test/cards/S2-04-01.png',
  });
  expect(screen.getByLabelText('보통 모찌').props.source[0]).toBe(
    emotions.neutral.source,
  );
});

test('calendar cells always use the default small face of the emotion', async () => {
  for (const emotion of emotionOrder) {
    const entry: DiaryEntry = {
      id: 'recorded',
      date: '2026-10-01',
      emotion,
      tags: [],
      memo: '',
      title: '기록',
      createdAt: '',
      generation: 'ready',
      status: 'completed',
      failure: null,
    };
    await render(
      <CalendarDay
        date="2026-10-01"
        selected={false}
        onPress={jest.fn()}
        entry={entry}
      />,
    );
    expect(
      screen.getByLabelText(`${emotions[emotion].label} 모찌`).props.source[0],
    ).toBe(emotions[emotion].face);
    await cleanup();
  }
});

test('emotion chosen on mypage is carried through the owned list to the pick', async () => {
  const app = await openApp('/mypage');
  await fireEvent.press(
    screen.getByRole('button', { name: `${emotions.sad.label} 모찌 변경하기` }),
  );
  await advance(0);
  expect(
    screen.getByRole('radio', { name: `${emotions.sad.label} 장착 설정` }),
  ).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: '체리 모찌' }));
  await advance(0);
  await fireEvent.press(
    screen.getByRole('button', { name: `${emotions.sad.label}에 장착하기` }),
  );
  await advance(0);
  expect(app.getPathname()).toBe('/mypage');
  expect(server.state.picks.get('SAD')).toBe(205);
  expect(server.state.picks.get('HAPPY')).toBeUndefined();
}, 30000);

test('an unowned card cannot be equipped and unauthenticated users cannot open mypage', async () => {
  server.state.owned.delete(204);
  await openApp('/mypage/mochi/204');
  expect(screen.getByText('보유한 모찌를 선택해 주세요')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /장착하기/ })).toBeNull();
  await cleanup();
  setAuthPreview('signedOut');
  const app = await renderRouter('./src/app', { initialUrl: '/mypage' });
  expect(app.getPathname()).toBe('/');
});
