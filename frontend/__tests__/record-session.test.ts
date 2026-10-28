import { presetTag } from '@/constants/tags';
import { useMockControls } from '@/mocks/controls';
import { createMockEntries } from '@/mocks/diaries';
import { mockDiaryService } from '@/mocks/services';
import {
  canRetry,
  canRewrite,
  emptyDraft,
  isDraftLocked,
  useAppStore,
} from '@/stores/useAppStore';
import { useTagStore } from '@/stores/useTagStore';

const tag = (id: string) => presetTag(id)!;
const TODAY = '2026-10-26';
const today = () =>
  useAppStore.getState().entries.find(entry => entry.date === TODAY);
const store = () => useAppStore.getState();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-26T12:00:00Z'));
  useMockControls.getState().reset();
  useAppStore.getState().resetSession();
  useTagStore.getState().resetSession();
});
afterEach(async () => {
  await jest.runOnlyPendingTimersAsync();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function pickDay() {
  store().selectEmotion('calm');
  store().toggleTag(tag('activity.cooking'));
  store().toggleTag(tag('place.home'));
  store().toggleTag(tag('companion.family'));
}
async function requestPicture() {
  const pending = store().startGeneration();
  await jest.advanceTimersByTimeAsync(1000);
  return (await pending)!;
}
async function finishPicture() {
  await jest.advanceTimersByTimeAsync(6000);
}

test('one tap sends one picture request built from tags alone, and a finished picture is not yet a saved record', async () => {
  const start = jest.spyOn(mockDiaryService, 'start');
  pickDay();
  const first = store().startGeneration();
  expect(await store().startGeneration()).toBeNull();
  await jest.advanceTimersByTimeAsync(1000);
  const entry = (await first)!;
  expect(start).toHaveBeenCalledTimes(1);
  expect(start.mock.calls[0][0]).toEqual({
    recordDate: TODAY,
    emotion: 'calm',
    activities: ['COOKING'],
    place: 'HOME',
    companions: ['FAMILY'],
    weather: null,
    customTagIds: [],
  });
  await finishPicture();
  expect(today()).toMatchObject({
    id: entry.id,
    generation: 'ready',
    status: 'draft',
    memo: '',
  });
  expect(store().entries.filter(item => item.date === TODAY)).toHaveLength(1);
});

test('once the picture is requested the mood and tags are locked, so the record keeps the tags it was drawn with', async () => {
  pickDay();
  await requestPicture();
  expect(isDraftLocked(store())).toBe(true);
  store().toggleTag(tag('activity.eating'));
  store().selectEmotion('happy');
  expect(store().draft).toMatchObject({
    emotion: 'calm',
    tags: { activities: ['activity.cooking'] },
  });
  expect(await store().startGeneration()).toBeNull();
  await finishPicture();
  expect(today()?.tags.map(item => item.label)).toEqual(['요리', '집', '가족']);
});

test('a request that fails before it is accepted keeps the choices and resends with the same key; a changed choice gets a new key', async () => {
  const start = jest.spyOn(mockDiaryService, 'start');
  useMockControls.getState().failNext('start');
  pickDay();
  expect(await requestPicture()).toBeNull();
  expect(store().requestStatus).toBe('error');
  expect(isDraftLocked(store())).toBe(false);
  expect(store().draft.tags.activities).toEqual(['activity.cooking']);
  useMockControls.getState().failNext('start');
  expect(await requestPicture()).toBeNull();
  expect(start.mock.calls[1][2]).toBe(start.mock.calls[0][2]);
  store().toggleTag(tag('weather.rainy'));
  const saved = await requestPicture();
  expect(start.mock.calls[2][2]).not.toBe(start.mock.calls[1][2]);
  expect(saved.tags.map(item => item.label)).toContain('비');
});

test('the line is optional; saving happens once and keeps the line after a failed attempt', async () => {
  const complete = jest.spyOn(mockDiaryService, 'complete');
  pickDay();
  const entry = await requestPicture();
  await finishPicture();
  store().setMemo('비 오는 날 가족이랑 오므라이스');
  useMockControls.getState().failNext('complete');
  const first = store().completeDiary(entry.id);
  expect(await store().completeDiary(entry.id)).toBeNull();
  await jest.advanceTimersByTimeAsync(1000);
  expect(await first).toBeNull();
  expect(store().saveStatus).toBe('error');
  expect(store().draft.memo).toBe('비 오는 날 가족이랑 오므라이스');
  expect(today()?.status).toBe('draft');
  const retry = store().completeDiary(entry.id);
  await jest.advanceTimersByTimeAsync(1000);
  expect(await retry).toMatchObject({
    status: 'completed',
    memo: '비 오는 날 가족이랑 오므라이스',
    title: '비 오는 날 가족이랑 오므라이스',
  });
  expect(complete).toHaveBeenCalledTimes(2);
  expect(complete.mock.calls[1][2]).toBe(complete.mock.calls[0][2]);
  expect(store().draft).toEqual(emptyDraft());
});

test('a record without a line is saved with the fallback title', async () => {
  pickDay();
  const entry = await requestPicture();
  await finishPicture();
  const save = store().completeDiary(entry.id);
  await jest.advanceTimersByTimeAsync(1000);
  expect(await save).toMatchObject({
    status: 'completed',
    memo: '',
    title: '평온 모찌와 남긴 하루',
  });
});

test('the line keeps at most three lines and 100 characters', () => {
  store().setMemo('하나\n둘\n셋\n넷');
  expect(store().draft.memo).toBe('하나\n둘\n셋');
  store().setMemo('가'.repeat(120));
  expect(store().draft.memo).toHaveLength(100);
});

test('a temporary failure redraws with the same tags, repeated taps share one retry, and it never offers rewriting', async () => {
  const retry = jest.spyOn(mockDiaryService, 'retry');
  useMockControls.getState().failNext('generation');
  pickDay();
  const entry = await requestPicture();
  await finishPicture();
  const failed = today()!;
  expect(failed.generation).toBe('failed');
  expect(canRetry(failed)).toBe(true);
  expect(canRewrite(failed)).toBe(false);
  expect(store().reopenDraft(entry.id)).toBe(false);
  const first = store().generateImage(entry.id);
  expect(store().generateImage(entry.id)).toBe(first);
  await finishPicture();
  await first;
  expect(retry).toHaveBeenCalledTimes(1);
  expect(today()).toMatchObject({ generation: 'ready', failure: null });
  expect(today()?.tags).toEqual(failed.tags);
});

test('redrawing stops when the daily retries are used up, without opening a rewrite', async () => {
  pickDay();
  useMockControls.getState().failNext('generation');
  const entry = await requestPicture();
  await finishPicture();
  for (let attempt = 0; attempt < 3; attempt++) {
    useMockControls.getState().failNext('generation');
    const retry = store().generateImage(entry.id);
    await finishPicture();
    await retry;
  }
  const spent = today()!;
  expect(spent.failure?.remainingRetries).toBe(0);
  expect(canRetry(spent)).toBe(false);
  expect(canRewrite(spent)).toBe(false);
});

test('a blocked picture reopens the day with the earlier choices; the fixed choices redraw the same record', async () => {
  const added = useTagStore.getState().add('오므라이스');
  await jest.advanceTimersByTimeAsync(400);
  const result = await added;
  if (result.kind !== 'custom') throw new Error('custom tag not created');
  const rewrite = jest.spyOn(mockDiaryService, 'rewrite');
  useMockControls.getState().failNext('generationBlocked');
  pickDay();
  store().selectCustomTag(result.id);
  const entry = await requestPicture();
  await finishPicture();
  const blocked = today()!;
  expect(blocked.failure).toMatchObject({ retryable: false });
  expect(blocked.failure?.blockedTags.map(item => item.label)).toEqual([
    '오므라이스',
  ]);
  expect(canRetry(blocked)).toBe(false);
  expect(store().reopenDraft(entry.id)).toBe(true);
  expect(isDraftLocked(store())).toBe(false);
  expect(store().draft).toMatchObject({
    emotion: 'calm',
    memo: '',
    tags: {
      activities: ['activity.cooking'],
      place: 'place.home',
      companions: ['companion.family'],
      custom: [result.id],
    },
  });
  store().toggleCustomTag(result.id);
  store().toggleTag(tag('weather.rainy'));
  await requestPicture();
  await finishPicture();
  expect(rewrite).toHaveBeenCalledTimes(1);
  expect(store().entries.filter(item => item.date === TODAY)).toHaveLength(1);
  expect(today()).toMatchObject({ generation: 'ready', status: 'draft' });
  expect(today()?.tags.map(item => item.label)).toEqual([
    '요리',
    '집',
    '가족',
    '비',
  ]);
  expect(isDraftLocked(store())).toBe(true);
});

test('an account reset discards late picture, save and custom-tag results', async () => {
  pickDay();
  const entry = await requestPicture();
  useAppStore.getState().resetSession();
  await finishPicture();
  expect(store().entries).toEqual(createMockEntries());
  // 저장 도중의 초기화
  pickDay();
  const second = await requestPicture();
  await finishPicture();
  const save = store().completeDiary(second.id);
  useAppStore.getState().resetSession();
  await jest.advanceTimersByTimeAsync(1000);
  expect(await save).toBeNull();
  expect(store().entries.find(item => item.id === entry.id)).toBeUndefined();
  // 내 태그 추가 도중의 초기화
  const added = useTagStore.getState().add('비밀 태그');
  useTagStore.getState().resetSession();
  await jest.advanceTimersByTimeAsync(400);
  expect(await added).toEqual({ kind: 'none' });
  expect(useTagStore.getState().tags).toEqual([]);
});
