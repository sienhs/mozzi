import { todayKey, monthCells } from '@/constants/date';
import { createMockEntries } from '@/mocks/diaries';
import { useMockControls } from '@/mocks/controls';
import {
  mockAuthService,
  mockSearchService,
  searchMockEntries,
} from '@/mocks/services';
import { emptyDraft, useAppStore } from '@/stores/useAppStore';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-26T12:00:00Z'));
  useMockControls.getState().reset();
  useAppStore.setState({
    draft: emptyDraft(),
    entries: createMockEntries(),
    saveStatus: 'idle',
    saveError: '',
  });
});
afterEach(async () => {
  await jest.runOnlyPendingTimersAsync();
  jest.useRealTimers();
});

test('keeps the entire draft on save failure, retries once, and finishes generation away from a screen', async () => {
  const store = useAppStore.getState();
  store.selectEmotion('calm');
  store.toggleActivity('가족');
  store.setMemo('맛있는 저녁');
  const draft = useAppStore.getState().draft;
  useMockControls.getState().failNext('save');
  const first = store.saveDiary();
  const duplicate = await store.saveDiary();
  expect(duplicate).toBeNull();
  await jest.advanceTimersByTimeAsync(1000);
  expect(await first).toBeNull();
  expect(useAppStore.getState().draft).toEqual(draft);
  expect(useAppStore.getState().saveStatus).toBe('error');
  const retry = store.saveDiary();
  await jest.advanceTimersByTimeAsync(1000);
  const saved = await retry;
  expect(saved?.generation).toBe('generating');
  expect(useAppStore.getState().draft).toEqual(emptyDraft());
  await jest.advanceTimersByTimeAsync(6000);
  expect(
    useAppStore.getState().entries.find(entry => entry.id === saved?.id),
  ).toMatchObject({
    generation: 'ready',
    memo: '맛있는 저녁',
    activities: ['가족'],
    emotion: 'calm',
  });
  expect(
    useAppStore.getState().entries.filter(entry => entry.date === todayKey()),
  ).toHaveLength(1);
});
test('retains a saved diary when generation fails and retries only the picture', async () => {
  const store = useAppStore.getState();
  store.selectEmotion('sad');
  useMockControls.getState().failNext('generation');
  const save = store.saveDiary();
  await jest.advanceTimersByTimeAsync(1000);
  const entry = (await save)!;
  await jest.advanceTimersByTimeAsync(6000);
  expect(
    useAppStore.getState().entries.find(item => item.id === entry.id)
      ?.generation,
  ).toBe('failed');
  const retry = store.generateImage(entry.id);
  const duplicate = store.generateImage(entry.id);
  expect(duplicate).toBe(retry);
  await jest.advanceTimersByTimeAsync(6000);
  await retry;
  expect(
    useAppStore.getState().entries.filter(item => item.id === entry.id),
  ).toHaveLength(1);
  expect(
    useAppStore.getState().entries.find(item => item.id === entry.id)
      ?.generation,
  ).toBe('ready');
});
test('account reset cancels an in-flight save and restores the demo records', async () => {
  const store = useAppStore.getState();
  store.selectEmotion('happy');
  const original = store.entries;
  const save = store.saveDiary();
  store.resetSession();
  await jest.advanceTimersByTimeAsync(1000);
  expect(await save).toBeNull();
  expect(useAppStore.getState().entries).toEqual(original);
  expect(useAppStore.getState().draft).toEqual(emptyDraft());
});
test('search filters actual mock records by emotion, activity and period, and returns an empty result', () => {
  const entries = createMockEntries();
  const calm = searchMockEntries('마음이 편했던 날을 보여 줘', entries);
  expect(calm.entries).toHaveLength(5);
  expect(calm.entries.every(entry => entry.emotion === 'calm')).toBe(true);
  const family = searchMockEntries('가족과 보낸 날은 언제였어?', entries);
  expect(family.entries.every(entry => entry.activities.includes('가족'))).toBe(
    true,
  );
  expect(searchMockEntries('눈 오는 날 기록 보여 줘', entries).entries).toEqual(
    [],
  );
  expect(searchMockEntries('9월 가족 기록', entries).entries).toEqual([]);
});
test('mock login and search failures are one-shot and recover without a network request', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('Unexpected network request'));
  useMockControls.getState().failNext('login');
  const login = mockAuthService.signIn();
  const rejected = expect(login).rejects.toThrow('로그인을 마치지 못했어요');
  await jest.advanceTimersByTimeAsync(650);
  await rejected;
  const loginRetry = mockAuthService.signIn();
  await jest.advanceTimersByTimeAsync(650);
  await expect(loginRetry).resolves.toEqual({ email: 'haru@gmail.com' });
  useMockControls.getState().failNext('search');
  const search = mockSearchService.search('평온', createMockEntries());
  const failed = expect(search).rejects.toThrow('연결이 잠시');
  await jest.advanceTimersByTimeAsync(700);
  await failed;
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockRestore();
});
test('calendar pads complete weeks and handles leap years and Seoul date boundaries', () => {
  expect(monthCells(2026, 10)).toHaveLength(35);
  expect(monthCells(2026, 10)[4]).toBe('2026-10-01');
  expect(monthCells(2024, 2).filter(Boolean)).toHaveLength(29);
  expect(todayKey(new Date('2026-10-25T15:00:00Z'))).toBe('2026-10-26');
});
