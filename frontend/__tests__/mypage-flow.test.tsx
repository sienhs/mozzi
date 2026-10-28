import {
  act,
  cleanup,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import { render } from '@testing-library/react-native';
import { EmotionPicker } from '@/components/emotion/Emotion';
import { CalendarDay } from '@/features/calendar/CalendarScreen';
import { companionEmotionSource } from '@/constants/companions';
import { gachaArt } from '@/constants/gacha';
import { useMockControls } from '@/mocks/controls';
import { emptyDraft, useAppStore } from '@/stores/useAppStore';
import { initialGachaState, useGachaStore } from '@/stores/useGachaStore';
import { setAuthPreview } from '@/mocks/authPreview';
import { useAuthStore } from '@/stores/useAuthStore';

jest.mock('../assets/gacha/mochi-grape.png', () => 501);
jest.mock('../assets/happy.png', () => 502);

const advance = async (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
beforeEach(() => {
  jest.useFakeTimers();
  useMockControls.getState().reset();
  useGachaStore.setState(initialGachaState());
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
  await jest.runOnlyPendingTimersAsync();
  jest.useRealTimers();
});

test('mypage tab opens the page, selecting a card does not equip, and a successful retry returns to the tab', async () => {
  const app = await renderRouter('./src/app', { initialUrl: '/home' });
  expect(screen.queryByRole('button', { name: '마이페이지' })).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: '마이페이지' }));
  expect(app.getPathname()).toBe('/mypage');
  expect(screen.getByRole('tab', { name: '마이페이지' })).toBeSelected();
  expect(screen.getByText('테스트 님')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '설정' })).toBeNull();
  expect(screen.queryByRole('button', { name: '로그아웃' })).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: '내 모찌 변경하기' }),
  );
  expect(app.getPathname()).toBe('/mypage/owned');
  expect(screen.queryByText('6종 보유')).toBeNull();
  expect(screen.getByText('6종')).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: '보유 모찌' })).toHaveStyle({
    fontSize: 28,
  });
  await fireEvent.press(screen.getByRole('button', { name: '포도 모찌' }));
  expect(app.getPathname()).toBe('/mypage/mochi/grape');
  expect(useGachaStore.getState().equippedId).toBe('default');
  useMockControls.getState().failNext('equip');
  await fireEvent.press(
    screen.getByRole('button', { name: '이 모찌 장착하기' }),
  );
  await advance(450);
  expect(
    screen.getByText('모찌를 장착하지 못했어요. 다시 시도해 주세요.'),
  ).toBeOnTheScreen();
  expect(useGachaStore.getState().equippedId).toBe('default');
  await fireEvent.press(
    screen.getByRole('button', { name: '이 모찌 장착하기' }),
  );
  await advance(450);
  expect(app.getPathname()).toBe('/mypage');
  expect(useGachaStore.getState().equippedId).toBe('grape');
  expect(screen.getByText('장착 완료!')).toBeOnTheScreen();
  await advance(3000);
  expect(screen.queryByText('장착 완료!')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: '뽑기' }));
  expect(screen.getByLabelText('유리병 속 기본 모찌').props.source).toBe(
    gachaArt.mochi,
  );
  expect(useGachaStore.getState().equippedId).toBe('grape');
}, 30000);

test('profile card opens settings and back returns to the selected mypage tab', async () => {
  const app = await renderRouter('./src/app', { initialUrl: '/mypage' });
  expect(screen.getAllByRole('tab')).toHaveLength(5);
  expect(screen.getByRole('tab', { name: '마이페이지' })).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: '설정으로 이동' }));
  expect(app.getPathname()).toBe('/settings');
  expect(screen.getByRole('button', { name: '프로필 정보' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
  expect(app.getPathname()).toBe('/mypage');
  expect(screen.getByRole('tab', { name: '마이페이지' })).toBeSelected();
}, 20000);

test('owned filters combine, cancel preserves selection, and empty filters can be reset', async () => {
  await renderRouter('./src/app', { initialUrl: '/mypage/owned' });
  await fireEvent.press(
    screen.getByRole('button', { name: '카테고리 · 전체' }),
  );
  await fireEvent.press(screen.getByRole('radio', { name: '할로윈' }));
  await fireEvent.press(screen.getByRole('button', { name: '필터 닫기' }));
  expect(
    screen.getByRole('button', { name: '카테고리 · 전체' }),
  ).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '카테고리 · 전체' }),
  );
  await fireEvent.press(screen.getByRole('radio', { name: '과일' }));
  await fireEvent.press(screen.getByRole('button', { name: '적용하기' }));
  await fireEvent.press(screen.getByRole('button', { name: '등급 · 전체' }));
  await fireEvent.press(screen.getByRole('radio', { name: '영웅' }));
  await fireEvent.press(screen.getByRole('button', { name: '적용하기' }));
  await fireEvent.changeText(screen.getByLabelText('모찌 이름 검색'), '포도');
  expect(screen.getByRole('button', { name: '포도 모찌' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '사과 모찌' })).toBeNull();
  await fireEvent.changeText(
    screen.getByLabelText('모찌 이름 검색'),
    '없는 모찌',
  );
  expect(screen.getByText('조건에 맞는 모찌가 없어요.')).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: '검색·필터 초기화' }),
  );
  expect(
    screen.getByRole('button', { name: '기본 모찌, 장착 중' }),
  ).toBeOnTheScreen();
}, 30000);

test('picker uses the current companion while legacy calendar cells keep the default image', async () => {
  useGachaStore.setState({ equippedId: 'grape' });
  await render(<EmotionPicker value="happy" onChange={jest.fn()} />);
  expect(screen.getByLabelText('행복 모찌').props.source).toBe(501);
  await cleanup();
  await render(
    <CalendarDay
      date="2026-10-01"
      selected={false}
      onPress={jest.fn()}
      entry={{
        id: 'legacy',
        date: '2026-10-01',
        emotion: 'happy',
        tags: [],
        memo: '',
        title: '기록',
        createdAt: '',
        generation: 'ready',
        status: 'completed',
        failure: null,
      }}
    />,
  );
  expect(screen.getByLabelText('행복 모찌').props.source).toBe(
    companionEmotionSource('default', 'happy', true),
  );
  expect(screen.getByLabelText('행복 모찌').props.source).toBe(502);
});

test('unowned detail routes cannot equip and unauthenticated users cannot open mypage', async () => {
  await renderRouter('./src/app', {
    initialUrl: '/mypage/mochi/strawberry-crown',
  });
  expect(screen.getByText('보유한 모찌를 선택해 주세요')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: '이 모찌 장착하기' })).toBeNull();
  await cleanup();
  setAuthPreview('signedOut');
  const app = await renderRouter('./src/app', { initialUrl: '/mypage' });
  expect(app.getPathname()).toBe('/');
});
