import { legacyActivityTag } from '@/constants/tags';
import type { DiaryEntry, Emotion } from '@/types/diary';

const sampleDays: [number, Emotion][] = [
  [1, 'happy'],
  [2, 'calm'],
  [5, 'neutral'],
  [6, 'sad'],
  [8, 'calm'],
  [9, 'happy'],
  [12, 'angry'],
  [13, 'neutral'],
  [14, 'calm'],
  [15, 'happy'],
  [16, 'calm'],
  [19, 'sad'],
  [20, 'neutral'],
  [21, 'sad'],
  [22, 'calm'],
];
// 개편 전에 남긴 기록처럼 활동 라벨(업무·휴식·가족·취미)로 만든다. 취미는 새 체계에 대응이 없어 legacy로 남는다.
export const createMockEntries = (): DiaryEntry[] =>
  sampleDays.map(([day, emotion]) => {
    const date = `2026-10-${String(day).padStart(2, '0')}`;
    const title =
      day === 22
        ? '퇴근하고 오므라이스를 만들어 먹었어'
        : day === 21
          ? '조금 늦었던 퇴근'
          : day === 16
            ? '공원에서 천천히 걸었어'
            : '모찌와 함께 남긴 작은 하루';
    const labels =
      day === 21 ? ['업무'] : emotion === 'calm' ? ['휴식', '가족'] : ['취미'];
    return {
      id: `diary-${date}`,
      date,
      emotion,
      title,
      tags: labels.map(legacyActivityTag),
      memo: day === 22 ? `${title}. 케첩으로 웃는 얼굴도 그렸다.` : title,
      createdAt: `${date}T21:12:00+09:00`,
      generation: 'ready',
      status: 'completed',
      failure: null,
    };
  });
