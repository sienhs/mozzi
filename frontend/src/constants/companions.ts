import type { ImageSource } from 'expo-image';
import { emotions } from './emotions';
import type { Emotion } from '@/types/diary';
import type { Companion } from '@/types/companion';

// 감정에 모찌를 고르지 않았으면 앱에 든 기본 모찌를 보여 준다.
export const DEFAULT_COMPANION_NAME = '기본 모찌';
export const companionName = (companion: Companion | null | undefined) =>
  companion?.name ?? DEFAULT_COMPANION_NAME;
// 고른 모찌는 카드 자체가 그 감정의 그림이다(카드마다 감정이 하나).
export function companionEmotionSource(
  companion: Companion | null | undefined,
  emotion: Emotion,
  small = false,
): ImageSource | number {
  if (companion) return { uri: companion.imageUrl };
  return small ? emotions[emotion].face : emotions[emotion].source;
}
