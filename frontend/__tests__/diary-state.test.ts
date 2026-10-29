import { allowedRecordDate, monthCells, todayKey } from '@/constants/date';
import { useMockControls } from '@/mocks/controls';
import { mockAuthService } from '@/mocks/services';

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

test('mock login failures are one-shot and recover without a network request', async () => {
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
