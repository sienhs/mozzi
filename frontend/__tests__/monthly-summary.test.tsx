import { render, screen } from '@testing-library/react-native';
import {
  getMonthlySummary,
  MonthlySummary,
} from '@/components/calendar/MonthlySummary';
import type { DiaryEntry, Emotion } from '@/types/diary';

const entry = (date: string, emotion: Emotion = 'happy'): DiaryEntry => ({
  id: date,
  date,
  emotion,
  tags: [],
  memo: '',
  title: '일기',
  createdAt: `${date}T00:00:00+09:00`,
  generation: 'ready',
  status: 'completed',
  failure: null,
});

test('monthly summary counts unique days, filters months and future dates, and finds the longest streak', () => {
  const entries = [
    entry('2026-09-30'),
    entry('2026-10-01'),
    entry('2026-10-02'),
    entry('2026-10-02'),
    entry('2026-10-03', 'calm'),
    entry('2026-10-05', 'sad'),
    entry('2026-10-28'),
    entry('2026-11-01'),
  ];
  expect(getMonthlySummary(entries, '2026-10', '2026-10-27')).toEqual({
    recordedDays: 4,
    topEmotion: '행복',
    longestStreak: 3,
  });
});

test('monthly summary handles ties and months without records', () => {
  expect(
    getMonthlySummary(
      [entry('2026-10-01'), entry('2026-10-03', 'calm')],
      '2026-10',
      '2026-10-27',
    ).topEmotion,
  ).toBe('공동 1위');
  expect(getMonthlySummary([], '2026-10', '2026-10-27')).toEqual({
    recordedDays: 0,
    topEmotion: '기록 없음',
    longestStreak: 0,
  });
});

test('monthly summary updates when the displayed month changes', async () => {
  const entries = [entry('2026-10-01'), entry('2026-09-01', 'calm')];
  const result = await render(
    <MonthlySummary entries={entries} monthKey="2026-10" today="2026-10-27" />,
  );
  expect(screen.getByText('행복')).toBeOnTheScreen();
  await result.rerender(
    <MonthlySummary entries={entries} monthKey="2026-09" today="2026-10-27" />,
  );
  expect(screen.getByText('평온')).toBeOnTheScreen();
  expect(screen.queryByText('행복')).toBeNull();
});

test('a picture still waiting for its save is not counted as a recorded day', () => {
  const draft = { ...entry('2026-10-04', 'angry'), status: 'draft' as const };
  expect(
    getMonthlySummary(
      [entry('2026-10-03'), draft, entry('2026-10-05')],
      '2026-10',
      '2026-10-27',
    ),
  ).toEqual({ recordedDays: 2, topEmotion: '행복', longestStreak: 1 });
});
