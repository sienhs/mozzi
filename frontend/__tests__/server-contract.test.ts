import { canResend, canRetry, entryPhase } from '@/stores/useAppStore';
import { toDiaryEntry } from '@/features/diary/serverDiary';
import {
  msUntilNextSeoulDay,
  pollDelay,
} from '@/features/diary/useDiaryQueries';
import { parseHome, type DiaryDetail } from '@/types/server';

const TODAY = '2026-10-26';
const diary = (patch: Partial<DiaryDetail> = {}): DiaryDetail => ({
  diaryId: 102,
  recordDate: TODAY,
  emoticonId: 2,
  emotion: 'CALM',
  content: null,
  myIcons: {
    WHAT: [
      {
        myIconId: 30,
        name: '요리',
        category: 'WHAT',
        createdAt: '2026-10-26T09:00:00+09:00',
      },
      {
        myIconId: 31,
        name: '악기 연습',
        category: 'WHAT',
        createdAt: '2026-10-26T09:00:00+09:00',
      },
    ],
    WHERE: [
      {
        myIconId: 15,
        name: '집',
        category: 'WHERE',
        createdAt: '2026-10-26T09:00:00+09:00',
      },
    ],
    WHO: [],
  },
  image: null,
  createdAt: '2026-10-26T21:12:00+09:00',
  updatedAt: '2026-10-26T21:12:00+09:00',
  ...patch,
});
const home = (patch: Record<string, unknown> = {}) => ({
  today: TODAY,
  todayStatus: 'IMAGE_NOT_REQUESTED',
  todayDiary: diary(),
  canRequestImage: true,
  recentDiary: null,
  ...patch,
});

test('home responses are validated, including null diaries and status mismatches', () => {
  expect(
    parseHome(home({ todayStatus: 'NOT_RECORDED', todayDiary: null })),
  ).toMatchObject({ todayDiary: null, recentDiary: null });
  expect(() => parseHome(home({ todayStatus: 'NOT_RECORDED' }))).toThrow();
  expect(() =>
    parseHome(home({ todayStatus: 'COMPLETED', todayDiary: null })),
  ).toThrow();
  expect(() => parseHome(home({ todayStatus: 'DONE' }))).toThrow();
  // 완성된 그림에 주소가 없으면 샘플 그림으로 대신하지 않는다.
  expect(() =>
    parseHome(
      home({
        todayStatus: 'COMPLETED',
        todayDiary: diary({ image: { status: 'SUCCEEDED', imageUrl: null } }),
      }),
    ),
  ).toThrow();
});

test('server diaries map to the screen model for every picture status', () => {
  const map = (detail: DiaryDetail, canRequestImage = true) =>
    toDiaryEntry(detail, { today: TODAY, canRequestImage });
  const notRequested = map(diary());
  expect(notRequested).toMatchObject({
    id: '102',
    serverId: 102,
    date: TODAY,
    emotion: 'calm',
    memo: '',
    title: '평온 모찌와 남긴 하루',
    generation: 'notRequested',
    status: 'draft',
  });
  // 기본 태그와 같은 이름은 기본 태그로, 나머지는 내 태그로 보인다.
  expect(notRequested.tags).toEqual([
    { category: 'activity', code: 'COOKING', label: '요리' },
    { category: 'activity', code: null, label: '악기 연습', customTagId: '31' },
    { category: 'place', code: 'HOME', label: '집' },
  ]);
  expect(entryPhase(notRequested, false)).toBe('notRequested');
  expect(canResend(notRequested)).toBe(true);
  expect(canResend(map(diary(), false))).toBe(false);

  const pending = map(diary({ image: { status: 'PENDING', imageUrl: null } }));
  expect(entryPhase(pending, false)).toBe('generating');

  const failed = map(diary({ image: { status: 'FAILED', imageUrl: null } }));
  expect(entryPhase(failed, false)).toBe('failed');
  expect(canRetry(failed)).toBe(true);
  expect(
    canRetry(
      map(diary({ image: { status: 'FAILED', imageUrl: null } }), false),
    ),
  ).toBe(false);

  // 서버 COMPLETED(그림 완성)라도 한 줄이 없으면 작성 완료가 아니다.
  const ready = map(
    diary({ image: { status: 'SUCCEEDED', imageUrl: 'https://cdn/x.webp' } }),
  );
  expect(ready).toMatchObject({
    generation: 'ready',
    imageUrl: 'https://cdn/x.webp',
    status: 'draft',
  });
  expect(entryPhase(ready, false)).toBe('reviewing');
  const written = map(
    diary({
      content: '비 오는 날',
      image: { status: 'SUCCEEDED', imageUrl: 'https://cdn/x.webp' },
    }),
  );
  expect(entryPhase(written, false)).toBe('completed');
  expect(written.title).toBe('비 오는 날');

  // 지난 기록은 더 고칠 수 없다: 한 줄이 없어도 완료로 보고 다시 그리지 않는다.
  const past = toDiaryEntry(
    diary({
      recordDate: '2026-10-20',
      image: { status: 'FAILED', imageUrl: null },
    }),
    { today: TODAY, canRequestImage: true },
  );
  expect(past.status).toBe('completed');
  expect(canRetry(past)).toBe(false);
});

test('picture polling slows down over time and the day rolls over at Seoul midnight', () => {
  expect(pollDelay(0)).toBe(4000);
  expect(pollDelay(2 * 60_000)).toBe(10000);
  expect(pollDelay(30 * 60_000)).toBe(30000);
  // 2026-10-26 21:00 서울 → 3시간 뒤 자정.
  expect(msUntilNextSeoulDay(new Date('2026-10-26T12:00:00Z'))).toBe(
    3 * 3_600_000,
  );
});
