import { Image } from 'react-native';
import { todayKey } from '@/constants/date';
import type { DiaryEntry } from '@/types/diary';

// Development presentation only; never persist this entry or change the query cache.
export function completedDiaryPreview(
  entry?: DiaryEntry | null,
  date = todayKey(),
  portrait = false,
): DiaryEntry {
  const memo = entry?.memo || '따뜻한 하루를 모찌와 그림으로 남겼어요.';
  return {
    id: 'preview-completed',
    date,
    emotion: 'happy',
    tags: [{ category: 'activity', code: null, label: '그림 그리기' }],
    createdAt: new Date().toISOString(),
    ...entry,
    memo,
    title: memo,
    generation: 'ready',
    status: 'completed',
    failure: null,
    canRequestImage: false,
    imageUrl: Image.resolveAssetSource(
      portrait
        ? require('../../assets/Mozzi_before.png')
        : require('../../assets/figma/warm-evening.png'),
    )!.uri,
  };
}
