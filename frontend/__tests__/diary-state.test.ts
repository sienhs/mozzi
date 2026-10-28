import { allowedRecordDate, monthCells, todayKey } from '@/constants/date';
import { createMockEntries } from '@/mocks/diaries';
import { useMockControls } from '@/mocks/controls';
import {
  mockAuthService,
  mockSearchService,
  searchMockEntries,
} from '@/mocks/services';

// 그림 요청·저장 흐름은 record-session.test.ts에서 검사한다.
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-26T12:00:00Z'));
  useMockControls.getState().reset();
});
afterEach(async () => {
  await jest.runOnlyPendingTimersAsync();
  jest.useRealTimers();
});

test('search filters actual mock records by emotion, activity and period, and returns an empty result', () => {
  const entries = createMockEntries();
  const calm = searchMockEntries('마음이 편했던 날을 보여 줘', entries);
  expect(calm.entries).toHaveLength(5);
  expect(calm.entries.every(entry => entry.emotion === 'calm')).toBe(true);
  const family = searchMockEntries('가족과 보낸 날은 언제였어?', entries);
  expect(family.entries.length).toBeGreaterThan(0);
  expect(
    family.entries.every(entry => entry.tags.some(tag => tag.label === '가족')),
  ).toBe(true);
  // 저장 전(작성 중) 기록은 검색하지 않는다.
  const drafts = entries.map(entry => ({
    ...entry,
    status: 'draft' as const,
  }));
  expect(
    searchMockEntries('가족과 보낸 날은 언제였어?', drafts).entries,
  ).toEqual([]);
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
test('a draft started before midnight keeps its day only until 3 a.m. in Seoul', () => {
  // 2026-10-27 02:30 KST
  expect(
    allowedRecordDate('2026-10-26', new Date('2026-10-26T17:30:00Z')),
  ).toBe('2026-10-26');
  // 2026-10-27 03:10 KST
  expect(
    allowedRecordDate('2026-10-26', new Date('2026-10-26T18:10:00Z')),
  ).toBe('2026-10-27');
  expect(allowedRecordDate(null, new Date('2026-10-26T18:10:00Z'))).toBe(
    '2026-10-27',
  );
});
