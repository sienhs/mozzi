import type { Emotion } from './diary';
import type { Tier } from './gacha';

// 감정별로 고른 모찌 (GET /members/me의 mozzis). null이면 고르지 않은 감정이라 앱의 기본 모찌를 보여 준다.
export interface Companion {
  cardId: number;
  name: string;
  tier: Tier;
  imageUrl: string;
}
export type EmotionPicks = Record<Emotion, Companion | null>;
export const emptyPicks = (): EmotionPicks => ({
  happy: null,
  calm: null,
  neutral: null,
  sad: null,
  angry: null,
});
// 보유 모찌 화면의 카드 (GET /members/me/mozzis).
export interface OwnedMozzi extends Companion {
  emotion: Emotion;
  acquiredAt: string;
  // 그 감정에 고른 모찌인지.
  equipped: boolean;
}
export type CompanionSort = 'recent' | 'oldest' | 'name';
